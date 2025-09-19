import { Button } from "@/components/ui/button"
import Link from "next/link"

export function FinalCTASection() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-2xl mx-auto text-center space-y-12">
        <h2 className="text-6xl md:text-8xl font-bold">Ready?</h2>
        <Link href="/room" className="cursor-pointer">
        <Button
          size="lg"
          className="text-2xl px-16 py-8 pulse-glow hover:scale-105 transition-transform duration-200 font-bold"
        >
          Start Listening →
        </Button>
        </Link>

        {/* Footer spacing */}
        <div className="pt-16 text-muted-foreground font-mono">
          <p>ShareVibe • Where music connects</p>
        </div>
      </div>
    </section>
  )
}
