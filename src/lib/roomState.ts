import { extractYouTubeId } from "@/lib/utils"

export function youtubeThumb(url?: string | null, fallback?: string | null) {
  if (fallback) return fallback
  const id = extractYouTubeId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined
}

export type RoomPlayback = {
  playingUrl: string | null
  playingTitle: string | null
  playingThumb: string | null
  playingAt: number
  isPlaying: boolean
  playbackClock: string | null
  playbackSeq: number
}

export function liveTimestamp(playingAt: number, isPlaying: boolean, playbackClock?: string | Date | null) {
  if (!isPlaying || !playbackClock) return Math.max(0, playingAt || 0)
  const clock = typeof playbackClock === "string" ? Date.parse(playbackClock) : playbackClock.getTime()
  if (!Number.isFinite(clock)) return Math.max(0, playingAt || 0)
  return Math.max(0, (playingAt || 0) + (Date.now() - clock) / 1000)
}
