import React from "react";
import "./globals.css";
import NavBar from "../components/NavBar";
import Sidebar from "../components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SessionBridge } from "@/components/SessionBridge";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">{/* remove 'dark' if you use a ThemeProvider */}
      <body className="min-h-screen bg-background text-foreground">
  <SessionBridge />
        <Toaster position="top-center" richColors closeButton />
        <div className="flex">
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
