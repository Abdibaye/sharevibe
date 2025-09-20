"use client";
import React from "react";

export default function ProgressBar({
  progress,
  onSeek,
  className = "",
  totalSeconds,
  isPlaying,
}: {
  progress: number; // 0..1
  onSeek: (pct: number) => void;
  className?: string;
  totalSeconds?: number; // optional, used for hover time tooltip
  isPlaying?: boolean; // controls styling (active vs paused)
}) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const [hoverPct, setHoverPct] = React.useState<number | null>(null)
  const [isHovering, setIsHovering] = React.useState(false)

  const computeAndSeek = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width);
    onSeek(pct);
  };

  const computeHover = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width);
    setHoverPct(pct);
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sec}`
    return `${m}:${sec}`
  }

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (["ArrowRight", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      onSeek(clamp(progress + step));
    } else if (["ArrowLeft", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      onSeek(clamp(progress - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(1);
    }
  };

  const pct = Math.round(clamp(progress) * 100);

  return (
    <div className={`w-full mt-4 select-none ${className}`}>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        tabIndex={0}
  className="group h-3 cursor-pointer rounded-full border border-border/50 bg-muted/40 backdrop-blur-sm relative transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={handleKey}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setHoverPct(null) }}
        onMouseDown={(e) => computeAndSeek(e.clientX, e.currentTarget)}
        onMouseMove={(e) => {
          computeHover(e.clientX, e.currentTarget)
          if (e.buttons === 1) computeAndSeek(e.clientX, e.currentTarget);
        }}
        onTouchStart={(e) => computeAndSeek(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={(e) => computeAndSeek(e.touches[0].clientX, e.currentTarget)}
      >
        {/* Progress fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full overflow-hidden transition-[width] duration-300 ease-out bg-gradient-to-r ${isPlaying ? 'from-primary to-primary/60' : 'from-muted to-muted/50'}`}
          style={{ width: `${pct}%` }}
        >
          {/* Subtle stripe shimmer only when playing */}
          {isPlaying ? (
            <div
              className="h-full w-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, rgba(255,255,255,0.18) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.18) 75%, transparent 75%, transparent)",
                backgroundSize: "16px 16px",
                animation: "progress-move 1s linear infinite",
              }}
            />
          ) : null}
        </div>

        {/* Thumb */}
        <div
          className={`absolute top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 translate-x-[-50%] rounded-full bg-background ring-2 shadow-md opacity-0 group-hover:opacity-100 transition-transform duration-200 group-active:scale-105 ${isPlaying ? 'ring-primary' : 'ring-muted-foreground'}`}
          style={{ left: `${pct}%` }}
        />

        {/* Hover time tooltip */}
        {isHovering && totalSeconds && hoverPct !== null ? (
          <div
            className="absolute -top-7 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] md:text-xs pointer-events-none select-none whitespace-nowrap"
            style={{ left: `${Math.round(hoverPct * 100)}%`, transform: 'translateX(-50%)' }}
          >
            {fmt(hoverPct * totalSeconds)}
          </div>
        ) : null}
      </div>

      {/* Optional percent label for screen readers */}
      <span className="sr-only">Progress: {pct}%</span>

      <style jsx global>{`
        @keyframes progress-move {
          0% { background-position: 0 0; }
          100% { background-position: 16px 0; }
        }
      `}</style>
    </div>
  );
}