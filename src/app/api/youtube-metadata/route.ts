import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeMetadata } from '@/utils/fetchYouTubeMetadata';
import { clientKey, rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, 'yt-meta'), 40, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    const data = await fetchYouTubeMetadata(url);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch metadata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
