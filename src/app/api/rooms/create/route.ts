import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-session'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)

  if (!userId) {
    return NextResponse.json({ error: 'GuestMode', message: 'Create temp room on client with UUID' }, { status: 401 })
  }

  const room = await prisma.room.create({
    data: { hostId: userId },
  })

  return NextResponse.json({ room }, { status: 201 })
}
