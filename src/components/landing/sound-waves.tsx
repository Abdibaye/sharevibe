export function SoundWaves() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-20">
      {/* Floating album covers / mixtapes */}
      <div
        className="absolute top-20 left-20 w-24 h-24 bg-secondary rounded-lg float-animation"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="absolute top-40 right-32 w-20 h-20 bg-accent rounded-lg float-animation"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute bottom-32 left-32 w-28 h-28 bg-primary/20 rounded-lg float-animation"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-20 right-20 w-16 h-16 bg-secondary/60 rounded-lg float-animation"
        style={{ animationDelay: "0.5s" }}
      />

      {/* Sound wave bars */}
      <div className="flex items-end space-x-2 opacity-30">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-2 bg-primary wave-animation"
            style={{
              height: `${Math.random() * 100 + 20}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
