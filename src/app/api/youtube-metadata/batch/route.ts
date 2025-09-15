import { NextRequest, NextResponse } from 'next/server'

type Meta = {
  title: string
  channelTitle: string
  thumbnailUrl: string
  duration: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((s: unknown) => typeof s === 'string') : []
    if (!ids.length) return NextResponse.json({ error: 'Provide ids: string[]' }, { status: 400 })

    const key = process.env.YOUTUBE_API_KEY
    if (!key) return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 })

    const uniq = Array.from(new Set(ids)).slice(0, 50) // API limit safety
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${uniq.join(',')}&key=${key}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok) {
      const msg = j?.error?.message || 'YouTube API error'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const out: Record<string, Meta> = {}
    const pickThumb = (thumbs: any): string | undefined =>
      thumbs?.maxres?.url || thumbs?.standard?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url

    for (const it of j.items || []) {
      out[it.id] = {
        title: it.snippet?.title,
        channelTitle: it.snippet?.channelTitle,
        thumbnailUrl: pickThumb(it.snippet?.thumbnails) || '',
        duration: it.contentDetails?.duration,
      }
    }
    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch batch metadata' }, { status: 500 })
  }
}
