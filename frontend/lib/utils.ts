import type { LatLng, RiskLevel } from '../types/api';

export const SF_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '#22c55e';
    case 'moderate':
      return '#f59e0b';
    case 'high':
      return '#f97316';
    case 'very_high':
      return '#ef4444';
    default:
      return '#71717a';
  }
}

export type HotspotQuery = { lat: number; lng: number; radius: number };

export function hotspotQueryForPoints(points: LatLng[], paddingM = 350): HotspotQuery {
  if (!points.length) {
    return { ...SF_CENTER, radius: 1500 };
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

export function hotspotLimitForRadius(radius: number): number {
  if (radius >= 5000) return 5000;
  if (radius >= 3500) return 3500;
  if (radius >= 2000) return 2500;
  return 2000;
}

export type RoutePreference = 'safest' | 'fastest' | 'compare';

export function pickRouteId<T extends { id: string; safetyScore: number; distanceMeters: number }>(
  routes: T[],
  preference: RoutePreference,
): string | null {
  if (!routes.length) return null;
  if (preference === 'safest') {
    return [...routes].sort((a, b) => b.safetyScore - a.safetyScore)[0].id;
  }
  if (preference === 'fastest') {
    return [...routes].sort((a, b) => a.distanceMeters - b.distanceMeters)[0].id;
  }
  return routes[0].id;
}
