"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePlayerStore, type Track } from "@/stores/playerStore"
import { songToTrack } from "@/lib/queueClient"
import { extractYouTubeId } from "@/lib/utils"
import { liveTimestamp, youtubeThumb } from "@/lib/roomState"

type RoomSnapshot = {
  id: string
  songs?: Parameters<typeof songToTrack>[0][]
  playingUrl?: string | null
  playingTitle?: string | null
  playingThumb?: string | null
  playingAt?: number
  isPlaying?: boolean
  playbackClock?: string | null
  playbackSeq?: number
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

function trackFromPlayback(room: RoomSnapshot, timestamp: number): Track | null {
  const url = room.playingUrl
  if (!url) return null
  const videoId = extractYouTubeId(url)
  const fromQueue = usePlayerStore.getState().queue.find((t) => t.url === url || extractYouTubeId(t.url) === videoId)
  return {
    id: videoId || fromQueue?.id || url,
    dbId: fromQueue?.dbId,
    title: room.playingTitle || fromQueue?.title || "Now playing",
    url,
    thumbnailUrl: room.playingThumb || fromQueue?.thumbnailUrl || youtubeThumb(url),
    artist: fromQueue?.artist,
    startAt: timestamp,
  }
}

export function useRoomSync(roomId?: string | null) {
  const setQueue = usePlayerStore((s) => s.setQueue)
  const setCurrent = usePlayerStore((s) => s.setCurrent)
  const setControl = usePlayerStore((s) => s.setControl)
  const lastAppliedSeq = useRef(0)
  const lastPostedSeq = useRef(0)
  const seededRef = useRef(false)
  const postingRef = useRef(false)

  useEffect(() => {
    if (!roomId) return
    seededRef.current = false
    lastAppliedSeq.current = 0
    lastPostedSeq.current = 0
    let cancelled = false

    const applyRoom = async (room: RoomSnapshot) => {
      const tracks = (room.songs ?? []).map(songToTrack)
      const local = usePlayerStore.getState()
      if (fingerprint(tracks) !== fingerprint(local.queue)) {
        if (tracks.length > 0 || local.queue.length === 0) {
          setQueue(tracks)
        }
      }

      const seq = room.playbackSeq ?? 0
      if (seq > lastAppliedSeq.current && seq !== lastPostedSeq.current) {
        lastAppliedSeq.current = seq
        const ts = liveTimestamp(room.playingAt ?? 0, !!room.isPlaying, room.playbackClock)
        const track = trackFromPlayback(room, ts)
        if (track) {
          const currentVid = extractYouTubeId(local.current?.url) || local.current?.id
          const nextVid = extractYouTubeId(track.url) || track.id
          if (currentVid !== nextVid) {
            setCurrent(track)
            if (room.isPlaying) usePlayerStore.getState().play()
            else usePlayerStore.getState().pause()
          } else {
            setControl({
              action: room.isPlaying ? "play" : "pause",
              timestamp: ts,
            })
          }
        }
      }

      if ((room.songs?.length ?? 0) === 0 && local.queue.length > 0 && !postingRef.current) {
        postingRef.current = true
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
          seededRef.current = true
        }
      } else if ((room.songs?.length ?? 0) > 0) {
        seededRef.current = true
      }
    }

    const pull = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" })
        if (!res.ok || cancelled) return
        const data = await res.json() as { room?: RoomSnapshot }
        if (!data.room || cancelled) return
        await applyRoom(data.room)
      } catch {}
    }

    void pull()
    const timer = setInterval(() => { void pull() }, 1200)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [roomId, setQueue, setCurrent, setControl])

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

  return { publishNowPlaying, publishControl }
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
