import { NextResponse } from 'next/server'
import { buildAuthorizeUrl, generateCodeChallenge, generateCodeVerifier, generateRandomString } from '@/lib/auth/spotify'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/spotify/callback`

  if (!clientId) {
    return NextResponse.json({ error: 'Missing SPOTIFY_CLIENT_ID env' }, { status: 500 })
  }

  const ctxParam = url.searchParams.get('ctx')
  const ctx: 'source' | 'destination' = ctxParam === 'destination' ? 'destination' : 'source'

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const stateRaw = generateRandomString(16)
  const state = `${ctx}:${stateRaw}`

  const scopes = [
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
  ].join(' ')

  const authorizeUrl = buildAuthorizeUrl({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    scope: scopes,
    state,
  })

  const res = NextResponse.redirect(authorizeUrl)
  // Short-lived cookies for verifier/state (scoped by context)
  res.cookies.set(`spotify_${ctx}_pkce_verifier`, codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 10 * 60 })
  res.cookies.set(`spotify_${ctx}_oauth_state`, stateRaw, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 10 * 60 })
  return res
}
