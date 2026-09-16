import React from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionBridge } from "@/components/SessionBridge";
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <SessionBridge />
        <Toaster position="top-center" richColors closeButton />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
