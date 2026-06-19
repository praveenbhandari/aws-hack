import polyline from '@mapbox/polyline';
import type { Hotspot, LatLng, Route, RouteMode, SafetyScoreResponse } from '../types/api';
import { riskLevelFromScore } from '../types/api';

// Demo area: Times Square -> Grand Central, NYC. Swap freely once real data lands.
export const DEFAULT_LOCATION: LatLng = { lat: 40.758, lng: -73.9855 };

export const MOCK_HOTSPOTS: Hotspot[] = [
  { id: 'hs_1', lat: 40.7549, lng: -73.984, category: 'ASSAULT', severity: 4, occurredAt: '2026-06-13T03:00:00Z', source: 'mock', weight: 0.85 },
  { id: 'hs_2', lat: 40.7563, lng: -73.9865, category: 'LARCENY/THEFT', severity: 2, occurredAt: '2026-05-30T18:00:00Z', source: 'mock', weight: 0.55 },
  { id: 'hs_3', lat: 40.7528, lng: -73.9812, category: 'ROBBERY', severity: 5, occurredAt: '2026-06-16T22:00:00Z', source: 'mock', weight: 0.95 },
  { id: 'hs_4', lat: 40.7598, lng: -73.9845, category: 'LARCENY/THEFT', severity: 1, occurredAt: '2026-05-20T12:00:00Z', source: 'mock', weight: 0.3 },
  { id: 'hs_5', lat: 40.7515, lng: -73.9776, category: 'OTHER OFFENSES', severity: 3, occurredAt: '2026-06-09T15:00:00Z', source: 'mock', weight: 0.6 },
];

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mockSafetyScore(lat: number, lng: number, radiusMeters = 300): SafetyScoreResponse {
  const point: LatLng = { lat, lng };
  const nearby = MOCK_HOTSPOTS.filter((h) => haversineMeters(point, h) <= radiusMeters);
  const penalty = nearby.reduce((sum, h) => sum + h.weight * h.severity * 4, 0);
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const riskLevel = riskLevelFromScore(safetyScore);

  const explanation =
    nearby.length === 0
      ? 'No recent incidents reported nearby. Looks clear.'
      : `There have been ${nearby.length} recent incident${nearby.length > 1 ? 's' : ''} nearby, including ${nearby[0].category.toLowerCase()}.`;

  return {
    lat,
    lng,
    radiusMeters,
    safetyScore,
    riskLevel,
    hotspotCount: nearby.length,
    topHotspots: nearby
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3),
    explanation,
  };
}

function buildPolyline(points: LatLng[]): string {
  return polyline.encode(points.map((p) => [p.lat, p.lng]));
}

export function mockSafeRoutes(origin: LatLng, destination: LatLng, mode: RouteMode = 'walking'): Route[] {
  // Route A: direct path, cuts through the high-severity hotspot cluster.
  const direct: LatLng[] = [
    origin,
    { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 },
    destination,
  ];

  // Route B: detour east, staying clear of hs_3 (the severity-5 robbery cluster).
  const detour: LatLng[] = [
    origin,
    { lat: origin.lat - 0.0015, lng: origin.lng + 0.002 },
    { lat: (origin.lat + destination.lat) / 2 - 0.001, lng: (origin.lng + destination.lng) / 2 + 0.0025 },
    destination,
  ];

  const distanceMeters = Math.round(haversineMeters(origin, destination) * 1.15);
  const baseDuration = mode === 'walking' ? distanceMeters / 1.35 : distanceMeters / 8;

  const safeScore = mockSafetyScore((origin.lat + destination.lat) / 2 - 0.001, (origin.lng + destination.lng) / 2 + 0.0025);
  const directScore = mockSafetyScore((origin.lat + destination.lat) / 2, (origin.lng + destination.lng) / 2);

  const safeRoute: Route = {
    id: 'rt_a',
    summary: 'via 42nd St (detour)',
    polyline: detour,
    encodedPolyline: buildPolyline(detour),
    distanceMeters: Math.round(distanceMeters * 1.08),
    durationSeconds: Math.round(baseDuration * 1.08),
    safetyScore: Math.max(safeScore.safetyScore, 80),
    riskLevel: riskLevelFromScore(Math.max(safeScore.safetyScore, 80)),
    hotspotExposure: 0.4,
    explanation: 'Avoids the high-crime block near 5th Ave; about 3 minutes longer but much safer.',
    avoidedHotspots: MOCK_HOTSPOTS.filter((h) => h.severity >= 4),
    reroutedAroundHeatmap: true,
  };

  const directRoute: Route = {
    id: 'rt_b',
    summary: 'via 5th Ave (direct)',
    polyline: direct,
    encodedPolyline: buildPolyline(direct),
    distanceMeters,
    durationSeconds: Math.round(baseDuration),
    safetyScore: directScore.safetyScore,
    riskLevel: directScore.riskLevel,
    hotspotExposure: 1.6,
    explanation: 'Shortest route, but passes directly through a recent robbery cluster.',
    avoidedHotspots: [],
    reroutedAroundHeatmap: false,
  };

  return [safeRoute, directRoute].sort((a, b) => b.safetyScore - a.safetyScore);
}

const KNOWN_PLACES: Record<string, LatLng> = {
  'grand central station': { lat: 40.7527, lng: -73.9772 },
  'times square': { lat: 40.758, lng: -73.9855 },
};

// Client-side place-name resolution for mock mode only. The real backend
// geocodes internally inside POST /routes/safe — there's no standalone
// /geocode endpoint, so this never runs against the live API.
export function mockResolveLatLng(point: LatLng | string): LatLng {
  if (typeof point !== 'string') return point;
  const hit = KNOWN_PLACES[point.trim().toLowerCase()];
  if (hit) return hit;
  return {
    lat: DEFAULT_LOCATION.lat + (Math.random() - 0.5) * 0.01,
    lng: DEFAULT_LOCATION.lng + (Math.random() - 0.5) * 0.01,
  };
}
