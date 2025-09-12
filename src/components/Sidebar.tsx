"use client";
import React from "react";

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
  return (
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-900/50"
      aria-label="Sidebar"
    >
      <div className="p-4">
        <div className="rounded-lg bg-gray-800/60 p-3 text-sm">
          <p className="text-gray-300">
            Explore upcoming features like Communities and Discover. Stay tuned!
          </p>
        </div>

        <Section title="Now" items={primary} />
        <Section title="Explore" items={explore} />
        <Section title="App" items={app} />
      </div>
    </aside>
  );
}