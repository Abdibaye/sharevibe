type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, current.resetAt - now) }
  }
  current.count += 1
  return { ok: true, remaining: limit - current.count }
}

export function clientKey(req: Request, prefix: string) {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  return `${prefix}:${ip}`
}
