"use client"

import { useEffect, useMemo, useRef } from 'react'
import supabase from '@/lib/supabaseClient'
import { usePlayerStore, type Track } from '@/stores/playerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { uuidv4 } from '@/lib/utils'

type NowPlayingPayload = {
  videoId: string
  timestamp?: number // seconds from start
}

type QueuePayload = {
  // For guest mode we only need YouTube IDs; Track details live locally
  videoIds: string[]
}

type EventEnvelope<T> = {
  // random UUID used to ignore self events
  senderId: string
  data: T
}

/**
 * Join a Supabase Realtime channel for a guest room and sync Zustand state.
 * - Broadcast queue changes (max 3 enforced by store)
 * - Broadcast nowPlaying updates
 * - Apply incoming events to local store
 */
export function useRealtimeGuestRoom(roomId?: string | null) {
  const { room, isGuest } = useSessionStore()
  const getState = usePlayerStore
  const setQueue = usePlayerStore((s) => s.setQueue)
  const queue = usePlayerStore((s) => s.queue)

  const senderIdRef = useRef<string>(uuidv4())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const muteBroadcastRef = useRef(false)

  // normalize room id: default to session room
  const activeRoomId = roomId ?? room?.id ?? null

  // Subscribe to Supabase channel
  useEffect(() => {
    const isTemp = room?.type === 'temp'
    if (!isTemp || !activeRoomId) return

    const channelName = `guest-room:${activeRoomId}`
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } })
  channelRef.current = channel

  const sid = senderIdRef.current

    // Handle incoming queue updates
  channel.on('broadcast', { event: 'queue:update' }, (payload: unknown) => {
      try {
    const env = (payload as any).payload as EventEnvelope<QueuePayload>
        if (!env || env.senderId === sid) return
  const ids = env.data.videoIds || []
        // Map to minimal Tracks; preserve titles if already known locally
        const existing = getState.getState().queue
        const map: Record<string, Track> = {}
        for (const t of existing) map[t.id] = t
  const tracks: Track[] = ids.slice(0, 3).map((vid) => {
          const found = existing.find((t) => t.url?.includes(vid))
          if (found) return found
          // Minimal placeholder; UI shows title when added locally
          return { id: vid, title: `YouTube ${vid}`, artist: 'Guest', url: `https://www.youtube.com/watch?v=${vid}` }
        })
  // prevent rebroadcast
  muteBroadcastRef.current = true
  setQueue(tracks)
  setTimeout(() => { muteBroadcastRef.current = false }, 0)
      } catch {}
    })

    // Handle nowPlaying updates
  channel.on('broadcast', { event: 'nowPlaying:update' }, (payload: unknown) => {
      try {
    const env = (payload as any).payload as EventEnvelope<NowPlayingPayload>
        if (!env || env.senderId === sid) return
        const { videoId, timestamp } = env.data
        const current = getState.getState().current
        const currentVid = current?.url?.match(/(?:v=|youtu\.be\/|embed\/|\/v\/|shorts\/)([\w-]{11})/)?.[1]
        if (currentVid === videoId) return
        // Set current track to this video ID; minimal info
        const track: Track = {
          id: videoId,
          title: `YouTube ${videoId}`,
          artist: 'Guest',
          url: `https://www.youtube.com/watch?v=${videoId}`,
        }
        getState.getState().setCurrent(track)
        // NOTE: Seeking to timestamp is handled by UI layer if desired
      } catch {}
    })

  channel.subscribe((_status: unknown) => {
      // noop; could log status
    })

    return () => {
      try { supabase.removeChannel(channel) } catch {}
      channelRef.current = null
    }
  }, [activeRoomId, room?.type, getState, setQueue])

  // Broadcast queue whenever it changes locally
  useEffect(() => {
    const isTemp = room?.type === 'temp'
    if (!isTemp || !activeRoomId) return
  if (muteBroadcastRef.current) return
  const sid = senderIdRef.current
    const ids = (queue || [])
      .map((t: Track) => t.url?.match(/(?:v=|youtu\.be\/|embed\/|\/v\/|shorts\/)([\w-]{11})/)?.[1])
      .filter(Boolean) as string[]
    channelRef.current?.send({
      type: 'broadcast',
      event: 'queue:update',
      payload: { senderId: sid, data: { videoIds: ids } as QueuePayload } as EventEnvelope<QueuePayload>,
    })
  }, [queue, activeRoomId, room?.type])

  // Expose helpers for publishing nowPlaying explicitly
  const publishNowPlaying = useMemo(() => (params: NowPlayingPayload) => {
    const isTemp = room?.type === 'temp'
    if (!isTemp || !activeRoomId) return
  const sid = senderIdRef.current as string
  channelRef.current?.send({
      type: 'broadcast',
      event: 'nowPlaying:update',
      payload: { senderId: sid, data: params } as EventEnvelope<NowPlayingPayload>,
    })
  }, [activeRoomId, room?.type])

  return { publishNowPlaying }
}

export default useRealtimeGuestRoom
