import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { startSync } from '@/lib/transfer/serverJobs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || !body.source || !body.destination || (body.mode !== 'one_way' && body.mode !== 'two_way')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const source = body.source as { id: string; name: string }
    const destination = body.destination as { id: string; name: string }
    if (typeof source.id !== 'string' || typeof source.name !== 'string' || typeof destination.id !== 'string' || typeof destination.name !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (source.id === 'liked_songs' || destination.id === 'liked_songs') {
      return NextResponse.json({ error: 'Syncing Liked Songs is not supported' }, { status: 400 })
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

    const job = startSync({ source, destination, mode: body.mode, auth })
    const res = NextResponse.json({ id: job.id, state: job })
    res.cookies.set('active_transfer_job_id', job.id, { path: '/', httpOnly: false, maxAge: 60 * 60 })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
