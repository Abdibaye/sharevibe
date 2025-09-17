"use client";
import React from "react";
import { Play, Pause, SkipForward, Volume2, Loader2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";

export default function PlaybackControls({
  isPlaying,
  isLoading,
  isMuted,
  canToggle,
  onToggle,
  onToggleMute,
  volume,
  onVolumeChange,
}: {
  isPlaying: boolean;
  isLoading?: boolean;
  isMuted?: boolean;
  canToggle: boolean;
  onToggle: () => void;
  onToggleMute?: () => void;
  volume: number; // 0..1
  onVolumeChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 mt-6">
      <Button
        size="icon"
        onClick={onToggle}
        disabled={!canToggle || !!isLoading}
        title={!canToggle
          ? "Select a supported song"
          : isLoading
          ? "Loading..."
          : (isPlaying ? "Pause" : "Play")}
        aria-label={isLoading ? "Loading" : (isPlaying ? "Pause" : "Play")}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>

      <Button size="icon" variant="secondary" disabled title="Skip not implemented" aria-label="Skip">
        <SkipForward className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 ml-2">
        {onToggleMute && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="inline-flex items-center gap-1"
          >
            {isMuted ? (
              <>
                <VolumeX className="h-4 w-4" />
                <span className="hidden sm:inline">Unmute</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                <span className="hidden sm:inline">Mute</span>
              </>
            )}
          </Button>
        )}
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