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
  pausedBy: "user" | "stall" | null
}

export type PresenceRow = {
  clientId: string
  lastSeen: number
  buffering: boolean
}

const playbackMem = new Map<string, PlaybackRow>()
const presenceMem = new Map<string, Map<string, PresenceRow>>()
let tableReady: Promise<boolean> | null = null

const STALE_MS = 3000
const LEFT_MS = 15000

function num(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RoomPlayback" (
          "roomId" TEXT PRIMARY KEY,
          "playingUrl" TEXT,
          "playingTitle" TEXT,
          "playingThumb" TEXT,
          "playingAt" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "isPlaying" BOOLEAN NOT NULL DEFAULT false,
          "playbackClock" TIMESTAMPTZ,
          "playbackSeq" INTEGER NOT NULL DEFAULT 0,
          "pausedBy" TEXT
        )
      `)
      await prisma.$executeRawUnsafe(`ALTER TABLE "RoomPlayback" ADD COLUMN IF NOT EXISTS "pausedBy" TEXT`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RoomPresence" (
          "roomId" TEXT NOT NULL,
          "clientId" TEXT NOT NULL,
          "lastSeen" TIMESTAMPTZ NOT NULL,
          "buffering" BOOLEAN NOT NULL DEFAULT false,
          PRIMARY KEY ("roomId", "clientId")
        )
      `)
      return true
    })().catch(() => false)
  }
  return tableReady
}

function mapPlayback(row: Record<string, unknown>, roomId: string): PlaybackRow {
  return {
    roomId,
    playingUrl: (row.playingUrl as string | null) ?? null,
    playingTitle: (row.playingTitle as string | null) ?? null,
    playingThumb: (row.playingThumb as string | null) ?? null,
    playingAt: num(row.playingAt),
    isPlaying: Boolean(row.isPlaying),
    playbackClock: row.playbackClock ? new Date(row.playbackClock as string | Date) : null,
    playbackSeq: num(row.playbackSeq),
    pausedBy: row.pausedBy === "user" || row.pausedBy === "stall" ? row.pausedBy : null,
  }
}

export function livePosition(row: PlaybackRow, now = Date.now()) {
  if (!row.isPlaying || !row.playbackClock) return Math.max(0, row.playingAt)
  return Math.max(0, row.playingAt + (now - row.playbackClock.getTime()) / 1000)
}

export async function getPlayback(roomId: string): Promise<PlaybackRow | null> {
  const ok = await ensureTable()
  if (!ok) return playbackMem.get(roomId) ?? null
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "roomId", "playingUrl", "playingTitle", "playingThumb", "playingAt", "isPlaying", "playbackClock", "playbackSeq", "pausedBy" FROM "RoomPlayback" WHERE "roomId" = $1`,
    roomId
  )
  if (rows[0]) {
    const mapped = mapPlayback(rows[0], roomId)
    playbackMem.set(roomId, mapped)
    return mapped
  }
  return playbackMem.get(roomId) ?? null
}

export async function setPlayback(roomId: string, patch: {
  playingUrl?: string | null
  playingTitle?: string | null
  playingThumb?: string | null
  playingAt?: number
  isPlaying?: boolean
  pausedBy?: "user" | "stall" | null
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
    pausedBy: null,
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
    pausedBy: patch.pausedBy === undefined ? prev.pausedBy : patch.pausedBy,
  }
  playbackMem.set(roomId, next)
  const ok = await ensureTable()
  if (ok) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RoomPlayback" ("roomId","playingUrl","playingTitle","playingThumb","playingAt","isPlaying","playbackClock","playbackSeq","pausedBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("roomId") DO UPDATE SET
         "playingUrl" = EXCLUDED."playingUrl",
         "playingTitle" = EXCLUDED."playingTitle",
         "playingThumb" = EXCLUDED."playingThumb",
         "playingAt" = EXCLUDED."playingAt",
         "isPlaying" = EXCLUDED."isPlaying",
         "playbackClock" = EXCLUDED."playbackClock",
         "playbackSeq" = EXCLUDED."playbackSeq",
         "pausedBy" = EXCLUDED."pausedBy"`,
      next.roomId,
      next.playingUrl,
      next.playingTitle,
      next.playingThumb,
      next.playingAt,
      next.isPlaying,
      next.playbackClock,
      next.playbackSeq,
      next.pausedBy
    )
  }
  return next
}

export async function touchPresence(roomId: string, clientId: string, buffering: boolean): Promise<PresenceRow[]> {
  const now = Date.now()
  let roomMap = presenceMem.get(roomId)
  if (!roomMap) {
    roomMap = new Map()
    presenceMem.set(roomId, roomMap)
  }
  roomMap.set(clientId, { clientId, lastSeen: now, buffering })
  for (const [id, row] of roomMap) {
    if (now - row.lastSeen > LEFT_MS) roomMap.delete(id)
  }

  const ok = await ensureTable()
  if (ok) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RoomPresence" ("roomId","clientId","lastSeen","buffering")
       VALUES ($1,$2,$3,$4)
       ON CONFLICT ("roomId","clientId") DO UPDATE SET "lastSeen" = EXCLUDED."lastSeen", "buffering" = EXCLUDED."buffering"`,
      roomId,
      clientId,
      new Date(now),
      buffering
    )
    await prisma.$executeRawUnsafe(
      `DELETE FROM "RoomPresence" WHERE "roomId" = $1 AND "lastSeen" < $2`,
      roomId,
      new Date(now - LEFT_MS)
    )
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "clientId", "lastSeen", "buffering" FROM "RoomPresence" WHERE "roomId" = $1`,
      roomId
    )
    return rows.map((r) => ({
      clientId: String(r.clientId),
      lastSeen: new Date(r.lastSeen as string | Date).getTime(),
      buffering: Boolean(r.buffering),
    }))
  }

  return [...roomMap.values()]
}

export function lockstepState(members: PresenceRow[], now = Date.now()) {
  const inRoom = members.filter((m) => now - m.lastSeen <= LEFT_MS)
  const healthy = inRoom.filter((m) => now - m.lastSeen <= STALE_MS)
  const offline = inRoom.some((m) => now - m.lastSeen > STALE_MS)
  // Do not stall on YouTube startup buffering — that prevented joiners from ever starting.
  const shouldHold = inRoom.length >= 2 && offline
  return { peers: inRoom.length, healthy: healthy.length, shouldHold, reason: shouldHold ? "peer-offline" as const : null }
}

export async function applyLockstep(roomId: string, members: PresenceRow[]) {
  const playback = await getPlayback(roomId)
  if (!playback) return { playback: null as PlaybackRow | null, lock: lockstepState(members) }
  const lock = lockstepState(members)
  const now = Date.now()
  if (lock.shouldHold && playback.isPlaying) {
    const frozen = livePosition(playback, now)
    const next = await setPlayback(roomId, {
      playingAt: frozen,
      isPlaying: false,
      pausedBy: "stall",
    })
    return { playback: next, lock }
  }
  if (!lock.shouldHold && playback.pausedBy === "stall" && !playback.isPlaying) {
    const next = await setPlayback(roomId, {
      isPlaying: true,
      pausedBy: null,
      playingAt: playback.playingAt,
    })
    return { playback: next, lock }
  }
  return { playback, lock }
}
