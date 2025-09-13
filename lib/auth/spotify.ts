import crypto from 'crypto'

export function generateRandomString(length = 64) {
  return crypto.randomBytes(length).toString('base64url')
}

export function generateCodeVerifier() {
  // between 43 and 128 chars, URL-safe
  return generateRandomString(64)
}

export function generateCodeChallenge(verifier: string) {
  const hash = crypto.createHash('sha256').update(verifier).digest('base64')
  return base64Url(hash)
}

export function base64Url(input: string) {
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildAuthorizeUrl(params: Record<string, string>) {
  const url = new URL('https://accounts.spotify.com/authorize')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

export type SpotifyTokenResponse = {
  access_token: string
  token_type: 'Bearer'
  scope: string
  expires_in: number
  refresh_token?: string
}

export async function exchangeToken(opts: {
  code: string
  code_verifier: string
  client_id: string
  redirect_uri: string
}): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirect_uri,
    client_id: opts.client_id,
    code_verifier: opts.code_verifier,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Spotify token exchange failed: ${res.status} ${res.statusText} ${txt}`)
  }

  return (await res.json()) as SpotifyTokenResponse
}

export async function refreshAccessToken(opts: {
  refresh_token: string
  client_id: string
}): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refresh_token,
    client_id: opts.client_id,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Spotify token refresh failed: ${res.status} ${res.statusText} ${txt}`)
  }

  return (await res.json()) as SpotifyTokenResponse
}
