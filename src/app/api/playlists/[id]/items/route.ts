import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-session'

async function assertOwner(req: NextRequest, id: string) {
  const userId = await getSessionUserId(req)
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
  const deleted = await prisma.playlistItem.deleteMany({ where: { id: itemId, playlistId } })
  if (deleted.count === 0) return NextResponse.json({ error: 'NotFound' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
