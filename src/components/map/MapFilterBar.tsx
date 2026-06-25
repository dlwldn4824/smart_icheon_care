"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ICHEON_AREA_OPTIONS,
  MAP_LAYER_OPTIONS,
  type IcheonArea,
  type MapLayerFilters,
} from "@/lib/map-filters";

interface MapFilterBarProps {
  selectedArea: IcheonArea;
  onAreaChange: (area: IcheonArea) => void;
  layerFilters: MapLayerFilters;
  onLayerFiltersChange: (layers: MapLayerFilters) => void;
  regionOpen: boolean;
  filterOpen: boolean;
  onRegionOpenChange: (open: boolean) => void;
  onFilterOpenChange: (open: boolean) => void;
}

export function MapFilterBar({
  selectedArea,
  onAreaChange,
  layerFilters,
  onLayerFiltersChange,
  regionOpen,
  filterOpen,
  onRegionOpenChange,
  onFilterOpenChange,
}: MapFilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onRegionOpenChange(false);
        onFilterOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onRegionOpenChange, onFilterOpenChange]);

  const activeLayerCount = Object.values(layerFilters).filter(Boolean).length;

  function toggleLayer(id: keyof MapLayerFilters) {
    onLayerFiltersChange({ ...layerFilters, [id]: !layerFilters[id] });
  }

  return (
    <div ref={barRef} className="relative flex shrink-0 items-center gap-1.5">
      {/* 지역 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            onFilterOpenChange(false);
            onRegionOpenChange(!regionOpen);
          }}
          className={cn(
            "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
            regionOpen || selectedArea !== "이천시 전체"
              ? "border-primary bg-blue-50 text-primary"
              : "border-gray-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          {selectedArea === "이천시 전체" ? "지역" : selectedArea}
          <ChevronDown className={cn("h-3 w-3 transition-transform", regionOpen && "rotate-180")} />
        </button>

        {regionOpen && (
          <div className="absolute right-0 top-full z-[500] mt-1 max-h-56 w-40 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {ICHEON_AREA_OPTIONS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => {
                  onAreaChange(area);
                  onRegionOpenChange(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] hover:bg-slate-50",
                  selectedArea === area && "bg-blue-50 font-medium text-primary",
                )}
              >
                {area}
                {selectedArea === area && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            onRegionOpenChange(false);
            onFilterOpenChange(!filterOpen);
          }}
          className={cn(
            "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
            filterOpen || activeLayerCount < MAP_LAYER_OPTIONS.length
              ? "border-primary bg-blue-50 text-primary"
              : "border-gray-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          필터
          {activeLayerCount < MAP_LAYER_OPTIONS.length && (
            <span className="rounded-full bg-primary px-1 text-[9px] text-white">
              {activeLayerCount}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform", filterOpen && "rotate-180")} />
        </button>

        {filterOpen && (
          <div className="absolute right-0 top-full z-[500] mt-1 w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            <p className="mb-1.5 px-1 text-[10px] font-medium text-muted">레이어 표시</p>
            {MAP_LAYER_OPTIONS.map((layer) => (
              <label
                key={layer.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={layerFilters[layer.id]}
                  onChange={() => toggleLayer(layer.id)}
                  className="h-3 w-3 rounded border-gray-300 accent-primary"
                />
                <span className={cn("h-2 w-2 rounded-full", layer.color)} />
                {layer.label}
              </label>
            ))}
            <div className="mt-2 flex gap-1 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() =>
                  onLayerFiltersChange(
                    Object.fromEntries(
                      MAP_LAYER_OPTIONS.map((l) => [l.id, true]),
                    ) as MapLayerFilters,
                  )
                }
                className="flex-1 rounded-md bg-slate-100 py-1 text-[10px] text-slate-600 hover:bg-slate-200"
              >
                전체
              </button>
              <button
                type="button"
                onClick={() =>
                  onLayerFiltersChange(
                    Object.fromEntries(
                      MAP_LAYER_OPTIONS.map((l) => [l.id, false]),
                    ) as MapLayerFilters,
                  )
                }
                className="flex-1 rounded-md bg-slate-100 py-1 text-[10px] text-slate-600 hover:bg-slate-200"
              >
                해제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
