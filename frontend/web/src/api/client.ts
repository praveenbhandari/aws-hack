import axios from "axios";
import type { FindNearbyPlaceResponse, HotspotsResponse, NearbyPlace, RouteCandidate, SafeRoutesResponse } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

export async function fetchHealth() {
  const { data } = await api.get<{ status: string; mode: string }>("/health");
  return data;
}

const MAP_HOTSPOT_RADIUS = 400;
const MAP_HOTSPOT_LIMIT = 800;

export async function fetchHotspots(
  lat: number,
  lng: number,
  radius = MAP_HOTSPOT_RADIUS,
  limit = MAP_HOTSPOT_LIMIT,
) {
  const { data } = await api.get<HotspotsResponse>("/hotspots", {
    params: { lat, lng, radius, limit },
  });
  return data;
}

export async function fetchSafeRoutes(
  origin: string,
  destination: string,
  mode: "walking" | "driving" = "walking",
  avoidHeatmap = false,
) {
  const { data } = await api.post<SafeRoutesResponse>("/routes/safe", {
    origin,
    destination,
    mode,
    avoidHeatmap,
  });
  return data;
}

export async function fetchFindNearbyPlace(placeType: string, lat: number, lng: number) {
  const { data } = await api.get<FindNearbyPlaceResponse>("/find_nearby_place", {
    params: { type: placeType, lat, lng },
  });
  return data;
}

export function getUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(SF_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(SF_CENTER),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export function placeToRouteCandidate(place: NearbyPlace, explanation?: string): RouteCandidate {
  return {
    id: `place-${place.id}`,
    summary: `Walk to ${place.name}`,
    polyline: place.route.coords,
    encodedPolyline: place.route.encodedPolyline,
    distanceMeters: place.route.distanceMeters,
    durationSeconds: place.route.durationSeconds,
    safetyScore: place.route.safetyScore,
    riskLevel: place.route.riskLevel,
    hotspotExposure: place.route.hotspotExposure,
    avoidedHotspots: [],
    explanation: explanation ?? `Safest nearby option — ${place.route.durationText}, risk score ${place.riskScore}.`,
  };
}

export async function fetchStreetView(lat: number, lng: number) {
  const { data } = await api.get<{
    available: boolean;
    status: string;
    imageUrl: string | null;
  }>("/maps/streetview", { params: { lat, lng } });
  return data;
}
