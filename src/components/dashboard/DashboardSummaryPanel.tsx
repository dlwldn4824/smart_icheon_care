"use client";

import Link from "next/link";
import { FileText, Plus, Sparkles } from "lucide-react";
import { aiDailySummary } from "@/lib/dashboard-metrics";
import { currentUser } from "@/data/user";
import { useActionRegistry } from "@/lib/action-registry";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function UsageGauge({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const angle = (pct / 100) * 180;

  return (
    <div className="relative mx-auto h-28 w-44">
      <svg viewBox="0 0 200 110" className="h-full w-full">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#E8EDF5"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 251} 251`}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F7CFF" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <p className="text-2xl font-bold text-slate-900">{pct}%</p>
        <p className="text-[10px] text-muted">조치 완료율</p>
        <p className="text-[9px] text-muted">
          {value} / {max}건 처리
        </p>
      </div>
    </div>
  );
}

export function DashboardSummaryPanel({ className }: { className?: string }) {
  const { actions } = useActionRegistry();
  const actionCount = actions.length;
  const targetTotal = 12;

  return (
    <aside className={cn("elevated-card flex flex-col overflow-hidden", className)}>
      <div className="border-b border-border/60 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#7aa0ff] text-lg font-bold text-white shadow-lg shadow-blue-200/60">
            {currentUser.name[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">
              {currentUser.name} {currentUser.role}
            </p>
            <p className="truncate text-[11px] text-muted">{currentUser.email}</p>
            <p className="text-[10px] text-muted">{currentUser.department}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <Link href="/ai-report" className="block">
          <Button variant="default" className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            AI 리포트 생성
          </Button>
        </Link>

        <div className="mt-6 rounded-2xl bg-primary-soft/60 px-4 py-3">
          <p className="text-center text-[11px] font-semibold text-slate-700">이번 달 조치 현황</p>
          <UsageGauge value={actionCount} max={targetTotal} />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold text-slate-700">오늘의 AI 탐지</p>
          <div className="space-y-2">
            {aiDailySummary.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-sm font-bold text-slate-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-border bg-slate-50/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold text-slate-700">빠른 작업</p>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            CCTV·주차·시설 도메인별 조치를 등록하면 완료율에 반영됩니다.
          </p>
          <Link href="/cctv" className="mt-3 block">
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              새 조치 등록
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  );
}
