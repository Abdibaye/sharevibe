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

type ControlEvent = {
  action: 'play' | 'pause' | 'seek'
  timestamp?: number // seconds at which to seek or current position
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
  const setControl = usePlayerStore((s) => s.setControl)

  const senderIdRef = useRef<string>(uuidv4())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const muteBroadcastRef = useRef(false)
  // simple in-memory cache for fetched metadata by videoId
  const metaCacheRef = useRef<Map<string, { title: string; thumbnailUrl?: string; channelTitle?: string }>>(new Map())

  // helper: fetch metadata for a given YouTube video ID via internal API
  const fetchMetaForId = async (videoId: string) => {
    const cached = metaCacheRef.current.get(videoId)
    if (cached) return cached
    try {
      const res = await fetch('/api/youtube-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      })
      if (!res.ok) throw new Error('meta fetch failed')
      const data = await res.json()
      const meta = { title: data?.title as string, thumbnailUrl: data?.thumbnailUrl as string | undefined, channelTitle: data?.channelTitle as string | undefined }
      if (meta && meta.title) metaCacheRef.current.set(videoId, meta)
      return meta
    } catch {
      return undefined
    }
  }

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
  channel.on('broadcast', { event: 'queue:update' }, async (payload: unknown) => {
      try {
        const env = (payload as any).payload as EventEnvelope<QueuePayload>
        if (!env || env.senderId === sid) return
        const ids = (env.data.videoIds || []).slice(0, getState.getState().maxQueueSize)
        const existing = getState.getState().queue

        // Identify which IDs are not cached locally
        const uncached = ids.filter((vid) => !metaCacheRef.current.has(vid))
        if (uncached.length) {
          try {
            const res = await fetch('/api/youtube-metadata/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: uncached }),
            })
            if (res.ok) {
              const map = await res.json()
              for (const vid of Object.keys(map || {})) {
                const m = map[vid]
                if (m?.title) metaCacheRef.current.set(vid, { title: m.title, channelTitle: m.channelTitle, thumbnailUrl: m.thumbnailUrl })
              }
            }
          } catch {}
        }

        // build tracks with best-known metadata
        const tracks: Track[] = ids.map((vid) => {
          const found = existing.find((t) => t.url?.includes(vid))
          if (found) return found
          const meta = metaCacheRef.current.get(vid)
          return {
            id: vid,
            title: meta?.title || `YouTube ${vid}`,
            artist: 'Guest',
            url: `https://www.youtube.com/watch?v=${vid}`,
            thumbnailUrl: meta?.thumbnailUrl,
          }
        })
        // prevent rebroadcast while applying remote queue
        muteBroadcastRef.current = true
        setQueue(tracks)
        setTimeout(() => { muteBroadcastRef.current = false }, 0)
      } catch {}
    })

  // Handle nowPlaying updates
  channel.on('broadcast', { event: 'nowPlaying:update' }, async (payload: unknown) => {
      try {
        const env = (payload as any).payload as EventEnvelope<NowPlayingPayload>
        if (!env || env.senderId === sid) return
        const { videoId, timestamp } = env.data
        const current = getState.getState().current
        const currentVid = current?.url?.match(/(?:v=|youtu\.be\/|embed\/|\/v\/|shorts\/)([\w-]{11})/)?.[1]
        if (currentVid === videoId) return
        const meta = await fetchMetaForId(videoId)
        const track: Track = {
          id: videoId,
          title: meta?.title || `YouTube ${videoId}`,
          artist: 'Guest',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl: meta?.thumbnailUrl,
          // Let UI seek after player loads
          startAt: typeof timestamp === 'number' ? Math.max(0, timestamp) : 0,
        }
        getState.getState().setCurrent(track)
      } catch {}
    })

    // Handle control updates (play/pause/seek)
    channel.on('broadcast', { event: 'control:update' }, (payload: unknown) => {
      try {
        const env = (payload as any).payload as EventEnvelope<ControlEvent>
        if (!env || env.senderId === sid) return
        setControl(env.data)
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

  // Broadcast control actions to other guests in the temp room
  const publishControl = useMemo(() => (params: ControlEvent) => {
    const isTemp = room?.type === 'temp'
    if (!isTemp || !activeRoomId) return
    const sid = senderIdRef.current as string
    channelRef.current?.send({
      type: 'broadcast',
      event: 'control:update',
      payload: { senderId: sid, data: params } as EventEnvelope<ControlEvent>,
    })
  }, [activeRoomId, room?.type])

  return { publishNowPlaying, publishControl }
}

export default useRealtimeGuestRoom
