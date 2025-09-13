"use client"

import { createClient } from '@supabase/supabase-js'

// Public client for browser-side realtime (no DB access used here)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    // Rely on default settings; channels are ephemeral
  },
})

export default supabase
