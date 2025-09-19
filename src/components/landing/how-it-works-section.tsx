export function HowItWorksSection() {
  const steps = [
    { icon: "🎧", word: "Create" },
    { icon: "🔗", word: "Share" },
    { icon: "💃", word: "Vibe" },
  ]

  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
          {steps.map((step, index) => (
            <div key={step.word} className="text-center space-y-6">
              <div className="text-8xl float-animation" style={{ animationDelay: `${index * 0.5}s` }}>
                {step.icon}
              </div>
              <h3 className="text-4xl md:text-5xl font-bold text-primary">{step.word}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
