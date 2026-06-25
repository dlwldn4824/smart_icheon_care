import type { MapMarker } from "@/types";

/** CCTV·민원 등 공공데이터에 없는 운영 마커 */
export const operationalMapMarkers: MapMarker[] = [
  { id: "m5", type: "cctv", lat: 37.286, lng: 127.431, label: "CAM-설봉-001", area: "설봉동" },
  { id: "m6", type: "cctv", lat: 37.279, lng: 127.449, label: "CAM-안흥-003", area: "안흥동" },
  { id: "m7", type: "complaint", lat: 37.286, lng: 127.432, label: "현수막 민원", area: "설봉동" },
  { id: "m8", type: "complaint", lat: 37.279, lng: 127.447, label: "벤치 파손 민원", area: "안흥동" },
];
