import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { refreshAccessToken } from '@/lib/auth/spotify'

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Missing SPOTIFY_CLIENT_ID env' }, { status: 500 })
  }

  const url = new URL(request.url)
  const instance = url.searchParams.get('instance') === 'dest' ? 'dest' : 'src'
  const suffix = instance === 'dest' ? '_dest' : ''

  const cookieStore = cookies()
  let accessToken = cookieStore.get(`spotify_access_token${suffix}`)?.value
  const refreshToken = cookieStore.get(`spotify_refresh_token${suffix}`)?.value
  const expiresAtStr = cookieStore.get(`spotify_expires_at${suffix}`)?.value
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0

  let updated = false
  let newExpiresAt = expiresAt
  let newRefreshToken: string | undefined

  if ((!accessToken || Date.now() >= expiresAt) && refreshToken) {
    try {
      const refreshed = await refreshAccessToken({ refresh_token: refreshToken, client_id: clientId })
      accessToken = refreshed.access_token
      newExpiresAt = Date.now() + refreshed.expires_in * 1000 - 30 * 1000
      newRefreshToken = refreshed.refresh_token
      updated = true
    } catch {
      // ignore and fall back to existing access token (likely invalid)
    }
  }

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const items: any[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 })
    }
    const data = await res.json()
    items.push(...(data.items || []))
    url = data.next
  }

  const playlists = items.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    tracks_total: p.tracks?.total as number | undefined,
    image: Array.isArray(p.images) && p.images.length > 0 ? { url: p.images[0].url as string, width: p.images[0].width as number | undefined, height: p.images[0].height as number | undefined } : null,
  }))

  let likedTotal: number | undefined
  try {
    const likedRes = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    if (likedRes.ok) {
      const likedData = await likedRes.json()
      likedTotal = typeof likedData.total === 'number' ? likedData.total : undefined
    }
  } catch {}

  playlists.unshift({
    id: 'liked_songs',
    name: 'Liked Songs',
    tracks_total: likedTotal,
    image: null,
  })

  const res = NextResponse.json({ items: playlists })
  if (updated) {
    const maxAge = Math.max(0, Math.floor((newExpiresAt - Date.now()) / 1000))
    res.cookies.set(`spotify_access_token${suffix}` as const, accessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge })
    if (newRefreshToken) {
      res.cookies.set(`spotify_refresh_token${suffix}` as const, newRefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    }
    res.cookies.set(`spotify_expires_at${suffix}` as const, String(newExpiresAt), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge })
  }
  return res
}
