import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const room = await prisma.room.findUnique({
    where: { id },
    include: { songs: { orderBy: { position: 'asc' } } },
  })
  if (!room) return NextResponse.json({ error: 'NotFound' }, { status: 404 })
  return NextResponse.json({ room })
}
