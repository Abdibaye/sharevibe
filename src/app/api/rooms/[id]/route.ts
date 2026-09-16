import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlayback, livePosition, setPlayback } from '@/lib/playbackDb'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const room = await prisma.room.findUnique({
    where: { id },
    include: { songs: { orderBy: { position: 'asc' } } },
  })
  if (!room || !room.isActive) return NextResponse.json({ error: 'NotFound' }, { status: 404 })
  const playback = await getPlayback(id)
  const serverNow = Date.now()
  const live = playback ? livePosition(playback, serverNow) : 0
  return NextResponse.json({
    room: {
      ...room,
      playingUrl: playback?.playingUrl ?? null,
      playingTitle: playback?.playingTitle ?? null,
      playingThumb: playback?.playingThumb ?? null,
      playingAt: playback?.playingAt ?? 0,
      livePosition: live,
      isPlaying: playback?.isPlaying ?? false,
      playbackClock: playback?.playbackClock ?? null,
      playbackSeq: playback?.playbackSeq ?? 0,
      pausedBy: playback?.pausedBy ?? null,
      serverNow,
    },
  })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({})) as {
    playingUrl?: string | null
    playingTitle?: string | null
    playingThumb?: string | null
    playingAt?: number
    isPlaying?: boolean
  }

  const room = await prisma.room.findUnique({
    where: { id },
    include: { songs: { orderBy: { position: 'asc' } } },
  })
  if (!room || !room.isActive) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  const playback = await setPlayback(id, {
    ...body,
    pausedBy: body.isPlaying === false ? "user" : body.isPlaying === true ? null : undefined,
  })
  return NextResponse.json({
    room: {
      ...room,
      playingUrl: playback.playingUrl,
      playingTitle: playback.playingTitle,
      playingThumb: playback.playingThumb,
      playingAt: playback.playingAt,
      isPlaying: playback.isPlaying,
      playbackClock: playback.playbackClock,
      playbackSeq: playback.playbackSeq,
      pausedBy: playback.pausedBy,
    },
  })
}
