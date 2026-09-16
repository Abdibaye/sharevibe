"use client"

import { useEffect, useMemo, useRef } from 'react'
import supabase from '@/lib/supabaseClient'
import { usePlayerStore, type Track } from '@/stores/playerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { extractYouTubeId, uuidv4 } from '@/lib/utils'

type NowPlayingPayload = {
  videoId: string
  timestamp?: number
  playing?: boolean
}

type QueuePayload = {
  videoIds: string[]
}

type EventEnvelope<T> = {
  senderId: string
  data: T
}

type ControlEvent = {
  action: 'play' | 'pause' | 'seek'
  timestamp?: number
}

type SyncRequest = { req: true }

const JOIN_GRACE_MS = 1800

function trackVideoId(track?: Track | null): string | undefined {
  if (!track) return undefined
  return extractYouTubeId(track.url) || (track.id.length === 11 ? track.id : undefined)
}

function envelopeFrom(payload: unknown): EventEnvelope<unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const direct = payload as { senderId?: string; data?: unknown; payload?: EventEnvelope<unknown> }
  if (direct.senderId && 'data' in direct) return direct as EventEnvelope<unknown>
  if (direct.payload?.senderId) return direct.payload
  return null
}

/**
 * Join a Supabase Realtime channel and sync Zustand playback state.
 */
export function useRealtimeGuestRoom(roomId?: string | null) {
  const { room } = useSessionStore()
  const getState = usePlayerStore
  const setQueue = usePlayerStore((s) => s.setQueue)
  const queue = usePlayerStore((s) => s.queue)
  const current = usePlayerStore((s) => s.current)
  const setControl = usePlayerStore((s) => s.setControl)

  const senderIdRef = useRef<string>(uuidv4())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const muteBroadcastRef = useRef(false)
  const muteNowPlayingBroadcastRef = useRef(false)
  const joinedAtRef = useRef<number>(0)
  const subscribedRef = useRef(false)
  const metaCacheRef = useRef<Map<string, { title: string; thumbnailUrl?: string; channelTitle?: string }>>(new Map())

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

  const activeRoomId = roomId ?? room?.id ?? null

  useEffect(() => {
    if (!activeRoomId) return

    const channelName = `guest-room:${activeRoomId}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: true, self: false } },
    })
    channelRef.current = channel
    subscribedRef.current = false
    const sid = senderIdRef.current
    const timers: ReturnType<typeof setTimeout>[] = []

    const replyWithState = () => {
      const st = getState.getState()
      const ids = (st.queue || [])
        .map((t: Track) => trackVideoId(t))
        .filter(Boolean) as string[]
      if (ids.length) {
        channel.send({
          type: 'broadcast',
          event: 'queue:update',
          payload: { senderId: sid, data: { videoIds: ids } as QueuePayload } as EventEnvelope<QueuePayload>,
        })
      }
      const vid = trackVideoId(st.current)
      const timestamp = typeof st.progress === 'number' ? st.progress : 0
      if (vid) {
        channel.send({
          type: 'broadcast',
          event: 'nowPlaying:update',
          payload: {
            senderId: sid,
            data: { videoId: vid, timestamp, playing: st.isPlaying } as NowPlayingPayload,
          } as EventEnvelope<NowPlayingPayload>,
        })
        channel.send({
          type: 'broadcast',
          event: 'control:update',
          payload: {
            senderId: sid,
            data: { action: st.isPlaying ? 'play' : 'pause', timestamp } as ControlEvent,
          } as EventEnvelope<ControlEvent>,
        })
      }
    }

    const requestSync = () => {
      channel.send({
        type: 'broadcast',
        event: 'sync:request',
        payload: { senderId: sid, data: { req: true } as SyncRequest } as EventEnvelope<SyncRequest>,
      })
    }

    channel.on('broadcast', { event: 'queue:update' }, async (payload: unknown) => {
      try {
        const env = envelopeFrom(payload) as EventEnvelope<QueuePayload> | null
        if (!env || env.senderId === sid) return
        const ids = (env.data.videoIds || []).slice(0, getState.getState().maxQueueSize)
        const existing = getState.getState().queue

        if (ids.length === 0 && (existing?.length ?? 0) > 0) return

        const uncached = ids.filter((vid) => !metaCacheRef.current.has(vid))
        if (uncached.length) {
          try {
            const res = await fetch('/api/youtube-metadata/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: uncached }),
            })
            if (res.ok) {
              const map = (await res.json()) as Record<string, { title?: string; channelTitle?: string; thumbnailUrl?: string }>
              for (const vid of Object.keys(map || {})) {
                const m = map[vid]
                if (m?.title) metaCacheRef.current.set(vid, { title: m.title, channelTitle: m.channelTitle, thumbnailUrl: m.thumbnailUrl })
              }
            }
          } catch {}
        }

        const tracks: Track[] = ids.map((vid) => {
          const found = existing.find((t) => t.id === vid || extractYouTubeId(t.url) === vid)
          if (found) return { ...found, id: vid }
          const meta = metaCacheRef.current.get(vid)
          return {
            id: vid,
            title: meta?.title || `YouTube ${vid}`,
            artist: 'Guest',
            url: `https://www.youtube.com/watch?v=${vid}`,
            thumbnailUrl: meta?.thumbnailUrl,
          }
        })
        muteBroadcastRef.current = true
        setQueue(tracks)
        setTimeout(() => { muteBroadcastRef.current = false }, 0)
      } catch {}
    })

    channel.on('broadcast', { event: 'nowPlaying:update' }, async (payload: unknown) => {
      try {
        const env = envelopeFrom(payload) as EventEnvelope<NowPlayingPayload> | null
        if (!env || env.senderId === sid) return
        const { videoId, timestamp, playing } = env.data
        const currentTrack = getState.getState().current
        const currentVid = trackVideoId(currentTrack)
        const ts = typeof timestamp === 'number' ? Math.max(0, timestamp) : 0

        if (currentVid === videoId) {
          setControl({
            action: playing === false ? 'pause' : playing === true ? 'play' : 'seek',
            timestamp: ts,
          })
          return
        }

        const meta = await fetchMetaForId(videoId)
        const track: Track = {
          id: videoId,
          title: meta?.title || `YouTube ${videoId}`,
          artist: 'Guest',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl: meta?.thumbnailUrl,
          startAt: ts,
        }
        muteNowPlayingBroadcastRef.current = true
        getState.getState().setCurrent(track)
        if (playing === false) getState.getState().pause()
        else if (playing === true) getState.getState().play()
        setTimeout(() => { muteNowPlayingBroadcastRef.current = false }, 0)
      } catch {}
    })

    channel.on('broadcast', { event: 'control:update' }, (payload: unknown) => {
      try {
        const env = envelopeFrom(payload) as EventEnvelope<ControlEvent> | null
        if (!env || env.senderId === sid) return
        setControl(env.data)
      } catch {}
    })

    channel.on('broadcast', { event: 'sync:request' }, (payload: unknown) => {
      try {
        const env = envelopeFrom(payload) as EventEnvelope<SyncRequest> | null
        if (!env || env.senderId === sid) return
        replyWithState()
      } catch {}
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      subscribedRef.current = true
      joinedAtRef.current = Date.now()
      requestSync()
      timers.push(setTimeout(requestSync, 700))
      timers.push(setTimeout(requestSync, 1800))
      timers.push(setTimeout(() => {
        const st = getState.getState()
        if (st.queue.length || st.current) replyWithState()
      }, JOIN_GRACE_MS))
    })

    return () => {
      subscribedRef.current = false
      for (const t of timers) clearTimeout(t)
      try { supabase.removeChannel(channel) } catch {}
      channelRef.current = null
    }
  }, [activeRoomId, getState, setQueue, setControl])

  useEffect(() => {
    if (!activeRoomId || !subscribedRef.current) return
    if (muteBroadcastRef.current) return
    if (Date.now() - (joinedAtRef.current || 0) < JOIN_GRACE_MS) return
    const sid = senderIdRef.current
    const ids = (queue || [])
      .map((t: Track) => trackVideoId(t))
      .filter(Boolean) as string[]
    channelRef.current?.send({
      type: 'broadcast',
      event: 'queue:update',
      payload: { senderId: sid, data: { videoIds: ids } as QueuePayload } as EventEnvelope<QueuePayload>,
    })
  }, [queue, activeRoomId])

  useEffect(() => {
    if (!activeRoomId || !subscribedRef.current) return
    if (muteNowPlayingBroadcastRef.current) return
    if (Date.now() - (joinedAtRef.current || 0) < JOIN_GRACE_MS) return
    const sid = senderIdRef.current
    const vid = trackVideoId(current)
    if (!vid) return
    const st = getState.getState()
    channelRef.current?.send({
      type: 'broadcast',
      event: 'nowPlaying:update',
      payload: {
        senderId: sid,
        data: {
          videoId: vid,
          timestamp: typeof st.progress === 'number' ? st.progress : 0,
          playing: st.isPlaying,
        } as NowPlayingPayload,
      } as EventEnvelope<NowPlayingPayload>,
    })
  }, [current?.id, activeRoomId, getState])

  const publishNowPlaying = useMemo(() => (params: NowPlayingPayload) => {
    if (!activeRoomId) return
    const sid = senderIdRef.current as string
    channelRef.current?.send({
      type: 'broadcast',
      event: 'nowPlaying:update',
      payload: { senderId: sid, data: params } as EventEnvelope<NowPlayingPayload>,
    })
  }, [activeRoomId])

  const publishControl = useMemo(() => (params: ControlEvent) => {
    if (!activeRoomId) return
    const sid = senderIdRef.current as string
    channelRef.current?.send({
      type: 'broadcast',
      event: 'control:update',
      payload: { senderId: sid, data: params } as EventEnvelope<ControlEvent>,
    })
  }, [activeRoomId])

  return { publishNowPlaying, publishControl }
}

export default useRealtimeGuestRoom
