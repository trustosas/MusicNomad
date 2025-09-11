import type { Track } from './types'

export function toM3U(tracks: Track[]): string {
  const lines: string[] = ['#EXTM3U']
  for (const t of tracks) {
    const seconds = t.durationMs ? Math.round(t.durationMs / 1000) : -1
    const title = [t.artist, t.title].filter(Boolean).join(' - ')
    lines.push(`#EXTINF:${seconds},${title}`)
    lines.push(t.url || title)
  }
  return lines.join('\n')
}
