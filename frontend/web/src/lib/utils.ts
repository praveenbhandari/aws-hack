import type { RiskLevel } from "../types";

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "#22c55e";
    case "moderate":
      return "#f59e0b";
    case "high":
      return "#f97316";
    case "very_high":
      return "#ef4444";
    default:
      return "#71717a";
  }
}

export function riskLabel(level: RiskLevel): string {
  return level.replace("_", " ");
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function hotspotRadius(weight: number, severity: number): number {
  return 3 + weight * 10 + severity * 1.2;
}

export function hotspotFill(weight: number, severity: number): string {
  const t = Math.min(1, weight * 0.8 + severity / 12);
  if (t > 0.55) return "#ef4444";
  if (t > 0.3) return "#f97316";
  if (t > 0.12) return "#f59e0b";
  return "#facc15";
}

export type HotspotQuery = { lat: number; lng: number; radius: number };

/** Center + radius so the backend bbox covers all points (route, origin, dest). */
export function hotspotQueryForPoints(
  points: { lat: number; lng: number }[],
  paddingM = 350,
): HotspotQuery {
  if (!points.length) {
    return { lat: 37.7749, lng: -122.4194, radius: 1500 };
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  const dLatM = (maxLat - minLat) * 111_000;
  const dLngM = (maxLng - minLng) * 111_000 * Math.cos((lat * Math.PI) / 180);
  const halfSpan = Math.max(dLatM, dLngM) / 2;
  const radius = Math.min(8000, Math.max(900, halfSpan + paddingM));

  return { lat, lng, radius };
}

/** Request more incidents for larger map areas (capped for browser perf). */
export function hotspotLimitForRadius(radius: number): number {
  if (radius >= 5000) return 5000;
  if (radius >= 3500) return 3500;
  if (radius >= 2000) return 2500;
  return 2000;
}
