import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-session'
import { extractYouTubeId } from '@/lib/utils'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { title, url, addedBy } = body as { title?: string; url?: string; addedBy?: string }
  if (!title || !url) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })

  const userId = await getSessionUserId(req)
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room || !room.isActive) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  const count = await prisma.song.count({ where: { roomId } })
  if (count >= 20) return NextResponse.json({ error: 'QueueLimitReached' }, { status: 400 })

  const videoId = extractYouTubeId(url)
  if (videoId) {
    const existing = await prisma.song.findMany({ where: { roomId } })
    const dup = existing.find((s) => extractYouTubeId(s.url) === videoId)
    if (dup) return NextResponse.json({ song: dup }, { status: 200 })
  }

  const position = (await prisma.song.aggregate({ _max: { position: true }, where: { roomId } }))._max.position ?? 0
  const song = await prisma.song.create({
    data: {
      title,
      url,
      addedBy: addedBy ?? userId ?? 'Guest',
      position: position + 1,
      roomId,
    },
  })
  return NextResponse.json({ song }, { status: 201 })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { songId, videoId } = body as { songId?: string; videoId?: string }
  if (!songId && !videoId) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room || !room.isActive) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  const songs = await prisma.song.findMany({ where: { roomId } })
  const song = songs.find((s) =>
    s.id === songId ||
    (videoId && extractYouTubeId(s.url) === videoId) ||
    (songId && extractYouTubeId(s.url) === songId)
  )
  if (!song) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  await prisma.song.delete({ where: { id: song.id } })

  const remaining = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i + 1) {
      await prisma.song.update({ where: { id: remaining[i].id }, data: { position: i + 1 } })
    }
  }
  const ordered = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  return NextResponse.json({ songs: ordered })
}
