import type { MapMarker, MapZone, MarkerType } from "@/types";

export const ICHEON_AREA_OPTIONS = [
  "이천시 전체",
  "설봉동",
  "안흥동",
  "중리동",
  "관고동",
  "창전동",
  "신둔면",
  "장호원읍",
  "모가면",
  "부발읍",
  "마장면",
  "백사면",
  "율면",
] as const;

export type IcheonArea = (typeof ICHEON_AREA_OPTIONS)[number];

export const MAP_LAYER_OPTIONS: { id: MapLayerId; label: string; color: string }[] = [
  { id: "restriction", label: "보호구역", color: "bg-red-500" },
  { id: "demand", label: "주차 부족", color: "bg-amber-500" },
  { id: "park", label: "공원", color: "bg-green-500" },
  { id: "parking", label: "주차장", color: "bg-blue-500" },
  { id: "cctv", label: "CCTV", color: "bg-purple-500" },
  { id: "complaint", label: "민원", color: "bg-rose-600" },
];

export type MapLayerId = MarkerType | "restriction" | "demand";

export type MapLayerFilters = Record<MapLayerId, boolean>;

export const DEFAULT_LAYER_FILTERS: MapLayerFilters = {
  restriction: true,
  demand: true,
  park: true,
  parking: true,
  cctv: true,
  complaint: true,
};

const AREA_KEYWORDS = ICHEON_AREA_OPTIONS.filter((a) => a !== "이천시 전체");

export function extractAreaFromAddress(address: string): string {
  const found = AREA_KEYWORDS.find((area) => address.includes(area));
  return found ?? "기타";
}

export function filterZonesByArea(zones: MapZone[], area: IcheonArea): MapZone[] {
  if (area === "이천시 전체") return zones;
  return zones.filter((z) => z.area === area || z.name.includes(area));
}

export function filterMarkersByArea(markers: MapMarker[], area: IcheonArea): MapMarker[] {
  if (area === "이천시 전체") return markers;
  return markers.filter((m) => m.area === area || m.label.includes(area));
}

export function filterMarkersByLayer(markers: MapMarker[], layers: MapLayerFilters): MapMarker[] {
  return markers.filter((m) => layers[m.type]);
}

export function filterZonesByLayer(zones: MapZone[], layers: MapLayerFilters): MapZone[] {
  return zones.filter((zone) => {
    if (zone.type === "restriction") return layers.restriction;
    if (zone.type === "demand") return layers.demand;
    if (zone.type === "conflict") return layers.demand && layers.restriction;
    return true;
  });
}

export function applyMapFilters(
  zones: MapZone[],
  markers: MapMarker[],
  area: IcheonArea,
  layers: MapLayerFilters,
): { zones: MapZone[]; markers: MapMarker[] } {
  const areaZones = filterZonesByArea(zones, area);
  const areaMarkers = filterMarkersByArea(markers, area);
  return {
    zones: filterZonesByLayer(areaZones, layers),
    markers: filterMarkersByLayer(areaMarkers, layers),
  };
}

export function countActiveLayerFilters(layers: MapLayerFilters): number {
  return Object.values(layers).filter(Boolean).length;
}
