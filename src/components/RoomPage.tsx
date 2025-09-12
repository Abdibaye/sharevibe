"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import NowPlaying from "./NowPlaying";
import ProgressBar from './ProgressBar';
import PlaybackControls from './PlaybackControls';

export default function RoomPage() {
  const [queue, setQueue] = useState<{
    title: string;
    addedBy: string;
    url?: string;
    thumbnailUrl?: string;
  }[]>([]);
  const [currentSong, setCurrentSong] = useState<null | { title: string; addedBy: string; url?: string; thumbnailUrl?: string }>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<null | { title: string; channelTitle: string; thumbnailUrl: string; duration: string }>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null); // YouTube Player instance
  const ytPlayerDivRef = useRef<HTMLDivElement | null>(null);
  const ytProgressTimerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [timeDisplay, setTimeDisplay] = useState({ current: '0:00', total: '0:00' });
  const [volume, setVolume] = useState(1); // 0..1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setAdding(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/youtube-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPreview(data);
      // Add immediately to queue placeholder (without persistence yet)
  const newSong = { title: data.title, addedBy: 'You', url: inputUrl.trim(), thumbnailUrl: data.thumbnailUrl };
  setQueue(q => [...q, newSong]);
  if (!currentSong) setCurrentSong(newSong);
      setInputUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const extractVideoId = useCallback((url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|\/v\/|shorts\/)([\w-]{11})/);
    return match ? match[1] : null;
  }, []);

  const isYouTubeUrl = (url?: string) => !!extractVideoId(url);

  // Load YouTube IFrame API once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).YT && (window as any).YT.Player) return; // already loaded
    const existing = document.getElementById('youtube-iframe-api');
    if (existing) return;
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }, []);

  // Helper to ensure player created
  const loadOrCreatePlayer = (videoId: string) => {
    if (!ytPlayerDivRef.current) return;
    const YTGlobal = (window as any).YT;
    if (!YTGlobal || !YTGlobal.Player) {
      // Retry shortly until API ready
      setTimeout(() => loadOrCreatePlayer(videoId), 300);
      return;
    }
    if (ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(videoId);
      return;
    }
    ytPlayerRef.current = new YTGlobal.Player(ytPlayerDivRef.current, {
      videoId,
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onStateChange: (e: any) => {
          if (e.data === YTGlobal.PlayerState.PLAYING) {
            setIsPlaying(true);
            startYtProgressTimer();
          } else if (e.data === YTGlobal.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === YTGlobal.PlayerState.ENDED) {
            setIsPlaying(false);
            setProgress(0);
            stopYtProgressTimer();
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
      stopYtProgressTimer();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const handleSelectSong = (song: { title: string; addedBy: string; url?: string; thumbnailUrl?: string }) => {
    setCurrentSong(song);
    const url = song.url;
    // mp3 playback path
    if (url && url.endsWith('.mp3') && audioRef.current) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch {}
        stopYtProgressTimer();
      }
      audioRef.current.src = url;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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
      if (vid) loadOrCreatePlayer(vid);
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
  };

  const togglePlay = () => {
    if (currentSong?.url?.endsWith('.mp3')) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else if (currentSong?.url && isYouTubeUrl(currentSong.url) && ytPlayerRef.current) {
      const state = ytPlayerRef.current.getPlayerState?.();
      const YTGlobal = (window as any).YT;
      if (state === YTGlobal.PlayerState.PLAYING) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
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

  // Replace the old handleSeek with a pct-based seeker
  const applySeek = (pct: number) => {
    setProgress(pct);
    if (currentSong?.url?.endsWith('.mp3') && audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = pct * audioRef.current.duration;
    } else if (currentSong?.url && isYouTubeUrl(currentSong.url) && ytPlayerRef.current) {
      const dur = ytPlayerRef.current.getDuration?.();
      if (dur) ytPlayerRef.current.seekTo(pct * dur, true);
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!el.duration || isNaN(el.duration)) return;
      setProgress(el.currentTime / el.duration);
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
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentSong]);

  return (
    <div
      className="min-h-screen flex flex-col relative text-white font-sans"
    >
      {/* Removed top navbar. It's now rendered from the layout via <NavBar /> */}

      {/* Now Playing Section */}
      <section className="flex flex-col md:flex-row items-center md:items-start gap-6 px-6 py-4 z-10 relative">
        <NowPlaying
          currentSong={currentSong}
          isPlaying={isPlaying}
          progress={progress}
          timeDisplay={timeDisplay}
          onSeek={applySeek}
          onToggle={togglePlay}
          volume={volume}
          onVolumeChange={setVolume}
          isYouTubeUrl={isYouTubeUrl}
          audioRef={audioRef}
          ytPlayerDivRef={ytPlayerDivRef}
        />
        <div className="flex-1 w-full max-w-md rounded-xl p-6 shadow-lg overflow-y-auto max-h-96 bg-card border border-border">
          {/* Queue Section */}
          <h3 className="text-xl font-bold mb-4">Queue</h3>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <span className="text-4xl mb-2">🎶</span>
              <span className="font-semibold">No songs in queue</span>
              <span className="text-sm mt-1">Add a YouTube link below to start the vibe!</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {queue.map((item, idx) => {
                const active = currentSong && currentSong.url === item.url && currentSong.title === item.title;
                return (
                  <li
                    key={idx}
                    onClick={() => handleSelectSong(item)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 cursor-pointer transition border ${active ? 'bg-gray-700 border-gray-500' : 'bg-gray-900 hover:bg-gray-800 border-transparent'}`}
                  >
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt={item.title} className="w-12 h-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <span className="font-semibold block leading-tight truncate max-w-[180px]" title={item.title}>{item.title}</span>
                      <span className="text-xs text-gray-400">Added by {item.addedBy}</span>
                    </div>
                    {active && <span className="text-xs text-green-400 font-semibold">Playing</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Add Song Section */}
      <footer className="mt-4 px-6 py-4 bg-gradient-to-t from-background/80 to-transparent flex flex-col justify-center gap-4 z-10 relative">
        <form onSubmit={handleSubmit} className="flex gap-4 w-full max-w-xl">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste YouTube link..."
            className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 font-bold text-lg transition"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {preview && (
          <div className="w-full max-w-xl flex items-center gap-4 bg-gray-800/70 p-4 rounded-lg border border-gray-700">
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
