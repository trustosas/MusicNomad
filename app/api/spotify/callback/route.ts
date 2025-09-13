import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeToken } from '@/lib/auth/spotify'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateFull = url.searchParams.get('state')

  if (!code || !stateFull) {
    return NextResponse.redirect(new URL('/action?authError=missing_code', url))
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/action?authError=missing_client_id', url))
  }

  // State is in the format "<ctx>:<random>"
  let ctx: 'source' | 'destination' = 'source'
  let stateRaw = stateFull
  const sepIdx = stateFull.indexOf(':')
  if (sepIdx > 0) {
    const maybeCtx = stateFull.slice(0, sepIdx)
    const maybeState = stateFull.slice(sepIdx + 1)
    if ((maybeCtx === 'source' || maybeCtx === 'destination') && maybeState) {
      ctx = maybeCtx
      stateRaw = maybeState
    }
  }

  const cookieStore = cookies()
  const cookieVerifier = cookieStore.get(`spotify_${ctx}_pkce_verifier`)?.value || cookieStore.get('spotify_pkce_verifier')?.value
  const cookieState = cookieStore.get(`spotify_${ctx}_oauth_state`)?.value || cookieStore.get('spotify_oauth_state')?.value

  if (!cookieVerifier || !cookieState || cookieState !== stateRaw) {
    return NextResponse.redirect(new URL('/action?authError=invalid_state', url))
  }

  const origin = url.origin
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/spotify/callback`

  try {
    const token = await exchangeToken({ code, code_verifier: cookieVerifier, client_id: clientId, redirect_uri: redirectUri })

    const res = NextResponse.redirect(new URL(`/action?auth=spotify&ctx=${ctx}`, url))
    const expiresAt = Date.now() + token.expires_in * 1000 - 30 * 1000
    res.cookies.set(`spotify_${ctx}_access_token`, token.access_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: token.expires_in })
    if (token.refresh_token) {
      res.cookies.set(`spotify_${ctx}_refresh_token`, token.refresh_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    }
    res.cookies.set(`spotify_${ctx}_expires_at`, String(expiresAt), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: token.expires_in })
    res.cookies.set(`spotify_${ctx}_pkce_verifier`, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set(`spotify_${ctx}_oauth_state`, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    // Clear legacy cookies if present
    res.cookies.set('spotify_pkce_verifier', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('spotify_oauth_state', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    return res
  } catch (e) {
    return NextResponse.redirect(new URL('/action?authError=token_exchange_failed', url))
  }
}
