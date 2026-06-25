"use client";

import { SmartCityMap } from "@/components/dashboard/SmartCityMap";
import { ParkingAnalyticsSidebar } from "@/components/parking/ParkingAnalyticsSidebar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ParkingAnalysisPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">대시보드 &gt; 주차 리스크 분석</p>
          <h1 className="text-lg font-bold">주차 갈등 분석</h1>
          <p className="text-xs text-muted">
            유동인구 수요와 주차 제한 구역의 겹침을 AI가 분석합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("필터 패널을 열었습니다.", "info")}>
            필터
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast("날짜: 2026.06.24", "info")}>
            2026.06.24
          </Button>
          <Button size="sm" onClick={() => toast("주차 갈등 분석 리포트를 다운로드했습니다.", "success")}>
            리포트 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SmartCityMap large showHotspotCard />
        </div>
        <div className="min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <ParkingAnalyticsSidebar />
        </div>
      </div>
    </div>
  );
}
