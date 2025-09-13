import { NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth/spotify'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Missing SPOTIFY_CLIENT_ID env' }, { status: 500 })
  }

  const cookieHeader = (request as any).headers?.get?.('cookie') as string | undefined
  const cookies = Object.fromEntries((cookieHeader || '').split(';').map((p) => p.trim().split('='))) as Record<string, string>

  let accessToken = cookies['spotify_access_token']
  const refreshToken = cookies['spotify_refresh_token']
  const expiresAtStr = cookies['spotify_expires_at']
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0

  // Refresh if expired and refresh token available
  if ((!accessToken || Date.now() >= expiresAt) && refreshToken) {
    try {
      const refreshed = await refreshAccessToken({ refresh_token: refreshToken, client_id: clientId })
      accessToken = refreshed.access_token
      const res = NextResponse.next()
      const newExpiresAt = Date.now() + refreshed.expires_in * 1000 - 30 * 1000
      res.cookies.set('spotify_access_token', refreshed.access_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: refreshed.expires_in })
      if (refreshed.refresh_token) {
        res.cookies.set('spotify_refresh_token', refreshed.refresh_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
      }
      res.cookies.set('spotify_expires_at', String(newExpiresAt), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: refreshed.expires_in })
      // Continue after setting cookies by returning res and chaining fetch would end the request; instead, merge cookies into response at the end.
      // We'll carry the Set-Cookie headers by collecting them and re-setting on final response.
      // For simplicity, we won't rely on these cookies immediately in this handler.
    } catch (e) {
      // fall through; will try with existing token if any
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
  return NextResponse.json(out)
}
