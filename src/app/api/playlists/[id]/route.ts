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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const pl = await prisma.playlist.findUnique({
    where: { id },
    include: { items: { orderBy: { position: 'asc' } } },
  })
  if (!pl) return NextResponse.json({ error: 'NotFound' }, { status: 404 })
  return NextResponse.json({ playlist: pl })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const authz = await assertOwner(req, id)
  if (authz.status !== 200) return authz.json
  const body = await req.json().catch(() => ({}))
  const name = (body?.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'BadRequest' }, { status: 400 })
  const pl = await prisma.playlist.update({ where: { id }, data: { name } })
  return NextResponse.json({ playlist: pl })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const authz = await assertOwner(req, id)
  if (authz.status !== 200) return authz.json
  await prisma.playlist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
