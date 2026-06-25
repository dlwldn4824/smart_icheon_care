import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function IllegalBannerExample({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted">AI 탐지 예시 · 설봉공원 입구</p>
          <h2 className="text-sm font-semibold text-slate-800">불법 현수막 탐지 전·후</h2>
        </div>
        <Badge variant="urgent">신뢰도 94%</Badge>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <p className="shrink-0 text-xs font-medium text-red-600">탐지 (처리 전)</p>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src="/images/illegal-banner-square.png"
              alt="불법 현수막 탐지 예시"
              fill
              className="object-cover"
              unoptimized
            />
            <DetectionOverlay
              detection={{
                label: "불법 현수막",
                confidence: 94,
                box: { x: 6, y: 6, width: 88, height: 88 },
                severity: "violation",
              }}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <p className="shrink-0 text-xs font-medium text-green-600">처리 완료 (처리 후)</p>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src="/images/illegal-banner-after-square.png"
              alt="불법 현수막 철거 후"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      </div>
      <p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted">
        CAM-설봉-001 · 2026.06.24 14:28:03 · CCTV 5만원 광고 현수막 AI 사각형 탐지
      </p>
    </div>
  );
}
