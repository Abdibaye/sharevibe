import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await context.params

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room || !room.isActive) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  const songs = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  if (songs.length <= 1) return NextResponse.json({ songs })

  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = songs[i]
    songs[i] = songs[j]
    songs[j] = tmp
  }

  for (let i = 0; i < songs.length; i++) {
    await prisma.song.update({ where: { id: songs[i].id }, data: { position: i + 1 } })
  }

  const ordered = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  return NextResponse.json({ songs: ordered })
}
