"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Clock, Eye, Pause } from "lucide-react";
import { bannerCandidatesByPriority } from "@/data/banner-candidates";
import {
  ILLEGAL_WEIGHTS,
  PRIORITY_WEIGHTS,
  illegalFactorLabel,
  priorityFactorLabel,
  reviewTierLabel,
} from "@/lib/banner-scoring";
import { cn } from "@/lib/utils";
import { useActionRegistration } from "@/lib/action-registry";
import { useToast } from "@/components/ui/Toast";
import { ActionStatus } from "@/components/actions/ActionStatus";
import type {
  BannerCandidate,
  BannerCandidateStatus,
  BannerReviewTier,
  IllegalScoreBreakdown,
  PriorityScoreBreakdown,
} from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  fetchVisionEvents,
  patchVisionEventStatus,
  VISION_EVENTS_UPDATED,
  VisionApiError,
  type VisionEvent,
} from "@/lib/vision-api";

const tierBadge: Record<BannerReviewTier, "urgent" | "high" | "medium" | "low"> = {
  urgent: "urgent",
  priority: "high",
  normal: "medium",
  observe: "low",
};

const statusLabel: Record<BannerCandidateStatus, string> = {
  pending: "확인 대기",
  reviewing: "검토 중",
  held: "보류·관찰",
  resolved: "처리 완료",
};

function levelToTier(level: string | undefined, risk: number): BannerReviewTier {
  if (level === "P1" || level === "Critical") return "urgent";
  if (level === "P2" || level === "High") return "priority";
  if (level === "P3" || level === "Medium") return "normal";
  if (level === "P4" || level === "Low") return "observe";
  if (risk >= 90) return "urgent";
  if (risk >= 70) return "priority";
  if (risk >= 40) return "normal";
  return "observe";
}

function apiStatusToLocal(status: string): BannerCandidateStatus {
  switch (status) {
    case "REVIEWING":
    case "REVIEW_PENDING":
    case "TRACKING":
      return "reviewing";
    case "DISMISSED":
      return "held";
    case "RESOLVED":
    case "CONFIRMED":
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "FINISHED":
      return "resolved";
    default:
      return "pending";
  }
}

function visionToCandidate(item: VisionEvent): BannerCandidate {
  const ev = item.event;
  const bd = (item.illegal as { breakdown?: Record<string, number> })?.breakdown ?? {};
  const risk =
    typeof (ev as { risk_score?: number }).risk_score === "number"
      ? Math.round((ev as { risk_score: number }).risk_score)
      : Math.round((item.illegal?.score ?? 0) * 100);
  const illegalBreakdown: IllegalScoreBreakdown = {
    unpermitted: Math.round((bd.permit_mismatch ?? 0.5) * 100),
    improperLocation: Math.round((bd.non_designated_location ?? 0.5) * 100),
    expiredPeriod: Math.round((bd.expired_period ?? 0.5) * 100),
    trafficObstruction: Math.round((bd.detection_persistence ?? 0.5) * 100),
    repeatComplaint: Math.round((bd.complaint_history ?? 0.5) * 100),
  };
  const priorityBreakdown: PriorityScoreBreakdown = {
    illegalLikelihood: risk,
    safetyRisk: 50,
    footTraffic: 50,
    vulnerableZone: 50,
    complaintFrequency: Math.round((bd.complaint_history ?? 0.5) * 100),
    installDuration: Math.round((bd.detection_persistence ?? 0.5) * 100),
  };
  return {
    id: ev.event_id,
    cameraId: ev.camera_id,
    trackId: String((ev as { track_id?: number }).track_id ?? "-"),
    location: ev.location_name ?? ev.camera_id,
    area: ev.admin_district ?? "-",
    detectedAt: ev.detected_at ?? new Date().toISOString(),
    imageUrl: ev.thumb_url || "/images/smart-icheon-care-logo.png",
    detectionConfidence: Math.round(ev.det_conf * 100),
    lat: ev.approx_lat,
    lng: ev.approx_lng,
    onDesignatedBoard: false,
    permitMatched: false,
    vulnerableZones: [],
    complaintCount: 0,
    installDays: 0,
    illegalScore: risk,
    illegalBreakdown,
    priorityScore: risk,
    priorityBreakdown,
    reviewTier: levelToTier(item.priority?.level, risk),
    status: apiStatusToLocal(ev.status),
    reasons: [
      ...(item.illegal?.reasons ?? []),
      ...(item.priority?.reasons ?? []),
      ...(item.geo_notes ?? []),
    ],
  };
}

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted">
        <span>
          {label}{" "}
          <span className="text-slate-400">×{(weight * 100).toFixed(0)}%</span>
        </span>
        <span className="font-medium text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function CandidateDetail({
  candidate,
  onStatus,
  live,
}: {
  candidate: BannerCandidate;
  onStatus: (status: BannerCandidateStatus) => void;
  live: boolean;
}) {
  const { toast } = useToast();
  const { action, openRegister } = useActionRegistration("cctv", candidate.id);

  return (
    <div className="space-y-3">
      <div className="relative h-36 overflow-hidden rounded-lg bg-slate-100">
        <Image
          src={candidate.imageUrl}
          alt={`${candidate.location} 현수막 후보`}
          fill
          className="object-cover"
          unoptimized
        />
        <div className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] text-white">
          {candidate.cameraId} · {candidate.trackId}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={tierBadge[candidate.reviewTier]}>
          {reviewTierLabel[candidate.reviewTier]}
        </Badge>
        <Badge variant="outline">탐지 신뢰도 {candidate.detectionConfidence}%</Badge>
        <Badge variant="info">{statusLabel[candidate.status]}</Badge>
        {live && <Badge variant="outline">Live API</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-slate-50/80 p-2.5">
          <p className="text-[10px] text-muted">Risk Score</p>
          <p className="text-xl font-bold text-slate-900">{candidate.illegalScore}</p>
        </div>
        <div className="rounded-lg border border-border bg-slate-50/80 p-2.5">
          <p className="text-[10px] text-muted">Priority Score</p>
          <p className="text-xl font-bold text-primary">{candidate.priorityScore}</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-800">처리 권장 이유 · 공공데이터</p>
        <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-600">
          {candidate.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-800">불법 가능성 요인</p>
        {(Object.keys(ILLEGAL_WEIGHTS) as (keyof IllegalScoreBreakdown)[]).map((key) => (
          <ScoreBar
            key={key}
            label={illegalFactorLabel[key]}
            value={candidate.illegalBreakdown[key]}
            weight={ILLEGAL_WEIGHTS[key]}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-800">우선순위 요인</p>
        {(Object.keys(PRIORITY_WEIGHTS) as (keyof PriorityScoreBreakdown)[]).map((key) => (
          <ScoreBar
            key={key}
            label={priorityFactorLabel[key]}
            value={candidate.priorityBreakdown[key]}
            weight={PRIORITY_WEIGHTS[key]}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onStatus("reviewing");
            toast("검토 중으로 표시했습니다.", "info");
            if (live) void patchVisionEventStatus(candidate.id, "REVIEW_PENDING").catch(() => undefined);
          }}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          검토
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onStatus("held");
            toast("보류·관찰로 기록했습니다.", "info");
            if (live) void patchVisionEventStatus(candidate.id, "DISMISSED").catch(() => undefined);
          }}
        >
          <Pause className="mr-1 h-3.5 w-3.5" />
          보류
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            openRegister(
              `현수막 조치 · ${candidate.id}`,
              `${candidate.location} · 불법 ${candidate.illegalScore} · 우선순위 ${candidate.priorityScore}`,
            );
            toast("조치 등록을 엽니다.", "info");
          }}
        >
          <Clock className="mr-1 h-3.5 w-3.5" />
          조치 등록
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onStatus("resolved");
            toast("처리 완료로 기록했습니다. 최종 행정 판단은 담당자 확인 기준입니다.", "success");
            if (live)
              void patchVisionEventStatus(candidate.id, "RESOLVED", "dashboard-officer").catch(
                () => undefined,
              );
          }}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          처리 완료
        </Button>
      </div>
      {action && <ActionStatus action={action} />}
    </div>
  );
}

export function BannerPriorityQueue() {
  const [liveEvents, setLiveEvents] = useState<BannerCandidate[] | null>(null);
  const [apiOffline, setApiOffline] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, BannerCandidateStatus>>({});
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchVisionEvents();
      const mapped = data
        .map(visionToCandidate)
        .sort((a, b) => b.priorityScore - a.priorityScore);
      setLiveEvents(mapped);
      setApiOffline(false);
      setSelectedId((prev) => prev || mapped[0]?.id || "");
      setStatuses((prev) => {
        const next = { ...prev };
        for (const c of mapped) {
          if (!(c.id in next)) next[c.id] = c.status;
        }
        return next;
      });
    } catch (e) {
      setLiveEvents(null);
      setApiOffline(true);
      void e;
      setSelectedId((prev) => prev || bannerCandidatesByPriority[0]?.id || "");
    }
  }, []);

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

  const base = liveEvents ?? bannerCandidatesByPriority;
  const live = liveEvents !== null;

  const candidates = useMemo(
    () =>
      base.map((c) => ({
        ...c,
        status: statuses[c.id] ?? c.status,
      })),
    [base, statuses],
  );

  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <Card className="lg:col-span-5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>철거·확인 우선순위</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted">
              {live ? "FastAPI 이벤트 · Priority 높은 순" : "샘플 후보 (API 미연결 시 대체)"}
            </p>
            {apiOffline && (
              <p className="mt-1 text-[10px] text-amber-700">API 오프라인 · mock 표시</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              새로고침
            </Button>
            <Badge variant="info">{candidates.length}건</Badge>
          </div>
        </CardHeader>
        <CardContent className="max-h-80 space-y-1 overflow-y-auto p-2">
          {candidates.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedId(candidate.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50",
                selected?.id === candidate.id && "border-l-2 border-primary bg-blue-50",
              )}
            >
              <span className="w-5 text-center text-xs font-bold text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">
                  {candidate.location}
                </p>
                <p className="truncate text-[10px] text-muted">
                  {candidate.area} · 탐지 {candidate.detectionConfidence}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-primary">{candidate.priorityScore}</p>
                <Badge variant={tierBadge[candidate.reviewTier]} className="mt-0.5">
                  {reviewTierLabel[candidate.reviewTier]}
                </Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>후보 상세 · Risk / Priority</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted">
            1단계 Risk로 불법 의심을 표시합니다. 최종 합법·불법 확정은 공무원이 수행합니다.
          </p>
        </CardHeader>
        <CardContent>
          {selected ? (
            <CandidateDetail
              candidate={selected}
              live={live}
              onStatus={(status) =>
                setStatuses((prev) => ({ ...prev, [selected.id]: status }))
              }
            />
          ) : (
            <p className="text-sm text-muted">선택된 후보가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
