"use client"

import { create } from 'zustand'

// Simple player store: current track, playing state, volume, and progress
export type Track = {
  id: string
  title: string
  artist?: string
  thumbnailUrl?: string
  duration?: number // seconds
  url?: string
  // optional: when receiving remote nowPlaying, seek to this position (seconds)
  startAt?: number
}

export type PlayerState = {
  current?: Track | null
  queue: Track[]
  isPlaying: boolean
  volume: number // 0..1
  progress: number // seconds
  maxQueueSize: number
  // remote control messages (from realtime)
  control: { action: 'play' | 'pause' | 'seek'; timestamp?: number } | null
  controlNonce: number
  setCurrent: (track: Track | null) => void
  setQueue: (tracks: Track[]) => void
  enqueue: (track: Track) => boolean
  dequeue: (id: string) => void
  clearQueue: () => void
  play: () => void
  pause: () => void
  toggle: () => void
  setVolume: (v: number) => void
  setProgress: (s: number) => void
  setMaxQueueSize: (n: number) => void
  setControl: (c: { action: 'play' | 'pause' | 'seek'; timestamp?: number } | null) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
  queue: [],
  isPlaying: false,
  volume: 0.9,
  progress: 0,
  maxQueueSize: 3, // default for guests; session store will bump to 20 for users
  control: null,
  controlNonce: 0,
  setCurrent: (track) => set({ current: track, progress: 0 }),
  setQueue: (tracks) => set({ queue: tracks }),
  enqueue: (track) => {
    const s = get()
    if (s.queue.length >= s.maxQueueSize) return false
    set({ queue: [...s.queue, track] })
    return true
  },
  dequeue: (id) =>
    set((s) => {
      const idx = s.queue.findIndex((t) => t.id === id)
      const newQueue = s.queue.filter((t) => t.id !== id)
      // If the removed track is the one currently playing, move to the next item (or clear)
      let newCurrent = s.current ?? null
      if (s.current && s.current.id === id) {
        const next = idx >= 0 ? s.queue[idx + 1] ?? null : null
        newCurrent = next
      }
      return { queue: newQueue, current: newCurrent }
    }),
  clearQueue: () => set((s) => ({ queue: [], current: null })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set({ isPlaying: !get().isPlaying }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setProgress: (s) => set({ progress: Math.max(0, s) }),
  setMaxQueueSize: (n) => set({ maxQueueSize: Math.max(0, Math.floor(n)) }),
  setControl: (c) => set((s) => ({ control: c, controlNonce: s.controlNonce + 1 })),
}))
