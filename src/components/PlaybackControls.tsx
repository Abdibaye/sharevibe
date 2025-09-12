"use client";
import React from "react";
import { Play, Pause, SkipForward, Volume2 } from "lucide-react";
import { Button } from "./ui/button";

export default function PlaybackControls({
  isPlaying,
  canToggle,
  onToggle,
  volume,
  onVolumeChange,
}: {
  isPlaying: boolean;
  canToggle: boolean;
  onToggle: () => void;
  volume: number; // 0..1
  onVolumeChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 mt-6">
      <Button
        size="icon"
        onClick={onToggle}
        disabled={!canToggle}
        title={canToggle ? (isPlaying ? "Pause" : "Play") : "Select a supported song"}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>

      <Button size="icon" variant="secondary" disabled title="Skip not implemented" aria-label="Skip">
        <SkipForward className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 ml-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="h-2 accent-primary cursor-pointer"
          aria-label="Volume"
          title={`Volume ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  );
}