import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const limited = rateLimit(clientKey(req, "yt-search"), 20, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
        q
      )}&key=${key}`
    );
    const searchJson = await searchRes.json();
    if (!searchRes.ok) throw new Error(searchJson?.error?.message || "YouTube search failed");

    const items = searchJson.items || [];
    const ids = items.map((it: { id?: { videoId?: string } }) => it.id?.videoId).filter(Boolean).join(",");
    const durations: Record<string, string> = {};
    if (ids) {
      const vidsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${key}`
      );
      const vidsJson = await vidsRes.json();
      (vidsJson.items || []).forEach((it: { id: string; contentDetails?: { duration?: string } }) => {
        durations[it.id] = it.contentDetails?.duration || "";
      });
    }

    const parseDuration = (iso?: string) => {
      if (!iso) return "0:00";
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return "0:00";
      const h = parseInt(m[1] || "0", 10);
      const min = parseInt(m[2] || "0", 10);
      const sec = parseInt(m[3] || "0", 10);
      const totalMin = h * 60 + min;
      return `${totalMin}:${String(sec).padStart(2, "0")}`;
    };

    const results = items.map((it: { id: { videoId: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } } }) => {
      const id = it.id.videoId;
      const sn = it.snippet;
      return {
        videoId: id,
        title: sn?.title,
        channelTitle: sn?.channelTitle,
        thumbnailUrl: sn?.thumbnails?.medium?.url || sn?.thumbnails?.default?.url,
        duration: parseDuration(durations[id]),
      };
    });

    return NextResponse.json(results);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "YouTube search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
