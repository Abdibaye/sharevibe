"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'
import { songToTrack } from './queueClient'
import { extractYouTubeId } from '@/lib/utils'
import { youtubeThumb } from '@/lib/roomState'

type RoomPayload = {
  room?: {
    id: string
    songs?: Parameters<typeof songToTrack>[0][]
    playingUrl?: string | null
    playingTitle?: string | null
    playingThumb?: string | null
    livePosition?: number
    playingAt?: number
    isPlaying?: boolean
  }
}

async function fetchRoom(id: string) {
  const res = await fetch(`/api/rooms/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Room not found')
  const data: RoomPayload = await res.json()
  return data.room ?? null
}

async function ensureRoom(id?: string) {
  const res = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { id } : {}),
  })
  if (res.ok) {
    const data: RoomPayload = await res.json()
    if (!data.room?.id) throw new Error('Failed to create room')
    return data.room
  }
  if (id) {
    const existing = await fetchRoom(id)
    if (existing) return existing
  }
  throw new Error('Failed to create room')
}

function applySongs(songs: Parameters<typeof songToTrack>[0][] | undefined) {
  const tracks: Track[] = (songs ?? []).map(songToTrack)
  if (tracks.length > 0) usePlayerStore.getState().setQueue(tracks)
  return tracks
}

function applyPlayback(room: NonNullable<RoomPayload["room"]>) {
  if (!room.playingUrl) return
  const videoId = extractYouTubeId(room.playingUrl)
  const position = Math.max(0, room.livePosition ?? room.playingAt ?? 0)
  const fromQueue = usePlayerStore.getState().queue.find(
    (t) => t.url === room.playingUrl || extractYouTubeId(t.url) === videoId
  )
  const track: Track = {
    id: videoId || fromQueue?.id || room.playingUrl,
    dbId: fromQueue?.dbId,
    title: room.playingTitle || fromQueue?.title || "Now playing",
    url: room.playingUrl,
    thumbnailUrl: room.playingThumb || fromQueue?.thumbnailUrl || youtubeThumb(room.playingUrl),
    artist: fromQueue?.artist,
    startAt: position,
  }
  const player = usePlayerStore.getState()
  player.setCurrent(track)
  if (room.isPlaying) player.play()
  else player.pause()
  player.setSyncClock({
    url: room.playingUrl,
    position,
    playing: Boolean(room.isPlaying),
    capturedAt: Date.now(),
    stall: false,
    stallReason: null,
    peers: 1,
  })
}

export async function createRoom() {
  const player = usePlayerStore.getState()
  player.clearQueue()
  try { localStorage.removeItem('guest-room-state') } catch {}
  const room = await ensureRoom()
  useSessionStore.getState().setRoom({ id: room.id, type: 'db' })
  applySongs(room.songs)
  return { id: room.id, type: 'db' as const }
}

export async function joinRoom(id: string) {
  let room = await fetchRoom(id)
  if (!room) room = await ensureRoom(id)
  useSessionStore.getState().setRoom({ id: room.id, type: 'db' })
  applySongs(room.songs)
  applyPlayback(room)
  return { id: room.id, type: 'db' as const }
}

export function roomShareUrl(roomId: string) {
  if (typeof window === 'undefined') return `/room?id=${roomId}`
  return `${window.location.origin}/room?id=${roomId}`
}
