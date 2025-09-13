import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { auth } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: roomId } = params
  const body = await req.json().catch(() => ({}))
  const { title, url, addedBy } = body as { title?: string; url?: string; addedBy?: string }
  if (!title || !url) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })

  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) return NextResponse.json({ error: 'NotFound' }, { status: 404 })

  const count = await prisma.song.count({ where: { roomId } })
  if (count >= 20) return NextResponse.json({ error: 'QueueLimitReached' }, { status: 400 })

  const position = (await prisma.song.aggregate({ _max: { position: true }, where: { roomId } }))._max.position ?? 0
  const song = await prisma.song.create({
    data: {
      title,
      url,
      addedBy: addedBy ?? userId,
      position: position + 1,
      roomId,
    },
  })
  return NextResponse.json({ song }, { status: 201 })
}
