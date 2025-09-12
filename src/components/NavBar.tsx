"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Copy, Share2, Check } from "lucide-react";
import { Badge } from "./ui/badge";

type NavBarProps = {
  title?: string;
  roomName?: string;
  roomCode?: string;
  onCopy?: () => void;
  coffeeUrl?: string;
};

export default function NavBar({
  title = "ShareVibe",
  roomName = " Demo Room",
  roomCode,
  onCopy,
  coffeeUrl = "https://buymeacoffee.com/yourname",
}: NavBarProps) {
  const [copied, setCopied] = useState(false);
  const effectiveRoomId = roomCode ?? "rvb-1234-ABCD"; // dummy ID for now

  const handleCopy = async () => {
    if (onCopy) return onCopy();
    try {
      await navigator.clipboard.writeText(effectiveRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleShare = async () => {
    const shareData = {
      title: `${title} • ${roomName}`,
      text: `Join my room: ${effectiveRoomId}`,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(effectiveRoomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border z-10 relative">
      <div className="flex items-center gap-2">
        <div className="text-2xl font-bold tracking-wide">{title}</div>
        {roomName && <Badge variant="outline">{roomName}</Badge>}
      </div>

      

      <div className="flex items-center w-full">
        {/* Actions (right) */}
        <div className="ml-auto flex items-center gap-2">
          {/* Room ID copy/share */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="font-mono"
            aria-label="Copy room ID"
            title="Copy room ID"
          >
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {effectiveRoomId}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShare}
            aria-label="Share room"
            title="Share room"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Auth */}
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}