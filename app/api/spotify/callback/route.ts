import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeToken } from '@/lib/auth/spotify'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect('/action?authError=missing_code')
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect('/action?authError=missing_client_id')
  }

  const cookieStore = cookies()
  const cookieVerifier = cookieStore.get('spotify_pkce_verifier')?.value
  const cookieState = cookieStore.get('spotify_oauth_state')?.value

  if (!cookieVerifier || !cookieState || cookieState !== state) {
    return NextResponse.redirect('/action?authError=invalid_state')
  }

  const origin = url.origin
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/spotify/callback`

  try {
    const token = await exchangeToken({ code, code_verifier: cookieVerifier, client_id: clientId, redirect_uri: redirectUri })

    const res = NextResponse.redirect('/action?auth=spotify')
    const expiresAt = Date.now() + token.expires_in * 1000 - 30 * 1000
    res.cookies.set('spotify_access_token', token.access_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: token.expires_in })
    if (token.refresh_token) {
      res.cookies.set('spotify_refresh_token', token.refresh_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    }
    res.cookies.set('spotify_expires_at', String(expiresAt), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: token.expires_in })
    res.cookies.set('spotify_pkce_verifier', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('spotify_oauth_state', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    return res
  } catch (e) {
    return NextResponse.redirect('/action?authError=token_exchange_failed')
  }
}
