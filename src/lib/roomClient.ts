"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'
import { uuidv4 } from './utils'
import { songToTrack } from './queueClient'

export async function createRoom() {
  const { isGuest, setRoom, isUser } = useSessionStore.getState()
  const player = usePlayerStore.getState()

  if (isGuest()) {
    const tempId = uuidv4()
    setRoom({ id: tempId, type: 'temp' })
    player.clearQueue()
    try { localStorage.removeItem('guest-room-state') } catch {}
    return { id: tempId, type: 'temp' as const }
  }

  if (isUser()) {
    const res = await fetch('/api/rooms/create', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to create room')
    const data = await res.json()
    setRoom({ id: data.room.id, type: 'db' })
    player.clearQueue()
    return { id: data.room.id, type: 'db' as const }
  }

  throw new Error('Unknown session mode')
}

export async function joinRoom(id: string) {
  const { isGuest, setRoom, isUser } = useSessionStore.getState()
  const player = usePlayerStore.getState()

  if (isGuest()) {
    setRoom({ id, type: 'temp' })
    try {
      usePlayerStore.setState({ queue: [], current: null })
    } catch {}
    return { id, type: 'temp' as const }
  }

  if (isUser()) {
    const res = await fetch(`/api/rooms/${id}`)
    if (res.status === 404) {
      setRoom({ id, type: 'temp' })
      try {
        usePlayerStore.setState({ queue: [], current: null })
      } catch {}
      return { id, type: 'temp' as const }
    }
    if (!res.ok) throw new Error('Room not found')
    const data = await res.json()
    setRoom({ id: data.room.id, type: 'db' })
    const tracks: Track[] = (data.room.songs ?? []).map(songToTrack)
    player.setQueue(tracks)
    return { id: data.room.id, type: 'db' as const }
  }

  throw new Error('Unknown session mode')
}

export function roomShareUrl(roomId: string) {
  if (typeof window === 'undefined') return `/room?id=${roomId}`
  return `${window.location.origin}/room?id=${roomId}`
}
