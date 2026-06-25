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
          <p className="text-xs text-muted">대시보드 &gt; AI CCTV 모니터링</p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">AI CCTV 모니터링</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              실시간
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">전체 48대</Badge>
          <Badge variant="low">정상 44</Badge>
          <Badge variant="urgent">이상 감지 4</Badge>
          <Badge variant="info">오늘 23건</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
        <IllegalBannerExample className="lg:col-span-8" />
        <IllegalParkingExample className="lg:col-span-2" />
        <GrassOvergrowthExample className="lg:col-span-2" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetectionTimeline />
        <DetectionAnalytics />
      </div>
    </div>
  );
}
