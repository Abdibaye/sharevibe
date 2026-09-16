import React from "react";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
