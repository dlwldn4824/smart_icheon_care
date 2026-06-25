import type { MapZone } from "@/types";
import type { IcheonPublicData } from "@/types/public-data";
import { computeParkingShortageZones } from "@/lib/shortage-zones";
import rawData from "@/data/generated/icheon.json";

const data = rawData as IcheonPublicData;

let cachedZones: MapZone[] | null = null;

function getAllShortageZones(): MapZone[] {
  if (cachedZones) return cachedZones;
  cachedZones = data.shortageZones ?? computeParkingShortageZones(data);
  return cachedZones;
}

/** 주차 부족 구역 (점수 110 이상 또는 인근 주차면 20면 미만) */
export function getParkingShortageZones(limit?: number): MapZone[] {
  const zones = getAllShortageZones();
  return limit ? zones.slice(0, limit) : zones;
}

export function getParkingShortageZoneCount(): number {
  return getAllShortageZones().length;
}
