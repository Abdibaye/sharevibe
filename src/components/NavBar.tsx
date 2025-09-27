"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Copy, Share2, Check, Menu } from "lucide-react";
import { Badge } from "./ui/badge";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useSessionStore } from "@/stores";
import { createRoom, joinRoom } from "@/lib/roomClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog";

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
  roomName = " Guest Room",
  roomCode,
  onCopy,
  coffeeUrl = "https://buymeacoffee.com/yourname",
}: NavBarProps) {
  const [copied, setCopied] = useState(false);
  const sessionRoom = useSessionStore((s) => s.room)
  const effectiveRoomId = sessionRoom?.id ?? roomCode ?? "no-room";
  const [isGooglePending, setIsGooglePending] = useState(false);
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

  const handleCreateRoom = async () => {
    try {
      const r = await createRoom()
      // Optionally navigate to /room/[id]
      // router.push(`/room?id=${r.id}`)
    } catch (e) {
      console.error(e)
    }
  }

  const [joinOpen, setJoinOpen] = useState(false)
  const [joinId, setJoinId] = useState("")
  const [joinErr, setJoinErr] = useState<string | null>(null)
  const [joinPending, setJoinPending] = useState(false)

  const handleJoinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const id = joinId.trim()
    if (!id) {
      setJoinErr("Please enter a room ID")
      return
    }
    setJoinPending(true)
    setJoinErr(null)
    try {
      await joinRoom(id)
      setJoinOpen(false)
      // router.push(`/room?id=${id}`)
    } catch (e) {
      setJoinErr((e as Error).message)
    } finally {
      setJoinPending(false)
    }
  }

  const handleLoginWithGoogle = async () => {
    try {
      setIsGooglePending(true);
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/room",
      });
      // Likely redirects; pending state will be irrelevant post-redirect
    } catch (error: any) {
      console.error("Google sign-in error:", error);
    } finally {
      setIsGooglePending(false);
    }
  };

  // Account dropdown
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountRef.current) return
      if (!accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleLogout = async () => {
    try {
      await authClient.signOut()
    } catch (e) {
      // ignore
    } finally {
      try { useSessionStore.getState().reset() } catch {}
      setAccountOpen(false)
      router.push('/room')
    }
  }

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border z-50 relative">
      <div className="flex items-center gap-2">
        <div className="text-xl sm:text-2xl font-bold tracking-wide">{title}</div>
        {roomName && <Badge variant="outline" className="hidden sm:inline-flex">{roomName}</Badge>}
      </div>

      <div className="flex items-center w-full">
        {/* Actions (right) */}
        <div className="ml-auto hidden md:flex items-center gap-2">
          {/* Room controls */}
          <Button size="sm" variant="secondary" onClick={handleCreateRoom}>
            Create Room
          </Button>
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Join Room</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a room</DialogTitle>
                <DialogDescription>Enter a room ID to join. Guests join a temporary room; users load DB-backed rooms.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinSubmit} className="space-y-3">
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="e.g. 3f0f6f8c-..."
                  className="w-full px-3 py-2 rounded-md bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
                {joinErr && <div className="text-sm text-red-400">{joinErr}</div>}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={joinPending}>{joinPending ? "Joining…" : "Join"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Room ID copy/share */}
          {(() => {
            const displayRoomId = effectiveRoomId.length > 20 ? `${effectiveRoomId.slice(0, 8)}…${effectiveRoomId.slice(-4)}` : effectiveRoomId
            return (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="font-mono hidden md:inline-flex max-w-[210px] truncate"
                aria-label="Copy room ID"
                title={`Copy room ID: ${effectiveRoomId}`}
              >
                {copied ? <Check className="mr-2 h-4 w-4 shrink-0" /> : <Copy className="mr-2 h-4 w-4 shrink-0" />}
                <span className="truncate">{displayRoomId}</span>
              </Button>
            )
          })()}
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
            <div className="relative" ref={accountRef}>
              <button
                className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-md hover:bg-muted focus:outline-none border border-transparent"
                onClick={() => setAccountOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <img
                  src={user?.image ?? "/avatar.png"}
                  alt={user?.name ?? "User"}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border"
                />
                <span className="text-sm font-medium">{firstName}</span>
              </button>
        {accountOpen && (
                <div
                  role="menu"
          className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-card shadow-md z-50 overflow-hidden"
                >
                  <Link
                    href="/room"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => setAccountOpen(false)}
                    role="menuitem"
                  >
                    Profile
                  </Link>
                  <button
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted text-red-400"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Log out 
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button variant="outline" onClick={handleLoginWithGoogle} disabled={isGooglePending} aria-busy={isGooglePending}>
              <div className="flex items-center gap-2">
                <GoogleIcon className="h-4 w-4" />
                {isGooglePending ? "Signing in with Google..." : "Sign in with Google"}
              </div>
            </Button>
          )}
          {/* Removed Sign up button */}
        </div>

        {/* Mobile menu trigger */}
        <div className="ml-auto md:hidden">
          <MobileMenu
            onCreateRoom={handleCreateRoom}
            onOpenJoin={() => setJoinOpen(true)}
            onCopy={handleCopy}
            onShare={handleShare}
            user={user}
            firstName={firstName}
            onLogout={handleLogout}
            isGooglePending={isGooglePending}
            onLoginWithGoogle={handleLoginWithGoogle}
            effectiveRoomId={effectiveRoomId}
          />
        </div>
      </div>
    </header>
  );
}

function MobileMenu({
  onCreateRoom,
  onOpenJoin,
  onCopy,
  onShare,
  user,
  firstName,
  onLogout,
  isGooglePending,
  onLoginWithGoogle,
  effectiveRoomId,
}: {
  onCreateRoom: () => void
  onOpenJoin: () => void
  onCopy: () => void
  onShare: () => void
  user: any
  firstName: string
  onLogout: () => void
  isGooglePending: boolean
  onLoginWithGoogle: () => void
  effectiveRoomId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="Open menu"
          className="p-2 rounded-md border border-border hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription>Quick actions</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button onClick={() => { setOpen(false); onCreateRoom() }}>
            Create Room
          </Button>
          <Button variant="outline" onClick={() => { setOpen(false); onOpenJoin() }}>
            Join Room
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { onCopy(); }} aria-label="Copy room ID" title="Copy room ID">
              <Copy className="h-4 w-4 mr-2" />
              Copy ID
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => { onShare(); }} aria-label="Share room" title="Share room">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Auth */}
          {user ? (
            <div className="mt-2 border-t border-border pt-3">
              <div className="flex items-center gap-3 mb-3">
                <img src={user?.image ?? "/avatar.png"} alt={user?.name ?? "User"} className="h-8 w-8 rounded-full border" />
                <div className="text-sm font-medium">{firstName}</div>
              </div>
              <Button variant="destructive" onClick={() => { setOpen(false); onLogout() }}>
                Log out
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => { setOpen(false); onLoginWithGoogle() }} disabled={isGooglePending} aria-busy={isGooglePending}>
              <div className="flex items-center gap-2">
                <GoogleIcon className="h-4 w-4" />
                {isGooglePending ? "Signing in with Google..." : "Sign in with Google"}
              </div>
            </Button>
          )}

          <div className="text-xs text-muted-foreground mt-2">
            Room: <span className="font-mono break-all">{effectiveRoomId}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}