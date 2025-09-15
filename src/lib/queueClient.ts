"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'

type DbSong = { id: string; title: string; url: string; addedBy: string }
type SongsResponse = { songs?: DbSong[] }

export async function enqueue(track: Track) {
  const { isGuest, isUser, room } = useSessionStore.getState()
  const player = usePlayerStore.getState()

  if (!room) throw new Error('No active room')

  if (isGuest() || room.type === 'temp') {
    const ok = player.enqueue(track)
    if (!ok) throw new Error('Queue limit reached')
    return
  }

  if (isUser() && room.type === 'db') {
    const res = await fetch(`/api/rooms/${room.id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: track.title, url: track.url, addedBy: track.artist }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error ?? 'Failed to enqueue')
    }
    return
  }
}

export async function removeFromQueue(id: string) {
  const { isGuest, isUser, room } = useSessionStore.getState()
  const player = usePlayerStore.getState()
  if (!room) throw new Error('No active room')

  if (isGuest() || room.type === 'temp') {
    player.dequeue(id)
    return
  }

  if (isUser() && room.type === 'db') {
    const res = await fetch(`/api/rooms/${room.id}/songs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: id }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error ?? 'Failed to remove song')
    }
  const data: SongsResponse = await res.json()
  const tracks: Track[] = (data.songs ?? []).map((s) => ({ id: s.id, title: s.title, url: s.url, artist: s.addedBy }))
    player.setQueue(tracks)
    return
  }
}

export async function shuffleQueue() {
  const { isGuest, isUser, room } = useSessionStore.getState()
  const player = usePlayerStore.getState()
  if (!room) throw new Error('No active room')

  if (isGuest() || room.type === 'temp') {
    const arr = [...player.queue]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    player.setQueue(arr)
    return
  }

  if (isUser() && room.type === 'db') {
    const res = await fetch(`/api/rooms/${room.id}/songs/shuffle`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error ?? 'Failed to shuffle')
    }
  const data: SongsResponse = await res.json()
  const tracks: Track[] = (data.songs ?? []).map((s) => ({ id: s.id, title: s.title, url: s.url, artist: s.addedBy }))
    player.setQueue(tracks)
    return
  }
}
