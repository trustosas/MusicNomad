import { refreshAccessToken } from '@/lib/auth/spotify'
import crypto from 'crypto'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type PlaylistProgress = {
  playlistId: string
  playlistName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  total: number
  added: number
  message?: string
  error?: string
}

export type TransferJobState = {
  id: string
  status: JobStatus
  createdAt: number
  updatedAt: number
  logs: string[]
  items: PlaylistProgress[]
}

export type StartTransferInput = {
  playlists: { id: string; name: string }[]
  auth: {
    sourceAccessToken: string
    sourceRefreshToken?: string
    destAccessToken: string
    destRefreshToken?: string
  }
}

const jobs = new Map<string, TransferJobState>()

function log(job: TransferJobState, line: string) {
  job.logs.push(line)
  job.updatedAt = Date.now()
}

async function ensureToken(current: string | undefined, refresh?: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (current) return current
  if (refresh && clientId) {
    try {
      const refreshed = await refreshAccessToken({ refresh_token: refresh, client_id: clientId })
      return refreshed.access_token
    } catch {
      return null
    }
  }
  return null
}

async function spotifyMe(token: string) {
  const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch Spotify user')
  return res.json() as Promise<{ id: string }>
}

async function fetchPlaylistDetails(token: string, playlistId: string) {
  if (playlistId === 'liked_songs') {
    return { id: 'liked_songs', name: 'Liked Songs', description: '' }
  }
  const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=id,name,description,images(total,height,width,url)`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to get playlist details')
  return res.json() as Promise<{ id: string; name: string; description?: string; images?: { url: string; width?: number; height?: number }[] }>
}

async function fetchPlaylistTrackUris(token: string, playlistId: string): Promise<string[]> {
  const uris: string[] = []
  if (playlistId === 'liked_songs') {
    let nextUrl: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50'
    while (nextUrl) {
      const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch liked songs')
      const data = await res.json()
      for (const item of data.items || []) {
        const track = item.track
        if (track && track.uri) uris.push(track.uri as string)
      }
      nextUrl = data.next
    }
    return uris
  }
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`
  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to fetch playlist tracks')
    const data = await res.json()
    for (const item of data.items || []) {
      const track = item.track
      if (track && track.uri) uris.push(track.uri as string)
    }
    nextUrl = data.next
  }
  return uris
}

async function createDestinationPlaylist(token: string, name: string, description?: string) {
  const res = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || '' }),
  })
  if (!res.ok) throw new Error('Failed to create destination playlist')
  return res.json() as Promise<{ id: string }>
}

async function setPlaylistCover(token: string, playlistId: string, imageUrl?: string) {
  if (!imageUrl) return
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return
    const contentType = imgRes.headers.get('content-type') || ''
    if (!contentType.includes('jpeg') && !contentType.includes('jpg')) {
      return
    }
    const arrBuf = await imgRes.arrayBuffer()
    // Spotify requires base64-encoded JPEG with no headers, body is raw base64
    const b64 = Buffer.from(arrBuf).toString('base64')
    await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/images`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
      body: b64,
    })
  } catch {
    // best-effort only
  }
}

async function addTracksInBatches(token: string, playlistId: string, uris: string[], onProgress: (added: number) => void) {
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100)
    const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: batch })
    })
    if (!res.ok) throw new Error('Failed to add tracks')
    onProgress(batch.length)
  }
}

async function runSpotifyToSpotify(job: TransferJobState, input: StartTransferInput) {
  const sourceToken = await ensureToken(input.auth.sourceAccessToken, input.auth.sourceRefreshToken)
  const destToken = await ensureToken(input.auth.destAccessToken, input.auth.destRefreshToken)
  if (!sourceToken || !destToken) {
    job.status = 'failed'
    job.items.forEach((it) => { it.status = 'failed'; it.error = 'Not authenticated'; })
    log(job, 'Authentication missing. Please sign in to both accounts.')
    return
  }

  // Warm up destination user call to ensure validity
  await spotifyMe(destToken)

  for (const item of job.items) {
    try {
      item.status = 'running'
      log(job, `Reading playlist: ${item.playlistName}`)
      const details = await fetchPlaylistDetails(sourceToken, item.playlistId)
      const uris = await fetchPlaylistTrackUris(sourceToken, item.playlistId)
      item.total = uris.length
      log(job, `Found ${uris.length} tracks`)
      log(job, `Creating destination playlist: ${details.name}`)
      const created = await createDestinationPlaylist(destToken, details.name, details.description)
      // Best-effort cover copy
      const coverUrl = details && (details as any).images && Array.isArray((details as any).images) && (details as any).images[0]?.url
      await setPlaylistCover(destToken, created.id, coverUrl)
      log(job, `Adding tracks...`)
      await addTracksInBatches(destToken, created.id, uris, (added) => { item.added += added; item.message = `${item.added}/${item.total}` })
      item.status = 'completed'
      log(job, `Completed: ${details.name}`)
    } catch (e: any) {
      item.status = 'failed'
      item.error = e?.message || 'Unknown error'
      log(job, `Failed ${item.playlistName}: ${item.error}`)
    }
  }

  job.status = job.items.some((i) => i.status === 'failed') ? 'failed' : 'completed'
}

export function startTransfer(input: StartTransferInput) {
  const id = `job_${crypto.randomUUID()}`
  const now = Date.now()
  const job: TransferJobState = {
    id,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    logs: [],
    items: input.playlists.map((p) => ({ playlistId: p.id, playlistName: p.name, status: 'pending', total: 0, added: 0 })),
  }
  jobs.set(id, job)

  // Run async without awaiting response
  ;(async () => {
    try {
      job.status = 'running'
      await runSpotifyToSpotify(job, input)
    } catch (e: any) {
      job.status = 'failed'
      log(job, e?.message || 'Unknown error')
    } finally {
      job.updatedAt = Date.now()
    }
  })()

  return job
}

export function getJob(id: string) {
  return jobs.get(id) || null
}
