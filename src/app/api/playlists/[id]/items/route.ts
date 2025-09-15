import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { auth } from '@/lib/auth'

const prisma = new PrismaClient()

async function assertOwner(req: NextRequest, id: string) {
  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id
  if (!userId) return { status: 401 as const, userId: null, json: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const pl = await prisma.playlist.findUnique({ where: { id }, select: { ownerId: true } })
  if (!pl || pl.ownerId !== userId) return { status: 403 as const, userId, json: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { status: 200 as const, userId }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: playlistId } = await context.params
  const authz = await assertOwner(req, playlistId)
  if (authz.status !== 200) return authz.json
  const body = await req.json().catch(() => ({}))
  const title = (body?.title as string)?.trim()
  const url = (body?.url as string)?.trim()
  const addedBy = (body?.addedBy as string | undefined)
  const thumbnailUrl = (body?.thumbnailUrl as string | undefined)
  if (!title || !url) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })
  const max = await prisma.playlistItem.aggregate({ _max: { position: true }, where: { playlistId } })
  const item = await prisma.playlistItem.create({
    data: { title, url, addedBy, thumbnailUrl, position: (max._max.position ?? 0) + 1, playlistId },
  })
  return NextResponse.json({ item }, { status: 201 })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: playlistId } = await context.params
  const authz = await assertOwner(req, playlistId)
  if (authz.status !== 200) return authz.json
  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })
  await prisma.playlistItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
