"use client";
import React, { useState } from "react";

export default function RoomPage() {
  const [roomCode] = useState("ABCD1234");
  const [queue] = useState([
    { title: "Song One", addedBy: "Alice" },
    { title: "Song Two", addedBy: "Bob" },
    { title: "Song Three", addedBy: "Charlie" },
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
  };

  return (
  <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white font-sans">
      {/* Top Bar */}
  <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-wide">ShareVibe</span>
          <span className="ml-2 px-3 py-1 rounded bg-gray-800 text-sm font-semibold">Room Name</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono bg-gray-800 px-3 py-1 rounded">{roomCode}</span>
          <button
            onClick={handleCopy}
            className="rounded px-3 py-1 bg-gray-700 hover:bg-gray-600 transition font-semibold text-sm"
          >
            Copy
          </button>
        </div>
      </header>

      {/* Now Playing Section */}
  <section className="flex flex-col md:flex-row items-center md:items-start gap-8 px-6 py-8">
        <div className="flex flex-col items-center md:items-start gap-4 flex-1">
          <div className="w-40 h-40 rounded-xl bg-gray-800 flex items-center justify-center overflow-hidden">
            {/* Placeholder for cover image */}
            <span className="text-5xl">🎵</span>
          </div>
          <div className="mt-2">
            <h2 className="text-3xl font-bold">Song Title</h2>
            <p className="text-lg text-gray-400">Artist Name</p>
          </div>
          {/* Progress Bar Placeholder */}
          <div className="w-full h-3 bg-gray-900 rounded-full mt-4">
            <div className="w-1/3 h-3 bg-gray-700 rounded-full transition-all" />
          </div>
          {/* Playback Controls */}
          <div className="flex gap-4 mt-6">
            <button className="rounded-full bg-gray-700 hover:bg-gray-600 p-4 text-2xl transition">
              ▶️
            </button>
            <button className="rounded-full bg-gray-700 hover:bg-gray-600 p-4 text-2xl transition">
              ⏸️
            </button>
            <button className="rounded-full bg-gray-700 hover:bg-gray-600 p-4 text-2xl transition">
              ⏭️
            </button>
          </div>
        </div>

        {/* Queue Section */}
        <div className="flex-1 w-full max-w-md bg-gray-800 rounded-xl p-6 shadow-lg overflow-y-auto max-h-96">
          <h3 className="text-xl font-bold mb-4">Queue</h3>
          <ul className="space-y-3">
            {queue.map((item, idx) => (
              <li key={idx} className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-2">
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm text-gray-400">Added by {item.addedBy}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Add Song Section */}
      <footer className="mt-auto px-6 py-6 bg-gradient-to-t from-gray-900 to-transparent flex items-center justify-center">
        <form className="flex gap-4 w-full max-w-xl">
          <input
            type="text"
            placeholder="Paste YouTube link..."
            className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button
            type="submit"
            className="rounded-lg px-6 py-3 bg-gray-700 hover:bg-gray-600 font-bold text-lg transition"
          >
            Add
          </button>
        </form>
      </footer>
    </div>
  );
}
