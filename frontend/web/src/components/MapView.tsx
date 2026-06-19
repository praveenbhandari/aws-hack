import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Hotspot, LatLng, RouteCandidate } from "../types";
import { hotspotFill, hotspotRadius } from "../lib/utils";

const SF_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

const ROUTE_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, points]);
  return null;
}

type Props = {
  hotspots: Hotspot[];
  routes: RouteCandidate[];
  selectedRouteId: string | null;
  origin: LatLng | null;
  destination: LatLng | null;
};

export function MapView({ hotspots, routes, selectedRouteId, origin, destination }: Props) {
  const allPoints: LatLng[] = [
    ...(origin ? [origin] : []),
    ...(destination ? [destination] : []),
    ...routes.flatMap((r) => r.polyline),
  ];

  return (
    <MapContainer
      center={[SF_CENTER.lat, SF_CENTER.lng]}
      zoom={13}
      className="h-full w-full rounded-xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {allPoints.length > 1 && <FitBounds points={allPoints} />}

      {hotspots.map((h) => (
        <CircleMarker
          key={h.id}
          center={[h.lat, h.lng]}
          radius={hotspotRadius(h.weight, h.severity)}
          pathOptions={{
            color: hotspotFill(h.weight, h.severity),
            fillColor: hotspotFill(h.weight, h.severity),
            fillOpacity: 0.45,
            weight: 1,
            opacity: 0.8,
          }}
        >
          <Tooltip className="route-tooltip" direction="top">
            <div>
              <strong>{h.category}</strong>
              <br />
              Severity {h.severity} · weight {(h.weight * 100).toFixed(0)}%
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {routes.map((route, i) => {
        const active = route.id === selectedRouteId;
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
        return (
          <Polyline
            key={route.id}
            positions={route.polyline.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color,
              weight: active ? 7 : 4,
              opacity: active ? 1 : selectedRouteId ? 0.35 : 0.85,
            }}
          >
            {active && (
              <Tooltip sticky className="route-tooltip">
                {route.summary} — {route.safetyScore}/100
              </Tooltip>
            )}
          </Polyline>
        );
      })}

      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={10}
          pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
        />
      )}
      {destination && (
        <CircleMarker
          center={[destination.lat, destination.lng]}
          radius={10}
          pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
        />
      )}
    </MapContainer>
  );
}
