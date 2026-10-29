"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  NOTIF_EVENT,
  dotColor,
  fetchNotifications,
  getReadIds,
  iconFor,
  markRead,
  markUnread,
  type NotifItem,
} from "@/lib/notifications";

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const sync = useCallback(() => setReadIds(getReadIds()), []);

  useEffect(() => {
    let active = true;
    sync();
    (async () => {
      const data = await fetchNotifications();
      if (!active) return;
      setItems(data);
      setLoading(false);
    })();
    window.addEventListener(NOTIF_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener(NOTIF_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  const unread = items.filter((n) => !readIds.has(n.id));
  const visible = filter === "unread" ? unread : items;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#002B73]">All notifications</h1>
          <p className="text-sm text-slate-500">
            {unread.length} unread · {items.length} total
          </p>
        </div>
        <button
          type="button"
          disabled={unread.length === 0}
          onClick={() => markRead(unread.map((n) => n.id))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#002B73] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={14} /> Mark all as read
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "unread"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f ? "bg-[#002B73] text-white" : "bg-white text-slate-500 hover:bg-slate-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm font-medium text-slate-400">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Bell size={28} color="#CBD5E1" />
            <p className="text-sm font-semibold text-slate-400">
              {filter === "unread" ? "No unread notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((n) => {
              const isRead = readIds.has(n.id);
              return (
                <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${isRead ? "" : "bg-blue-50/40"}`}>
                  <span
                    className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
                    style={{ background: dotColor(n.type) }}
                  >
                    {iconFor(n.type)}
                  </span>
                  <Link href={n.href} onClick={() => markRead([n.id])} className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 break-words text-sm font-semibold text-[#1A1C1F]">
                      {n.title}
                      {!isRead && <span className="size-2 shrink-0 rounded-full bg-red-500" />}
                    </p>
                    <p className="mt-0.5 break-all text-xs font-medium text-slate-500">{n.sub}</p>
                    {n.meta && <p className="mt-0.5 text-xs font-medium text-slate-400">{n.meta}</p>}
                  </Link>
                  <button
                    type="button"
                    onClick={() => (isRead ? markUnread(n.id) : markRead([n.id]))}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-[#002B73] transition hover:bg-slate-100"
                  >
                    {isRead ? "Mark as unread" : "Mark as read"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
