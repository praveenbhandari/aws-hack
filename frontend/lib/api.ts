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

import { GUARDIAN_API_URL } from './config';

// Flip EXPO_PUBLIC_USE_MOCKS=false once the Companion API (backend/guardian) is live.
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';
export const COMPANION_API_BASE_URL =
  process.env.EXPO_PUBLIC_COMPANION_API_BASE_URL ?? GUARDIAN_API_URL;

export type StreetViewDescribe = {
  lat: number;
  lng: number;
  heading: number;
  segment: string;
  streetViewAvailable: boolean;
  status: string;
  description: string;
  imageUrl: string | null;
};

export type AgentChatResponse = {
  reply: string;
  toolCalls?: string[];
};

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

export async function getHotspots(
  lat: number,
  lng: number,
  radius = 1500,
  limit = 2500,
): Promise<HotspotsResponse> {
  if (USE_MOCKS) {
    const { MOCK_HOTSPOTS } = await import('../mocks/data');
    return { center: { lat, lng }, radiusMeters: radius, count: MOCK_HOTSPOTS.length, hotspots: MOCK_HOTSPOTS };
  }
  return get<HotspotsResponse>('/hotspots', { lat, lng, radius, limit });
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
  return post<SafeRouteRequest, SafeRouteResponse>('/routes/safe', {
    mode: 'walking',
    includeNavigationCues: true,
    avoidHeatmap: true,
    ...req,
  });
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

export function nearbyPlaceToRoute(place: NearbyPlace, explanation?: string): Route {
  return {
    id: place.id,
    summary: place.name,
    polyline: place.route.coords,
    encodedPolyline: place.route.polyline,
    distanceMeters: place.route.distanceMeters,
    durationSeconds: place.route.durationSeconds,
    safetyScore: place.route.safetyScore,
    riskLevel: riskLevelFromScore(place.route.safetyScore),
    hotspotExposure: place.route.hotspotExposure,
    avoidedHotspots: [],
    explanation: explanation ?? `Walking route to ${place.name} — ${place.route.durationText}.`,
    reroutedAroundHeatmap: false,
  };
}

export async function getStreetViewDescribe(
  lat: number,
  lng: number,
  heading = 0,
  destinationLabel = 'destination',
): Promise<StreetViewDescribe> {
  return get<StreetViewDescribe>('/maps/streetview/describe', {
    lat,
    lng,
    heading,
    segment: 'along_route',
    origin_label: 'your location',
    destination_label: destinationLabel,
  });
}

export function streetViewImageUrl(lat: number, lng: number, heading: number): string {
  return `${COMPANION_API_BASE_URL}/maps/streetview/image?lat=${lat}&lng=${lng}&heading=${heading}`;
}

export async function getAgentChat(
  message: string,
  userLat?: number,
  userLng?: number,
): Promise<AgentChatResponse> {
  return post<{ message: string; user_lat?: number; user_lng?: number }, AgentChatResponse>(
    '/agent/chat',
    { message, user_lat: userLat, user_lng: userLng },
  );
}

export async function getHealth(): Promise<{ status: string; mode: string; version?: string }> {
  const res = await fetch(`${COMPANION_API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`health failed: ${res.status}`);
  }
  return res.json();
}
