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

export type SyncMode = 'one_way' | 'two_way'

export type StartSyncInput = {
  source: { id: string; name: string }
  destination: { id: string; name: string }
  mode: SyncMode
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
      for (const item of (data.items || [])) {
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
    for (const item of (data.items || [])) {
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
    const b64 = Buffer.from(arrBuf).toString('base64')
    await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/images`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
      body: b64,
    })
  } catch {
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

async function removeTracksFromPlaylistInBatches(token: string, playlistId: string, uris: string[], onProgress: (removed: number) => void) {
  for (let i = 0; i < uris.length; i += 100) {
    const batchUris = uris.slice(i, i + 100)
    const body = { tracks: batchUris.map((u) => ({ uri: u })) }
    const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to remove tracks')
    onProgress(batchUris.length)
  }
}

function extractTrackIdsFromUris(uris: string[]): string[] {
  return uris
    .map((u) => {
      const m = u.match(/spotify:track:([A-Za-z0-9]+)/)
      return m ? m[1] : null
    })
    .filter((x): x is string => !!x)
}

async function addTracksToLikedSongsInBatches(token: string, ids: string[], onProgress: (added: number) => void) {
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const res = await fetch('https://api.spotify.com/v1/me/tracks', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: batch })
    })
    if (!res.ok) throw new Error('Failed to save tracks to library')
    onProgress(batch.length)
  }
}

async function removeTracksFromLikedSongsInBatches(token: string, ids: string[], onProgress: (removed: number) => void) {
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const url = `https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(batch.join(','))}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to remove tracks from library')
    onProgress(batch.length)
  }
}

// Sequential operations for Liked Songs and playlist adds
async function addTracksSequentiallyToPlaylist(token: string, playlistId: string, uris: string[], onProgress: (added: number) => void) {
  for (const uri of uris) {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] })
    })
    if (!res.ok) throw new Error('Failed to add track')
    onProgress(1)
  }
}

async function addTracksToLikedSongsSequential(token: string, ids: string[], onProgress: (added: number) => void) {
  for (const id of ids) {
    const res = await fetch('https://api.spotify.com/v1/me/tracks', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] })
    })
    if (!res.ok) throw new Error('Failed to save track to library')
    onProgress(1)
  }
}

async function removeTracksFromLikedSongsSequential(token: string, ids: string[], onProgress: (removed: number) => void) {
  for (const id of ids) {
    const url = `https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(id)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to remove track from library')
    onProgress(1)
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
      const coverUrl = details && (details as any).images && Array.isArray((details as any).images) && (details as any).images[0]?.url
      await setPlaylistCover(destToken, created.id, coverUrl)
      log(job, `Adding tracks...`)
      if (item.playlistId === 'liked_songs') {
        await addTracksSequentiallyToPlaylist(destToken, created.id, uris, (added) => { item.added += added; item.message = `${item.added}/${item.total}` })
      } else {
        await addTracksInBatches(destToken, created.id, uris, (added) => { item.added += added; item.message = `${item.added}/${item.total}` })
      }
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

async function runSpotifySync(job: TransferJobState, input: StartSyncInput) {
  const sourceToken = await ensureToken(input.auth.sourceAccessToken, input.auth.sourceRefreshToken)
  const destToken = await ensureToken(input.auth.destAccessToken, input.auth.destRefreshToken)
  if (!sourceToken || !destToken) {
    job.status = 'failed'
    job.items.forEach((it) => { it.status = 'failed'; it.error = 'Not authenticated'; })
    log(job, 'Authentication missing. Please sign in to both accounts.')
    return
  }

  await spotifyMe(sourceToken)
  await spotifyMe(destToken)

  try {
    log(job, `Fetching source tracks: ${input.source.name}`)
    const sourceUris = await fetchPlaylistTrackUris(sourceToken, input.source.id)
    log(job, `Source has ${sourceUris.length} tracks`)

    log(job, `Fetching destination tracks: ${input.destination.name}`)
    const destUris = await fetchPlaylistTrackUris(destToken, input.destination.id)
    log(job, `Destination has ${destUris.length} tracks`)

    const sourceSet = new Set(sourceUris)
    const destSet = new Set(destUris)

    const toDest = sourceUris.filter((u) => !destSet.has(u))
    const toSource = destUris.filter((u) => !sourceSet.has(u))

    if (input.mode === 'one_way') {
      const item = job.items[0]
      item.status = 'running'
      item.total = toDest.length
      log(job, `One-way sync: adding ${toDest.length} missing tracks to destination`)
      if (input.destination.id === 'liked_songs') {
        const ids = extractTrackIdsFromUris(toDest)
        await addTracksToLikedSongsSequential(destToken, ids, (added) => { item.added += added; item.message = `${item.added}/${item.total}` })
      } else {
        await addTracksInBatches(destToken, input.destination.id, toDest, (added) => { item.added += added; item.message = `${item.added}/${item.total}` })
      }

      const toRemoveFromDest = destUris.filter((u) => !sourceSet.has(u))
      if (toRemoveFromDest.length > 0) {
        log(job, `One-way sync: removing ${toRemoveFromDest.length} tracks from destination not present in source`)
        if (input.destination.id === 'liked_songs') {
          const rmIds = extractTrackIdsFromUris(toRemoveFromDest)
          await removeTracksFromLikedSongsSequential(destToken, rmIds, () => {})
        } else {
          await removeTracksFromPlaylistInBatches(destToken, input.destination.id, toRemoveFromDest, () => {})
        }
        log(job, `Removed ${toRemoveFromDest.length} tracks from destination`)
      } else {
        log(job, 'No tracks to remove from destination')
      }

      item.status = 'completed'
      log(job, `One-way sync completed`)
    } else {
      const destItem = job.items.find((it) => it.playlistId === `to:${input.destination.id}`) || job.items[0]
      destItem.status = 'running'
      destItem.total = toDest.length
      log(job, `Two-way sync: adding ${toDest.length} tracks to destination`)
      if (input.destination.id === 'liked_songs') {
        const ids = extractTrackIdsFromUris(toDest)
        await addTracksToLikedSongsSequential(destToken, ids, (added) => { destItem.added += added; destItem.message = `${destItem.added}/${destItem.total}` })
      } else {
        await addTracksInBatches(destToken, input.destination.id, toDest, (added) => { destItem.added += added; destItem.message = `${destItem.added}/${destItem.total}` })
      }
      destItem.status = 'completed'

      const sourceItem = job.items.find((it) => it.playlistId === `to:${input.source.id}`) || job.items[job.items.length - 1]
      sourceItem.status = 'running'
      sourceItem.total = toSource.length
      log(job, `Two-way sync: adding ${toSource.length} tracks to source`)
      if (input.source.id === 'liked_songs') {
        const ids = extractTrackIdsFromUris(toSource)
        await addTracksToLikedSongsSequential(sourceToken, ids, (added) => { sourceItem.added += added; sourceItem.message = `${sourceItem.added}/${sourceItem.total}` })
      } else {
        await addTracksInBatches(sourceToken, input.source.id, toSource, (added) => { sourceItem.added += added; sourceItem.message = `${sourceItem.added}/${sourceItem.total}` })
      }
      sourceItem.status = 'completed'
      log(job, `Two-way sync completed`)
    }

    job.status = 'completed'
  } catch (e: any) {
    const msg = e?.message || 'Unknown error'
    job.items.forEach((it) => { if (it.status === 'running' || it.status === 'pending') { it.status = 'failed'; it.error = msg } })
    job.status = 'failed'
    log(job, msg)
  }
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

export function startSync(input: StartSyncInput) {
  const id = `job_${crypto.randomUUID()}`
  const now = Date.now()
  const items: PlaylistProgress[] = input.mode === 'two_way'
    ? [
        { playlistId: `to:${input.destination.id}`, playlistName: `To destination: ${input.destination.name}`, status: 'pending', total: 0, added: 0 },
        { playlistId: `to:${input.source.id}`, playlistName: `To source: ${input.source.name}`, status: 'pending', total: 0, added: 0 },
      ]
    : [
        { playlistId: input.destination.id, playlistName: `Add to ${input.destination.name}`, status: 'pending', total: 0, added: 0 },
      ]

  const job: TransferJobState = {
    id,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    logs: [],
    items,
  }
  jobs.set(id, job)

  ;(async () => {
    try {
      job.status = 'running'
      await runSpotifySync(job, input)
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
