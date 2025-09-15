"use client";

import RoomPage from '@/components/RoomPage'
import React, { Suspense } from 'react'

export default function page() {
  return (
     <Suspense fallback={<div>Loading...</div>}>
      <RoomPage />
    </Suspense>

  )
}
