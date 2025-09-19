import { FinalCTASection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { VibeSection } from "@/components/landing/vibe-section";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <HowItWorksSection />
      <VibeSection />
      <FinalCTASection />
    </main>
  )
}
