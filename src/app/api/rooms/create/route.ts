import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-session'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const body = await req.json().catch(() => ({})) as { id?: string }
  const requestedId = typeof body.id === 'string' ? body.id.trim() : ''

  if (requestedId) {
    if (requestedId.length < 8 || requestedId.length > 80) {
      return NextResponse.json({ error: 'BadRequest' }, { status: 400 })
    }
    const existing = await prisma.room.findUnique({
      where: { id: requestedId },
      include: { songs: { orderBy: { position: 'asc' } } },
    })
    if (existing) return NextResponse.json({ room: existing })
    const room = await prisma.room.create({
      data: { id: requestedId, hostId: userId ?? undefined },
      include: { songs: true },
    })
    return NextResponse.json({ room }, { status: 201 })
  }

  const room = await prisma.room.create({
    data: { hostId: userId ?? undefined },
    include: { songs: true },
  })
  return NextResponse.json({ room }, { status: 201 })
}
