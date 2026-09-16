import { extractYouTubeId } from '@/lib/utils';

function parseDuration(iso?: string) {
  if (!iso) return '0:00';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const sec = parseInt(m[3] || '0', 10);
  const totalMin = h * 60 + min;
  return `${totalMin}:${String(sec).padStart(2, '0')}`;
}

export async function fetchYouTubeMetadata(youtubeUrl: string): Promise<{
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
}> {
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube video URL or ID');
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not set in environment variables');
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch YouTube metadata');
  }
  const data = await response.json();
  if (!data.items || !data.items.length) {
    throw new Error('No video found for the provided ID');
  }
  const item = data.items[0];
  const thumbs = item.snippet.thumbnails || {}
  const thumbUrl =
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url
  return {
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: thumbUrl,
    duration: parseDuration(item.contentDetails.duration),
  };
}
