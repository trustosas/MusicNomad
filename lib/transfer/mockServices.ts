"use client"
import * as React from 'react'
import { parseCsv } from './csv'
import { toM3U } from './m3u'
import { buildPlaylist, tracksFromCsvRows, uniqueBy } from './utils'
import type { AuthState, DestinationServiceAdapter, Playlist, SourceServiceAdapter, Track } from './types'

export class MockMusicService implements SourceServiceAdapter {
  id = 'mock'
  displayName = 'Mock Music'
  kind = 'source' as const
  icon?: React.ReactNode
  private auth: AuthState = 'signed_out'
  private playlists: Playlist[] = []

  constructor() {
    const rock: Track[] = [
      { title: 'Everlong', artist: 'Foo Fighters', album: 'The Colour and the Shape', durationMs: 250000 },
      { title: 'Californication', artist: 'Red Hot Chili Peppers', album: 'Californication', durationMs: 330000 },
      { title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', durationMs: 222000 },
    ]
    const chill: Track[] = [
      { title: 'Sunset Lover', artist: 'Petit Biscuit', album: 'Presence', durationMs: 196000 },
      { title: 'Weightless', artist: 'Marconi Union', durationMs: 505000 },
    ]
    this.playlists = [
      buildPlaylist('Rock Classics', rock),
      buildPlaylist('Chill Vibes', chill),
    ]
  }

  async getAuthState(): Promise<AuthState> { return this.auth }
  async signIn(): Promise<void> { this.auth = 'signed_in' }
  async signOut(): Promise<void> { this.auth = 'signed_out' }

  async listPlaylists(): Promise<Playlist[]> { return this.playlists }
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    return this.playlists.find((p) => p.id === playlistId)?.tracks || []
  }
}

export class CsvFileImportService implements SourceServiceAdapter {
  id = 'csv_import'
  displayName = 'CSV / TSV File'
  kind = 'source' as const
  icon?: React.ReactNode
  private auth: AuthState = 'signed_out'
  private imported: Playlist[] = []

  async getAuthState(): Promise<AuthState> { return this.auth }
  async signIn(): Promise<void> { this.auth = 'signed_in' }
  async signOut(): Promise<void> { this.auth = 'signed_out'; this.imported = [] }

  async importFile(file: File): Promise<void> {
    const text = await file.text()
    const rows = parseCsv(text)
    const tracks = tracksFromCsvRows(rows)
    const clean = uniqueBy(tracks, (t) => `${t.artist?.toLowerCase() || ''}|${t.title.toLowerCase()}`)
    const pl = buildPlaylist(file.name.replace(/\.[^.]+$/, ''), clean)
    this.imported = [pl]
  }

  async listPlaylists(): Promise<Playlist[]> { return this.imported }
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    return this.imported.find((p) => p.id === playlistId)?.tracks || []
  }
}

export class JsonFileImportService implements SourceServiceAdapter {
  id = 'json_import'
  displayName = 'JSON File'
  kind = 'source' as const
  icon?: React.ReactNode
  private auth: AuthState = 'signed_out'
  private imported: Playlist[] = []

  async getAuthState(): Promise<AuthState> { return this.auth }
  async signIn(): Promise<void> { this.auth = 'signed_in' }
  async signOut(): Promise<void> { this.auth = 'signed_out'; this.imported = [] }

  async importFile(file: File): Promise<void> {
    const text = await file.text()
    const data = JSON.parse(text) as { name?: string; tracks: Track[] } | Track[]
    let name = 'Imported'
    let tracks: Track[] = []
    if (Array.isArray(data)) {
      tracks = data
    } else {
      name = data.name || name
      tracks = data.tracks
    }
    const clean = uniqueBy(tracks, (t) => `${t.artist?.toLowerCase() || ''}|${t.title.toLowerCase()}`)
    const pl = buildPlaylist(name, clean)
    this.imported = [pl]
  }

  async listPlaylists(): Promise<Playlist[]> { return this.imported }
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    return this.imported.find((p) => p.id === playlistId)?.tracks || []
  }
}

export class CsvFileExportService implements DestinationServiceAdapter {
  id = 'csv_export'
  displayName = 'CSV Download'
  kind = 'destination' as const
  icon?: React.ReactNode
  private auth: AuthState = 'signed_out'
  private artifacts: { name: string; data: string; mime: string }[] = []

  async getAuthState(): Promise<AuthState> { return this.auth }
  async signIn(): Promise<void> { this.auth = 'signed_in' }
  async signOut(): Promise<void> { this.auth = 'signed_out'; this.artifacts = [] }

  async createPlaylist(name: string): Promise<{ id: string }> {
    this.artifacts.push({ name: `${name}.csv`, data: 'PENDING_WRITE', mime: 'text/csv' })
    return { id: `csv_${crypto.randomUUID()}` }
  }

  async addTracks(playlistId: string, tracks: Track[]): Promise<{ added: number; failed: Track[] }> {
    const header = ['title', 'artist', 'album', 'isrc', 'durationMs']
    const lines = [header.join(',')]
    for (const t of tracks) {
      const esc = (v: string) => (/[,\n\r"]/g.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
      lines.push([
        esc(t.title || ''),
        esc(t.artist || ''),
        esc(t.album || ''),
        esc(t.isrc || ''),
        String(t.durationMs ?? ''),
      ].join(','))
    }
    const data = lines.join('\r\n')
    this.artifacts = this.artifacts.map((a) => (a.data === 'PENDING_WRITE' ? { ...a, data } : a))
    return { added: tracks.length, failed: [] }
  }

  getArtifacts() { return this.artifacts }
}

export class M3UExportService implements DestinationServiceAdapter {
  id = 'm3u_export'
  displayName = 'M3U Download'
  kind = 'destination' as const
  icon?: React.ReactNode
  private auth: AuthState = 'signed_out'
  private artifacts: { name: string; data: string; mime: string }[] = []

  async getAuthState(): Promise<AuthState> { return this.auth }
  async signIn(): Promise<void> { this.auth = 'signed_in' }
  async signOut(): Promise<void> { this.auth = 'signed_out'; this.artifacts = [] }

  async createPlaylist(name: string): Promise<{ id: string }> {
    const filename = `${name}.m3u`
    this.artifacts.push({ name: filename, data: 'PENDING_WRITE', mime: 'audio/x-mpegurl' })
    return { id: `m3u_${crypto.randomUUID()}` }
  }

  async addTracks(playlistId: string, tracks: Track[]): Promise<{ added: number; failed: Track[] }> {
    const data = toM3U(tracks)
    this.artifacts = this.artifacts.map((a) => (a.data === 'PENDING_WRITE' ? { ...a, data } : a))
    return { added: tracks.length, failed: [] }
  }

  getArtifacts() { return this.artifacts }
}

export type AnyService = SourceServiceAdapter | DestinationServiceAdapter

export function createAvailableServices() {
  const sourceServices: SourceServiceAdapter[] = [
    new MockMusicService(),
    new CsvFileImportService(),
    new JsonFileImportService(),
  ]
  const destinationServices: DestinationServiceAdapter[] = [
    new CsvFileExportService(),
    new M3UExportService(),
  ]
  return { sourceServices, destinationServices }
}
