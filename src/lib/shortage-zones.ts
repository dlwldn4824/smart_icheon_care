import type { MapZone } from "@/types";
import type { IcheonPublicData } from "@/types/public-data";
import { extractAreaFromAddress, ICHEON_AREA_OPTIONS } from "@/lib/map-filters";

const RADIUS_METERS = 550;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ShortageCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  area: string;
  shortageScore: number;
  nearbyParkingSpaces: number;
  demandIndex: number;
}

function nearbyParkingSpaces(
  data: IcheonPublicData,
  lat: number,
  lng: number,
  radiusMeters: number,
): number {
  return data.parkingLots
    .filter((lot) => haversineMeters(lat, lng, lot.lat, lot.lng) <= radiusMeters)
    .reduce((sum, lot) => sum + lot.spaces, 0);
}

function nearbyParkCount(
  data: IcheonPublicData,
  lat: number,
  lng: number,
  radiusMeters: number,
): number {
  return data.parks.filter((park) => haversineMeters(lat, lng, park.lat, park.lng) <= radiusMeters)
    .length;
}

function buildSchoolShortageCandidates(data: IcheonPublicData): ShortageCandidate[] {
  const schools = data.protectionZones.filter(
    (z) => z.subtype === "child" && z.facilityType.includes("초등"),
  );

  return schools.map((school) => {
    const spaces = nearbyParkingSpaces(data, school.lat, school.lng, RADIUS_METERS);
    const parks = nearbyParkCount(data, school.lat, school.lng, 400);
    const demandIndex = 50 + parks * 12;
    const shortageScore = Math.round((demandIndex / Math.max(spaces, 6)) * 100);

    return {
      id: `demand-school-${school.id}`,
      name: `${school.name} 인근 주차부족`,
      lat: school.lat,
      lng: school.lng,
      area: extractAreaFromAddress(school.address),
      shortageScore,
      nearbyParkingSpaces: spaces,
      demandIndex,
    };
  });
}

function buildDistrictShortageCandidates(data: IcheonPublicData): ShortageCandidate[] {
  const districts = ICHEON_AREA_OPTIONS.filter((a) => a !== "이천시 전체");
  const results: ShortageCandidate[] = [];

  for (const district of districts) {
    const lots = data.parkingLots.filter((l) => extractAreaFromAddress(l.address) === district);
    const schools = data.protectionZones.filter(
      (z) => extractAreaFromAddress(z.address) === district && z.subtype === "child",
    );
    const parks = data.parks.filter((p) => extractAreaFromAddress(p.address) === district);
    const elderly = data.protectionZones.filter(
      (z) => extractAreaFromAddress(z.address) === district && z.subtype === "elderly",
    );

    if (schools.length === 0 && parks.length < 2) continue;

    const totalSpaces = lots.reduce((sum, l) => sum + l.spaces, 0);
    const demandIndex = schools.length * 28 + parks.length * 10 + elderly.length * 6 + 20;
    const shortageScore = Math.round((demandIndex / Math.max(totalSpaces, 10)) * 100);

    const points = [
      ...schools.map((s) => ({ lat: s.lat, lng: s.lng })),
      ...parks.map((p) => ({ lat: p.lat, lng: p.lng })),
    ];
    if (points.length === 0) continue;

    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;

    results.push({
      id: `demand-district-${district}`,
      name: `${district} 주차부족 구역`,
      lat,
      lng,
      area: district,
      shortageScore,
      nearbyParkingSpaces: totalSpaces,
      demandIndex,
    });
  }

  return results;
}

function toDemandZone(candidate: ShortageCandidate): MapZone {
  const radius = Math.min(520, Math.max(320, 300 + Math.round(candidate.shortageScore / 4)));
  return {
    id: candidate.id,
    name: candidate.name,
    type: "demand",
    lat: candidate.lat,
    lng: candidate.lng,
    radiusMeters: radius,
    area: candidate.area,
    shortageScore: candidate.shortageScore,
    nearbyParkingSpaces: candidate.nearbyParkingSpaces,
    demandIndex: candidate.demandIndex,
  };
}

function dedupeCandidates(candidates: ShortageCandidate[]): ShortageCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.shortageScore - a.shortageScore);
  const picked: ShortageCandidate[] = [];

  for (const candidate of sorted) {
    const tooClose = picked.some(
      (p) => haversineMeters(p.lat, p.lng, candidate.lat, candidate.lng) < 450,
    );
    if (!tooClose) picked.push(candidate);
  }

  return picked;
}

/** 주차 부족 구역 (점수 110 이상 또는 인근 주차면 20면 미만) */
export function computeParkingShortageZones(data: IcheonPublicData, limit?: number): MapZone[] {
  const candidates = dedupeCandidates([
    ...buildSchoolShortageCandidates(data),
    ...buildDistrictShortageCandidates(data),
  ]).filter((c) => c.shortageScore >= 110 || c.nearbyParkingSpaces < 20);

  const zones = candidates.map(toDemandZone);
  return limit ? zones.slice(0, limit) : zones;
}
