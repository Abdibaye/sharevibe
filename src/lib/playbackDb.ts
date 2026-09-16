import { prisma } from "@/lib/prisma"

export type PlaybackRow = {
  roomId: string
  playingUrl: string | null
  playingTitle: string | null
  playingThumb: string | null
  playingAt: number
  isPlaying: boolean
  playbackClock: Date | null
  playbackSeq: number
}

const memory = new Map<string, PlaybackRow>()
let tableReady: Promise<boolean> | null = null

async function ensureTable() {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RoomPlayback" (
        "roomId" TEXT PRIMARY KEY,
        "playingUrl" TEXT,
        "playingTitle" TEXT,
        "playingThumb" TEXT,
        "playingAt" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "isPlaying" BOOLEAN NOT NULL DEFAULT false,
        "playbackClock" TIMESTAMPTZ,
        "playbackSeq" INTEGER NOT NULL DEFAULT 0
      )
    `).then(() => true).catch(() => false)
  }
  return tableReady
}

export async function getPlayback(roomId: string): Promise<PlaybackRow | null> {
  const ok = await ensureTable()
  if (!ok) return memory.get(roomId) ?? null
  const rows = await prisma.$queryRawUnsafe<PlaybackRow[]>(
    `SELECT "roomId", "playingUrl", "playingTitle", "playingThumb", "playingAt", "isPlaying", "playbackClock", "playbackSeq" FROM "RoomPlayback" WHERE "roomId" = $1`,
    roomId
  )
  return rows[0] ?? memory.get(roomId) ?? null
}

export async function setPlayback(roomId: string, patch: {
  playingUrl?: string | null
  playingTitle?: string | null
  playingThumb?: string | null
  playingAt?: number
  isPlaying?: boolean
}): Promise<PlaybackRow> {
  const prev = (await getPlayback(roomId)) ?? {
    roomId,
    playingUrl: null,
    playingTitle: null,
    playingThumb: null,
    playingAt: 0,
    isPlaying: false,
    playbackClock: null,
    playbackSeq: 0,
  }
  const next: PlaybackRow = {
    roomId,
    playingUrl: patch.playingUrl === undefined ? prev.playingUrl : patch.playingUrl,
    playingTitle: patch.playingTitle === undefined ? prev.playingTitle : patch.playingTitle,
    playingThumb: patch.playingThumb === undefined ? prev.playingThumb : patch.playingThumb,
    playingAt: typeof patch.playingAt === "number" ? Math.max(0, patch.playingAt) : prev.playingAt,
    isPlaying: typeof patch.isPlaying === "boolean" ? patch.isPlaying : prev.isPlaying,
    playbackClock: new Date(),
    playbackSeq: prev.playbackSeq + 1,
  }
  memory.set(roomId, next)
  const ok = await ensureTable()
  if (ok) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RoomPlayback" ("roomId","playingUrl","playingTitle","playingThumb","playingAt","isPlaying","playbackClock","playbackSeq")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT ("roomId") DO UPDATE SET
         "playingUrl" = EXCLUDED."playingUrl",
         "playingTitle" = EXCLUDED."playingTitle",
         "playingThumb" = EXCLUDED."playingThumb",
         "playingAt" = EXCLUDED."playingAt",
         "isPlaying" = EXCLUDED."isPlaying",
         "playbackClock" = EXCLUDED."playbackClock",
         "playbackSeq" = EXCLUDED."playbackSeq"`,
      next.roomId,
      next.playingUrl,
      next.playingTitle,
      next.playingThumb,
      next.playingAt,
      next.isPlaying,
      next.playbackClock,
      next.playbackSeq
    )
  }
  return next
}
