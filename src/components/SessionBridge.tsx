"use client"

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useSessionStore } from '@/stores/sessionStore'
import { userFromAuthSession } from '@/lib/auth-user'

export function SessionBridge() {
  const { data: session, isPending } = authClient.useSession?.() ?? { data: null, isPending: false }
  const { setGuest, setUser } = useSessionStore()

  useEffect(() => {
    if (isPending) return
    const user = userFromAuthSession(session)
    if (user?.id) {
      setUser({ id: user.id, name: user.name, image: user.image, email: user.email })
    } else {
      setGuest()
    }
  }, [session, isPending, setGuest, setUser])

  return null
}
