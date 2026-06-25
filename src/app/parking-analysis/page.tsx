"use client";

import { SmartCityMap } from "@/components/dashboard/SmartCityMap";
import { ParkingAnalyticsSidebar } from "@/components/parking/ParkingAnalyticsSidebar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ParkingAnalysisPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <div className="flex min-h-[calc(100vh-13rem)] flex-col xl:col-span-2">
          <SmartCityMap large showHotspotCard fill className="min-h-0 flex-1" />
        </div>
        <div className="min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <ParkingAnalyticsSidebar />
        </div>
      </div>
    </div>
  );
}
