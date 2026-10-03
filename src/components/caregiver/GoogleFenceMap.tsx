"use client";
import { useEffect } from "react";
import { AdvancedMarker, APIProvider, Circle, Map, Polyline, useMap } from "@vis.gl/react-google-maps";
import type { MapFence, MapPoint } from "./FenceMapInner";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
// Advanced markers need a map id; Google's DEMO_MAP_ID works without setup.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

function Recenter({ center, k }: { center: MapPoint; k?: string }) {
  const map = useMap();
  useEffect(() => {
    if (map && k) map.panTo(center);
  }, [map, k, center]);
  return null;
}

/** Google Maps version of the safety map (same props as the OpenStreetMap one). */
export default function GoogleFenceMap({
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
    <APIProvider apiKey={KEY}>
      <div className="h-[420px] w-full overflow-hidden rounded-2xl" aria-label="Map">
        <Map
          mapId={MAP_ID}
          defaultCenter={center}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          onClick={(e) => {
            const ll = e.detail.latLng;
            if (ll) onClick?.({ lat: ll.lat, lng: ll.lng });
          }}
        >
          <Recenter center={center} k={recenterKey} />
          {fences.map((f) => (
            <Circle
              key={f.id}
              center={{ lat: f.centerLat, lng: f.centerLng }}
              radius={f.radiusM}
              strokeColor={f.kind === "home" ? "#2f6f73" : "#b8731a"}
              strokeWeight={f.active ? 3 : 1.5}
              strokeOpacity={f.active ? 1 : 0.6}
              fillColor={f.kind === "home" ? "#2f6f73" : "#b8731a"}
              fillOpacity={f.active ? 0.12 : 0.05}
              clickable={false}
            />
          ))}
          {draft && (
            <Circle
              center={{ lat: draft.lat, lng: draft.lng }}
              radius={draft.radiusM}
              strokeColor="#4f7a3a"
              strokeWeight={2}
              fillColor="#4f7a3a"
              fillOpacity={0.08}
              clickable={false}
            />
          )}
          {trail.length > 1 && <Polyline path={trail} strokeColor="#5c4a3a" strokeOpacity={0.6} strokeWeight={2} clickable={false} />}
          {latest && (
            <AdvancedMarker position={latest} title="Last seen here">
              <span className="block h-5 w-5 rounded-full border-[3px] border-white bg-sea shadow-md" />
            </AdvancedMarker>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
