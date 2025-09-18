"use client"

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { usePlayerStore } from './playerStore'

export type SessionMode = 'guest' | 'user'

export type RoomRef = {
  id: string
  type: 'temp' | 'db'
}

export type CurrentUser = {
  id: string
  name?: string | null
  image?: string | null
  email?: string | null
} | null

export type SessionState = {
  mode: SessionMode
  room: RoomRef | null
  user: CurrentUser
  setGuest: () => void
  setUser: (user: CurrentUser) => void
  setRoom: (room: RoomRef | null) => void
  isGuest: () => boolean
  isUser: () => boolean
  reset: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      mode: 'guest',
      room: null,
      user: null,
      setGuest: () => {
        set({ mode: 'guest', user: null })
        // Enforce guest limits
        usePlayerStore.getState().setMaxQueueSize(5)
      },
      setUser: (user) => {
        set({ mode: 'user', user })
        // Enforce user limits
        usePlayerStore.getState().setMaxQueueSize(20)
      },
      setRoom: (room) => set({ room }),
      isGuest: () => get().mode === 'guest',
      isUser: () => get().mode === 'user',
      reset: () => {
        set({ mode: 'guest', room: null, user: null })
        usePlayerStore.getState().setMaxQueueSize(5)
        usePlayerStore.getState().clearQueue()
      },
    }),
    {
      name: 'session-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, room: s.room, user: s.user }),
    }
  )
)

export const isGuest = () => useSessionStore.getState().isGuest()
export const isUser = () => useSessionStore.getState().isUser()
export const currentUser = () => useSessionStore.getState().user
