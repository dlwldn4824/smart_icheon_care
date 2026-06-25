import type { FacilityRow, MapMarker, MapZone } from "@/types";
import type { IcheonPublicData, ProtectionZoneRecord } from "@/types/public-data";
import { extractAreaFromAddress } from "@/lib/map-filters";
import { getParkingShortageZones } from "@/lib/parking-shortage";
import rawData from "@/data/generated/icheon.json";

const data = rawData as IcheonPublicData;

export const publicDataMeta = data.meta;

function protectionRadiusMeters(zone: ProtectionZoneRecord): number {
  if (zone.roadWidth && zone.roadWidth > 0) {
    return Math.round(zone.roadWidth * 15);
  }

  if (zone.subtype === "child") {
    if (zone.facilityType.includes("초등")) return 300;
    return 250;
  }

  return 250;
}

export function toRestrictionZones(zones: ProtectionZoneRecord[] = data.protectionZones): MapZone[] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    type: "restriction" as const,
    lat: zone.lat,
    lng: zone.lng,
    radiusMeters: protectionRadiusMeters(zone),
    area: extractAreaFromAddress(zone.address),
  }));
}

export function toParkMarkers(parks = data.parks): MapMarker[] {
  return parks.map((park) => ({
    id: park.id,
    type: "park" as const,
    lat: park.lat,
    lng: park.lng,
    label: park.name,
    area: extractAreaFromAddress(park.address),
  }));
}

export function toParkingMarkers(lots = data.parkingLots): MapMarker[] {
  return lots.map((lot) => ({
    id: lot.id,
    type: "parking" as const,
    lat: lot.lat,
    lng: lot.lng,
    label: lot.name,
    area: extractAreaFromAddress(lot.address),
  }));
}

export function toFacilities(parks = data.parks): FacilityRow[] {
  return parks.map((park, index) => ({
    id: park.id,
    name: park.name,
    type: park.category,
    address: park.address,
    floatingPopulation: 0,
    complaints: 0,
    aiStatus: "정상",
    priority: index < 3 ? "medium" : "low",
    manager: "이천시 시설관리",
    lastInspection: data.meta.generatedAt.slice(0, 10),
    nextMaintenance: "-",
    lat: park.lat,
    lng: park.lng,
  }));
}

/** 초등학교 보호구역 우선, 그 외 어린이·노인 구역 */
export function getDashboardRestrictionZones(limit = 18): MapZone[] {
  const childSchools = data.protectionZones.filter(
    (z) => z.subtype === "child" && z.facilityType.includes("초등"),
  );
  const rest = data.protectionZones.filter(
    (z) => !(z.subtype === "child" && z.facilityType.includes("초등")),
  );

  return toRestrictionZones([...childSchools, ...rest].slice(0, limit));
}

export function getAllRestrictionZones(): MapZone[] {
  return toRestrictionZones();
}

/** 주차구획수 상위 N개 */
export function getDashboardParkingMarkers(limit = 20): MapMarker[] {
  const sorted = [...data.parkingLots].sort((a, b) => b.spaces - a.spaces);
  return toParkingMarkers(sorted.slice(0, limit));
}

export function getAllParkingMarkers(): MapMarker[] {
  return toParkingMarkers();
}

export function getAllParkMarkers(): MapMarker[] {
  return toParkMarkers();
}

export interface MapDataSet {
  zones: MapZone[];
  markers: MapMarker[];
}

export function getDashboardMapData(mockMarkers: MapMarker[]): MapDataSet {
  return {
    zones: [...getDashboardRestrictionZones(), ...getParkingShortageZones(8)],
    markers: [...getAllParkMarkers(), ...getDashboardParkingMarkers(), ...mockMarkers],
  };
}

export function getParkingAnalysisMapData(mockMarkers: MapMarker[]): MapDataSet {
  return {
    zones: [...getAllRestrictionZones(), ...getParkingShortageZones()],
    markers: [...getAllParkMarkers(), ...getAllParkingMarkers(), ...mockMarkers],
  };
}

export function getAllFacilities(): FacilityRow[] {
  return toFacilities();
}
