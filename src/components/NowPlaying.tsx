"use client";
import React from "react";
import RotatingThumbnail from "./RotatingThumbnail";
import ProgressBar from "./ProgressBar";
import PlaybackControls from "./PlaybackControls";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Copy, ExternalLink, Music2, PlayCircle, Radio } from "lucide-react";

type Song = {
  title: string;
  url?: string;
  thumbnailUrl?: string;
  addedBy?: string;
  artist?: string;
};

type TimeDisplay = { current: string; total: string };

export default function NowPlaying({
  currentSong,
  isPlaying,
  isLoading,
  isMuted,
  progress,
  timeDisplay,
  totalSeconds,
  onSeek,
  onToggle,
  onToggleMute,
  volume,
  onVolumeChange,
  isYouTubeUrl,
  audioRef,
  ytPlayerDivRef,
}: {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading?: boolean;
  isMuted?: boolean;
  progress: number; // 0..1
  timeDisplay: TimeDisplay;
  totalSeconds?: number;
  onSeek: (pct: number) => void;
  onToggle: () => void;
  onToggleMute?: () => void;
  volume: number; // 0..1
  onVolumeChange: (v: number) => void;
  isYouTubeUrl: (url?: string) => boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ytPlayerDivRef: React.RefObject<HTMLDivElement | null>;
}) {
  const srcType = currentSong?.url
    ? isYouTubeUrl(currentSong.url)
      ? "YouTube"
      : currentSong.url.endsWith(".mp3")
      ? "MP3"
      : "Link"
    : undefined;

  const SrcIcon = !currentSong?.url
    ? null
    : isYouTubeUrl(currentSong.url)
    ? PlayCircle
    : currentSong.url.endsWith(".mp3")
    ? Music2
    : PlayCircle;

  const handleCopy = async () => {
    if (!currentSong?.url) return;
    try {
      await navigator.clipboard.writeText(currentSong.url);
    } catch {}
  };

  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="relative self-center sm:self-auto">
            <RotatingThumbnail
              src={currentSong?.thumbnailUrl || undefined}
              isPlaying={isPlaying}
              alt={currentSong?.title || "No song"}
              size={140}
            />
            <div
              ref={ytPlayerDivRef}
              className="absolute -z-10 opacity-0 pointer-events-none"
              style={{ width: 0, height: 0, overflow: "hidden" }}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <CardTitle className="truncate text-lg sm:text-xl">
              {currentSong ? currentSong.title : "No song playing"}
            </CardTitle>
            <CardDescription className="mt-1 text-muted-foreground text-sm sm:text-base">
              {currentSong ? `Added by ${currentSong.addedBy ?? currentSong.artist ?? 'Someone'}` : "Select a song from the queue"}
            </CardDescription>

            <div className="mt-2 flex items-center gap-2">
              {srcType && SrcIcon ? (
                <Badge variant="secondary" className="gap-1 py-0.5">
                  <SrcIcon className="h-3.5 w-3.5" />
                  <span>{srcType}</span>
                </Badge>
              ) : null}
              {isPlaying && (
                <Badge variant="secondary" className="gap-1 py-0.5">
                  <Radio className="h-3.5 w-3.5" />
                  Live
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ProgressBar progress={progress} onSeek={onSeek} totalSeconds={totalSeconds} />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>{timeDisplay.current}</span>
          <span>{timeDisplay.total}</span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 pt-0">
        <PlaybackControls
          isPlaying={isPlaying}
          isLoading={isLoading}
          isMuted={isMuted}
          canToggle={!!(currentSong?.url && (currentSong.url.endsWith(".mp3") || isYouTubeUrl(currentSong.url)))}
          onToggle={onToggle}
          onToggleMute={onToggleMute}
          volume={volume}
          onVolumeChange={onVolumeChange}
        />

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={!currentSong?.url}
            title="Copy track link"
            className="inline-flex items-center"
          >
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy link</span>
          </Button>
          {currentSong?.url ? (
            <a href={currentSong.url} target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="ghost" size="sm" title="Open in new tab" className="inline-flex items-center">
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Open</span>
              </Button>
            </a>
          ) : null}
        </div>
      </CardFooter>

      <audio ref={audioRef} className="hidden" preload="metadata" />
    </Card>
  );
}