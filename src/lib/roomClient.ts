"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'
import { uuidv4 } from './utils'

type CreateRoomOptions = Record<string, never>

export async function createRoom(_opts?: CreateRoomOptions) {
  const { isGuest, setRoom, isUser } = useSessionStore.getState()
  const player = usePlayerStore.getState()

  if (isGuest()) {
    const tempId = uuidv4()
    setRoom({ id: tempId, type: 'temp' })
    player.clearQueue()
    return { id: tempId, type: 'temp' as const }
  }

  if (isUser()) {
    const res = await fetch('/api/rooms/create', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to create room')
    const data = await res.json()
    setRoom({ id: data.room.id, type: 'db' })
    player.clearQueue()
    // server-side queue is empty initially
    return { id: data.room.id, type: 'db' as const }
  }

  throw new Error('Unknown session mode')
}

export async function joinRoom(id: string) {
  const { isGuest, setRoom, isUser } = useSessionStore.getState()
  const player = usePlayerStore.getState()

  if (isGuest()) {
    setRoom({ id, type: 'temp' })
    // leave existing queue as-is; or clear if you prefer reset
    return { id, type: 'temp' as const }
  }

  if (isUser()) {
    const res = await fetch(`/api/rooms/${id}`)
    if (res.status === 404) {
      // Fallback: treat as guest temp room when no DB room exists
      setRoom({ id, type: 'temp' })
      return { id, type: 'temp' as const }
    }
    if (!res.ok) throw new Error('Room not found')
    const data = await res.json()
    setRoom({ id: data.room.id, type: 'db' })
    // Map DB songs to Track and set into queue
  type DbSong = { id: string; title: string; url: string; addedBy: string }
  const tracks: Track[] = (data.room.songs ?? []).map((s: DbSong) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      artist: s.addedBy,
      // duration not stored; you could fetch metadata
    }))
    player.setQueue(tracks)
    return { id: data.room.id, type: 'db' as const }
  }

  throw new Error('Unknown session mode')
}
