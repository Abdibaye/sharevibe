export type YTPlayer = {
  loadVideoById: (id: string | { videoId: string; startSeconds?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  setPlaybackQuality?: (quality: string) => void
  setVolume: (v: number) => void
  destroy: () => void
}

export type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
      }
    }
  ) => YTPlayer
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
}

declare global {
  interface Window {
    YT?: YTNamespace
  }
}

export function getYT(): YTNamespace | undefined {
  if (typeof window === "undefined") return undefined
  return window.YT
}

export function ensureYouTubeApi() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if (window.YT?.Player) return
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return
  const tag = document.createElement("script")
  tag.id = "youtube-iframe-api"
  tag.src = "https://www.youtube.com/iframe_api"
  tag.async = true
  document.head.appendChild(tag)
}

if (typeof window !== "undefined") ensureYouTubeApi()
