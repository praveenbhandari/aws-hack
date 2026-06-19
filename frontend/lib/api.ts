import { mockResolveLatLng, mockSafeRoutes, mockSafetyScore } from '../mocks/data';
import type {
  FindNearbyPlaceResponse,
  HotspotsResponse,
  LatLng,
  NearbyPlace,
  Route,
  SafeRouteRequest,
  SafeRouteResponse,
  SafetyScoreRequest,
  SafetyScoreResponse,
} from '../types/api';
import { riskLevelFromScore } from '../types/api';

// Flip EXPO_PUBLIC_USE_MOCKS=false once the Companion API (backend/guardian) is live.
// Nothing else in the app changes.
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';
export const COMPANION_API_BASE_URL =
  process.env.EXPO_PUBLIC_COMPANION_API_BASE_URL ?? 'http://localhost:3001';

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(`${COMPANION_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function get<TResponse>(path: string, params: Record<string, string | number>): Promise<TResponse> {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString();
  const res = await fetch(`${COMPANION_API_BASE_URL}${path}?${query}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getHotspots(lat: number, lng: number, radius = 400): Promise<HotspotsResponse> {
  if (USE_MOCKS) {
    const { MOCK_HOTSPOTS } = await import('../mocks/data');
    return { center: { lat, lng }, radiusMeters: radius, count: MOCK_HOTSPOTS.length, hotspots: MOCK_HOTSPOTS };
  }
  return get<HotspotsResponse>('/hotspots', { lat, lng, radius });
}

export async function getSafetyScore(req: SafetyScoreRequest): Promise<SafetyScoreResponse> {
  if (USE_MOCKS) {
    return mockSafetyScore(req.lat, req.lng, req.radiusMeters);
  }
  return post<SafetyScoreRequest, SafetyScoreResponse>('/safety/score', req);
}

export async function getSafeRoutes(req: SafeRouteRequest): Promise<SafeRouteResponse> {
  if (USE_MOCKS) {
    const origin = mockResolveLatLng(req.origin);
    const destination = mockResolveLatLng(req.destination);
    return {
      origin,
      destination,
      mode: req.mode ?? 'walking',
      avoidHeatmap: req.avoidHeatmap ?? false,
      routes: mockSafeRoutes(origin, destination, req.mode),
    };
  }
  return post<SafeRouteRequest, SafeRouteResponse>('/routes/safe', req);
}

export function resolveHere(point: LatLng | string, current: LatLng | null): LatLng | string {
  if (typeof point === 'string' && point.trim().toLowerCase() === 'here' && current) {
    return current;
  }
  return point;
}

export async function getFindNearbyPlace(
  placeType: string,
  lat: number,
  lng: number,
): Promise<FindNearbyPlaceResponse> {
  return get<FindNearbyPlaceResponse>('/find_nearby_place', {
    type: placeType,
    lat,
    lng,
  });
}

export function nearbyPlaceToRoute(place: NearbyPlace): Route {
  return {
    id: place.id,
    summary: place.name,
    // NearbyPlaceRoute names these the opposite of Route — see types/api.ts.
    polyline: place.route.coords,
    encodedPolyline: place.route.polyline,
    distanceMeters: place.route.distanceMeters,
    durationSeconds: place.route.durationSeconds,
    safetyScore: place.route.safetyScore,
    riskLevel: riskLevelFromScore(place.route.safetyScore),
    hotspotExposure: place.route.hotspotExposure,
    avoidedHotspots: [],
    explanation: `Walking route to ${place.name} — ${place.route.durationText}.`,
    reroutedAroundHeatmap: false,
  };
}
