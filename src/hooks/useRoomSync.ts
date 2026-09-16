"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePlayerStore, type Track } from "@/stores/playerStore"
import { songToTrack } from "@/lib/queueClient"
import { extractYouTubeId, uuidv4 } from "@/lib/utils"
import { youtubeThumb } from "@/lib/roomState"

type TickResponse = {
  serverNow: number
  livePosition: number
  isPlaying: boolean
  playbackSeq: number
  pausedBy?: "user" | "stall" | null
  playingUrl: string | null
  playingTitle: string | null
  playingThumb: string | null
  stall: boolean
  stallReason: "buffering" | "peer-offline" | null
  peers: number
  songsHash: string
  songs?: Parameters<typeof songToTrack>[0][]
}

type ControlEvent = {
  action: "play" | "pause" | "seek"
  timestamp?: number
}

type NowPlayingPayload = {
  videoId: string
  timestamp?: number
  playing?: boolean
}

function fingerprint(tracks: Track[]) {
  return tracks.map((t) => t.id).join("|")
}

function clientId() {
  try {
    const key = "sharevibe-client-id"
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = uuidv4()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return uuidv4()
  }
}

export function useRoomSync(roomId?: string | null, buffering = false) {
  const setQueue = usePlayerStore((s) => s.setQueue)
  const setCurrent = usePlayerStore((s) => s.setCurrent)
  const setSyncClock = usePlayerStore((s) => s.setSyncClock)
  const [stall, setStall] = useState<{ active: boolean; reason: string | null; peers: number }>({
    active: false,
    reason: null,
    peers: 1,
  })
  const lastPostedSeq = useRef(0)
  const postingRef = useRef(false)
  const songsHashRef = useRef("")
  const cidRef = useRef<string>("")
  const bufferingRef = useRef(buffering)
  bufferingRef.current = buffering

  useEffect(() => {
    if (!roomId) return
    cidRef.current = clientId()
    lastPostedSeq.current = 0
    songsHashRef.current = ""
    let cancelled = false

    const applyTick = (tick: TickResponse) => {
      if (Array.isArray(tick.songs)) {
        const tracks = tick.songs.map(songToTrack)
        const local = usePlayerStore.getState()
        if (fingerprint(tracks) !== fingerprint(local.queue) && (tracks.length > 0 || local.queue.length === 0)) {
          setQueue(tracks)
        }
        songsHashRef.current = tick.songsHash
      }

      const url = tick.playingUrl
      if (url) {
        const videoId = extractYouTubeId(url)
        const local = usePlayerStore.getState()
        const fromQueue = local.queue.find((t) => t.url === url || extractYouTubeId(t.url) === videoId)
        const track: Track = {
          id: videoId || fromQueue?.id || url,
          dbId: fromQueue?.dbId,
          title: tick.playingTitle || fromQueue?.title || "Now playing",
          url,
          thumbnailUrl: tick.playingThumb || fromQueue?.thumbnailUrl || youtubeThumb(url),
          artist: fromQueue?.artist,
          startAt: tick.livePosition,
        }
        const currentVid = extractYouTubeId(local.current?.url) || local.current?.id
        const nextVid = videoId || track.id
        if (currentVid !== nextVid) {
          setCurrent(track)
          if (tick.isPlaying) usePlayerStore.getState().play()
          else usePlayerStore.getState().pause()
        }
        setSyncClock({
          url,
          position: tick.livePosition,
          playing: tick.isPlaying,
          capturedAt: Date.now(),
          stall: tick.stall,
          stallReason: tick.stallReason,
          peers: tick.peers,
        })
      }

      setStall({ active: tick.stall, reason: tick.stallReason, peers: tick.peers })

      if (Array.isArray(tick.songs) && tick.songs.length === 0) {
        const local = usePlayerStore.getState()
        if (local.queue.length > 0 && !postingRef.current) {
          postingRef.current = true
          void (async () => {
            try {
              for (const track of local.queue) {
                await fetch(`/api/rooms/${roomId}/songs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: track.title,
                    url: track.url,
                    addedBy: track.artist,
                    thumbnailUrl: track.thumbnailUrl,
                  }),
                }).catch(() => {})
              }
              if (local.current?.url) {
                const seq = await postPlayback(roomId, {
                  playingUrl: local.current.url,
                  playingTitle: local.current.title,
                  playingThumb: local.current.thumbnailUrl ?? null,
                  playingAt: local.progress || 0,
                  isPlaying: local.isPlaying,
                })
                if (typeof seq === "number") lastPostedSeq.current = seq
              }
            } finally {
              postingRef.current = false
            }
          })()
        }
      }
    }

    const tick = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/tick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: cidRef.current,
            buffering: bufferingRef.current,
            songsHash: songsHashRef.current,
          }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json() as TickResponse
        if (cancelled) return
        applyTick(data)
      } catch {}
    }

    void tick()
    const timer = setInterval(() => { void tick() }, 300)
    return () => {
      cancelled = true
      clearInterval(timer)
      setSyncClock(null)
    }
  }, [roomId, setQueue, setCurrent, setSyncClock])

  const publishNowPlaying = useMemo(() => (params: NowPlayingPayload) => {
    if (!roomId || postingRef.current) return
    const current = usePlayerStore.getState().current
    const url = params.videoId
      ? `https://www.youtube.com/watch?v=${params.videoId}`
      : current?.url
    if (!url) return
    void postPlayback(roomId, {
      playingUrl: url,
      playingTitle: current?.title ?? null,
      playingThumb: current?.thumbnailUrl ?? null,
      playingAt: params.timestamp ?? 0,
      isPlaying: params.playing !== false,
    }).then((seq) => {
      if (typeof seq === "number") lastPostedSeq.current = seq
    })
  }, [roomId])

  const publishControl = useMemo(() => (params: ControlEvent) => {
    if (!roomId) return
    const current = usePlayerStore.getState().current
    if (!current?.url) return
    void postPlayback(roomId, {
      playingUrl: current.url,
      playingTitle: current.title,
      playingThumb: current.thumbnailUrl ?? null,
      playingAt: params.timestamp ?? usePlayerStore.getState().progress ?? 0,
      isPlaying: params.action === "pause" ? false : params.action === "play" ? true : usePlayerStore.getState().isPlaying,
    }).then((seq) => {
      if (typeof seq === "number") lastPostedSeq.current = seq
    })
  }, [roomId])

  return { publishNowPlaying, publishControl, stall }
}

async function postPlayback(roomId: string, body: {
  playingUrl: string
  playingTitle?: string | null
  playingThumb?: string | null
  playingAt: number
  isPlaying: boolean
}) {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const data = await res.json() as { room?: { playbackSeq?: number } }
  return data.room?.playbackSeq ?? null
}

export default useRoomSync
