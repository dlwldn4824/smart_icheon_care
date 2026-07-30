"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { initialNotifications } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { MobileShell } from "@/components/mobile/MobileShell";
import type { AppNotification, NotificationType } from "@/types";

const typeStyle: Record<NotificationType, { dot: string; badge: string; label: string }> = {
  urgent: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "긴급" },
  warning: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "주의" },
  info: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700", label: "안내" },
  success: { dot: "bg-green-500", badge: "bg-green-100 text-green-700", label: "완료" },
};

export function MobileNotifications() {
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast("모든 알림을 읽음 처리했습니다.", "success");
  }

  function handleClick(n: AppNotification) {
    markAsRead(n.id);
    if (n.href && n.href.startsWith("/mobile")) {
      router.push(n.href);
    } else if (n.href) {
      toast("관리자 페이지 알림입니다.", "info");
    }
  }

  return (
    <MobileShell title="알림" showBack>
      <div className="px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  filter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {f === "all" ? "전체" : `읽지 않음 (${unreadCount})`}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              모두 읽음
            </button>
          )}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted">
              <Bell className="h-10 w-10 opacity-30" />
              <p className="text-sm">알림이 없습니다</p>
            </div>
          ) : (
            filtered.map((n) => {
              const style = typeStyle[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-white p-4 text-left shadow-sm",
                    !n.read && "border-l-4 border-l-primary",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", style.badge)}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-muted">{n.category}</span>
                    <span className="ml-auto text-[10px] text-muted">{n.time}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{n.message}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </MobileShell>
  );
}
