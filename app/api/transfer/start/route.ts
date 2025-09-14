import { NextResponse } from 'next/server'
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
    const job = startTransfer({ playlists })
    return NextResponse.json({ id: job.id, state: job })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
