import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyLockstep, livePosition, touchPresence } from "@/lib/playbackDb"
import { youtubeThumb } from "@/lib/roomState"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await context.params
  const body = await req.json().catch(() => ({})) as {
    clientId?: string
    buffering?: boolean
    songsHash?: string
  }
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 80) : ""
  if (!clientId) return NextResponse.json({ error: "BadRequest" }, { status: 400 })

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { songs: { orderBy: { position: "asc" } } },
  })
  if (!room || !room.isActive) return NextResponse.json({ error: "NotFound" }, { status: 404 })

  const members = await touchPresence(roomId, clientId, Boolean(body.buffering))
  const { playback, lock } = await applyLockstep(roomId, members)
  const serverNow = Date.now()
  const live = playback ? livePosition(playback, serverNow) : 0
  const songsHash = (room.songs ?? []).map((s) => s.id).join("|")
  const includeSongs = body.songsHash !== songsHash

  return NextResponse.json({
    serverNow,
    livePosition: live,
    isPlaying: playback?.isPlaying ?? false,
    playbackSeq: playback?.playbackSeq ?? 0,
    pausedBy: playback?.pausedBy ?? null,
    playingUrl: playback?.playingUrl ?? null,
    playingTitle: playback?.playingTitle ?? null,
    playingThumb: playback?.playingThumb ?? youtubeThumb(playback?.playingUrl),
    stall: lock.shouldHold,
    stallReason: lock.reason,
    peers: lock.peers,
    songsHash,
    songs: includeSongs ? room.songs : undefined,
  })
}
