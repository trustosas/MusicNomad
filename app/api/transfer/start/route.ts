import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { startTransfer } from '@/lib/transfer/serverJobs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.playlists)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const playlists: { id: string; name: string }[] = body.playlists
      .filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string')
    if (playlists.length === 0) {
      return NextResponse.json({ error: 'No playlists provided' }, { status: 400 })
    }
    const cookieStore = cookies()
    const auth = {
      sourceAccessToken: cookieStore.get('spotify_source_access_token')?.value || cookieStore.get('spotify_access_token')?.value || '',
      sourceRefreshToken: cookieStore.get('spotify_source_refresh_token')?.value || cookieStore.get('spotify_refresh_token')?.value,
      destAccessToken: cookieStore.get('spotify_destination_access_token')?.value || '',
      destRefreshToken: cookieStore.get('spotify_destination_refresh_token')?.value,
    }
    if (!auth.sourceAccessToken || !auth.destAccessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const job = startTransfer({ playlists, auth })
    return NextResponse.json({ id: job.id, state: job })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
