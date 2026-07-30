import Image from "next/image";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const pipeline = [
  "현수막 탐지",
  "객체 추적",
  "위치·허가 조회",
  "불법 가능성",
  "우선순위",
] as const;

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
          <p className="text-xs text-muted">2단계 판정 · 설봉공원 입구</p>
          <h2 className="text-sm font-semibold text-slate-800">
            현수막 탐지 → 불법 가능성 후보
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">탐지 94%</Badge>
          <Badge variant="urgent">불법 가능성 91</Badge>
          <Badge variant="high">우선순위 82</Badge>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-slate-50/80 px-4 py-2">
        {pipeline.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-slate-300">→</span>}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                i <= 3 ? "bg-primary/10 text-primary" : "bg-slate-200/80 text-slate-600",
              )}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <p className="shrink-0 text-xs font-medium text-slate-700">
            1단계 · 현수막 객체 탐지
          </p>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src="/images/illegal-banner-square.png"
              alt="현수막 객체 탐지 예시"
              fill
              className="object-cover"
              unoptimized
            />
            <DetectionOverlay
              detection={{
                label: "현수막",
                confidence: 94,
                box: { x: 6, y: 6, width: 88, height: 88 },
                severity: "caution",
              }}
            />
          </div>
          <p className="text-[10px] text-muted">
            YOLO 계열 · banner 1클래스 · 존재·위치만 식별
          </p>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <p className="shrink-0 text-xs font-medium text-slate-700">
            2단계 · 행정 연계 후 현장 확인
          </p>
          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src="/images/illegal-banner-after-square.png"
              alt="현장 확인·철거 후"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <p className="text-[10px] text-muted">
            신고대장 미일치 · 게시대 밖 · 우선 확인 후 철거
          </p>
        </div>
      </div>
      <p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted">
        CAM-설봉-001 · TRK-설봉-014 · 동일 객체 통합 · 불법 확정이 아닌 가능성 점수
      </p>
    </div>
  );
}
