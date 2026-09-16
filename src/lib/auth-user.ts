export type AuthUser = {
  id: string
  name?: string | null
  image?: string | null
  email?: string | null
}

export function userFromAuthSession(session: unknown): AuthUser | null {
  if (!session || typeof session !== "object") return null
  const payload = session as { user?: AuthUser; session?: { user?: AuthUser } }
  const user = payload.user ?? payload.session?.user
  if (!user?.id) return null
  return user
}

export function errorMessage(err: unknown, fallback = "Something went wrong") {
  return err instanceof Error && err.message ? err.message : fallback
}
