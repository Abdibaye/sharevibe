export function VibeSection() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="w-96 h-96 border-4 border-accent rounded-full animate-pulse" />
        <div className="absolute w-64 h-64 border-2 border-secondary rounded-full animate-ping" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Phone sync visual mockup */}
        <div className="mb-16 flex justify-center items-center space-x-8">
          <div className="w-32 h-56 bg-card border-2 border-accent rounded-2xl flex items-center justify-center float-animation">
            <div className="w-20 h-20 bg-primary rounded-full animate-pulse" />
          </div>
          <div className="text-6xl text-accent">⟷</div>
          <div
            className="w-32 h-56 bg-card border-2 border-secondary rounded-2xl flex items-center justify-center float-animation"
            style={{ animationDelay: "1s" }}
          >
            <div className="w-20 h-20 bg-secondary rounded-full animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>
        </div>

        {/* Emotional hook */}
        <h2 className="text-5xl md:text-7xl font-bold text-balance leading-tight">
          Music hits different when it's <span className="text-accent">shared</span>.
        </h2>
      </div>
    </section>
  )
}
