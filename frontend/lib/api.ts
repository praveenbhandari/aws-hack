import {
  mockGeocode,
  mockSafeRoutes,
  mockSafetyScore,
} from '../mocks/data';
import type {
  GeocodeRequest,
  GeocodeResponse,
  HotspotsResponse,
  LatLng,
  SafeRouteRequest,
  SafeRouteResponse,
  SafetyScoreRequest,
  SafetyScoreResponse,
} from '../types/api';

// Flip EXPO_PUBLIC_USE_MOCKS=false once the Companion API is live. Nothing else changes.
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

export async function getHotspots(lat: number, lng: number, radius = 1500): Promise<HotspotsResponse> {
  if (USE_MOCKS) {
    const { MOCK_HOTSPOTS } = await import('../mocks/data');
    return { hotspots: MOCK_HOTSPOTS };
  }
  return get<HotspotsResponse>('/hotspots', { lat, lng, radius });
}

export async function getSafetyScore(req: SafetyScoreRequest): Promise<SafetyScoreResponse> {
  if (USE_MOCKS) {
    return mockSafetyScore(req.lat, req.lng, req.radius);
  }
  return post<SafetyScoreRequest, SafetyScoreResponse>('/safety/score', req);
}

function resolveLatLng(point: LatLng | string): LatLng {
  if (typeof point === 'string') {
    const geo = mockGeocode(point);
    return { lat: geo.lat, lng: geo.lng };
  }
  return point;
}

export async function getSafeRoutes(req: SafeRouteRequest): Promise<SafeRouteResponse> {
  if (USE_MOCKS) {
    const origin = resolveLatLng(req.origin);
    const destination = resolveLatLng(req.destination);
    return { routes: mockSafeRoutes(origin, destination, req.mode) };
  }
  return post<SafeRouteRequest, SafeRouteResponse>('/routes/safe', req);
}

export async function geocode(req: GeocodeRequest): Promise<GeocodeResponse> {
  if (USE_MOCKS) {
    return mockGeocode(req.query);
  }
  return post<GeocodeRequest, GeocodeResponse>('/geocode', req);
}
