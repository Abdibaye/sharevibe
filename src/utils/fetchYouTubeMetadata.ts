import { env } from 'process';

export async function fetchYouTubeMetadata(youtubeUrl: string): Promise<{
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
}> {
  // Extract video ID from URL
  const match = youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/|\/v\/|\/shorts\/)([\w-]{11})/);
  const videoId = match ? match[1] : null;
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
  return {
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails.default.url,
    duration: item.contentDetails.duration,
  };
}
