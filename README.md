This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## State Management (Zustand)

This project uses Zustand for client-side state.

- Player store: `usePlayerStore` at `src/stores/playerStore.ts`
- UI store: `useUIStore` at `src/stores/uiStore.ts`

Both stores are persisted to `localStorage`. In Next.js app router, import these hooks only in Client Components. Each store file begins with `"use client"` to enforce this.

Quick usage:

```tsx
"use client"
import { usePlayerStore, useUIStore } from "@/stores"

export function Example() {
	const { isPlaying, play, pause } = usePlayerStore((s) => ({
		isPlaying: s.isPlaying,
		play: s.play,
		pause: s.pause,
	}))
	const sidebarOpen = useUIStore((s) => s.sidebarOpen)
	return (
		<div>
			<button onClick={() => (isPlaying ? pause() : play())}>
				{isPlaying ? "Pause" : "Play"}
			</button>
			<button onClick={() => useUIStore.getState().toggleSidebar()}>
				Toggle sidebar (now {String(sidebarOpen)})
			</button>
		</div>
	)
}
```

SSR note: Avoid calling these hooks in Server Components. If you need to pass initial data, do it via props to a client component.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
