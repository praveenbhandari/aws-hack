import polyline from '@mapbox/polyline';
import type {
  GeocodeResponse,
  Hotspot,
  LatLng,
  Route,
  RouteMode,
  SafetyScoreResponse,
} from '../types/api';
import { riskLevelFromScore } from '../types/api';

// Demo area: Times Square -> Grand Central, NYC. Swap freely once real data lands.
export const DEFAULT_LOCATION: LatLng = { lat: 40.758, lng: -73.9855 };

export const MOCK_HOTSPOTS: Hotspot[] = [
  { id: 'hs_1', lat: 40.7549, lng: -73.984, category: 'assault', severity: 4, recencyDays: 6, count: 9, weight: 0.85 },
  { id: 'hs_2', lat: 40.7563, lng: -73.9865, category: 'theft', severity: 2, recencyDays: 20, count: 14, weight: 0.55 },
  { id: 'hs_3', lat: 40.7528, lng: -73.9812, category: 'robbery', severity: 5, recencyDays: 3, count: 5, weight: 0.95 },
  { id: 'hs_4', lat: 40.7598, lng: -73.9845, category: 'theft', severity: 1, recencyDays: 30, count: 6, weight: 0.3 },
  { id: 'hs_5', lat: 40.7515, lng: -73.9776, category: 'harassment', severity: 3, recencyDays: 10, count: 8, weight: 0.6 },
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

export function mockSafetyScore(lat: number, lng: number, radius = 800): SafetyScoreResponse {
  const point: LatLng = { lat, lng };
  const nearby = MOCK_HOTSPOTS.filter((h) => haversineMeters(point, h) <= radius);
  const penalty = nearby.reduce((sum, h) => sum + h.weight * h.severity * 4, 0);
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const riskLevel = riskLevelFromScore(safetyScore);

  const explanation =
    nearby.length === 0
      ? 'No recent incidents reported nearby. Looks clear.'
      : `There have been ${nearby.length} recent incident${nearby.length > 1 ? 's' : ''} nearby, including ${nearby[0].category}.`;

  return {
    safetyScore,
    riskLevel,
    explanation,
    topHotspots: nearby
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3),
  };
}

function buildPolyline(points: LatLng[]): string {
  return polyline.encode(points.map((p) => [p.lat, p.lng]));
}

export function mockSafeRoutes(
  origin: LatLng,
  destination: LatLng,
  mode: RouteMode
): Route[] {
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
    polyline: buildPolyline(detour),
    distanceMeters: Math.round(distanceMeters * 1.08),
    durationSeconds: Math.round(baseDuration * 1.08),
    safetyScore: Math.max(safeScore.safetyScore, 80),
    riskLevel: riskLevelFromScore(Math.max(safeScore.safetyScore, 80)),
    explanation: 'Avoids the high-crime block near 5th Ave; about 3 minutes longer but much safer.',
    avoidedHotspots: MOCK_HOTSPOTS.filter((h) => h.severity >= 4),
  };

  const directRoute: Route = {
    id: 'rt_b',
    summary: 'via 5th Ave (direct)',
    polyline: buildPolyline(direct),
    distanceMeters,
    durationSeconds: Math.round(baseDuration),
    safetyScore: directScore.safetyScore,
    riskLevel: directScore.riskLevel,
    explanation: 'Shortest route, but passes directly through a recent robbery cluster.',
    avoidedHotspots: [],
  };

  return [safeRoute, directRoute];
}

export function mockGeocode(query: string): GeocodeResponse {
  const known: Record<string, GeocodeResponse> = {
    'grand central station': { lat: 40.7527, lng: -73.9772, formattedAddress: 'Grand Central Terminal, NY' },
    'times square': { lat: 40.758, lng: -73.9855, formattedAddress: 'Times Square, NY' },
  };
  const hit = known[query.trim().toLowerCase()];
  if (hit) return hit;
  // Fallback: jitter around the default location so unknown queries still resolve.
  return {
    lat: DEFAULT_LOCATION.lat + (Math.random() - 0.5) * 0.01,
    lng: DEFAULT_LOCATION.lng + (Math.random() - 0.5) * 0.01,
    formattedAddress: query,
  };
}
