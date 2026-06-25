import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";

export function IllegalParkingExample() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted">AI 탐지 예시 · 설봉초등학교 인근</p>
          <h2 className="text-sm font-semibold text-slate-800">불법 주차 탐지</h2>
        </div>
        <Badge variant="urgent">신뢰도 87%</Badge>
      </div>
      <div className="p-4">
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-slate-100">
          <Image
            src="/images/illegal-parking-square.png"
            alt="불법 주차 탐지 예시"
            fill
            className="object-cover"
            unoptimized
          />
          <DetectionOverlay
            detection={{
              label: "불법 주차",
              confidence: 87,
              box: { x: 2, y: 2, width: 96, height: 96 },
              severity: "violation",
            }}
          />
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
        CAM-설봉-012 · 2026.06.24 14:28:45 · 통학로 차량 2대 이중 주차 AI 사각형 탐지
      </p>
    </div>
  );
}
