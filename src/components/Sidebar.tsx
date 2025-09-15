"use client";
import React from "react";
import { authClient } from "@/lib/auth-client";

type Item = {
  label: string;
  icon?: string;
  soon?: boolean;
  onClick?: () => void;
};

const primary: Item[] = [
  { label: "Now Playing", icon: "🎵" },
  { label: "Queue", icon: "📜" },
];

const explore: Item[] = [
  { label: "Communities", icon: "👥", soon: true },
  { label: "Discover", icon: "🔎", soon: true },
  { label: "Friends", icon: "🤝", soon: true },
];

const app: Item[] = [{ label: "Settings", icon: "⚙️", soon: true }];

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="mt-4">
      <p className="px-2 text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              onClick={it.onClick}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-800/70 transition"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{it.icon}</span>
                <span className="text-sm">{it.label}</span>
              </span>
              {it.soon && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-700 text-gray-200">
                  Soon
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = authClient.useSession?.() ?? { data: null };
  const user = (session as any)?.user ?? (session as any)?.session?.user;
  const signedIn = !!user;

  return (
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-900/50 relative"
      aria-label="Sidebar"
    >
      {/* Sidebar content */}
      <div className={`p-4 ${!signedIn ? "pointer-events-none select-none" : ""}`}>
        <div className={`rounded-lg bg-gray-800/60 p-3 text-sm ${!signedIn ? "opacity-90" : ""}`}>
          <p className="text-gray-300">
            Explore upcoming features like Communities and Discover. Stay tuned!
          </p>
        </div>

        <div className={!signedIn ? "filter blur-[1px]" : undefined}>
          <Section title="Now" items={primary} />
          <Section title="Explore" items={explore} />
          <Section title="App" items={app} />
        </div>
      </div>

      {/* Signed-out overlay */}
      {!signedIn && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4 text-center">
          <div className="space-y-1">
            <p className="text-sm text-gray-200">Sign in to access the sidebar features.</p>
            <p className="text-xs text-gray-300/80">Your communities, queue tools, and more await.</p>
          </div>
        </div>
      )}
    </aside>
  );
}