"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Menu, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { DEMO_SESSION_KEY, type DemoSession } from "@/lib/demoAuth";

import {
  NOTIF_EVENT,
  clearFromDropdown,
  dotColor,
  fetchNotifications,
  getClearedIds,
  getReadIds,
  iconFor,
  markRead,
  type NotifItem,
} from "@/lib/notifications";

/** Polling interval in ms — check for new notifications every 15 seconds */
const POLL_INTERVAL = 15_000;

export default function TopAppBar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allNotifs, setAllNotifs] = useState<NotifItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [demoSession, setDemoSession] = useState<DemoSession | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown when clicking/tapping anywhere outside it, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const savedSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (!savedSession) return;
    try {
      setDemoSession(JSON.parse(savedSession) as DemoSession);
    } catch (error) {
      console.error("Could not read the signed-in demo account.", error);
    }
  }, []);

  const syncStored = useCallback(() => {
    setReadIds(getReadIds());
    setClearedIds(getClearedIds());
  }, []);

  // Keep read/cleared state in sync (other tabs + the All notifications page)
  useEffect(() => {
    syncStored();
    window.addEventListener(NOTIF_EVENT, syncStored);
    window.addEventListener("storage", syncStored);
    return () => {
      window.removeEventListener(NOTIF_EVENT, syncStored);
      window.removeEventListener("storage", syncStored);
    };
  }, [syncStored]);

  const refresh = useCallback(async () => {
    const data = await fetchNotifications();
    setAllNotifs(data);
    return data;
  }, []);

  // Initial fetch + start polling
  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      const data = await fetchNotifications();
      if (!active) return;
      setAllNotifs(data);
      setLoading(false);
    })();

    pollRef.current = setInterval(async () => {
      if (!active) return;
      const data = await fetchNotifications();
      if (!active) return;
      setAllNotifs(data);
    }, POLL_INTERVAL);

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // The dropdown only lists notifications that were not cleared
  const notifs = allNotifs.filter((n) => !clearedIds.has(n.id));
  const unreadCount = notifs.filter((n) => !readIds.has(n.id)).length;

  const handleBellClick = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    await refresh();
    setLoading(false);
  }, [open, refresh]);

  const handleClear = () => {
    clearFromDropdown(notifs.map((n) => n.id));
  };

  return (
    <>
      <style>{`
        .topappbar {
          height: 64px;
          background: #ffffff;
          border-bottom: 1px solid #E2E8F0;
          box-shadow: 0 2px 10px rgba(11, 60, 176, 0.06);
          border-top: 3px solid;
          border-image: linear-gradient(90deg, #0B3CB0 0%, #0B3CB0 70%, #F03020 100%) 1;
        }
        .profile-button {
          padding: 3px 12px 3px 3px;
          border: 1px solid #E2E8F0;
        }
        .profile-avatar {
          width: 34px;
          height: 34px;
          background: rgba(0, 43, 115, 0.1);
          flex-shrink: 0;
        }
        .profile-name {
          color: #1E3A8A;
          font-size: 12px;
          line-height: 14px;
        }
        .profile-role {
          font-size: 10px;
          line-height: 12px;
          color: #64748B;
        }

        @media (max-width: 640px) {
          .topappbar {
            height: 56px;
            padding-left: 12px;
            padding-right: 12px;
          }
          .profile-button > .flex.flex-col {
            display: none;
          }
          .profile-avatar {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>

      {/* Backdrop — closes dropdown on outside click */}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      )}

      <header className="topappbar fixed top-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 left-0 lg:left-[var(--sb,252px)]">
        <button
          onClick={onMenuClick}
          className="flex size-11 sm:size-9 items-center justify-center rounded-lg transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="size-7 sm:size-5" color="#475569" />
        </button>

        <div className="flex items-center gap-2.5 sm:gap-4 ml-auto">
          <div className="relative" ref={bellRef}>
            <button
              onClick={handleBellClick}
              className="flex size-11 sm:size-9 items-center justify-center rounded-full transition hover:bg-slate-100"
              aria-label="Notifications"
              aria-expanded={open}
            >
              <Bell className="size-6 sm:size-[18px]" color={open ? "#002B73" : "#64748B"} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-red-500 text-white font-bold"
                  style={{
                    minWidth: 18,
                    height: 18,
                    fontSize: 10,
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                  aria-label={`${unreadCount} new notifications`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div
                className="
      absolute right-0 top-full mt-3
      z-[99999]
      flex w-[calc(100vw-2rem)] max-w-[340px]
      flex-col
      overflow-hidden
      rounded-2xl
      bg-white
      opacity-100
      shadow-[0px_12px_32px_rgba(0,0,0,0.18)]
      sm:w-[360px]
    "
                style={{
                  border: "1px solid #E2E8F0",
                  maxHeight: "min(480px, calc(100vh - 90px))",
                  backgroundColor: "#FFFFFF",
                  opacity: 1,
                  isolation: "isolate",
                }}
              >
                {/* Header */}
                <div
                  className="flex shrink-0 items-center justify-between px-5 py-4"
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <span className="text-sm font-bold text-[#002B73]">
                    Notifications
                  </span>

                  <div className="flex items-center gap-2">
                    {notifs.length > 0 && (
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#002B73]">
                        {notifs.length}
                      </span>
                    )}
                    {notifs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="rounded-md px-2 py-0.5 text-xs font-bold text-[#BC0000] transition hover:bg-red-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Notification list */}
                <div
                  className="
                  min-h-0
                  flex-1
                  overflow-y-auto
                  bg-white
                  max-h-[50vh]
                  sm:max-h-[360px]
                "
                >
                  {loading ? (
                    <div className="flex items-center justify-center bg-white py-10">
                      <span className="text-sm font-medium text-[#94A3B8]">
                        Loading…
                      </span>
                    </div>
                  ) : notifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 bg-white px-6 py-10 text-center">
                      <Bell size={28} color="#CBD5E1" />

                      <p className="text-sm font-semibold text-[#94A3B8]">
                        All caught up — no new notifications
                      </p>
                    </div>
                  ) : (
                    <ul className="bg-white">
                      {notifs.map((n, idx) => (
                        <li
                          key={n.id}
                          className="bg-white"
                          style={{
                            borderTop: idx === 0 ? "none" : "1px solid #F1F5F9",
                          }}
                        >
                          <Link
                            href={n.href}
                            onClick={() => {
                              markRead([n.id]);
                              setOpen(false);
                            }}
                            className="
                  flex items-start gap-3
                  bg-white
                  px-5 py-4
                  transition
                  hover:bg-slate-50
                "
                          >
                            <span
                              className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: dotColor(n.type),
                              }}
                            >
                              {iconFor(n.type)}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 break-words text-sm font-semibold leading-snug text-[#1A1C1F]">
                                {n.title}
                                {!readIds.has(n.id) && (
                                  <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />
                                )}
                              </p>

                              <p className="mt-0.5 break-all text-xs font-medium text-[#64748B]">
                                {n.sub}
                              </p>

                              {n.meta && (
                                <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
                                  {n.meta}
                                </p>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Footer */}
                <div
                  className="z-[99999] flex shrink-0 items-center justify-center bg-white px-2 py-1"
                  style={{
                    borderTop: "1px solid #F1F5F9",
                  }}
                >
                  <Link
                    href="/dashboard/notifications"
                    onClick={() => setOpen(false)}
                    className="text-xs font-bold text-[#002B73]"
                  >
                    View all notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="profile-button flex items-center gap-3 rounded-full bg-white">
            <div className="profile-avatar flex items-center justify-center rounded-full">
              <UserCircle2 size={20} color="#002B73" />
            </div>
            <div className="flex flex-col items-start">
              <span className="profile-name font-bold">
                {demoSession?.name ?? "Account"}
              </span>
              <span className="profile-role font-medium">
                {demoSession?.role === "admin"
                  ? "Administrator"
                  : demoSession?.teamName ?? "Team member"}
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
