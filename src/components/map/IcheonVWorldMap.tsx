"use client";

import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { getDashboardMapMarkers, getDashboardMapZones } from "@/lib/map-data";
import {
  ICHEON_CENTER,
  ICHEON_DEFAULT_ZOOM,
  getVWorldTileUrl,
  VWORLD_ATTRIBUTION,
} from "@/lib/map-config";
import type { MapMarker, MapZone, ZoneType } from "@/types";
import { VWorldTileLayer } from "./VWorldTileLayer";

const zoneStyle: Record<ZoneType, { color: string; fillColor: string }> = {
  demand: { color: "#d97706", fillColor: "#f59e0b" },
  restriction: { color: "#dc2626", fillColor: "#ef4444" },
  conflict: { color: "#ea580c", fillColor: "#f97316" },
};

const markerColor: Record<MapMarker["type"], string> = {
  park: "#16a34a",
  parking: "#2563eb",
  cctv: "#9333ea",
  complaint: "#dc2626",
};

const markerTypeLabel: Record<MapMarker["type"], string> = {
  park: "도시공원",
  parking: "주차장",
  cctv: "CCTV",
  complaint: "민원",
};

function createPinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:12px;height:12px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

export function MapZoomControls({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}) {
  const map = useMap();

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: 8, marginRight: 8 }}>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            map.zoomIn();
            onZoomIn?.();
          }}
          className="rounded-lg bg-white p-1.5 shadow-md hover:bg-slate-50"
          aria-label="확대"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            map.zoomOut();
            onZoomOut?.();
          }}
          className="rounded-lg bg-white p-1.5 shadow-md hover:bg-slate-50"
          aria-label="축소"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface IcheonVWorldMapProps {
  zones?: MapZone[];
  markers?: MapMarker[];
  large?: boolean;
  showHeatmap?: boolean;
  clusterMarkers?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

function MapMarkerItem({ marker }: { marker: MapMarker }) {
  return (
    <Marker
      position={[marker.lat, marker.lng]}
      icon={createPinIcon(markerColor[marker.type])}
    >
      <Popup>
        <strong>{marker.label}</strong>
        <br />
        <span className="text-xs text-slate-600">{markerTypeLabel[marker.type]}</span>
      </Popup>
    </Marker>
  );
}

export default function IcheonVWorldMap({
  zones,
  markers,
  large = false,
  showHeatmap = false,
  clusterMarkers,
  onZoomIn,
  onZoomOut,
}: IcheonVWorldMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  const resolvedZones = zones ?? getDashboardMapZones();
  const resolvedMarkers = markers ?? getDashboardMapMarkers();

  const clusterableMarkers = resolvedMarkers.filter((m) => m.type === "park" || m.type === "parking");
  const operationalMarkers = resolvedMarkers.filter((m) => m.type === "cctv" || m.type === "complaint");
  const useCluster =
    clusterMarkers ?? clusterableMarkers.length > 30;

  return (
    <MapContainer
      center={[ICHEON_CENTER.lat, ICHEON_CENTER.lng]}
      zoom={large ? ICHEON_DEFAULT_ZOOM + 1 : ICHEON_DEFAULT_ZOOM}
      className="h-full w-full z-0"
      zoomControl={false}
      attributionControl={true}
    >
      {apiKey ? (
        <VWorldTileLayer />
      ) : (
        <TileLayer url={getVWorldTileUrl("Base")} attribution={VWORLD_ATTRIBUTION} maxZoom={19} />
      )}

      {showHeatmap && (
        <TileLayer
          url={getVWorldTileUrl("Satellite")}
          attribution=""
          opacity={0.35}
          maxZoom={19}
        />
      )}

      {resolvedZones.map((zone: MapZone) => {
        const style = zoneStyle[zone.type];
        return (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.radiusMeters}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: zone.type === "conflict" ? 0.3 : zone.type === "demand" ? 0.22 : 0.15,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <br />
              {zone.type === "demand" && (
                <>
                  주차 부족 구역
                  {zone.shortageScore != null && (
                    <>
                      <br />
                      <span className="text-xs text-slate-600">
                        부족지수 {zone.shortageScore} · 인근 {zone.nearbyParkingSpaces ?? 0}면
                      </span>
                    </>
                  )}
                </>
              )}
              {zone.type === "restriction" && "보호구역 (주차 제한)"}
              {zone.type === "conflict" && "주차 갈등 핫스팟"}
            </Popup>
          </Circle>
        );
      })}

      {useCluster ? (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {clusterableMarkers.map((marker) => (
            <MapMarkerItem key={marker.id} marker={marker} />
          ))}
        </MarkerClusterGroup>
      ) : (
        clusterableMarkers.map((marker) => (
          <MapMarkerItem key={marker.id} marker={marker} />
        ))
      )}

      {operationalMarkers.map((marker) => (
        <MapMarkerItem key={marker.id} marker={marker} />
      ))}

      <MapZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
    </MapContainer>
  );
}
