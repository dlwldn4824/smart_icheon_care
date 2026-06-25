"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActionRegistration } from "@/lib/action-registry";
import { useToast } from "@/components/ui/Toast";
import { ActionStatus } from "@/components/actions/ActionStatus";
import { MapApiBadge } from "@/components/map/MapApiBadge";
import { MapFilterBar } from "@/components/map/MapFilterBar";
import {
  getDashboardMapMarkers,
  getDashboardMapZones,
  getParkingMapMarkers,
  getParkingMapZones,
} from "@/lib/map-data";
import {
  applyMapFilters,
  DEFAULT_LAYER_FILTERS,
  MAP_LAYER_OPTIONS,
  type IcheonArea,
  type MapLayerFilters,
} from "@/lib/map-filters";
import type { MapMarker, MapZone } from "@/types";

const IcheonVWorldMap = dynamic(() => import("@/components/map/IcheonVWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-muted">
      이천시 지도 로딩 중...
    </div>
  ),
});

interface SmartCityMapProps {
  className?: string;
  showHotspotCard?: boolean;
  large?: boolean;
  compact?: boolean;
  fill?: boolean;
  zones?: MapZone[];
  markers?: MapMarker[];
  clusterMarkers?: boolean;
}

export function SmartCityMap({
  className,
  showHotspotCard = false,
  large = false,
  compact = false,
  fill = false,
  zones,
  markers,
  clusterMarkers,
}: SmartCityMapProps) {
  const { toast } = useToast();
  const [selectedArea, setSelectedArea] = useState<IcheonArea>("이천시 전체");
  const [layerFilters, setLayerFilters] = useState<MapLayerFilters>(DEFAULT_LAYER_FILTERS);
  const [regionOpen, setRegionOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const baseZones = zones ?? (large ? getParkingMapZones() : getDashboardMapZones());
  const baseMarkers = markers ?? (large ? getParkingMapMarkers() : getDashboardMapMarkers());

  const { zones: mapZones, markers: mapMarkers } = useMemo(
    () => applyMapFilters(baseZones, baseMarkers, selectedArea, layerFilters),
    [baseZones, baseMarkers, selectedArea, layerFilters],
  );

  const visibleLegend = MAP_LAYER_OPTIONS.filter((l) => layerFilters[l.id]);

  const restrictionCount = mapZones.filter((z) => z.type === "restriction").length;
  const demandCount = mapZones.filter((z) => z.type === "demand").length;
  const hotspotId = `hotspot-${selectedArea}`;
  const hotspotTitle = `${selectedArea} 인프라 집중 대응`;
  const { isRegistered, action, openRegister } = useActionRegistration("map", hotspotId);

  return (
    <div
      className={cn(
        "elevated-card flex flex-col overflow-hidden",
        fill && "h-full min-h-0",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-semibold text-slate-800">도시 인프라 현황 지도</span>
          <MapApiBadge />
        </div>
        <MapFilterBar
          selectedArea={selectedArea}
          onAreaChange={setSelectedArea}
          layerFilters={layerFilters}
          onLayerFiltersChange={setLayerFilters}
          regionOpen={regionOpen}
          filterOpen={filterOpen}
          onRegionOpenChange={setRegionOpen}
          onFilterOpenChange={setFilterOpen}
        />
      </div>

      <div
        className={cn(
          "relative isolate min-h-0 overflow-hidden",
          fill && "flex-1",
          !fill && compact && "h-[180px]",
          !fill && !compact && large && "h-[clamp(280px,48vh,520px)]",
          !fill && !compact && !large && "h-[clamp(180px,26vh,260px)]",
        )}
      >
        <div className="absolute inset-0 z-0">
          <IcheonVWorldMap
            zones={mapZones}
            markers={mapMarkers}
            large={large}
            showHeatmap={large}
            clusterMarkers={clusterMarkers}
            onZoomIn={() => toast("지도를 확대했습니다.", "info")}
            onZoomOut={() => toast("지도를 축소했습니다.", "info")}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[400]">
          <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1.5 text-[10px] shadow backdrop-blur">
            <div className="flex flex-wrap gap-2">
              {visibleLegend.length > 0 ? (
                visibleLegend.map((layer) => (
                  <span key={layer.id} className="flex items-center gap-1">
                    <span className={cn("h-2 w-2 rounded-full", layer.color)} />
                    {layer.label}
                  </span>
                ))
              ) : (
                <span className="text-muted">표시 레이어 없음</span>
              )}
            </div>
            {(selectedArea !== "이천시 전체" || mapMarkers.length + mapZones.length === 0) && (
              <p className="mt-1 text-[9px] text-muted">
                {selectedArea !== "이천시 전체" && `${selectedArea} · `}
                구역 {mapZones.length} · 마커 {mapMarkers.length}
              </p>
            )}
          </div>

          <div className="pointer-events-auto absolute right-2 top-2">
            <button
              type="button"
              onClick={() => {
                setRegionOpen(false);
                setFilterOpen((v) => !v);
              }}
              className={cn(
                "rounded-lg p-1.5 shadow-md hover:bg-slate-50",
                filterOpen ? "bg-blue-50 text-primary" : "bg-white",
              )}
              aria-label="레이어 필터"
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
          </div>

          {showHotspotCard && (
            <div className="pointer-events-auto absolute bottom-3 right-3 w-52 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
              <p className="text-[10px] text-muted">
                {selectedArea === "이천시 전체" ? "공공데이터 기준" : `${selectedArea} 필터`}
              </p>
              <p className="text-lg font-bold text-red-600">보호구역 {restrictionCount}곳</p>
              <p className="text-sm font-semibold text-amber-600">주차부족 {demandCount}곳</p>
              <p className="text-[10px] text-muted">
                주차장 {mapMarkers.filter((m) => m.type === "parking").length}개 · 공원{" "}
                {mapMarkers.filter((m) => m.type === "park").length}개
              </p>
              <div className="mt-2 space-y-2">
                {action && <ActionStatus action={action} compact />}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openRegister(
                        hotspotTitle,
                        `보호구역 ${restrictionCount}곳 · 주차부족 ${demandCount}곳 집중 관리`,
                      )
                    }
                    disabled={isRegistered}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[10px]",
                      isRegistered
                        ? "cursor-not-allowed border border-green-200 bg-green-50 text-green-700"
                        : "bg-primary text-white",
                    )}
                  >
                    {isRegistered ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        배정 완료
                      </span>
                    ) : (
                      "조치 등록"
                    )}
                  </button>
                <button
                  type="button"
                  onClick={() => toast("상세 분석 리포트 생성", "info")}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-[10px]"
                >
                  상세
                </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
