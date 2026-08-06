import { BannerApiEvents } from "@/components/cctv/BannerApiEvents";
import { BannerInferenceUpload } from "@/components/cctv/BannerInferenceUpload";
import { BannerPriorityQueue } from "@/components/cctv/BannerPriorityQueue";
import { GrassOvergrowthExample } from "@/components/cctv/GrassOvergrowthExample";
import { IllegalBannerExample } from "@/components/cctv/IllegalBannerExample";
import { IllegalParkingExample } from "@/components/cctv/IllegalParkingExample";
import { DetectionAnalytics } from "@/components/cctv/DetectionAnalytics";
import { DetectionTimeline } from "@/components/cctv/DetectionTimeline";
import { Badge } from "@/components/ui/Badge";

export default function CCTVPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 현수막 존재 · 불법 의심 후보</p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">현수막 존재 탐지 · 불법 의심 후보</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              데모
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            YOLO로 현수막 존재를 찾고 Risk로 의심 후보를 표시합니다. 탐지 직후 Claude가 불법 의심·놓친
            현수막을 보조 점검하고, 박스 클릭 시 OCR합니다. 최종 확정(CONFIRMED)은 공무원만 가능합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="info">Human-in-the-loop</Badge>
        </div>
      </div>

      <BannerInferenceUpload />

      <BannerApiEvents />

      <IllegalBannerExample />

      <BannerPriorityQueue />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetectionTimeline />
        <DetectionAnalytics />
      </div>

      <details className="rounded-xl border border-border bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
          확장 예시 · 불법 주차 / 잔디 과성장 (참고)
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2">
          <IllegalParkingExample />
          <GrassOvergrowthExample />
        </div>
      </details>
    </div>
  );
}
