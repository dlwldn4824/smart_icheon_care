import type { MapMarker, MapZone } from "@/types";
import {
  getDashboardMapData,
  getParkingAnalysisMapData,
  type MapDataSet,
} from "@/lib/public-data";
import { operationalMapMarkers } from "@/data/mock-operational";

let dashboardCache: MapDataSet | null = null;
let parkingCache: MapDataSet | null = null;

function getDashboardCache(): MapDataSet {
  if (!dashboardCache) {
    dashboardCache = getDashboardMapData(operationalMapMarkers);
  }
  return dashboardCache;
}

function getParkingCache(): MapDataSet {
  if (!parkingCache) {
    parkingCache = getParkingAnalysisMapData(operationalMapMarkers);
  }
  return parkingCache;
}

export function getDashboardMapZones(): MapZone[] {
  return getDashboardCache().zones;
}

export function getDashboardMapMarkers(): MapMarker[] {
  return getDashboardCache().markers;
}

export function getParkingMapZones(): MapZone[] {
  return getParkingCache().zones;
}

export function getParkingMapMarkers(): MapMarker[] {
  return getParkingCache().markers;
}
