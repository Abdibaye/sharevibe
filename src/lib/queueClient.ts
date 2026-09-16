"use client"

import { useSessionStore } from '@/stores/sessionStore'
import { usePlayerStore, Track } from '@/stores/playerStore'
import { extractYouTubeId } from '@/lib/utils'
import { youtubeThumb } from '@/lib/roomState'

type DbSong = { id: string; title: string; url: string; addedBy: string; thumbnailUrl?: string | null }
type SongsResponse = { songs?: DbSong[]; song?: DbSong }

export function songToTrack(s: DbSong): Track {
  const videoId = extractYouTubeId(s.url)
  return {
    id: videoId || s.id,
    dbId: s.id,
    title: s.title,
    url: s.url,
    artist: s.addedBy,
    thumbnailUrl: youtubeThumb(s.url, s.thumbnailUrl),
  }
}

export async function enqueue(track: Track) {
  const { room } = useSessionStore.getState()
  const player = usePlayerStore.getState()
  if (!room) throw new Error('No active room')

  const res = await fetch(`/api/rooms/${room.id}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: track.title,
      url: track.url,
      addedBy: track.artist,
      thumbnailUrl: track.thumbnailUrl,
    }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error ?? 'Failed to enqueue')
  }
  const data: SongsResponse = await res.json()
  const saved = data.song ? songToTrack(data.song) : track
  const merged: Track = {
    ...track,
    ...saved,
    id: extractYouTubeId(saved.url || track.url) || saved.id || track.id,
    dbId: saved.dbId || data.song?.id,
    thumbnailUrl: track.thumbnailUrl || saved.thumbnailUrl,
  }
  const ok = player.enqueue(merged)
  if (!ok) throw new Error('Queue limit reached')
}

export async function removeFromQueue(id: string) {
  const { room } = useSessionStore.getState()
  const player = usePlayerStore.getState()
  if (!room) throw new Error('No active room')

  const prevQueue = [...player.queue]
  const wasCurrent = player.current?.id === id
  const removedIdx = prevQueue.findIndex((t) => t.id === id)
  const nextCandidateId = removedIdx >= 0 ? prevQueue[removedIdx + 1]?.id : undefined
  const dbId = prevQueue[removedIdx]?.dbId
  const res = await fetch(`/api/rooms/${room.id}/songs`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId: dbId || id, videoId: id }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error ?? 'Failed to remove song')
  }
  const data: SongsResponse = await res.json()
  const tracks: Track[] = (data.songs ?? []).map(songToTrack)
  const nextTrack = wasCurrent ? (tracks.find((t) => t.id === nextCandidateId) ?? tracks[0] ?? null) : (usePlayerStore.getState().current ?? null)
  usePlayerStore.setState((s) => ({
    queue: tracks,
    current: wasCurrent ? nextTrack : (s.current ?? null),
  }))
}

export async function shuffleQueue() {
  const { room } = useSessionStore.getState()
  const player = usePlayerStore.getState()
  if (!room) throw new Error('No active room')

  const res = await fetch(`/api/rooms/${room.id}/songs/shuffle`, { method: 'POST' })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error ?? 'Failed to shuffle')
  }
  const data: SongsResponse = await res.json()
  const tracks: Track[] = (data.songs ?? []).map(songToTrack)
  player.setQueue(tracks)
}
