"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, X } from "lucide-react";
import { initialNotifications } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { AppNotification, NotificationType } from "@/types";

const typeStyle: Record<NotificationType, { dot: string; bg: string; label: string }> = {
  urgent: { dot: "bg-red-500", bg: "bg-red-50", label: "긴급" },
  warning: { dot: "bg-orange-500", bg: "bg-orange-50", label: "주의" },
  info: { dot: "bg-blue-500", bg: "bg-blue-50", label: "안내" },
  success: { dot: "bg-green-500", bg: "bg-green-50", label: "완료" },
};

export function NotificationBell() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast("모든 알림을 읽음 처리했습니다.", "success");
  }

  function handleNotificationClick(n: AppNotification) {
    markAsRead(n.id);
    setOpen(false);
    if (n.href) {
      router.push(n.href);
    } else {
      toast(n.message, "info");
    }
  }

  function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="relative z-50">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        aria-expanded={open}
        className={cn(
          "relative rounded-2xl p-2 transition-colors",
          open ? "bg-primary-soft text-primary" : "text-slate-500 hover:bg-slate-100",
        )}
      >
        <Bell className={cn("h-5 w-5", open ? "text-primary" : "text-slate-500")} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:w-96"
        >
          {/* 패널 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">알림</p>
              <p className="text-[11px] text-muted">
                {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}건` : "모든 알림을 확인했습니다"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-primary hover:bg-blue-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">알림이 없습니다</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = typeStyle[n.type];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-1 border-b border-gray-50",
                      !n.read && "bg-blue-50/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              style.bg,
                              n.type === "urgent" && "text-red-700",
                              n.type === "warning" && "text-orange-700",
                              n.type === "info" && "text-blue-700",
                              n.type === "success" && "text-green-700",
                            )}
                          >
                            {style.label}
                          </span>
                          <span className="text-[10px] text-muted">{n.category}</span>
                          {!n.read && (
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted">{n.time}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => dismiss(n.id, e)}
                      className="mr-2 mt-3 shrink-0 rounded p-0.5 text-muted hover:bg-slate-200 hover:text-slate-600"
                      aria-label="알림 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 패널 푸터 */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/cctv"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] text-primary hover:underline"
            >
              AI 탐지 이력 전체 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
