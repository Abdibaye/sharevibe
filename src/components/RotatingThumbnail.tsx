"use client";
import React from 'react';

interface RotatingThumbnailProps {
  src?: string | null;
  isPlaying: boolean;
  size?: number;
  alt?: string;
}

export const RotatingThumbnail: React.FC<RotatingThumbnailProps> = ({ src, isPlaying, size = 240, alt = 'Cover Art' }) => {
  return (
    <div
      className={`spinning-thumbnail ${isPlaying ? 'playing' : ''} rounded-full bg-gray-800 flex items-center justify-center overflow-hidden relative`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="object-cover w-full h-full select-none pointer-events-none"
          draggable={false}
        />
      ) : (
        <span className="text-5xl">🎵</span>
      )}
      <div className="absolute inset-0 rounded-full ring-1 ring-white/5" />
    </div>
  );
};

export default RotatingThumbnail;
