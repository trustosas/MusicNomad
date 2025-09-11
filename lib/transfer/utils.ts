import type { Playlist, Track } from './types'

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function normalizeTrack(input: Partial<Track>): Track {
  return {
    id: input.id,
    title: (input.title || '').trim(),
    artist: input.artist?.trim(),
    album: input.album?.trim(),
    isrc: input.isrc?.trim(),
    durationMs: input.durationMs,
    url: input.url,
    sourceId: input.sourceId,
    meta: input.meta || {},
  }
}

export function tracksFromCsvRows(rows: Record<string, string>[]): Track[] {
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const titleKeys = ['title', 'track', 'song', 'name']
  const artistKeys = ['artist', 'artists', 'author']
  const albumKeys = ['album', 'record', 'collection']
  const isrcKeys = ['isrc']
  const durationKeys = ['duration', 'durationms', 'length']

  return rows
    .map((r) => {
      const pick = (candidates: string[]) => {
        const entry = Object.entries(r).find(([k]) => candidates.includes(key(k)))
        return entry ? entry[1] : ''
      }
      const title = pick(titleKeys)
      const artist = pick(artistKeys)
      const album = pick(albumKeys)
      const isrc = pick(isrcKeys)
      const durationStr = pick(durationKeys)
      const durationMs = durationStr ? parseInt(durationStr, 10) : undefined
      return normalizeTrack({ title, artist, album, isrc, durationMs })
    })
    .filter((t) => t.title.length > 0)
}

export function uniqueBy<T>(items: T[], getKey: (x: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = getKey(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}

export function buildPlaylist(name: string, tracks: Track[]): Playlist {
  return { id: `pl_${crypto.randomUUID()}`, name, tracks }
}
