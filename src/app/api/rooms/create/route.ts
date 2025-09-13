import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  // Determine user from BetterAuth request
  const session = await auth.api.getSession({ headers: req.headers as any }).catch(() => null as any)
  const userId = (session as any)?.user?.id ?? (session as any)?.session?.user?.id

  if (!userId) {
    // Guest: create a temporary room client-side; server returns 401 with hint
    return NextResponse.json({ error: 'GuestMode', message: 'Create temp room on client with UUID' }, { status: 401 })
  }

  const room = await prisma.room.create({
    data: { hostId: userId },
  })

  return NextResponse.json({ room }, { status: 201 })
}
