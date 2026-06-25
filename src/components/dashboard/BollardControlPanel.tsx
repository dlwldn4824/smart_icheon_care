"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  History,
  Loader2,
  Radio,
  ShieldCheck,
  Volume2,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  bollardOperationLogs,
  bollardSchedule as defaultSchedule,
  bollardUnits as initialBollardUnits,
} from "@/data/bollards";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  canOperateBollard,
  computeBollardSummary,
  delay,
  formatBollardTime,
  getStatusAfterMove,
  isBollardSafe,
} from "@/lib/bollard-control";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { BollardDangerLevel, BollardOperationLog, BollardSchedule, BollardStatus, BollardUnit } from "@/types";

function BollardIcon({ status, className }: { status: BollardStatus; className?: string }) {
  const raised = status === "raised" || status === "raising";
  const moving = status === "raising" || status === "lowering";

  return (
    <svg
      viewBox="0 0 48 64"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="8" y="44" width="32" height="6" rx="2" fill="#cbd5e1" />
      <rect x="14" y="48" width="20" height="12" rx="1" fill="#94a3b8" />
      <rect
        x="18"
        y={raised ? 18 : 38}
        width="12"
        height={raised ? 26 : 10}
        rx="3"
        fill={status === "maintenance" ? "#f97316" : raised ? "#ef4444" : "#22c55e"}
        className={moving ? "animate-pulse" : undefined}
      />
      <ellipse cx="24" cy="44" rx="14" ry="3" fill="#e2e8f0" />
      {raised && (
        <path d="M24 8 L28 16 L20 16 Z" fill="#ef4444" opacity="0.85" />
      )}
    </svg>
  );
}

const statusBadge: Record<
  BollardStatus,
  { label: string; variant: "urgent" | "low" | "info" | "medium" | "high" }
> = {
  raised: { label: "상승", variant: "urgent" },
  raising: { label: "상승 중", variant: "high" },
  lowered: { label: "하강", variant: "low" },
  lowering: { label: "하강 중", variant: "info" },
  maintenance: { label: "점검", variant: "medium" },
};

const dangerStyle: Record<BollardDangerLevel, { icon: typeof CheckCircle2; className: string }> = {
  safe: { icon: CheckCircle2, className: "text-green-600" },
  warning: { icon: AlertTriangle, className: "text-amber-500" },
  danger: { icon: XCircle, className: "text-red-500" },
};

function detectionLabel(detected: boolean, label: string) {
  return detected ? `${label}: 감지됨` : `${label}: 없음`;
}

function appendLog(
  setter: React.Dispatch<React.SetStateAction<BollardOperationLog[]>>,
  message: string,
  time = formatBollardTime(),
) {
  setter((prev) => [{ id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time, message }, ...prev]);
}

export function BollardControlPanel() {
  const { toast } = useToast();
  const [units, setUnits] = useState<BollardUnit[]>(initialBollardUnits);
  const [selectedId, setSelectedId] = useState(initialBollardUnits[0]?.id ?? "");
  const [warningSound, setWarningSound] = useState(true);
  const [ledFlash, setLedFlash] = useState(true);
  const [scheduleDraft, setScheduleDraft] = useState<BollardSchedule>(defaultSchedule);
  const [appliedSchedule, setAppliedSchedule] = useState<BollardSchedule | null>(null);
  const [logs, setLogs] = useState(bollardOperationLogs);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [scheduleApplying, setScheduleApplying] = useState(false);

  const selected = useMemo(
    () => units.find((b) => b.id === selectedId) ?? units[0],
    [units, selectedId],
  );

  const summary = useMemo(() => computeBollardSummary(units), [units]);
  const canOperateSelected = selected ? canOperateBollard(selected, operatingId) : false;
  const isOperatingSelected = operatingId === selected?.id;

  const primaryAction =
    selected?.targetAction === "lower" ? "차단봉 하강" : "차단봉 상승";

  const updateUnit = useCallback((id: string, patch: Partial<BollardUnit>) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const executeBollardAction = useCallback(
    async (unitId: string) => {
      const unit = units.find((u) => u.id === unitId);
      if (!unit || !canOperateBollard(unit, operatingId)) {
        if (unit && !isBollardSafe(unit)) {
          toast(`${unit.location} — 안전 조건 미충족으로 작동할 수 없습니다.`, "warning");
        }
        return;
      }

      const isLower = unit.targetAction === "lower";
      const actionVerb = isLower ? "하강" : "상승";
      const movingStatus: BollardStatus = isLower ? "lowering" : "raising";
      const finalStatus: BollardStatus = isLower ? "lowered" : "raised";

      setOperatingId(unitId);
      setSelectedId(unitId);

      const startTime = formatBollardTime();
      updateUnit(unitId, {
        ...getStatusAfterMove(unit, movingStatus),
        lastOperatedAt: startTime,
      });
      appendLog(setLogs, `${unit.location} 차단봉 ${actionVerb} 원격 제어 시작`, startTime);
      toast(`${unit.location} 차단봉 ${actionVerb} 명령을 전송했습니다.`, "info");

      if (warningSound) {
        appendLog(setLogs, "작동 전 경고음 5초 송출");
        await delay(1200);
        appendLog(setLogs, "경고음 송출 완료");
      }

      if (ledFlash) {
        appendLog(setLogs, "LED 점멸 활성화");
        await delay(400);
      }

      appendLog(setLogs, "CCTV 안전 확인 완료");
      await delay(isLower ? 1800 : 1600);

      const endTime = formatBollardTime();
      updateUnit(unitId, {
        ...getStatusAfterMove(unit, finalStatus),
        lastOperatedAt: endTime,
      });
      appendLog(setLogs, `${unit.location} 차단봉 ${actionVerb} 완료`, endTime);
      toast(`${unit.location} 차단봉 ${actionVerb}이 완료되었습니다.`, "success");
      setOperatingId(null);
    },
    [units, operatingId, warningSound, ledFlash, toast, updateUnit],
  );

  const handleOperate = useCallback(() => {
    if (!selected) return;
    void executeBollardAction(selected.id);
  }, [selected, executeBollardAction]);

  const handleApplySchedule = useCallback(async () => {
    setScheduleApplying(true);
    await delay(600);

    const next = { ...scheduleDraft };
    setAppliedSchedule(next);

    const time = formatBollardTime();
    const statusLabel = next.enabled ? "활성화" : "비활성화";
    appendLog(
      setLogs,
      `장날 자동 개방 스케줄 적용 (${statusLabel} · ${next.startTime}~${next.endTime})`,
      time,
    );

    toast(
      `장날 자동 개방 ${statusLabel} · ${next.startTime} ~ ${next.endTime} · ${next.repeatLabel}`,
      "success",
    );
    setScheduleApplying(false);
  }, [scheduleDraft, toast]);

  if (!selected) return null;

  const DangerIcon = dangerStyle[selected.dangerLevel].icon;

  return (
    <section className="elevated-card overflow-hidden">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-white to-slate-50/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
            <BollardIcon status="raised" className="h-8 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted">
              AI 안전 감지 확인 후 원격 제어 · 실시간 CCTV 연동
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-white px-3 py-1.5 text-[11px]">
          <Wifi className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted">원격 제어</span>
          <span className="font-semibold text-green-600">연결됨</span>
        </div>
      </div>

      <div className="space-y-4 p-4 lg:p-5">
        {/* 1. 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "전체 차단봉", value: summary.total, unit: "개", accent: "text-slate-900" },
            { label: "상승 중", value: summary.raising, unit: "개", accent: "text-red-600" },
            { label: "하강 중", value: summary.lowering, unit: "개", accent: "text-blue-600" },
            { label: "점검 필요", value: summary.maintenance, unit: "개", accent: "text-amber-600" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[10px] font-medium text-muted">{item.label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", item.accent)}>
                {item.value}
                <span className="ml-0.5 text-sm font-semibold text-muted">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 2. 테이블 + 3. 상세 제어 */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-white xl:col-span-7">
            <div className="border-b border-border/60 px-4 py-3">
              <span className="text-xs font-bold text-slate-800">차단봉 제어 목록</span>
            </div>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[10px] text-muted">
                    <th className="px-3 py-2.5 font-medium">위치</th>
                    <th className="px-2 py-2.5 font-medium">현재 상태</th>
                    <th className="px-2 py-2.5 font-medium">주변 위험 감지</th>
                    <th className="px-2 py-2.5 font-medium">제어 모드</th>
                    <th className="px-2 py-2.5 font-medium">마지막 작동</th>
                    <th className="px-3 py-2.5 font-medium">조작</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((row) => {
                    const active = row.id === selectedId;
                    const sb = statusBadge[row.status];
                    const DIcon = dangerStyle[row.dangerLevel].icon;
                    const rowOperating = operatingId === row.id;
                    const rowCanOperate = canOperateBollard(row, operatingId);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "cursor-pointer border-t border-gray-50 transition-colors",
                          active ? "bg-primary-soft/60" : "hover:bg-slate-50/80",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <BollardIcon status={row.status} className="h-7 w-5" />
                            <span className="font-medium text-slate-800">{row.location}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant={sb.variant} className="text-[10px]">
                            {row.statusLabel}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={cn("flex items-center gap-1", dangerStyle[row.dangerLevel].className)}>
                            <DIcon className="h-3 w-3 shrink-0" />
                            <span className="text-[10px] text-slate-700">{row.dangerLabel}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-[10px] text-slate-600">{row.modeLabel}</td>
                        <td className="px-2 py-2.5 text-[10px] tabular-nums text-muted">
                          {row.lastOperatedAt}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            disabled={rowOperating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(row.id);
                              if (rowCanOperate) {
                                void executeBollardAction(row.id);
                              } else if (!isBollardSafe(row)) {
                                toast(`${row.location} — 안전 확인이 필요합니다.`, "warning");
                              }
                            }}
                            className={cn(
                              "rounded-lg px-2 py-1 text-[10px] font-semibold",
                              rowOperating
                                ? "bg-slate-100 text-muted"
                                : rowCanOperate
                                  ? "bg-primary-soft text-primary hover:bg-blue-100"
                                  : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {rowOperating ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                작동 중
                              </span>
                            ) : (
                              row.actionLabel
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 상세 제어 카드 */}
          <div className="rounded-2xl border border-border/60 bg-white xl:col-span-5">
            <div className="border-b border-border/60 px-4 py-3">
              <span className="text-xs font-bold text-slate-800">상세 제어</span>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <BollardIcon status={selected.status} className="h-14 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{selected.location}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={statusBadge[selected.status].variant}>
                      {selected.statusLabel}
                    </Badge>
                    <span className="text-[10px] text-muted">모드: {selected.detailModeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-border/60 bg-slate-900">
                <Image
                  src="/images/illegal-parking-square.png"
                  alt="CCTV 미리보기"
                  width={400}
                  height={225}
                  className="h-36 w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white">
                  <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                  LIVE · CAM 연동
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "pedestrian", label: "보행자 감지", val: selected.surrounding.pedestrian },
                  { key: "vehicle", label: "차량 접근", val: selected.surrounding.vehicle },
                  { key: "bicycle", label: "자전거 접근", val: selected.surrounding.bicycle },
                  { key: "obstacle", label: "장애물 감지", val: selected.surrounding.obstacle },
                ].map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[10px]",
                      item.val
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700",
                    )}
                  >
                    {item.val ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {detectionLabel(item.val, item.label)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 4. 안전 체크리스트 + 5. 경고음 + 6. 스케줄 + 7. 로그 */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          {/* 안전 체크리스트 & 제어 버튼 */}
          <Card className="h-auto self-start border border-border/60 shadow-sm lg:col-span-4">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 text-primary" />
                작동 전 안전 확인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
              {[
                { key: "noPedestrian", label: "주변 보행자 없음" },
                { key: "noVehicle", label: "차량 접근 없음" },
                { key: "noObstacle", label: "장애물 없음" },
                { key: "warningSoundOk", label: "경고음 작동 가능" },
                { key: "cctvOk", label: "CCTV 시야 정상" },
              ].map((item) => {
                const ok = selected.safetyChecks[item.key as keyof typeof selected.safetyChecks];
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]",
                      ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700",
                    )}
                  >
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    {item.label}
                  </div>
                );
              })}

              {canOperateSelected ? (
                <Button
                  className="mt-2 w-full gap-2"
                  onClick={handleOperate}
                  disabled={isOperatingSelected}
                >
                  {isOperatingSelected ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      작동 중...
                    </>
                  ) : (
                    <>
                      {selected.targetAction === "lower" ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                      {primaryAction}
                    </>
                  )}
                </Button>
              ) : (
                <Button className="mt-2 w-full bg-slate-300 text-slate-600 shadow-none hover:bg-slate-300" disabled>
                  {isOperatingSelected ? "작동 중..." : "안전 확인 필요"}
                </Button>
              )}
              <p className="pt-0.5 text-center text-[10px] text-muted">
                AI 감지 · CCTV · 센서 교차 검증 후 원격 제어 가능
              </p>
            </CardContent>
          </Card>

          {/* 경고음 UI */}
          <Card className="h-auto self-start border border-border/60 shadow-sm lg:col-span-4">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Volume2 className="h-4 w-4 text-primary" />
                경고음 · 안내
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-slate-50 px-3 py-2.5">
                <span className="text-[11px] text-slate-700">작동 전 경고음 5초 송출</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={warningSound}
                  onClick={() => setWarningSound((v) => !v)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    warningSound ? "bg-primary" : "bg-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      warningSound ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-slate-50 px-3 py-2.5">
                <span className="text-[11px] text-slate-700">LED 점멸 활성화</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ledFlash}
                  onClick={() => setLedFlash((v) => !v)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    ledFlash ? "bg-primary" : "bg-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      ledFlash ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </label>
              <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-3">
                <div className="flex items-start gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] font-semibold text-blue-800">음성 안내</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-blue-900/80">
                      &ldquo;차단봉이 작동합니다. 주변을 확인해주세요.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
              {(warningSound || ledFlash) && (
                <div className="flex items-center gap-2 text-[10px] text-green-600">
                  <Radio className="h-3 w-3 animate-pulse" />
                  작동 시 경고 시퀀스 자동 실행
                </div>
              )}
            </CardContent>
          </Card>

          {/* 스케줄 + 로그 */}
          <div className="space-y-4 self-start lg:col-span-4">
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-xs">
                  <Clock className="h-4 w-4 text-primary" />
                  예약 작동 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={scheduleDraft.enabled}
                    onChange={(e) => setScheduleDraft((s) => ({ ...s, enabled: e.target.checked }))}
                    className="rounded border-border text-primary"
                  />
                  <span className="font-medium text-slate-800">장날 자동 개방</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted">시작 시간</label>
                    <input
                      type="time"
                      value={scheduleDraft.startTime}
                      onChange={(e) => setScheduleDraft((s) => ({ ...s, startTime: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-xl border border-border bg-white px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted">종료 시간</label>
                    <input
                      type="time"
                      value={scheduleDraft.endTime}
                      onChange={(e) => setScheduleDraft((s) => ({ ...s, endTime: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-xl border border-border bg-white px-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted">반복</label>
                  <p className="mt-1 rounded-xl border border-border/60 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                    {scheduleDraft.repeatLabel}
                  </p>
                </div>
                {appliedSchedule && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] text-green-800">
                    <p className="font-semibold">적용됨</p>
                    <p className="mt-0.5">
                      {appliedSchedule.enabled ? "활성" : "비활성"} · {appliedSchedule.startTime}~
                      {appliedSchedule.endTime}
                    </p>
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => void handleApplySchedule()}
                  disabled={scheduleApplying}
                >
                  {scheduleApplying ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      적용 중...
                    </>
                  ) : (
                    "적용"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-xs">
                  <History className="h-4 w-4 text-primary" />
                  작동 이력
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[140px] space-y-0 overflow-y-auto px-4 pb-4 pt-0">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 border-b border-gray-50 py-2 last:border-0"
                  >
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-primary">
                      {log.time}
                    </span>
                    <span className="text-[10px] text-slate-600">{log.message}</span>
                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted opacity-40" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
