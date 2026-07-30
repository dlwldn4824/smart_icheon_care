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
          <p className="text-xs text-muted">대시보드 &gt; 현수막 탐지·우선순위</p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">현수막 탐지 및 불법 가능성 판정</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              실시간
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            이미지/영상 업로드로 학습 모델 탐지를 실행할 수 있습니다. FastAPI 이벤트·Risk/Priority와
            연동되며, 최종 확인(CONFIRMED)은 공무원만 가능합니다. 라이브 CCTV(RTSP)는 미연동입니다.
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
