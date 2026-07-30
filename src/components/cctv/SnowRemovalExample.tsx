import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";

export function SnowRemovalExample() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted">AI 탐지 예시 · 신둔면 학교 앞</p>
          <h2 className="text-sm font-semibold text-slate-800">적설 누적 · 제설 작업</h2>
        </div>
        <Badge variant="info">신뢰도 91%</Badge>
      </div>
      <div className="p-4">
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-slate-100">
          <Image
            src="/images/snow-removal-square.png"
            alt="적설 누적 및 제설 작업 예시"
            fill
            className="object-cover"
            unoptimized
          />
          <DetectionOverlay
            detection={{
              label: "적설 누적",
              confidence: 91,
              box: { x: 5, y: 5, width: 90, height: 90 },
              severity: "info",
            }}
          />
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
        CAM-신둔-007 · 2026.06.24 13:52:10 · 등하교로 적설 AI 사각형 탐지 · 제설 작업 진행
      </p>
    </div>
  );
}
