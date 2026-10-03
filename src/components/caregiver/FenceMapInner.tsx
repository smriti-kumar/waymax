"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export type MapFence = { id: string; kind: "home" | "temporary"; label: string; centerLat: number; centerLng: number; radiusM: number; active?: boolean };
export type MapPoint = { lat: number; lng: number };

function ClickCatcher({ onClick }: { onClick?: (p: MapPoint) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center }: { center: MapPoint }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

export default function FenceMapInner({
  center,
  fences,
  draft,
  trail,
  latest,
  onClick,
  recenterKey,
}: {
  center: MapPoint;
  fences: MapFence[];
  draft?: { lat: number; lng: number; radiusM: number } | null;
  trail: MapPoint[];
  latest: MapPoint | null;
  onClick?: (p: MapPoint) => void;
  recenterKey?: string;
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom className="h-[420px] w-full rounded-2xl" aria-label="Map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher onClick={onClick} />
      {recenterKey && <Recenter key={recenterKey} center={center} />}
      {fences.map((f) => (
        <Circle
          key={f.id}
          center={[f.centerLat, f.centerLng]}
          radius={f.radiusM}
          pathOptions={{
            color: f.kind === "home" ? "#2f6f73" : "#b8731a",
            weight: f.active ? 3 : 1.5,
            dashArray: f.active ? undefined : "6 6",
            fillOpacity: f.active ? 0.12 : 0.05,
          }}
        >
          <Tooltip>{f.label}</Tooltip>
        </Circle>
      ))}
      {draft && (
        <Circle center={[draft.lat, draft.lng]} radius={draft.radiusM} pathOptions={{ color: "#4f7a3a", dashArray: "4 4", fillOpacity: 0.08 }} />
      )}
      {trail.length > 1 && <Polyline positions={trail.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#5c4a3a", weight: 2, opacity: 0.6 }} />}
      {latest && (
        <CircleMarker center={[latest.lat, latest.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2f6f73", fillOpacity: 1 }}>
          <Tooltip permanent direction="top">
            Last seen here
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
