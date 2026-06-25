"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { cctvFeeds } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useActionRegistration } from "@/lib/action-registry";
import { useToast } from "@/components/ui/Toast";
import { ActionStatus } from "@/components/actions/ActionStatus";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import type { CCTVFeed, Severity } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const severityBadge: Record<Severity, "urgent" | "medium" | "info"> = {
  violation: "urgent",
  caution: "medium",
  info: "info",
};

const statusLabel: Record<Severity, string> = {
  violation: "위반 감지",
  caution: "점검 필요",
  info: "제설 권고",
};

function CCTVFeedCard({ feed }: { feed: CCTVFeed }) {
  const { toast } = useToast();
  const primary = feed.detections[0];
  const actionTitle = primary
    ? `${feed.location} · ${primary.label} 대응`
    : `${feed.location} 점검 조치`;
  const { isRegistered, action, openRegister } = useActionRegistration("cctv", feed.cameraId);
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div
        className={cn(
          "relative overflow-hidden bg-slate-200",
          expanded ? "h-[320px]" : "h-[clamp(140px,18vh,200px)]",
        )}
      >
        {!imgError ? (
          <Image
            src={feed.imageUrl}
            alt={feed.location}
            fill
            className="object-cover"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #334155 0%, #475569 50%, #64748b 100%)",
            }}
          />
        )}
        {feed.detections.map((det) => (
          <DetectionOverlay key={det.label} detection={det} />
        ))}
        <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
          {feed.cameraId}
        </div>
        {feed.isLive && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-[11px] text-white/80">{feed.location}</p>
          {primary && (
            <p className="text-xs font-medium text-white">
              {primary.label} · {primary.confidence}%
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={isRegistered ? "low" : primary ? severityBadge[primary.severity] : "outline"}>
            {isRegistered ? "조치 배정" : primary ? statusLabel[primary.severity] : "정상"}
          </Badge>
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(!expanded);
                toast(expanded ? "화면 크기를 축소했습니다." : `${feed.location} 영상을 확대했습니다.`, "info");
              }}
            >
              {expanded ? "축소" : "확대"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast(`${feed.timestamp} 탐지 기록을 불러왔습니다.`, "info")}
            >
              기록
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                openRegister(
                  actionTitle,
                  primary
                    ? `AI 신뢰도 ${primary.confidence}% · ${feed.timestamp} 탐지`
                    : feed.timestamp,
                )
              }
              disabled={isRegistered}
            >
              {isRegistered ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  배정 완료
                </>
              ) : (
                "조치 등록"
              )}
            </Button>
          </div>
        </div>
        {action && <ActionStatus action={action} className="mt-2" />}
      </div>
    </div>
  );
}

export function CCTVFeedGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cctvFeeds.map((feed) => (
        <CCTVFeedCard key={feed.cameraId} feed={feed} />
      ))}
    </div>
  );
}
