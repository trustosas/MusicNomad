export type ServiceKind = 'source' | 'destination' | 'both'

export type Track = {
  id?: string
  title: string
  artist?: string
  album?: string
  isrc?: string
  durationMs?: number
  url?: string
  sourceId?: string
  meta?: Record<string, unknown>
}

export type Playlist = {
  id: string
  name: string
  description?: string
  tracks?: Track[]
  meta?: Record<string, unknown>
}

export type AuthState = 'signed_out' | 'signed_in'

export interface ServiceAdapter {
  id: string
  displayName: string
  kind: ServiceKind
  icon?: React.ReactNode
  getAuthState(): Promise<AuthState>
  signIn(): Promise<void>
  signOut(): Promise<void>
}

export interface SourceServiceAdapter extends ServiceAdapter {
  kind: 'source' | 'both'
  listPlaylists(): Promise<Playlist[]>
  getPlaylistTracks(playlistId: string): Promise<Track[]>
}

export interface DestinationServiceAdapter extends ServiceAdapter {
  kind: 'destination' | 'both'
  createPlaylist(name: string, description?: string): Promise<{ id: string }>
  addTracks(playlistId: string, tracks: Track[]): Promise<{ added: number; failed: Track[] }>
}

export type TransferPlan = {
  sourceServiceId: string
  destinationServiceId: string
  playlistName: string
  sourcePlaylistId?: string
  tracks: Track[]
}

export type TransferResult = {
  createdPlaylistId?: string
  added: number
  failed: { track: Track; reason: string }[]
  artifacts?: { label: string; filename: string; mime: string; data: string | Blob }[]
  logs: string[]
}
