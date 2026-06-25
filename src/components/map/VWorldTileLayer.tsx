"use client";

import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { getVWorldTileUrl, VWORLD_ATTRIBUTION } from "@/lib/map-config";

/** VWorld WMTS 타일 레이어 (API 키 유무에 따라 URL 형식 자동 전환) */
export function VWorldTileLayer() {
  const map = useMap();

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
    let layer: L.TileLayer;

    if (apiKey) {
      layer = L.tileLayer("", {
        attribution: VWORLD_ATTRIBUTION,
        maxZoom: 19,
        minZoom: 6,
      });
      layer.getTileUrl = (coords) =>
        `https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Base/${coords.z}/${coords.y}/${coords.x}.png`;
    } else {
      layer = L.tileLayer(getVWorldTileUrl("Base"), {
        attribution: VWORLD_ATTRIBUTION,
        maxZoom: 19,
        minZoom: 6,
      });
    }

    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}
