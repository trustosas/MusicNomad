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

  const meRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!meRes.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const me = await meRes.json()
  const out = {
    id: me.id as string,
    display_name: (me.display_name as string | undefined) || undefined,
    email: (me.email as string | undefined) || undefined,
    product: (me.product as string | undefined) || undefined,
  }

  const res = NextResponse.json(out)
  if (updated) {
    const maxAge = Math.max(0, Math.floor((newExpiresAt - Date.now()) / 1000))
    res.cookies.set(`spotify_access_token${suffix}`, accessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge })
    if (newRefreshToken) {
      res.cookies.set(`spotify_refresh_token${suffix}`, newRefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    }
    res.cookies.set(`spotify_expires_at${suffix}`, String(newExpiresAt), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge })
  }
  return res
}
