import type { MapZone } from "@/types";

export interface ProtectionZoneRecord {
  id: string;
  name: string;
  subtype: "child" | "elderly";
  facilityType: string;
  lat: number;
  lng: number;
  roadWidth: number | null;
  address: string;
}

export interface ParkingLotRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  spaces: number;
  type: string;
  address: string;
}

export interface ParkRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  area: number | null;
  address: string;
}

export interface IcheonPublicData {
  meta: {
    generatedAt: string;
    sources: string[];
    counts: {
      protectionZones: number;
      parkingLots: number;
      parks: number;
    };
  };
  protectionZones: ProtectionZoneRecord[];
  parkingLots: ParkingLotRecord[];
  parks: ParkRecord[];
  /** 빌드 시 사전 계산된 주차 부족 구역 */
  shortageZones?: MapZone[];
}
