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
          <p className="text-xs text-muted">대시보드 &gt; 불법 현수막(의심) 탐지</p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">불법 현수막(의심) 탐지</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              실시간
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            YOLO로 현수막을 찾은 뒤 공공데이터 Risk로 불법 의심을 표시합니다. 박스를 클릭하면 해당
            배너만 OCR·마크 검사합니다. 최종 확정(CONFIRMED)은 공무원만 가능합니다. 라이브 CCTV(RTSP)는
            미연동입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">API :8000</Badge>
          <Badge variant="info">Human-in-the-loop</Badge>
        </div>
      </div>

      <BannerInferenceUpload />

      <BannerApiEvents />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
        <IllegalBannerExample className="lg:col-span-8" />
        <IllegalParkingExample className="lg:col-span-2" />
        <GrassOvergrowthExample className="lg:col-span-2" />
      </div>

      <BannerPriorityQueue />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetectionTimeline />
        <DetectionAnalytics />
      </div>
    </div>
  );
}
