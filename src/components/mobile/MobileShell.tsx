"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Car, Flag, Home, Menu, Snowflake, Trees } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { initialNotifications, complaints, notices } from "@/data/mock";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

const tabs = [
  { href: "/mobile", label: "홈", icon: Home },
  { href: "/mobile/report", label: "민원 신고", icon: Flag },
  { href: "/mobile/complaints", label: "내 민원", icon: Menu },
  { href: "/mobile/notifications", label: "알림", icon: Bell },
  { href: "/dashboard", label: "더보기", icon: Menu },
];

export function MobileShell({
  children,
  title,
  showBack,
}: {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
}) {
  const pathname = usePathname();
  const unreadCount = initialNotifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-border bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          {showBack ? (
            <Link href="/mobile" className="text-sm text-primary">
              ← 뒤로
            </Link>
          ) : (
            <div>
              <BrandLogo priority height={26} maxWidth={128} />
              <p className="mt-1.5 text-xs text-muted">📍 이천시 설봉동</p>
            </div>
          )}
          {!showBack && (
            <Link href="/mobile/notifications" className="relative rounded-lg p-1 hover:bg-slate-100">
              <Bell className="h-5 w-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}
          {showBack && <h1 className="text-base font-bold">{title}</h1>}
          {showBack && <div className="w-8" />}
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-[390px] -translate-x-1/2 border-t border-border bg-white">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-primary" : "text-slate-400",
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileHome() {
  const quickActions = [
    { label: "불법 현수막 신고", icon: Flag, href: "/mobile/report", color: "bg-red-50 text-red-600" },
    { label: "공원/시설 신고", icon: Trees, href: "/mobile/report", color: "bg-green-50 text-green-600" },
    { label: "제설 요청", icon: Snowflake, href: "/mobile/report", color: "bg-blue-50 text-blue-600" },
    { label: "불법 주차 신고", icon: Car, href: "/mobile/report", color: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-blue-700 p-5 text-white">
        <p className="text-lg font-bold">이천시 AI 스마트 시티</p>
        <p className="mt-1 text-sm text-blue-100">시설 불편을 쉽고 빠르게 신고하세요</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">빠른 신고</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={cn("flex flex-col items-center gap-2 rounded-xl p-4", action.color)}
              >
                <Icon className="h-6 w-6" />
                <span className="text-center text-xs font-medium">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">최근 공지</h2>
        <div className="space-y-2">
          {notices.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-white p-3">
              <p className="text-[10px] text-muted">{n.date}</p>
              <p className="text-sm">{n.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">내 민원 현황</h2>
        <div className="space-y-2">
          {complaints.slice(0, 2).map((c) => (
            <Link
              key={c.id}
              href="/mobile/complaints"
              className="flex items-center justify-between rounded-xl border border-border bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted">{c.date}</p>
              </div>
              <Badge
                variant={
                  c.status === "processing"
                    ? "info"
                    : c.status === "reviewing"
                      ? "medium"
                      : "low"
                }
              >
                {c.status === "processing" ? "처리중" : c.status === "reviewing" ? "검토중" : "완료"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
