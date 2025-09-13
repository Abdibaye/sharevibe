"use client"

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useSessionStore } from '@/stores/sessionStore'

export function SessionBridge() {
  const { data: session } = authClient.useSession?.() ?? { data: null }
  const { setGuest, setUser } = useSessionStore()

  useEffect(() => {
    const user = (session as any)?.user ?? (session as any)?.session?.user
    if (user?.id) {
      setUser({ id: user.id, name: user.name, image: user.image, email: user.email })
    } else {
      setGuest()
    }
  }, [session, setGuest, setUser])

  return null
}
