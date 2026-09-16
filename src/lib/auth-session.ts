import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

type SessionLike = {
  user?: { id?: string }
  session?: { user?: { id?: string } }
} | null

export async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const session = (await auth.api.getSession({ headers: req.headers }).catch(() => null)) as SessionLike
  return session?.user?.id ?? session?.session?.user?.id ?? null
}
