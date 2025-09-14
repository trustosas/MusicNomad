import { NextResponse } from 'next/server'
import { getJob } from '@/lib/transfer/serverJobs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  const job = getJob(id)
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(job)
}
