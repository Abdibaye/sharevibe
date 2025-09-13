"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'

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
