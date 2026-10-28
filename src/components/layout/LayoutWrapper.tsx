"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import TopAppBar from "./TopAppBar";
import Sidebar from "./Sidebar";

export default function LayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("magnify-sidebar-collapsed") === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem("magnify-sidebar-collapsed", v ? "0" : "1");
      } catch {}
      return !v;
    });

  return (
    <div
      className="h-screen overflow-hidden bg-[#F8FAFD]"
      style={{ ["--sb" as string]: collapsed ? "76px" : "252px" }}
    >
      <TopAppBar onMenuClick={() => setSidebarOpen((v) => !v)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <main
        className="dashboard-main flex flex-col overflow-y-auto lg:ml-[var(--sb)] transition-[margin] duration-300"
        style={{
          marginTop: 64,
          height: "calc(100vh - 64px)",
          backgroundColor: "#F8FAFD",
        }}
      >
        {children}
      </main>
    </div>
  );
}