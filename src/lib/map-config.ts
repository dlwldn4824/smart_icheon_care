/** 이천시 중심 좌표 (이천시청 인근) */
export const ICHEON_CENTER = {
  lat: 37.272,
  lng: 127.435,
} as const;

export const ICHEON_DEFAULT_ZOOM = 13;

export type VWorldLayerType = "Base" | "Satellite" | "Hybrid" | "gray" | "midnight";

/** VWorld 지도 타일 URL 생성 */
export function getVWorldTileUrl(layer: VWorldLayerType = "Base"): string {
  const apiKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

  if (apiKey) {
    const ext = layer === "Satellite" ? "jpeg" : "png";
    return `https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/${layer}/{z}/{y}/{x}.${ext}`;
  }

  // API 키 없을 때 공개 타일 (개발/데모용)
  if (layer === "Satellite") {
    return "https://xdworld.vworld.kr/2d/Satellite/service/{z}/{x}/{y}.jpeg";
  }
  return `https://xdworld.vworld.kr/2d/${layer}/service/{z}/{x}/{y}.png`;
}

export const VWORLD_ATTRIBUTION =
  '&copy; <a href="https://www.vworld.kr/">VWorld</a> · 국토교통부';

export function hasVWorldApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VWORLD_API_KEY);
}
