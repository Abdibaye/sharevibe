import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { auth } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lists = await prisma.playlist.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true, createdAt: true },
  })
  return NextResponse.json({ playlists: lists })
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = (body?.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })
  const pl = await prisma.playlist.create({ data: { name, ownerId: userId } })
  return NextResponse.json({ playlist: pl }, { status: 201 })
}
