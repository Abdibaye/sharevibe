import React from "react";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionBridge } from "@/components/SessionBridge";
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://s.ytimg.com" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <SessionBridge />
        <Toaster position="top-center" richColors closeButton />
        {children}
        <Analytics />
        <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive" />
      </body>
    </html>
  );
}
