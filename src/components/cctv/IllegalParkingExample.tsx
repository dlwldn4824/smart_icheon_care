import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function IllegalParkingExample({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] text-muted">AI 탐지 예시 · 설봉초</p>
          <h2 className="truncate text-xs font-semibold text-slate-800">불법 주차 탐지</h2>
        </div>
        <Badge variant="urgent" className="shrink-0 text-[10px]">
          87%
        </Badge>
      </div>
      <div className="flex min-h-0 flex-1 p-3">
        <div className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-lg bg-slate-100">
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
      <p className="shrink-0 border-t border-border px-3 py-2 text-[10px] leading-snug text-muted">
        CAM-설봉-012 · 통학로 이중 주차 탐지
      </p>
    </div>
  );
}
