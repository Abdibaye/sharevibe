import React from "react";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";


export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">{/* remove 'dark' if you use a ThemeProvider */}
      <body className="min-h-screen bg-background text-foreground">
        <NavBar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
