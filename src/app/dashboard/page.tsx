import { AIRecommendationPanel } from "@/components/dashboard/AIRecommendationPanel";
import { AIRiskCardGrid } from "@/components/dashboard/AIRiskCard";
import { DashboardCCTVMini } from "@/components/dashboard/DashboardCCTVMini";
import { DashboardHeroChart } from "@/components/dashboard/DashboardHeroChart";
import { DashboardSummaryPanel } from "@/components/dashboard/DashboardSummaryPanel";
import { FacilityPriorityTable } from "@/components/dashboard/FacilityPriorityTable";
import { SmartCityMap } from "@/components/dashboard/SmartCityMap";
import { TrendChartsRow } from "@/components/dashboard/TrendChartsRow";

export default function DashboardPage() {
  return (
    <div className="flex w-full max-w-full gap-4 xl:gap-5">
      <div className="min-w-0 flex-1 space-y-4">
        <DashboardHeroChart />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="relative z-0 isolate overflow-hidden lg:col-span-8">
            <SmartCityMap compact fill className="h-[240px] sm:h-[260px] lg:h-[280px]" />
          </div>
          <div className="isolate overflow-hidden lg:col-span-4">
            <AIRiskCardGrid className="h-[240px] sm:h-[260px] lg:h-[280px]" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex h-[280px] min-h-0 flex-col overflow-hidden">
            <FacilityPriorityTable compact />
          </div>
          <div className="flex h-[280px] min-h-0 flex-col overflow-hidden">
            <DashboardCCTVMini />
          </div>
          <div className="flex h-[280px] min-h-0 flex-col overflow-hidden">
            <AIRecommendationPanel compact />
          </div>
        </div>

        <TrendChartsRow />
      </div>

      <div className="hidden w-[280px] shrink-0 xl:block">
        <DashboardSummaryPanel className="sticky top-0" />
      </div>
    </div>
  );
}
