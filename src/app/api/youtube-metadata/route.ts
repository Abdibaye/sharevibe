import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeMetadata } from '@/utils/fetchYouTubeMetadata';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    const data = await fetchYouTubeMetadata(url);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch metadata' }, { status: 500 });
  }
}
