"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  Smartphone,
  UserCircle,
} from "lucide-react";
import { currentUser } from "@/data/user";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export function UserProfileMenu() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  function handleMenu(action: string) {
    setOpen(false);
    if (action === "logout") {
      toast("로그아웃되었습니다. 안녕히 가세요.", "success");
      setTimeout(() => router.push("/dashboard"), 800);
      return;
    }
    if (action === "mobile") return;
    toast(`「${action}」은 프로토타입 준비 중입니다.`, "warning");
  }

  const menuItems = [
    { id: "profile", label: "내 정보", icon: UserCircle, href: "/settings?tab=profile" },
    { id: "settings", label: "계정 설정", icon: Settings, href: "/settings?tab=profile" },
    { id: "notifications", label: "알림 설정", icon: Bell, href: "/settings?tab=notifications" },
    { id: "mobile", label: "시민용 앱 보기", icon: Smartphone, href: "/mobile" },
  ];

  return (
    <div className="relative z-50">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="프로필 메뉴"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors",
          open
            ? "border-primary/30 bg-blue-50"
            : "border-gray-100 bg-slate-50 hover:bg-slate-100",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {currentUser.name[0]}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-semibold text-slate-800">
            {currentUser.name} {currentUser.role}
          </p>
          <p className="text-[10px] text-muted">{currentUser.department}</p>
        </div>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-muted transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-[100] mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {/* 프로필 정보 */}
          <div className="border-b border-gray-100 bg-gradient-to-br from-blue-50 to-white px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white shadow-md shadow-blue-200">
                {currentUser.name[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {currentUser.name} {currentUser.role}
                </p>
                <p className="text-xs text-muted">{currentUser.department}</p>
                <p className="mt-0.5 text-[10px] text-muted">{currentUser.email}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg bg-white/80 px-2 py-1.5">
                <p className="text-muted">사번</p>
                <p className="font-medium text-slate-700">{currentUser.employeeId}</p>
              </div>
              <div className="rounded-lg bg-white/80 px-2 py-1.5">
                <p className="text-muted">최근 접속</p>
                <p className="font-medium text-slate-700">{currentUser.lastLogin}</p>
              </div>
            </div>
          </div>

          {/* 메뉴 */}
          <div className="py-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="h-4 w-4 text-muted" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* 로그아웃 */}
          <div className="border-t border-gray-100 p-2">
            <button
              type="button"
              onClick={() => handleMenu("logout")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
