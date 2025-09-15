import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { auth } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: roomId } = params

  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const songs = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  if (songs.length <= 1) return NextResponse.json({ songs })

  // Fisher-Yates shuffle (keep first song optional? we'll shuffle entire list)
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = songs[i]
    songs[i] = songs[j]
    songs[j] = tmp
  }

  // Persist new positions
  for (let i = 0; i < songs.length; i++) {
    await prisma.song.update({ where: { id: songs[i].id }, data: { position: i + 1 } })
  }

  const ordered = await prisma.song.findMany({ where: { roomId }, orderBy: { position: 'asc' } })
  return NextResponse.json({ songs: ordered })
}
