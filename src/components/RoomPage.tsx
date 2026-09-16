"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import NowPlaying from "./NowPlaying";
import { usePlayerStore, type Track } from "@/stores";
import { enqueue, removeFromQueue, shuffleQueue } from "@/lib/queueClient";
import { createRoom, joinRoom } from "@/lib/roomClient";
import { extractYouTubeId } from "@/lib/utils";
import { errorMessage } from "@/lib/auth-user";
import { getYT, type YTPlayer } from "@/lib/youtubePlayer";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/stores/sessionStore";
import { useRealtimeGuestRoom } from "@/hooks/useRealtimeGuestRoom";
import { Shuffle as ShuffleIcon, Trash2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export default function RoomPage() {
  const queue = usePlayerStore((s) => s.queue)
  const setCurrentGlobal = usePlayerStore((s) => s.setCurrent)
  const session = useSessionStore()
  const roomId = session.room?.id
  const { publishNowPlaying, publishControl } = useRealtimeGuestRoom(roomId)
  const router = useRouter()
  const [currentSong, setCurrentSong] = useState<Track | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<null | { title: string; channelTitle: string; thumbnailUrl: string; duration: string }>(null);
  const [results, setResults] = useState<
    { videoId: string; title: string; channelTitle: string; thumbnailUrl: string; duration: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null); // YouTube Player instance
  const ytPlayerDivRef = useRef<HTMLDivElement | null>(null);
  const ytProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerLoadGenRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [timeDisplay, setTimeDisplay] = useState({ current: '0:00', total: '0:00' });
  const [totalSeconds, setTotalSeconds] = useState<number | undefined>(undefined);
  const [volume, setVolume] = useState(1); // 0..1
  const [autoAdvance, setAutoAdvance] = useState(false)
  const currentFromStore = usePlayerStore((s) => s.current)
  const control = usePlayerStore((s) => s.control)
  const controlNonce = usePlayerStore((s) => s.controlNonce)
  const lastAppliedControlRef = useRef<number>(0)
  const autoAdvanceRef = useRef(false)
  const queueRef = useRef(queue)
  const currentSongRef = useRef<Track | null>(null)

  useEffect(() => { autoAdvanceRef.current = autoAdvance }, [autoAdvance])
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { currentSongRef.current = currentSong }, [currentSong])

  const STORAGE_KEY = 'guest-room-state'

  const syncPlaying = (playing: boolean) => {
    setIsPlaying(playing)
    if (playing) usePlayerStore.getState().play()
    else usePlayerStore.getState().pause()
  }

  // Restore persisted guest state only if peers did not already sync a queue
  useEffect(() => {
    const room = session.room
    if (!room || room.type !== 'temp') return
    const t = setTimeout(() => {
      const st = usePlayerStore.getState()
      if ((st.queue?.length ?? 0) > 0 || st.current) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const saved = JSON.parse(raw) as { roomId?: string; queue?: Track[]; currentId?: string }
        if (saved.roomId !== room.id) return
        if (Array.isArray(saved.queue) && saved.queue.length) {
          const migrated = saved.queue.map((track) => {
            const vid = extractYouTubeId(track.url)
            return vid ? { ...track, id: vid } : track
          })
          usePlayerStore.getState().setQueue(migrated)
          const currentId = saved.currentId && saved.currentId.length !== 11
            ? extractYouTubeId(migrated.find((x) => x.id === saved.currentId || extractYouTubeId(x.url) === saved.currentId)?.url) ?? saved.currentId
            : saved.currentId
          const cur = currentId ? migrated.find((x) => x.id === currentId || extractYouTubeId(x.url) === currentId) ?? null : null
          if (cur) {
            setCurrentGlobal(cur)
            setCurrentSong(cur)
          }
        }
      } catch {}
    }, 2000)
    return () => clearTimeout(t)
  }, [session.room?.id, session.room?.type, setCurrentGlobal])

  useEffect(() => {
    const room = session.room
    if (!room || room.type !== 'temp') return
    try {
      const payload = {
        roomId: room.id,
        queue: queue,
        currentId: (usePlayerStore.getState().current ?? null)?.id ?? null,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {}
  }, [queue, currentFromStore, session.room?.id, session.room?.type])

  const extractVideoId = useCallback((url?: string) => extractYouTubeId(url), []);

  const isYouTubeUrl = (url?: string) => !!extractVideoId(url);

  const searchParams = useSearchParams()
  const roomQueryId = searchParams.get('id')
  const bootLockRef = useRef(false)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  useEffect(() => {
    const api = useSessionStore.persist
    if (api.hasHydrated()) setSessionHydrated(true)
    const unsub = api.onFinishHydration(() => setSessionHydrated(true))
    return () => { unsub() }
  }, [])
  useEffect(() => {
    if (!sessionHydrated && !roomQueryId) return
    let cancelled = false
    ;(async () => {
      try {
        const existing = useSessionStore.getState().room
        if (roomQueryId) {
          if (existing?.id !== roomQueryId) await joinRoom(roomQueryId)
          return
        }
        if (existing?.id) {
          router.replace(`/room?id=${existing.id}`)
          return
        }
        if (bootLockRef.current) return
        bootLockRef.current = true
        const created = await createRoom()
        if (!cancelled && created?.id) router.replace(`/room?id=${created.id}`)
      } catch {
        bootLockRef.current = false
      }
    })()
    return () => { cancelled = true }
  }, [roomQueryId, router, sessionHydrated])

  // Debounced YouTube search when input is not a URL
  useEffect(() => {
    const q = inputUrl.trim();
    if (!q) {
      setResults([]);
      return;
    }
    if (isYouTubeUrl(q)) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [inputUrl]);

  const addVideoToQueue = async (v: { videoId: string; title: string; channelTitle: string; thumbnailUrl: string; duration: string }) => {
    const url = `https://www.youtube.com/watch?v=${v.videoId}`;
    const track: Track = { id: v.videoId, title: v.title, artist: "You", url, thumbnailUrl: v.thumbnailUrl }
    try {
      await enqueue(track)
      // If nothing is playing, immediately start playback; otherwise just enqueue
      if (!currentSong) {
        handleSelectSong(track)
      }
      setPreview({ title: v.title, channelTitle: v.channelTitle, thumbnailUrl: v.thumbnailUrl, duration: v.duration });
      setInputUrl("");
      setResults([]);
    } catch (e: unknown) {
      const msg = errorMessage(e, 'Failed to add to queue')
      setError(msg)
      if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('max')) {
        toast("Queue limit reached", {
          description: "Sign in to unlock a larger queue size.",
          action: {
            label: "Sign in",
            onClick: () => {
              try { authClient.signIn.social({ provider: 'google', callbackURL: '/room' }) } catch {}
            }
          }
        })
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputUrl.trim();
    if (!q) return;

    // If it's a YouTube URL, use existing metadata flow
    if (isYouTubeUrl(q)) {
      setAdding(true);
      setError(null);
      setPreview(null);
      try {
        const res = await fetch("/api/youtube-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: q }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        setPreview(data);
        const videoId = extractVideoId(q) || q;
        const track: Track = { id: videoId, title: data.title, artist: "You", url: q, thumbnailUrl: data.thumbnailUrl };
        try {
          await enqueue(track)
          if (!currentSong) {
            // Immediately start playback for first track
            handleSelectSong(track)
          }
        } catch (e: unknown) {
          const msg = errorMessage(e, 'Failed to add to queue')
          setError(msg)
          if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('max')) {
            toast("Queue limit reached", {
              description: "Sign in to unlock a larger queue size.",
              action: {
                label: "Sign in",
                onClick: () => {
                  try { authClient.signIn.social({ provider: 'google', callbackURL: '/room' }) } catch {}
                }
              }
            })
          }
        }
        setInputUrl("");
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed"));
      } finally {
        setAdding(false);
      }
      return;
    }

    // Otherwise treat as search: add the top result if available
    if (results.length > 0) {
      addVideoToQueue(results[0]);
    } else {
      setError("No results found.");
    }
  };

  // Load YouTube IFrame API once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const yt = getYT();
    if (yt?.Player) return;
    const existing = document.getElementById('youtube-iframe-api');
    if (existing) return;
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }, []);

  // Determine next track in queue
  function getNextTrack(): Track | null {
    const q = queueRef.current || []
    const cur = currentSongRef.current
    if (!q || q.length === 0) return null
    if (!cur) return q[0] || null
    const idx = q.findIndex((t) => t.id === cur.id || extractYouTubeId(t.url) === extractYouTubeId(cur.url) || t.id === extractYouTubeId(cur.url))
    if (idx === -1) return q[0] || null
    return q[idx + 1] || null
  }

  // Play next track and broadcast nowPlaying for temp rooms
  function playNext() {
    const next = getNextTrack()
    if (!next) {
      setAutoAdvance(false)
      return
    }
    handleSelectSong(next)
  }

  // Helper to ensure player created
  const loadOrCreatePlayer = (videoId: string, opts?: { userInitiated?: boolean; startAt?: number; shouldPlay?: boolean }) => {
    const gen = playerLoadGenRef.current
    if (!ytPlayerDivRef.current) {
      setTimeout(() => {
        if (playerLoadGenRef.current !== gen) return
        loadOrCreatePlayer(videoId, opts)
      }, 50);
      return;
    }
    const YTGlobal = getYT();
    if (!YTGlobal || !YTGlobal.Player) {
      setTimeout(() => {
        if (playerLoadGenRef.current !== gen) return
        loadOrCreatePlayer(videoId, opts)
      }, 300);
      return;
    }
    const applyStartAt = () => {
      if (opts?.startAt && opts.startAt > 0) {
        try { ytPlayerRef.current?.seekTo?.(opts.startAt, true) } catch {}
      }
    }
    const applyPlaybackIntent = () => {
      if (opts?.userInitiated) {
        try { ytPlayerRef.current?.unMute?.(); setIsMuted(false); } catch {}
        try { ytPlayerRef.current?.playVideo?.() } catch {}
        return
      }
      try { ytPlayerRef.current?.mute?.(); setIsMuted(true); } catch {}
      if (opts?.shouldPlay === false) {
        try { ytPlayerRef.current?.pauseVideo?.() } catch {}
        syncPlaying(false)
      } else {
        try { ytPlayerRef.current?.playVideo?.() } catch {}
      }
    }
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(videoId);
      } catch {
        try { ytPlayerRef.current.destroy?.() } catch {}
        ytPlayerRef.current = null
        setTimeout(() => {
          if (playerLoadGenRef.current !== gen) return
          loadOrCreatePlayer(videoId, opts)
        }, 0)
        return
      }
      applyPlaybackIntent()
      setTimeout(() => {
        if (playerLoadGenRef.current !== gen) return
        applyStartAt()
        if (opts?.shouldPlay === false) {
          try { ytPlayerRef.current?.pauseVideo?.() } catch {}
        }
      }, 400)
      return;
    }
    ytPlayerRef.current = new YTGlobal.Player(ytPlayerDivRef.current, {
      videoId,
      playerVars: {
        autoplay: opts?.shouldPlay === false ? 0 : 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          if (playerLoadGenRef.current !== gen) return
          applyStartAt()
          applyPlaybackIntent()
        },
        onStateChange: (e: { data: number }) => {
          if (e.data === YTGlobal.PlayerState.PLAYING) {
            syncPlaying(true);
            setIsLoadingPlayback(false);
            startYtProgressTimer();
          } else if (e.data === YTGlobal.PlayerState.PAUSED) {
            syncPlaying(false);
            setIsLoadingPlayback(false);
          } else if (e.data === YTGlobal.PlayerState.ENDED) {
            syncPlaying(false);
            setIsLoadingPlayback(false);
            setProgress(0);
            usePlayerStore.getState().setProgress(0)
            stopYtProgressTimer();
            setTimeDisplay({ current: '0:00', total: '0:00' });
            if (autoAdvanceRef.current) playNext();
          } else if (e.data === YTGlobal.PlayerState.BUFFERING) {
            setIsLoadingPlayback(true);
          }
        }
      }
    });
  };

  const startYtProgressTimer = () => {
    stopYtProgressTimer();
    ytProgressTimerRef.current = setInterval(() => {
      if (!ytPlayerRef.current) return;
      const dur = ytPlayerRef.current.getDuration?.();
      const cur = ytPlayerRef.current.getCurrentTime?.();
      if (dur && cur != null && dur > 0) {
        setProgress(cur / dur);
        setTotalSeconds(dur);
        usePlayerStore.getState().setProgress(cur)
        const fmt = (s: number) => {
          if (!isFinite(s)) return '0:00';
          const m = Math.floor(s / 60);
          const sec = Math.floor(s % 60).toString().padStart(2, '0');
          return `${m}:${sec}`;
        };
        setTimeDisplay({ current: fmt(cur), total: fmt(dur) });
      }
    }, 500);
  };
  const stopYtProgressTimer = () => {
    if (ytProgressTimerRef.current) {
      clearInterval(ytProgressTimerRef.current);
      ytProgressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      playerLoadGenRef.current += 1
      stopYtProgressTimer();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy?.(); } catch {}
        ytPlayerRef.current = null
      }
    };
  }, []);

  const handleSelectSong = (song: Track) => {
    setCurrentSong(song);
    setCurrentGlobal({ ...song, startAt: 0 })
    if (session.room && song.url) {
      const vid = extractVideoId(song.url)
      if (vid) publishNowPlaying({ videoId: vid, timestamp: 0, playing: true })
    }
    const url = song.url;
    // mp3 playback path
    if (url && url.endsWith('.mp3') && audioRef.current) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch {}
        stopYtProgressTimer();
      }
      audioRef.current.src = url;
      setIsLoadingPlayback(true);
      audioRef.current.play()
        .then(() => syncPlaying(true))
        .catch(() => syncPlaying(false))
        .finally(() => setIsLoadingPlayback(false));
  // update time display while playing mp3 via audio events (already handled below)
      return;
    }
    // YouTube
    if (url && isYouTubeUrl(url)) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      setIsPlaying(false);
      setProgress(0);
      const vid = extractVideoId(url);
      if (vid) {
        setIsLoadingPlayback(true);
        loadOrCreatePlayer(vid, { userInitiated: true, startAt: 0 });
      }
      return;
    }
    // Neither mp3 nor YouTube
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
  setIsPlaying(false);
  setProgress(0);
  setTotalSeconds(undefined);
  setIsLoadingPlayback(false);
  };

  // Apply remote nowPlaying (store.current) to local playback, including null -> stop
  useEffect(() => {
    const song = (currentFromStore as Track | null | undefined) ?? null
    // If store cleared current, stop playback and reset UI
    if (!song) {
      setCurrentSong(null)
      setIsPlaying(false)
      setProgress(0)
      setTimeDisplay({ current: '0:00', total: '0:00' })
      setTotalSeconds(undefined)
      setIsMuted(false)
      if (audioRef.current) {
        try { audioRef.current.pause() } catch {}
        try { audioRef.current.removeAttribute('src') } catch {}
      }
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo?.() } catch {}
        stopYtProgressTimer()
      }
      setIsLoadingPlayback(false)
      return
    }
    const sameTrack = currentSong && (
      currentSong.id === song.id ||
      (!!extractVideoId(currentSong.url) && extractVideoId(currentSong.url) === extractVideoId(song.url))
    )
    if (sameTrack) {
      const startAt = song.startAt
      if (typeof startAt === 'number' && startAt > 0) {
        if (ytPlayerRef.current?.seekTo) {
          try { ytPlayerRef.current.seekTo(startAt, true) } catch {}
        } else if (song.url && isYouTubeUrl(song.url)) {
          const vid = extractVideoId(song.url)
          if (vid) loadOrCreatePlayer(vid, { userInitiated: false, startAt, shouldPlay: usePlayerStore.getState().isPlaying })
        }
      }
      return
    }
    setCurrentSong(song)
    const url = song.url
    if (url && url.endsWith('.mp3') && audioRef.current) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch {}
        stopYtProgressTimer();
      }
      setIsMuted(false);
      audioRef.current.src = url;
      setIsLoadingPlayback(true)
      audioRef.current.play()
        .then(() => syncPlaying(true))
        .catch(() => syncPlaying(false))
        .finally(() => setIsLoadingPlayback(false))
      return;
    }
    if (url && isYouTubeUrl(url)) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      setIsPlaying(false);
      setProgress(0);
      setTotalSeconds(undefined);
      const vid = extractVideoId(url);
      if (vid) { setIsLoadingPlayback(true); loadOrCreatePlayer(vid, { userInitiated: false, startAt: song.startAt, shouldPlay: usePlayerStore.getState().isPlaying }); }
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo?.(); } catch {}
    }
    setIsPlaying(false);
    setProgress(0);
    setTotalSeconds(undefined);
    setIsLoadingPlayback(false)
  }, [currentFromStore])

  const togglePlay = () => {
    if (currentSong?.url?.endsWith('.mp3')) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        syncPlaying(false);
        if (session.room) publishControl({ action: 'pause', timestamp: audioRef.current.currentTime || 0 })
      } else {
        setIsLoadingPlayback(true)
        audioRef.current.play()
          .then(() => syncPlaying(true))
          .catch(() => syncPlaying(false))
          .finally(() => setIsLoadingPlayback(false))
        if (session.room) publishControl({ action: 'play', timestamp: audioRef.current.currentTime || 0 })
      }
    } else if (currentSong?.url && isYouTubeUrl(currentSong.url) && ytPlayerRef.current) {
      const state = ytPlayerRef.current.getPlayerState?.();
      const YTGlobal = getYT();
      if (!YTGlobal) return
      if (state === YTGlobal.PlayerState.PLAYING) {
        ytPlayerRef.current.pauseVideo();
        syncPlaying(false);
        setIsLoadingPlayback(false)
        if (session.room) publishControl({ action: 'pause', timestamp: ytPlayerRef.current.getCurrentTime?.() || 0 })
      } else {
        setIsLoadingPlayback(true)
        try { ytPlayerRef.current.unMute?.(); setIsMuted(false); } catch {}
        ytPlayerRef.current.playVideo();
        syncPlaying(true);
        if (session.room) publishControl({ action: 'play', timestamp: ytPlayerRef.current.getCurrentTime?.() || 0 })
      }
    }
  };

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(Math.round(volume * 100));
    }
  }, [volume]);

  const handleToggleMute = () => {
    const p = ytPlayerRef.current
    if (!p) return
    try {
      if (p.isMuted?.()) {
        p.unMute?.()
        setIsMuted(false)
      } else {
        p.mute?.()
        setIsMuted(true)
      }
    } catch {}
  }

  // Replace the old handleSeek with a pct-based seeker
  const applySeek = (pct: number) => {
    setProgress(pct);
    if (currentSong?.url?.endsWith('.mp3') && audioRef.current && audioRef.current.duration) {
      const t = pct * audioRef.current.duration
      audioRef.current.currentTime = t;
      usePlayerStore.getState().setProgress(t)
      if (session.room) publishControl({ action: 'seek', timestamp: t })
    } else if (currentSong?.url && isYouTubeUrl(currentSong.url) && ytPlayerRef.current) {
      const dur = ytPlayerRef.current.getDuration?.();
      if (dur) {
        const t = pct * dur
        ytPlayerRef.current.seekTo(t, true);
        usePlayerStore.getState().setProgress(t)
        if (session.room) publishControl({ action: 'seek', timestamp: t })
      }
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!el.duration || isNaN(el.duration)) return;
      setProgress(el.currentTime / el.duration);
      setTotalSeconds(el.duration);
      usePlayerStore.getState().setProgress(el.currentTime)
      const fmt = (s: number) => {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
      };
      setTimeDisplay({ current: fmt(el.currentTime), total: fmt(el.duration) });
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setTimeDisplay({ current: '0:00', total: '0:00' });
      setTotalSeconds(undefined);
      if (autoAdvanceRef.current) playNext();
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentSong]);

  // Apply remote control updates
  useEffect(() => {
    // Ignore if same message already applied
    if (!control || lastAppliedControlRef.current === controlNonce) return
    lastAppliedControlRef.current = controlNonce
    const song = currentSong ?? currentFromStore
    const ts = Math.max(0, control.timestamp || 0)
    usePlayerStore.getState().setProgress(ts)
    if (song?.url?.endsWith('.mp3')) {
      if (!audioRef.current) return
      if (control.action === 'pause') {
        audioRef.current.pause()
        syncPlaying(false)
        if (!isNaN(ts)) audioRef.current.currentTime = ts
      } else if (control.action === 'play') {
        if (!isNaN(ts)) audioRef.current.currentTime = ts
        audioRef.current.play().then(() => syncPlaying(true)).catch(() => syncPlaying(false))
      } else if (control.action === 'seek') {
        if (!isNaN(ts)) audioRef.current.currentTime = ts
      }
    } else if (song?.url && isYouTubeUrl(song.url) && ytPlayerRef.current) {
      if (control.action === 'pause') {
        try { ytPlayerRef.current.pauseVideo() } catch {}
        syncPlaying(false)
        if (!isNaN(ts)) ytPlayerRef.current.seekTo?.(ts, true)
      } else if (control.action === 'play') {
        if (!isNaN(ts)) ytPlayerRef.current.seekTo?.(ts, true)
        try { ytPlayerRef.current.playVideo() } catch {}
        syncPlaying(true)
      } else if (control.action === 'seek') {
        if (!isNaN(ts)) ytPlayerRef.current.seekTo?.(ts, true)
      }
    } else if (song?.url && isYouTubeUrl(song.url) && !ytPlayerRef.current) {
      const vid = extractVideoId(song.url)
      if (vid) loadOrCreatePlayer(vid, { userInitiated: false, startAt: ts, shouldPlay: control.action !== 'pause' })
    }
  }, [controlNonce])

  return (
    <div
      className="min-h-screen flex flex-col relative text-white font-sans"
    >
      {/* Removed top navbar. It's now rendered from the layout via <NavBar /> */}

      {/* Now Playing Section */}
      <section className="flex flex-col lg:flex-row items-stretch lg:items-start gap-6 px-4 sm:px-6 py-4 z-10 relative max-w-screen-2xl mx-auto w-full">
        <NowPlaying
          currentSong={currentSong ? { ...currentSong, addedBy: currentSong.artist } : null}
          isPlaying={isPlaying}
          isLoading={isLoadingPlayback}
          isMuted={isMuted}
          progress={progress}
          timeDisplay={timeDisplay}
          totalSeconds={totalSeconds}
          onSeek={applySeek}
          onToggle={togglePlay}
          onToggleMute={handleToggleMute}
          volume={volume}
          onVolumeChange={setVolume}
          isYouTubeUrl={isYouTubeUrl}
          audioRef={audioRef}
          ytPlayerDivRef={ytPlayerDivRef}
        />
  <div className="w-full lg:max-w-md rounded-xl p-4 sm:p-5 lg:p-6 shadow-lg overflow-y-auto max-h-[55vh] sm:max-h-[60vh] lg:max-h-96 bg-card border border-border order-first lg:order-none">
          {/* Queue Section */}
          <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg md:text-xl font-bold">Queue</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!autoAdvance) {
                    // Start Play All mode and begin playback
                    setAutoAdvance(true)
                    if (currentSong) {
                      if (!isPlaying) togglePlay()
                    } else if (queue.length > 0) {
                      handleSelectSong(queue[0])
                    }
                  } else {
                    // In Play All mode: toggle play/pause only
                    if (currentSong) {
                      togglePlay()
                    } else if (queue.length > 0) {
                      handleSelectSong(queue[0])
                    }
                  }
                }}
                className={`p-2 rounded bg-gray-700 hover:bg-gray-600 ${autoAdvance && isPlaying ? 'ring-2 ring-green-500' : ''}`}
                aria-label={autoAdvance && isPlaying ? 'Pause all' : 'Play all'}
                title={autoAdvance && isPlaying ? 'Pause all' : 'Play all'}
              >
                {autoAdvance && isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => shuffleQueue().catch(() => {})}
                className="p-2 rounded bg-gray-700 hover:bg-gray-600"
                aria-label="Shuffle queue"
                title="Shuffle queue"
              >
                <ShuffleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 md:h-40 text-muted-foreground">
              <span className="text-4xl mb-2">🎶</span>
              <span className="font-semibold">No songs in queue</span>
              <span className="text-sm mt-1">Add a YouTube link below to start the vibe!</span>
            </div>
          ) : (
            <ul className="space-y-2 md:space-y-3">
              {queue.map((item) => {
                const active = currentSong && currentSong.id === item.id;
                return (
                  <li
                    key={item.id}
                    onClick={() => handleSelectSong(item)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 cursor-pointer transition border ${active ? 'bg-gray-700 border-gray-500' : 'bg-gray-900 hover:bg-gray-800 border-transparent'}`}
                  >
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt={item.title} className="w-10 h-10 md:w-12 md:h-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <span className="font-semibold block leading-tight truncate text-sm md:text-base max-w-[140px] md:max-w-[180px]" title={item.title}>{item.title}</span>
                      <span className="text-[10px] md:text-xs text-gray-400">Added by {item.artist ?? 'Someone'}</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      {active && isPlaying && (
                        <span className="text-[10px] md:text-xs text-green-400 font-semibold">Playing</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromQueue(item.id).catch(() => {}) }}
                        className="p-2 rounded bg-gray-800 hover:bg-gray-700"
                        aria-label="Remove from queue"
                        title="Remove from queue"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Add Song Section */}
      <footer className="mt-4 px-4 sm:px-6 py-4 bg-gradient-to-t from-background/80 to-transparent flex flex-col justify-center gap-4 z-10 relative">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-2xl">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Search YouTube or paste a link..."
            className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 min-w-0"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 font-bold text-lg transition whitespace-nowrap"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>

        {/* Live search suggestions */}
        {!isYouTubeUrl(inputUrl) && (searching || results.length > 0) && (
          <div className="w-full max-w-2xl bg-gray-800/70 rounded-lg border border-gray-700 overflow-hidden">
            {searching && (
              <div className="px-4 py-2 text-sm text-gray-400">Searching...</div>
            )}
            {results.length > 0 && (
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-700">
                {results.map((v) => (
                  <li key={v.videoId} className="flex items-center gap-3 p-3 hover:bg-gray-800">
                    <img src={v.thumbnailUrl} alt={v.title} className="w-16 h-10 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={v.title}>{v.title}</p>
                      <p className="text-xs text-gray-400 truncate">{v.channelTitle}</p>
                    </div>
                    <span className="text-xs text-gray-400 mr-3">{v.duration}</span>
                    <button
                      onClick={() => addVideoToQueue(v)}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Keep preview of last added */}
        {preview && (
          <div className="w-full max-w-2xl flex items-center gap-4 bg-gray-800/70 p-4 rounded-lg border border-gray-700">
            <img src={preview.thumbnailUrl} alt={preview.title} className="w-16 h-16 rounded object-cover" />
            <div className="flex-1">
              <p className="font-semibold leading-tight">{preview.title}</p>
              <p className="text-xs text-gray-400">{preview.channelTitle}</p>
              <p className="text-xs text-gray-500">Duration: {preview.duration}</p>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
