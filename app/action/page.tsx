'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Button } from '@/components/ui/button'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useState, useEffect, useLayoutEffect } from 'react'

export const dynamic = 'force-static'


type SpotifyPlaylist = { id: string; name: string; tracks_total?: number; image: { url: string; width?: number; height?: number } | null }

type ServiceId = 'spotify' | 'apple' | 'youtube' | 'tidal' | 'deezer' | 'amazon'

type SpotifyUser = { id: string; display_name?: string } | null

type TransferItem = { playlistId: string; playlistName: string; status: 'pending' | 'running' | 'completed' | 'failed'; total: number; added: number; message?: string; error?: string }

type TransferState = { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: number; updatedAt: number; logs: string[]; items: TransferItem[] }

type SyncMode = 'one_way' | 'two_way'

export default function ActionPage() {
  const [mode, setMode] = useState<'transfer' | 'sync'>('transfer')
  const [syncMode, setSyncMode] = useState<SyncMode>('one_way')
  const [removeMissing, setRemoveMissing] = useState(false)
  const [source, setSource] = useState<ServiceId | null>(null)
  const [destination, setDestination] = useState<ServiceId | null>(null)

  const [spotifySourceUser, setSpotifySourceUser] = useState<SpotifyUser>(null)
  const [spotifyDestUser, setSpotifyDestUser] = useState<SpotifyUser>(null)

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())
  const [confirmedSelectedCount, setConfirmedSelectedCount] = useState(0)

  const [destLibraryOpen, setDestLibraryOpen] = useState(false)
  const [destPlaylists, setDestPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loadingDestPlaylists, setLoadingDestPlaylists] = useState(false)
  const [destPlaylistError, setDestPlaylistError] = useState<string | null>(null)
  const [selectedDestPlaylist, setSelectedDestPlaylist] = useState<string | null>(null)
  const [confirmedDestSelected, setConfirmedDestSelected] = useState(false)

  // Helpers for client-side operations
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null
    const v = document.cookie.split('; ').find((r) => r.startsWith(name + '='))
    return v ? decodeURIComponent(v.split('=')[1] || '') : null
  }

  const ensureAccessToken = async (ctx: 'source' | 'destination'): Promise<string | null> => {
    try { await fetch(`/api/spotify/me?ctx=${ctx}`, { cache: 'no-store' }) } catch {}
    return getCookie(`spotify_${ctx}_access_token`)
  }

  const logAppend = (setter: (s: TransferState | null) => void, msg: string) => {
    setter((prev) => {
      if (!prev) return prev
      const next = { ...prev, logs: [...prev.logs, msg], updatedAt: Date.now() }
      return next
    })
  }

  const updateItem = (setter: (s: TransferState | null) => void, playlistId: string, patch: Partial<TransferItem>) => {
    setter((prev) => {
      if (!prev) return prev
      const items = prev.items.map((it) => (it.playlistId === playlistId ? { ...it, ...patch } : it))
      return { ...prev, items, updatedAt: Date.now() }
    })
  }

  const setJobStatus = (setter: (s: TransferState | null) => void, status: TransferState['status']) => {
    setter((prev) => (prev ? { ...prev, status, updatedAt: Date.now() } : prev))
  }

  const fetchPlaylistDetails = async (token: string, playlistId: string) => {
    if (playlistId === 'liked_songs') return { id: 'liked_songs', name: 'Liked Songs', description: '' } as any
    const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=id,name,description,images(total,height,width,url),owner(id,display_name)`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to get playlist details')
    return res.json() as Promise<{ id: string; name: string; description?: string; images?: { url: string; width?: number; height?: number }[]; owner?: { id?: string; display_name?: string } }>
  }

  const fetchPlaylistTrackUris = async (token: string, playlistId: string): Promise<string[]> => {
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

  const createDestinationPlaylist = async (token: string, name: string, description?: string) => {
    const res = await fetch('https://api.spotify.com/v1/me/playlists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || '' }),
    })
    if (!res.ok) throw new Error('Failed to create destination playlist')
    return res.json() as Promise<{ id: string }>
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    return btoa(binary)
  }

  const setPlaylistCover = async (token: string, playlistId: string, imageUrl?: string) => {
    if (!imageUrl) return
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) return
      const contentType = imgRes.headers.get('content-type') || ''
      if (!contentType.includes('jpeg') && !contentType.includes('jpg')) return
      const arrBuf = await imgRes.arrayBuffer()
      const b64 = arrayBufferToBase64(arrBuf)
      await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/images`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        body: b64,
      })
    } catch {}
  }

  const addTracksInBatches = async (token: string, playlistId: string, uris: string[], onProgress: (added: number) => void) => {
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

  const removeTracksFromPlaylistInBatches = async (token: string, playlistId: string, uris: string[], onProgress: (removed: number) => void) => {
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

  const extractTrackIdsFromUris = (uris: string[]): string[] => {
    return uris
      .map((u) => {
        const m = u.match(/spotify:track:([A-Za-z0-9]+)/)
        return m ? m[1] : null
      })
      .filter((x): x is string => !!x)
  }

  const addTracksToLikedSongsSequential = async (token: string, ids: string[], onProgress: (added: number) => void) => {
    for (const id of ids) {
      const res = await fetch('https://api.spotify.com/v1/me/tracks', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      })
      if (!res.ok) throw new Error('Failed to save track to library')
      onProgress(1)
      // Space out saves to ensure distinct added_at timestamps and preserve relative ordering
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  const removeTracksFromLikedSongsSequential = async (token: string, ids: string[], onProgress: (removed: number) => void) => {
    for (const id of ids) {
      const url = `https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(id)}`
      const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to remove track from library')
      onProgress(1)
    }
  }

  useEffect(() => {
    if (mode === 'sync') {
      setSelectedPlaylists((prev) => {
        if (prev.size <= 1) return prev
        const first = prev.values().next().value as string
        return new Set([first])
      })
      setConfirmedSelectedCount((c) => Math.min(c, 1))
    } else {
      setSelectedPlaylists((prev) => {
        const next = new Set(prev)
        next.delete('liked_songs')
        return next
      })
    }
  }, [mode])

  useLayoutEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const auth = params.get('auth')
      const ctx = params.get('ctx')
      const authError = params.get('authError')

      if (auth === 'spotify') {
        if (ctx === 'destination') {
          setDestination('spotify')
          setCurrent(1)
        } else {
          setSource('spotify')
          setCurrent(0)
        }
      }

      if (auth || authError || ctx) {
        const url = new URL(window.location.href)
        url.searchParams.delete('auth')
        url.searchParams.delete('ctx')
        url.searchParams.delete('authError')
        window.history.replaceState({}, '', url.toString())
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/spotify/me?ctx=source', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSpotifySourceUser(data) })
      .catch(() => {})

    fetch('/api/spotify/me?ctx=destination', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSpotifyDestUser(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!libraryOpen) return
    if (source !== 'spotify' || !spotifySourceUser) return
    setLoadingPlaylists(true)
    setPlaylistError(null)
    fetch('/api/spotify/playlists?ctx=source', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load playlists')
        return r.json()
      })
      .then((data) => {
        setPlaylists((data?.items || []) as SpotifyPlaylist[])
      })
      .catch(() => setPlaylistError('Unable to load playlists'))
      .finally(() => setLoadingPlaylists(false))
  }, [libraryOpen, source, spotifySourceUser])

  useEffect(() => {
    if (!destLibraryOpen) return
    if (destination !== 'spotify' || !spotifyDestUser) return
    setLoadingDestPlaylists(true)
    setDestPlaylistError(null)
    fetch('/api/spotify/playlists?ctx=destination', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load playlists')
        return r.json()
      })
      .then((data) => {
        setDestPlaylists((data?.items || []) as SpotifyPlaylist[])
      })
      .catch(() => setDestPlaylistError('Unable to load playlists'))
      .finally(() => setLoadingDestPlaylists(false))
  }, [destLibraryOpen, destination, spotifyDestUser])

  const togglePick = (id: string) => {
    setSelectedPlaylists((prev) => {
      const next = new Set(prev)
      if (mode === 'sync') {
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.clear()
          next.add(id)
        }
        return next
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePickDest = (id: string) => {
    setSelectedDestPlaylist((prev) => (prev === id ? null : id))
  }

  const services: { id: ServiceId; name: string; enabled: boolean }[] = [
    { id: 'spotify', name: 'Spotify', enabled: true },
    { id: 'apple', name: 'Apple Music', enabled: false },
    { id: 'youtube', name: 'YouTube Music', enabled: false },
    { id: 'tidal', name: 'TIDAL', enabled: false },
    { id: 'deezer', name: 'Deezer', enabled: false },
    { id: 'amazon', name: 'Amazon Music', enabled: false },
  ]

  const steps: { label: string }[] = [
    { label: 'Select source' },
    { label: 'Select destination' },
    { label: mode === 'sync' ? 'Start sync' : 'Start transfer' },
  ]
  const [current, setCurrent] = useState(0)

  const [job, setJob] = useState<TransferState | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const startTransfer = async () => {
    setStartError(null)
    setStarting(true)
    try {
      const selectedList = playlists.filter((pl) => selectedPlaylists.has(pl.id)).map((pl) => ({ id: pl.id, name: pl.name }))
      if (selectedList.length === 0) throw new Error('No playlists selected')

      const now = Date.now()
      const initJob: TransferState = {
        id: 'client_job',
        status: 'running',
        createdAt: now,
        updatedAt: now,
        logs: [],
        items: selectedList.map((p) => ({ playlistId: p.id, playlistName: p.name, status: 'pending', total: 0, added: 0 })),
      }
      setJob(initJob)

      const sourceToken = await ensureAccessToken('source')
      const destToken = await ensureAccessToken('destination')
      if (!sourceToken || !destToken) {
        setJobStatus(setJob, 'failed')
        logAppend(setJob, 'Authentication missing. Please sign in to both accounts.')
        return
      }

      // Validate destination token
      try {
        await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${destToken}` } })
      } catch {}

      for (const item of selectedList) {
        try {
          updateItem(setJob, item.id, { status: 'running', error: undefined, message: undefined, added: 0, total: 0 })
          logAppend(setJob, `Reading playlist: ${item.name}`)
          const details = await fetchPlaylistDetails(sourceToken, item.id)

          const ownerId = (details as any)?.owner?.id as string | undefined
          const srcUserId = spotifySourceUser?.id || null
          if (ownerId && srcUserId && ownerId !== srcUserId && destination === 'spotify') {
            try {
              logAppend(setJob, `Adding playlist to destination library: ${details.name}`)
              const followRes = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(item.id)}/followers`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${destToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ public: false })
              })
              if (followRes.ok) {
                updateItem(setJob, item.id, { status: 'completed', total: 0, added: 0, message: undefined })
                logAppend(setJob, `Added to library: ${details.name}`)
                continue
              } else {
                logAppend(setJob, `Follow failed (status ${followRes.status}). Creating a copy instead...`)
              }
            } catch {
              logAppend(setJob, 'Follow failed. Creating a copy instead...')
            }
          }

          const uris = await fetchPlaylistTrackUris(sourceToken, item.id)
          updateItem(setJob, item.id, { total: uris.length })
          logAppend(setJob, `Found ${uris.length} tracks`)
          logAppend(setJob, `Creating destination playlist: ${details.name}`)
          const created = await createDestinationPlaylist(destToken, details.name, (details as any).description)
          const coverUrl = (details as any)?.images?.[0]?.url as string | undefined
          await setPlaylistCover(destToken, created.id, coverUrl)
          logAppend(setJob, 'Adding tracks...')
          await addTracksInBatches(destToken, created.id, uris, (added) => {
            updateItem(setJob, item.id, (prev => ({})) as any)
            setJob((prev) => {
              if (!prev) return prev
              const nextItems = prev.items.map((it) => it.playlistId === item.id ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items: nextItems, updatedAt: Date.now() }
            })
          })
          updateItem(setJob, item.id, { status: 'completed' })
          logAppend(setJob, `Completed: ${details.name}`)
        } catch (e: any) {
          const err = e?.message || 'Unknown error'
          updateItem(setJob, item.id, { status: 'failed', error: err })
          logAppend(setJob, `Failed ${item.name}: ${err}`)
        }
      }

      setJob((prev) => {
        if (!prev) return prev
        const status = prev.items.some((i) => i.status === 'failed') ? 'failed' : 'completed'
        return { ...prev, status, updatedAt: Date.now() }
      })
    } catch (e: any) {
      setStartError(e?.message || 'Unable to start transfer')
    } finally {
      setStarting(false)
    }
  }

  const startSync = async () => {
    setStartError(null)
    setStarting(true)
    try {
      const src = playlists.find((pl) => selectedPlaylists.has(pl.id))
      const dst = destPlaylists.find((p) => p.id === selectedDestPlaylist) || null
      if (!src || !dst) throw new Error('Select source and destination playlists')

      const now = Date.now()
      const items: TransferItem[] = syncMode === 'two_way'
        ? [
            { playlistId: `to:${dst.id}`, playlistName: `To destination: ${dst.name}`, status: 'pending', total: 0, added: 0 },
            { playlistId: `to:${src.id}`, playlistName: `To source: ${src.name}`, status: 'pending', total: 0, added: 0 },
          ]
        : [
            { playlistId: dst.id, playlistName: `Add to ${dst.name}`, status: 'pending', total: 0, added: 0 },
          ]
      setJob({ id: 'client_job', status: 'running', createdAt: now, updatedAt: now, logs: [], items })

      const sourceToken = await ensureAccessToken('source')
      const destToken = await ensureAccessToken('destination')
      if (!sourceToken || !destToken) {
        setJobStatus(setJob, 'failed')
        logAppend(setJob, 'Authentication missing. Please sign in to both accounts.')
        return
      }

      logAppend(setJob, `Fetching source tracks: ${src.name}`)
      const sourceUris = await fetchPlaylistTrackUris(sourceToken, src.id)
      logAppend(setJob, `Source has ${sourceUris.length} tracks`)

      logAppend(setJob, `Fetching destination tracks: ${dst.name}`)
      const destUris = await fetchPlaylistTrackUris(destToken, dst.id)
      logAppend(setJob, `Destination has ${destUris.length} tracks`)

      const sourceSet = new Set(sourceUris)
      const destSet = new Set(destUris)
      const toDest = sourceUris.filter((u) => !destSet.has(u))
      const toSource = destUris.filter((u) => !sourceSet.has(u))

      if (syncMode === 'one_way') {
        const itemId = dst.id
        updateItem(setJob, itemId, { status: 'running', total: toDest.length })
        logAppend(setJob, `One-way sync: adding ${toDest.length} missing tracks to destination`)
        if (dst.id === 'liked_songs') {
          const ids = extractTrackIdsFromUris(toDest).slice().reverse()
          await addTracksToLikedSongsSequential(destToken, ids, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === itemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        } else {
          await addTracksInBatches(destToken, dst.id, toDest, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === itemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        }

        const toRemoveFromDest = destUris.filter((u) => !sourceSet.has(u))
        if (removeMissing && toRemoveFromDest.length > 0) {
          logAppend(setJob, `One-way sync: removing ${toRemoveFromDest.length} tracks from destination not present in source`)
          if (dst.id === 'liked_songs') {
            const rmIds = extractTrackIdsFromUris(toRemoveFromDest)
            await removeTracksFromLikedSongsSequential(destToken, rmIds, () => {})
          } else {
            await removeTracksFromPlaylistInBatches(destToken, dst.id, toRemoveFromDest, () => {})
          }
          logAppend(setJob, `Removed ${toRemoveFromDest.length} tracks from destination`)
        } else {
          logAppend(setJob, removeMissing ? 'No tracks to remove from destination' : 'Removal disabled: skipping removal from destination')
        }

        updateItem(setJob, itemId, { status: 'completed' })
        logAppend(setJob, `One-way sync completed`)
      } else {
        const destItemId = `to:${dst.id}`
        updateItem(setJob, destItemId, { status: 'running', total: toDest.length })
        logAppend(setJob, `Two-way sync: adding ${toDest.length} tracks to destination`)
        if (dst.id === 'liked_songs') {
          const ids = extractTrackIdsFromUris(toDest).slice().reverse()
          await addTracksToLikedSongsSequential(destToken, ids, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === destItemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        } else {
          await addTracksInBatches(destToken, dst.id, toDest, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === destItemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        }
        updateItem(setJob, destItemId, { status: 'completed' })

        const sourceItemId = `to:${src.id}`
        updateItem(setJob, sourceItemId, { status: 'running', total: toSource.length })
        logAppend(setJob, `Two-way sync: adding ${toSource.length} tracks to source`)
        if (src.id === 'liked_songs') {
          const ids = extractTrackIdsFromUris(toSource).slice().reverse()
          await addTracksToLikedSongsSequential(sourceToken, ids, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === sourceItemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        } else {
          await addTracksInBatches(sourceToken, src.id, toSource, (added) => {
            setJob((prev) => {
              if (!prev) return prev
              const items = prev.items.map((it) => it.playlistId === sourceItemId ? { ...it, added: it.added + added, message: `${it.added + added}/${it.total}` } : it)
              return { ...prev, items, updatedAt: Date.now() }
            })
          })
        }
        updateItem(setJob, sourceItemId, { status: 'completed' })
        logAppend(setJob, `Two-way sync completed`)
      }

      setJobStatus(setJob, 'completed')
    } catch (e: any) {
      const msg = e?.message || 'Unable to start sync'
      setJob((prev) => {
        if (!prev) return prev
        const items = prev.items.map((it) => (it.status === 'running' || it.status === 'pending') ? { ...it, status: 'failed', error: msg } : it)
        return { ...prev, status: 'failed', items, updatedAt: Date.now(), logs: [...prev.logs, msg] }
      })
      setStartError(msg)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center">
          <ToggleGroup.Root
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as 'transfer' | 'sync')}
            aria-label="Action mode"
            className="inline-flex rounded-full border bg-white/70 p-1 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40"
          >
            <ToggleGroup.Item
              value="transfer"
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200"
            >
              Transfer
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="sync"
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200"
            >
              Sync
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>

        <div className="mx-auto mt-10 max-w-2xl px-2">
          <div className="relative">
            <ol className="relative z-10 flex items-center justify-between gap-3 text-[11px]">
              {steps.map((s, i) => {
                const state = i < current ? 'complete' : i === current ? 'current' : 'upcoming'
                return (
                  <li key={s.label} className="flex flex-col items-center text-center">
                    <div
                      className={[
                        'flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-medium',
                        state === 'current'
                          ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                          : state === 'complete'
                          ? 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/40'
                          : 'bg-white/70 text-slate-600 border-slate-300 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-700 dark:text-slate-300',
                      ].join(' ')}
                      aria-current={state === 'current' ? 'step' : undefined}
                    >
                      {state === 'complete' ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <span className="mt-1 whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-300">{s.label}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-xl text-center">
          <p className="mt-2 text-sm text-muted-foreground">Only Spotify is available in this MVP. Others are coming soon.</p>

          {current === 0 && (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {services.map((svc) => {
                  const isSelected = source === svc.id
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        if (!svc.enabled) return
                        setSource((prev) => (prev === svc.id ? null : svc.id))
                      }}
                      disabled={!svc.enabled}
                      className={[
                        'group flex items-center justify-center rounded-lg border p-4 text-center transition-colors',
                        'bg-white/70 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-800',
                        svc.enabled ? 'hover:border-[#7c3aed] focus-visible:border-[#7c3aed] focus-visible:ring-[#7c3aed]/40 focus-visible:ring-[3px] outline-none' : 'opacity-50 grayscale cursor-not-allowed',
                        isSelected ? 'ring-2 ring-[#7c3aed]/60 border-[#7c3aed]' : '',
                      ].join(' ')}
                      aria-pressed={isSelected}
                    >
                      <span className={`service-icon service-icon--${svc.id}`} aria-hidden="true" />
                      <span className="sr-only">{svc.name}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 mx-auto flex max-w-xs flex-col gap-3">
                <Button size="lg" className="w-full" disabled={!source} onClick={() => {
                  if (source === 'spotify') {
                    window.location.href = '/api/spotify/auth?ctx=source'
                  }
                }}>{source === 'spotify' && spotifySourceUser ? `Signed in as ${spotifySourceUser.display_name || spotifySourceUser.id}` : 'Sign in'}</Button>
                <Button size="lg" variant="outline" className="w-full" disabled={!spotifySourceUser || !source} onClick={() => setLibraryOpen(true)}>{confirmedSelectedCount > 0 ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" /> Selected {confirmedSelectedCount} {confirmedSelectedCount === 1 ? 'playlist' : 'playlists'}
                  </span>
                ) : 'Select content'}</Button>
              </div>
            </>
          )}

          {current === 1 && (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {services.map((svc) => {
                  const isSelected = destination === svc.id
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        if (!svc.enabled) return
                        setDestination((prev) => (prev === svc.id ? null : svc.id))
                      }}
                      disabled={!svc.enabled}
                      className={[
                        'group flex items-center justify-center rounded-lg border p-4 text-center transition-colors',
                        'bg-white/70 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-800',
                        svc.enabled ? 'hover:border-[#7c3aed] focus-visible:border-[#7c3aed] focus-visible:ring-[#7c3aed]/40 focus-visible:ring-[3px] outline-none' : 'opacity-50 grayscale cursor-not-allowed',
                        isSelected ? 'ring-2 ring-[#7c3aed]/60 border-[#7c3aed]' : '',
                      ].join(' ')}
                      aria-pressed={isSelected}
                    >
                      <span className={`service-icon service-icon--${svc.id}`} aria-hidden="true" />
                      <span className="sr-only">{svc.name}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 mx-auto flex max-w-xs flex-col gap-3">
                <Button size="lg" className="w-full" disabled={!destination} onClick={() => {
                  if (destination === 'spotify') {
                    window.location.href = '/api/spotify/auth?ctx=destination'
                  }
                }}>{destination === 'spotify' && spotifyDestUser ? `Signed in as ${spotifyDestUser.display_name || spotifyDestUser.id}` : 'Sign in'}</Button>
                {mode === 'sync' && (
                  <Button size="lg" variant="outline" className="w-full" disabled={!spotifyDestUser || !destination} onClick={() => setDestLibraryOpen(true)}>
                    {confirmedDestSelected && selectedDestPlaylist ? (
                      <span className="inline-flex items-center gap-2">
                        <Check className="h-4 w-4" /> Selected 1 playlist
                      </span>
                    ) : 'Select content destination'}
                  </Button>
                )}
              </div>
            </>
          )}

          {current === 2 && (
            <div className="mt-8 text-left">
              <div className="rounded-xl border bg-white/70 p-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-base font-semibold">{mode === 'sync' ? 'Start sync' : 'Start transfer'}</div>
                <div className="mt-1 text-sm text-muted-foreground">Confirm the source account, selected playlists, and destination account.</div>
                {mode === 'sync' && (
                  <div className="mt-4 flex items-center justify-center">
                    <ToggleGroup.Root
                      type="single"
                      value={syncMode}
                      onValueChange={(v) => v && setSyncMode(v as SyncMode)}
                      aria-label="Sync mode"
                      className="inline-flex rounded-full border bg-white/70 p-1 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <ToggleGroup.Item value="one_way" className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200">One way</ToggleGroup.Item>
                      <ToggleGroup.Item value="two_way" className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200">Two way</ToggleGroup.Item>
                    </ToggleGroup.Root>
                  </div>
                )}
                {mode === 'sync' && syncMode === 'one_way' && (
                  <div className="mt-4 flex items-center justify-center">
                    <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <Switch.Root
                        checked={removeMissing}
                        onCheckedChange={setRemoveMissing}
                        className="relative inline-flex h-6 w-11 items-center rounded-full border bg-white/70 transition-colors data-[state=checked]:bg-[#7c3aed] dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <Switch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 dark:bg-slate-200" />
                      </Switch.Root>
                      <span>Remove tracks in destination not in source</span>
                    </label>
                  </div>
                )}
                <div className="mt-5 grid gap-4">
                  <div className="rounded-lg border bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Source account</div>
                    <div className="mt-2 flex items-center gap-3">
                      {source ? <span className={`service-icon service-icon--${source}`} aria-hidden="true" /> : <span className="h-8 w-8 rounded bg-[#7c3aed]/10" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{source ? (source === 'spotify' ? 'Spotify' : source) : 'Not selected'}</div>
                        <div className="truncate text-xs text-muted-foreground">{source === 'spotify' && spotifySourceUser ? (spotifySourceUser.display_name || spotifySourceUser.id) : 'Not signed in'}</div>
                      </div>
                    </div>
                  </div>

                  {mode === 'sync' ? (
                    <>
                      <div className="rounded-lg border bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Source playlist</div>
                        <div className="mt-2">
                          {(() => {
                            const selectedList = playlists.filter((pl) => selectedPlaylists.has(pl.id))
                            if (selectedList.length === 0) {
                              return <div className="text-sm text-muted-foreground">No playlist selected</div>
                            }
                            const pl = selectedList[0]
                            return (
                              <span className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                                {pl.id === 'liked_songs' ? (
                                  <img src="https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800" alt="" className="h-4 w-4 rounded object-cover" />
                                ) : pl.image?.url ? (
                                  <img src={pl.image.url} alt="" className="h-4 w-4 rounded object-cover" />
                                ) : (
                                  <span className="h-4 w-4 rounded bg-[#7c3aed]/10" />
                                )}
                                <span className="truncate max-w-[12rem]">{pl.name}</span>
                              </span>
                            )
                          })()}
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Destination playlist</div>
                        <div className="mt-2">
                          {(() => {
                            const pl = destPlaylists.find((p) => p.id === selectedDestPlaylist) || null
                            if (!pl) {
                              return <div className="text-sm text-muted-foreground">No playlist selected</div>
                            }
                            return (
                              <span className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                                {pl.id === 'liked_songs' ? (
                                  <img src="https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800" alt="" className="h-4 w-4 rounded object-cover" />
                                ) : pl.image?.url ? (
                                  <img src={pl.image.url} alt="" className="h-4 w-4 rounded object-cover" />
                                ) : (
                                  <span className="h-4 w-4 rounded bg-[#7c3aed]/10" />
                                )}
                                <span className="truncate max-w-[12rem]">{pl.name}</span>
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Playlists to transfer</div>
                      <div className="mt-2">
                        {(() => {
                          const selectedList = playlists.filter((pl) => selectedPlaylists.has(pl.id))
                          if (selectedList.length === 0) {
                            return <div className="text-sm text-muted-foreground">No playlists selected</div>
                          }
                          return (
                            <div className="flex flex-wrap gap-2">
                              {selectedList.map((pl) => (
                                <span key={pl.id} className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                                  {pl.id === 'liked_songs' ? (
                                    <img src="https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800" alt="" className="h-4 w-4 rounded object-cover" />
                                  ) : pl.image?.url ? (
                                    <img src={pl.image.url} alt="" className="h-4 w-4 rounded object-cover" />
                                  ) : (
                                    <span className="h-4 w-4 rounded bg-[#7c3aed]/10" />
                                  )}
                                  <span className="truncate max-w-[12rem]">{pl.name}</span>
                                </span>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Destination account</div>
                    <div className="mt-2 flex items-center gap-3">
                      {destination ? <span className={`service-icon service-icon--${destination}`} aria-hidden="true" /> : <span className="h-8 w-8 rounded bg-[#7c3aed]/10" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{destination ? (destination === 'spotify' ? 'Spotify' : destination) : 'Not selected'}</div>
                        <div className="truncate text-xs text-muted-foreground">{destination === 'spotify' && spotifyDestUser ? (spotifyDestUser.display_name || spotifyDestUser.id) : 'Not signed in'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <Button size="lg" type="button" onClick={mode === 'sync' ? startSync : startTransfer} disabled={starting || !source || !destination || playlists.filter((pl) => selectedPlaylists.has(pl.id)).length === 0 || (mode === 'sync' && !selectedDestPlaylist) || (source === 'spotify' && !spotifySourceUser) || (destination === 'spotify' && !spotifyDestUser)}>
                  {starting ? 'Starting...' : (mode === 'sync' ? 'Start sync' : 'Start transfer')}
                </Button>
              </div>
              {startError && (
                <div className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{startError}</div>
              )}
              {job && (
                <div className="mt-6 rounded-xl border bg-white/70 p-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="text-base font-semibold">{mode === 'sync' ? 'Sync progress' : 'Transfer progress'}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Status: {job.status}</div>
                  <div className="mt-4 space-y-3">
                    {job.items.map((it) => (
                      <div key={it.playlistId} className="rounded-lg border bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{it.playlistName}</div>
                            <div className="text-xs text-muted-foreground">{it.status === 'running' ? `${it.added}/${it.total}` : it.status}</div>
                          </div>
                          <div className="w-40 h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-[#7c3aed]" style={{ width: it.total > 0 ? `${Math.round((it.added / it.total) * 100)}%` : '0%' }} />
                          </div>
                        </div>
                        {it.error && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{it.error}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border bg-white/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/30 max-h-40 overflow-auto">
                    {job.logs.length === 0 ? <div className="text-muted-foreground">No logs yet</div> : job.logs.map((l, i) => (<div key={i}>{l}</div>))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 mx-auto max-w-xl px-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="link"
                className="inline-flex items-center gap-1 text-[#7c3aed] hover:text-[#7c3aed]"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                variant="link"
                className="inline-flex items-center gap-1 text-[#7c3aed] hover:text-[#7c3aed]"
                onClick={() => { setLibraryOpen(false); setCurrent((c) => Math.min(steps.length - 1, c + 1)) }}
                disabled={current === 0 ? !source : current === 1 ? !destination : false}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog.Root open={libraryOpen} onOpenChange={(o) => setLibraryOpen(o)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-2xl max-h-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white/70 p-0 text-left shadow-xl backdrop-blur-sm focus:outline-none dark:bg-slate-900/60 dark:border-slate-800 flex flex-col">
            <div className="p-5 border-b dark:border-slate-800">
              <Dialog.Title className="text-lg font-semibold">Your playlists</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">Choose the playlists to {mode === 'sync' ? 'sync' : 'transfer'}</Dialog.Description>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {loadingPlaylists && (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading playlists...</div>
              )}
              {!loadingPlaylists && playlistError && (
                <div className="p-6 text-center text-sm text-red-600 dark:text-red-400">{playlistError}</div>
              )}
              {!loadingPlaylists && !playlistError && playlists.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No playlists found</div>
              )}
              <ul className="space-y-1">
                {(mode === 'sync' ? playlists : playlists.filter((pl) => pl.id !== 'liked_songs')).map((pl) => {
                  const checked = selectedPlaylists.has(pl.id)
                  const artworkUrl = pl.id === 'liked_songs' ? 'https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800' : (pl.image?.url || null)
                  return (
                    <li key={pl.id}>
                      <button type="button" onClick={() => togglePick(pl.id)} className={[
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                        'bg-white/50 hover:border-[#7c3aed] dark:bg-slate-900/30 dark:border-slate-800',
                        checked ? 'ring-1 ring-[#7c3aed] border-[#7c3aed]' : '',
                      ].join(' ')}>
                        <input type={mode === 'sync' ? 'radio' : 'checkbox'} name="playlist-pick" checked={checked} onChange={() => togglePick(pl.id)} className="pointer-events-none" />
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {artworkUrl ? (
                            <img src={artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-[#7c3aed]/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{pl.name}</div>
                            <div className="text-xs text-muted-foreground">{typeof pl.tracks_total === 'number' ? `${pl.tracks_total} tracks` : 'Playlist'}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs text-muted-foreground">{selectedPlaylists.size} selected</div>
              <Button size="sm" onClick={() => { setConfirmedSelectedCount(selectedPlaylists.size); setLibraryOpen(false) }}>Done</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={destLibraryOpen} onOpenChange={(o) => setDestLibraryOpen(o)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-2xl max-height-[80vh] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white/70 p-0 text-left shadow-xl backdrop-blur-sm focus:outline-none dark:bg-slate-900/60 dark:border-slate-800 flex flex-col">
            <div className="p-5 border-b dark:border-slate-800">
              <Dialog.Title className="text-lg font-semibold">Destination playlists</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">Choose the playlist to sync into</Dialog.Description>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {loadingDestPlaylists && (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading playlists...</div>
              )}
              {!loadingDestPlaylists && destPlaylistError && (
                <div className="p-6 text-center text-sm text-red-600 dark:text-red-400">{destPlaylistError}</div>
              )}
              {!loadingDestPlaylists && !destPlaylistError && destPlaylists.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No playlists found</div>
              )}
              <ul className="space-y-1">
                {destPlaylists.map((pl) => {
                  const checked = selectedDestPlaylist === pl.id
                  const artworkUrl = pl.id === 'liked_songs'
                    ? 'https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800'
                    : (pl.image?.url || null)
                  return (
                    <li key={pl.id}>
                      <button type="button" onClick={() => togglePickDest(pl.id)} className={[
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                        'bg-white/50 hover:border-[#7c3aed] dark:bg-slate-900/30 dark:border-slate-800',
                        checked ? 'ring-1 ring-[#7c3aed] border-[#7c3aed]' : '',
                      ].join(' ')}>
                        <input type="radio" name="playlist-pick-destination" checked={checked} onChange={() => togglePickDest(pl.id)} className="pointer-events-none" />
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {artworkUrl ? (
                            <img src={artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-[#7c3aed]/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{pl.name}</div>
                            <div className="text-xs text-muted-foreground">{typeof pl.tracks_total === 'number' ? `${pl.tracks_total} tracks` : 'Playlist'}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs text-muted-foreground">{selectedDestPlaylist ? 1 : 0} selected</div>
              <Button size="sm" onClick={() => { setConfirmedDestSelected(!!selectedDestPlaylist); setDestLibraryOpen(false) }}>Done</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
