"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchVisionEvents,
  patchVisionEventStatus,
  VISION_EVENTS_UPDATED,
  VisionApiError,
  type VisionEvent,
} from "@/lib/vision-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  DETECTED: "탐지됨",
  REVIEW_PENDING: "검토 대기",
  CONFIRMED: "공무원 확정",
  ASSIGNED: "담당 배정",
  IN_PROGRESS: "처리 중",
  RESOLVED: "처리 완료",
  DISMISSED: "기각",
};

/** 단방향 전이 — 현재 상태에서 누를 수 있는 다음 단계만 */
const NEXT_ACTIONS: Record<string, { to: string; label: string; primary?: boolean }[]> = {
  DETECTED: [
    { to: "REVIEW_PENDING", label: "검토 요청", primary: true },
    { to: "DISMISSED", label: "기각" },
  ],
  REVIEW_PENDING: [
    { to: "CONFIRMED", label: "공무원 확정", primary: true },
    { to: "DISMISSED", label: "기각" },
  ],
  CONFIRMED: [{ to: "ASSIGNED", label: "담당 배정", primary: true }],
  ASSIGNED: [{ to: "IN_PROGRESS", label: "처리 시작", primary: true }],
  IN_PROGRESS: [{ to: "RESOLVED", label: "처리 완료", primary: true }],
  RESOLVED: [],
  DISMISSED: [],
};

export function BannerApiEvents() {
  const [events, setEvents] = useState<VisionEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [illegalOnly, setIllegalOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVisionEvents({ illegalOnly });
      setEvents(data);
      setSelectedId((prev) => {
        if (prev && data.some((e) => e.event.event_id === prev)) return prev;
        return data[0]?.event.event_id || "";
      });
    } catch (e) {
      setEvents([]);
      setError(e instanceof VisionApiError ? e.message : "API 오류");
    } finally {
      setLoading(false);
    }
  }, [illegalOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdated = () => {
      void load();
    };
    window.addEventListener(VISION_EVENTS_UPDATED, onUpdated);
    return () => window.removeEventListener(VISION_EVENTS_UPDATED, onUpdated);
  }, [load]);

  const selected = events.find((e) => e.event.event_id === selectedId) ?? events[0];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <Card className="lg:col-span-5">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>현수막 존재 · 의심 후보 이벤트</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted">
              Risk 70 이상이면 불법 의심 후보로 표시됩니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-muted">
              <input
                type="checkbox"
                checked={illegalOnly}
                onChange={(e) => setIllegalOnly(e.target.checked)}
              />
              의심 후보만
            </label>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-80 space-y-1 overflow-y-auto p-2">
          {loading && <p className="p-2 text-xs text-muted">불러오는 중…</p>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && events.length === 0 && (
            <p className="p-2 text-xs text-muted">이벤트 없음</p>
          )}
          {events.map((item) => (
            <button
              key={item.event.event_id}
              type="button"
              onClick={() => setSelectedId(item.event.event_id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-slate-50",
                selected?.event.event_id === item.event.event_id && "border-l-2 border-primary bg-blue-50",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{item.event.location_name ?? item.event.camera_id}</p>
                <p className="text-[10px] text-muted">
                  {item.event.camera_id} · conf {(item.event.det_conf * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={
                    item.event.verdict === "ILLEGAL_SUSPECT" || item.event.illegal_candidate
                      ? "urgent"
                      : "outline"
                  }
                >
                  {item.event.verdict === "ILLEGAL_SUSPECT" || item.event.illegal_candidate
                    ? "의심 후보"
                    : item.event.verdict || item.illegal.level}
                </Badge>
                <p className="mt-0.5 text-[10px] font-bold text-primary">{item.priority.level}</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>이벤트 상세 · 행정 처리</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted">
            AI는 후보만 제안합니다. 「공무원 확정」이 최종 불법 판단입니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected && !error && <p className="text-sm text-muted">선택된 이벤트 없음</p>}
          {selected && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric
                  label="탐지 신뢰도"
                  value={`${(selected.event.det_conf * 100).toFixed(0)}%`}
                />
                <Metric
                  label="1단계 판정"
                  value={formatVerdict(
                    selected.event.verdict ?? selected.verdict,
                    selected.event.illegal_candidate ?? selected.illegal_candidate,
                  )}
                />
                <Metric
                  label="Risk · Priority"
                  value={formatRiskPriority(
                    selected.event.risk_score ?? selected.illegal.score,
                    selected.priority.level,
                  )}
                />
                <Metric
                  label="상태"
                  value={STATUS_LABEL[selected.event.status] ?? selected.event.status}
                />
              </div>
              {selected.event.content_verdict && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-[11px]">
                  <p className="font-semibold text-slate-800">
                    2단계 내용 검사 · {formatVerdict(selected.event.content_verdict)}
                  </p>
                  {selected.event.ocr_text && (
                    <p className="mt-1 break-words text-slate-600">OCR: {selected.event.ocr_text}</p>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-700">
                {selected.event.location_name} ({selected.event.admin_district}) · CCTV{" "}
                {selected.event.camera_id}
                <br />
                근사좌표 {selected.event.approx_lat}, {selected.event.approx_lng}{" "}
                {selected.event.location_is_approximate ? "(정밀 GPS 아님)" : ""}
                <br />
                시각 {selected.event.detected_at ?? "-"}
              </p>
              <div>
                <p className="mb-1 text-xs font-semibold">판단 근거</p>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {selected.illegal.reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {(NEXT_ACTIONS[selected.event.status] ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500">이 이벤트는 종료된 상태입니다.</p>
                  ) : (
                    (NEXT_ACTIONS[selected.event.status] ?? []).map((action) => (
                      <Button
                        key={action.to}
                        size="sm"
                        variant={action.primary ? "default" : "outline"}
                        onClick={() => {
                          const needsActor = ["CONFIRMED", "ASSIGNED", "RESOLVED"].includes(
                            action.to,
                          );
                          void patchVisionEventStatus(selected.event.event_id, action.to, {
                            actor: needsActor ? "이현수 주무관" : undefined,
                            assignee: action.to === "ASSIGNED" ? "김담당" : undefined,
                            department: action.to === "ASSIGNED" ? "도시경관과" : undefined,
                            note:
                              action.to === "ASSIGNED"
                                ? "데모 · 현장 확인 배정"
                                : action.to === "CONFIRMED"
                                  ? "공무원 확정 (데모)"
                                  : undefined,
                          })
                            .then(load)
                            .catch((e: Error) => setError(e.message));
                        }}
                      >
                        {action.label}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-slate-50/80 px-2 py-1.5">
      <p className="truncate text-[10px] leading-tight text-muted">{label}</p>
      <p
        className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-slate-800"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function formatVerdict(v: string | undefined, illegalCandidate?: boolean): string {
  const raw = String(v || (illegalCandidate ? "ILLEGAL_SUSPECT" : "LOW_RISK"))
    .trim()
    .toUpperCase();
  if (raw === "ILLEGAL_SUSPECT") return "의심 후보";
  if (raw === "LOW_RISK") return "저위험";
  if (raw === "LIKELY_LEGAL") return "합법 추정";
  if (raw === "NEEDS_REVIEW") return "추가 검토";
  if (raw.length > 8) return `${raw.slice(0, 7)}…`;
  return raw;
}

function formatRiskPriority(risk: number | undefined, level: string | undefined): string {
  const score =
    typeof risk === "number"
      ? risk <= 1
        ? Math.round(risk * 100)
        : Math.round(risk)
      : "-";
  const pri = (level || "-").replace(/^PRIORITY[_-]?/i, "").slice(0, 4);
  return `${score}/${pri}`;
}
