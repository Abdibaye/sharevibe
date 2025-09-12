"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Copy, Share2, Check } from "lucide-react";
import { Badge } from "./ui/badge";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Lightweight Google "G" icon (no extra dependency)
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.676 31.659 29.267 35 24 35c-6.627 0-12-5.373-12-12S17.373 11 24 11c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 4.158 29.268 2 24 2 12.955 2 4 10.955 4 22s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.68 16.148 18.975 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 4.158 29.268 2 24 2 16.318 2 9.656 6.473 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 42c5.17 0 9.86-1.977 13.409-5.192l-6.201-5.188C29.267 35 24.858 38 24 38c-4.234 0-7.825-2.716-9.132-6.477l-6.576 5.061C11.6 38.775 17.383 42 24 42z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.307 3.761-5.716 7-11.303 7-3.09 0-5.865-1.19-7.979-3.129l-6.576 5.061C12.018 39.864 17.686 42 24 42c7.732 0 14.223-5.242 16.206-12.285.529-1.742.794-3.623.794-5.715 0-1.341-.138-2.651-.389-3.917z"/>
  </svg>
);

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
  const [isGooglePending, startGoogleTransition] = useTransition();
  const router = useRouter();

  // Session (shows avatar + first name if logged in)
  const { data: session, isPending: sessionLoading } = authClient.useSession?.() ?? { data: null, isPending: false };
  const user = (session as any)?.user ?? (session as any)?.session?.user;
  const firstName =
    user?.name?.split(" ")?.[0] ??
    user?.email?.split("@")?.[0] ??
    "User";

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

  const handleLoginWithGoogle = () => {
    startGoogleTransition(() => {
      authClient
        .signIn.social({
          provider: "google",
          callbackURL: "/room",
        })
        .catch((error: any) => {
          console.error("Google sign-in error:", error);
        });
    });
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
          {sessionLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" aria-hidden="true" />
              <div className="h-4 w-16 rounded bg-muted animate-pulse" aria-hidden="true" />
            </div>
          ) : user ? (
            <Button asChild size="sm" variant="ghost" className="pl-1 pr-2" aria-label="Account">
              <Link href="/room" className="flex items-center gap-2">
                <img
                  src={user?.image ?? "/avatar.png"}
                  alt={user?.name ?? "User"}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border"
                />
                <span className="text-sm font-medium">{firstName}</span>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={handleLoginWithGoogle}>
              <div className="flex items-center gap-2">
                <GoogleIcon className="h-4 w-4" />
                {isGooglePending ? "Signing in with Google..." : "Sign in with Google"}
              </div>
            </Button>
          )}
          {/* Removed Sign up button */}
        </div>
      </div>
    </header>
  );
}