"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import {
  Building2,
  Car,
  CloudSun,
  FileText,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Snowflake,
  Smartphone,
} from "lucide-react";
import { navItems } from "@/data/nav";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { NavItem } from "@/types";

const iconMap = {
  layout: LayoutDashboard,
  building: Building2,
  car: Car,
  snowflake: Snowflake,
  flag: Flag,
  message: MessageSquare,
  file: FileText,
  settings: Settings,
  shield: ShieldCheck,
};

const pageTitles: Record<string, string> = {
  "/dashboard": "통합 대시보드",
  "/bollard-control": "지능형 차단봉 제어",
  "/facility-management": "시설 관리",
  "/parking-analysis": "주차 분석",
  "/snow-removal": "제설 관리",
  "/cctv": "CCTV AI 탐지",
  "/complaint-management": "민원 관리",
  "/ai-report": "AI 리포트",
  "/settings": "설정",
};

function NavIcon({ item }: { item: NavItem }) {
  const Icon = iconMap[item.iconName];
  return <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />;
}

function SidebarTooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group/navtip relative", className)}>
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[60] -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/navtip:translate-x-0 group-hover/navtip:opacity-100"
      >
        {label}
        <span
          className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const isMobile = pathname.startsWith("/mobile");
  const isDashboard = pathname === "/dashboard";
  const pageTitle = pageTitles[pathname] ?? "Smart Icheon Care";

  useEffect(() => {
    document.body.dataset.mobile = isMobile ? "true" : "false";
  }, [isMobile]);

  if (isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="relative z-50 flex w-[72px] shrink-0 flex-col items-center overflow-visible border-r border-border/80 bg-sidebar py-5 shadow-[4px_0_24px_rgba(15,23,42,0.04)]">
        <SidebarTooltip label="홈" className="mb-6">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#7aa0ff] text-white shadow-lg shadow-blue-200/50"
            aria-label="홈"
          >
            <Building2 className="h-5 w-5" />
          </Link>
        </SidebarTooltip>

        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-visible px-2">
          {navItems.map((item) => {
            const active = item.ready && pathname === item.href;

            if (!item.ready) {
              return (
                <SidebarTooltip key={item.label} label={item.label}>
                  <button
                    type="button"
                    aria-label={item.label}
                    onClick={() => toast(`「${item.label}」은 프로토타입 준비 중입니다.`, "warning")}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-sidebar-hover hover:text-slate-600"
                  >
                    <NavIcon item={item} />
                  </button>
                </SidebarTooltip>
              );
            }

            return (
              <SidebarTooltip key={item.label} label={item.label}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                    active
                      ? "bg-primary-soft text-primary shadow-sm"
                      : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-600",
                  )}
                >
                  {active && (
                    <span className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <NavIcon item={item} />
                </Link>
              </SidebarTooltip>
            );
          })}
        </nav>

        <div className="mt-2 flex flex-col items-center gap-2 px-2">
          <SidebarTooltip label="시민용 앱">
            <Link
              href="/mobile"
              aria-label="시민용 앱"
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-sidebar-hover hover:text-primary"
            >
              <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Link>
          </SidebarTooltip>
          <SidebarTooltip label="설정">
            <Link
              href="/settings"
              aria-label="설정"
              aria-current={pathname === "/settings" ? "page" : undefined}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                pathname === "/settings"
                  ? "bg-primary-soft text-primary"
                  : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-600",
              )}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Link>
          </SidebarTooltip>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-[60px] shrink-0 items-center gap-3 border-b border-border/60 bg-white/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <Link href="/dashboard" className="shrink-0" aria-label="Smart Icheon Care 홈">
              <BrandLogo priority height={43} maxWidth={isDashboard ? 176 : 144} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                {pageTitle}
              </h1>
              <p className="truncate text-[10px] text-muted sm:text-[11px]">
                이천시 AI 도시 인프라 통합 관리
              </p>
            </div>
          </div>

          <div className="hidden max-w-md flex-1 px-4 md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    toast(`「${search.trim()}」 검색 결과를 표시합니다.`, "info");
                  }
                }}
                placeholder="탐지 이벤트, 시설, 구역 검색..."
                className="h-10 w-full rounded-2xl border border-border bg-slate-50/80 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
            <div className="hidden items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 lg:flex">
              <CloudSun className="h-3.5 w-3.5 text-amber-500" />
              <span>이천시 21°C</span>
            </div>
            <NotificationBell />
            {!isDashboard && <UserProfileMenu />}
          </div>
        </header>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto",
            isDashboard ? "p-4 lg:p-5" : "p-4 lg:p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
