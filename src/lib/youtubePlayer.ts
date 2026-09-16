export type YTPlayer = {
  loadVideoById: (id: string) => void
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
  setVolume: (v: number) => void
  destroy: () => void
}

export type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
      }
    }
  ) => YTPlayer
  PlayerState: {
    PLAYING: number
    PAUSED: number
    ENDED: number
    BUFFERING: number
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
