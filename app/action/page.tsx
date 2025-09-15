'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useState, useEffect, useLayoutEffect } from 'react'

export const dynamic = 'force-static'


type SpotifyPlaylist = { id: string; name: string; tracks_total?: number; image: { url: string; width?: number; height?: number } | null }

type ServiceId = 'spotify' | 'apple' | 'youtube' | 'tidal' | 'deezer' | 'amazon'

type SpotifyUser = { id: string; display_name?: string } | null

type TransferItem = { playlistId: string; playlistName: string; status: 'pending' | 'running' | 'completed' | 'failed'; total: number; added: number; message?: string; error?: string }

type TransferState = { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: number; updatedAt: number; logs: string[]; items: TransferItem[] }

export default function ActionPage() {
  const [mode, setMode] = useState<'transfer' | 'sync'>('transfer')
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

  // Destination playlist picker (sync mode)
  const [destLibraryOpen, setDestLibraryOpen] = useState(false)
  const [destPlaylists, setDestPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loadingDestPlaylists, setLoadingDestPlaylists] = useState(false)
  const [destPlaylistError, setDestPlaylistError] = useState<string | null>(null)
  const [selectedDestPlaylist, setSelectedDestPlaylist] = useState<string | null>(null)
  const [confirmedDestSelected, setConfirmedDestSelected] = useState(false)

  useEffect(() => {
    if (mode === 'sync') {
      setSelectedPlaylists((prev) => {
        if (prev.size <= 1) return prev
        const first = prev.values().next().value as string
        return new Set([first])
      })
      setConfirmedSelectedCount((c) => Math.min(c, 1))
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
    { label: 'Start transfer' },
  ]
  const [current, setCurrent] = useState(0)

  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<TransferState | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    try {
      let id: string | null = null
      if (typeof window !== 'undefined') {
        id = window.localStorage.getItem('active_transfer_job_id')
        if (!id) {
          const found = document.cookie.split('; ').find((r) => r.startsWith('active_transfer_job_id='))
          if (found) id = decodeURIComponent(found.split('=')[1] || '')
        }
      }
      if (id) {
        setJobId(id)
        setCurrent(2)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!jobId) return
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('active_transfer_job_id', jobId)
        document.cookie = `active_transfer_job_id=${encodeURIComponent(jobId)}; path=/; max-age=86400`
      }
    } catch {}
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    let timer: number | null = null
    const clearPersisted = () => {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('active_transfer_job_id')
          document.cookie = 'active_transfer_job_id=; Max-Age=0; path=/'
        }
      } catch {}
    }
    const poll = async () => {
      try {
        const res = await fetch(`/api/transfer/status?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setJob(data)
          if (data.status === 'completed' || data.status === 'failed') {
            clearPersisted()
            return
          }
        } else if (res.status === 404) {
          clearPersisted()
          return
        }
      } catch {}
      timer = window.setTimeout(poll, 1000)
    }
    poll()
    return () => { if (timer) window.clearTimeout(timer) }
  }, [jobId])

  const startTransfer = async () => {
    setStartError(null)
    setStarting(true)
    try {
      const selectedList = playlists.filter((pl) => selectedPlaylists.has(pl.id)).map((pl) => ({ id: pl.id, name: pl.name }))
      const res = await fetch('/api/transfer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playlists: selectedList }) })
      if (!res.ok) throw new Error('Failed to start transfer')
      const data = await res.json()
      setJobId(data.id)
      setJob(data.state)
      setCurrent(2)
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('active_transfer_job_id', data.id)
          document.cookie = `active_transfer_job_id=${encodeURIComponent(data.id)}; path=/; max-age=86400`
        }
      } catch {}
    } catch (e: any) {
      setStartError(e?.message || 'Unable to start transfer')
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
                <div className="text-base font-semibold">Start transfer</div>
                <div className="mt-1 text-sm text-muted-foreground">Confirm the source account, selected playlists, and destination account.</div>
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
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src="https://cdn.builder.io/api/v1/image/assets%2F672bd2452a84448ea16383bbff6a43d6%2F533ea5db8ac54bf58d52fcac265b743a?format=webp&width=800" alt="" className="h-4 w-4 rounded object-cover" />
                                ) : pl.image?.url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
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
                <Button size="lg" type="button" onClick={startTransfer} disabled={starting || !source || !destination || playlists.filter((pl) => selectedPlaylists.has(pl.id)).length === 0 || (source === 'spotify' && !spotifySourceUser) || (destination === 'spotify' && !spotifyDestUser)}>
                  {starting ? 'Starting...' : 'Start transfer'}
                </Button>
              </div>
              {startError && (
                <div className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{startError}</div>
              )}
              {job && (
                <div className="mt-6 rounded-xl border bg-white/70 p-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="text-base font-semibold">Transfer progress</div>
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
              <Dialog.Description className="text-sm text-muted-foreground">Choose the playlists to transfer</Dialog.Description>
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
                {playlists.map((pl) => {
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
                            // eslint-disable-next-line @next/next/no-img-element
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
    </div>
  )
}
