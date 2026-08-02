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

const statusOptions = [
  "DETECTED",
  "REVIEW_PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
] as const;

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
            <CardTitle>불법 현수막(의심) 이벤트</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted">
              GET /api/v1/events · Risk≥70 → 불법 의심 · mock 없음
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-muted">
              <input
                type="checkbox"
                checked={illegalOnly}
                onChange={(e) => setIllegalOnly(e.target.checked)}
              />
              불법 의심만
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
                    ? "불법의심"
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
          <CardTitle>이벤트 상세 · 1단계 Risk / 2단계 내용 검사</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted">
            최종 확정(CONFIRMED)은 공무원만. 좌표는 CCTV 근사 위치입니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected && !error && <p className="text-sm text-muted">선택된 이벤트 없음</p>}
          {selected && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="탐지 신뢰도" value={`${(selected.event.det_conf * 100).toFixed(1)}%`} />
                <Metric
                  label="1단계 판정"
                  value={
                    selected.event.verdict ||
                    (selected.event.illegal_candidate ? "ILLEGAL_SUSPECT" : "LOW_RISK")
                  }
                />
                <Metric
                  label="Risk / Priority"
                  value={`${selected.event.risk_score ?? selected.illegal.score} · ${selected.priority.level}`}
                />
                <Metric label="상태" value={selected.event.status} />
              </div>
              {selected.event.content_verdict && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-[11px]">
                  <p className="font-semibold text-slate-800">
                    2단계 내용 검사 · {selected.event.content_verdict}
                  </p>
                  {selected.event.ocr_text && (
                    <p className="mt-1 text-slate-600">OCR: {selected.event.ocr_text}</p>
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
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={selected.event.status === st ? "default" : "outline"}
                    onClick={() =>
                      void patchVisionEventStatus(
                        selected.event.event_id,
                        st,
                        st === "CONFIRMED" ? "dashboard-officer" : undefined,
                      )
                        .then(load)
                        .catch((e: Error) => setError(e.message))
                    }
                  >
                    {st}
                  </Button>
                ))}
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
    <div className="rounded-lg border border-border bg-slate-50/80 p-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
