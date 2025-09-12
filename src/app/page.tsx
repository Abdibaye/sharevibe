"use client"
import React, { useRef, useEffect, useState } from "react"
import "./globals.css"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Headphones, Link2, Play, Pause, Square } from "lucide-react"

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioPlaying, setAudioPlaying] = useState(true)
  const [audioPaused, setAudioPaused] = useState(false)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.8
    }
  }, [])

  const handleCloseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setAudioPlaying(false)
    }
  }

  const handlePauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setAudioPaused(true)
    }
  }

  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
      setAudioPaused(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 h-screen w-screen object-cover -z-10"
      >
        <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Background audio */}
      <audio ref={audioRef} src="/sandbreaker.mp3" autoPlay loop className="hidden" />

      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <Card className="w-[min(90vw,700px)] bg-white/30 backdrop-blur-md shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <Button asChild size="lg" className="text-2xl px-8 py-6">
              <Link href="/room">
                <Headphones className="mr-2 h-6 w-6" />
                Create Room
              </Link>
            </Button>

            <Button size="lg" variant="secondary" className="text-2xl px-8 py-6">
              <Link2 className="mr-2 h-6 w-6" />
              Join Room
            </Button>

            {audioPlaying && (
              <div className="mt-2 flex items-center gap-3">
                {audioPaused ? (
                  <Button onClick={handlePlayAudio} size="sm">
                    <Play className="mr-2 h-4 w-4" />
                    Play
                  </Button>
                ) : (
                  <Button onClick={handlePauseAudio} size="sm" variant="outline">
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button onClick={handleCloseAudio} size="sm" variant="destructive">
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
