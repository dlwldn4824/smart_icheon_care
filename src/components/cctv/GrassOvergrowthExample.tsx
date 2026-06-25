import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";

export function GrassOvergrowthExample() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted">AI 탐지 예시 · 안흥공원 중앙</p>
          <h2 className="text-sm font-semibold text-slate-800">잔디 과성장 탐지</h2>
        </div>
        <Badge variant="medium">신뢰도 89%</Badge>
      </div>
      <div className="p-4">
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-slate-100">
          <Image
            src="/images/grass-overgrowth-square.png"
            alt="잔디 과성장 탐지 예시"
            fill
            className="object-cover"
            unoptimized
          />
          <DetectionOverlay
            detection={{
              label: "잔디 과성장",
              confidence: 89,
              box: { x: 4, y: 4, width: 92, height: 92 },
              severity: "caution",
            }}
          />
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
        CAM-안흥-003 · 2026.06.24 14:15:22 · 산책로 주변 잔디 과성장 AI 사각형 탐지
      </p>
    </div>
  );
}
