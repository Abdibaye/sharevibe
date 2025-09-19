import { Button } from "@/components/ui/button"
import { SoundWaves } from "./sound-waves"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/10" />

      {/* Floating sound waves */}
      <div className="absolute inset-0 pointer-events-none">
        <SoundWaves />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto space-y-12">
        {/* Big raw headline */}
        <div className="space-y-6">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-balance leading-none">
            <span className="block">One beat.</span>
            <span className="block">One room.</span>
            <span className="block text-primary">Infinite vibes.</span>
          </h1>

          {/* Tiny subtext */}
          <p className="text-lg md:text-xl font-mono text-muted-foreground">Create a room. Share ID. Hit play.</p>
        </div>

        {/* Main CTA */}
        <div className="pt-8">
        <Link href="/room">
          <Button
            size="lg"
            className="text-xl px-12 py-6 pulse-glow hover:scale-105 transition-transform duration-200 font-bold cursor-pointer"
          >
            Start a Room
          </Button>
            </Link>
        </div>
      </div>
    </section>
  )
}
