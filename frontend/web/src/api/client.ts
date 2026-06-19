import axios, { isAxiosError } from "axios";
import type { FindNearbyPlaceResponse, HotspotsResponse, NearbyPlace, RouteCandidate, SafeRoutesResponse } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 45_000,
});

export const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

export function apiErrorMessage(e: unknown, fallback = "Request failed"): string {
  if (isAxiosError(e)) {
    const detail = e.response?.data?.detail;
    if (typeof detail === "string") {
      if (detail.includes("403") || detail.includes("API_KEY_SERVICE_BLOCKED")) {
        return "Places API blocked — enable Places API (New) in Google Cloud Console.";
      }
      if (detail.length > 120) return detail.slice(0, 120) + "…";
      return detail;
    }
    if (e.code === "ECONNABORTED") return "Request timed out — is the backend running on :3001?";
    if (e.response?.status === 502) return "Backend error — check Places API (New) is enabled.";
    return e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

export async function fetchHealth() {
  const { data } = await api.get<{ status: string; mode: string }>("/health");
  return data;
}

const MAP_HOTSPOT_LIMIT_MAX = 5000;

export async function fetchHotspots(
  lat: number,
  lng: number,
  radius = 1500,
  limit = MAP_HOTSPOT_LIMIT_MAX,
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

export function getUserLocation(fallback = SF_CENTER): Promise<{ lat: number; lng: number; fromGps: boolean }> {
  if (!navigator.geolocation) {
    return Promise.resolve({ ...fallback, fromGps: false });
  }

  return Promise.race([
    new Promise<{ lat: number; lng: number; fromGps: boolean }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            fromGps: true,
          }),
        () => resolve({ ...fallback, fromGps: false }),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 120_000 },
      );
    }),
    new Promise<{ lat: number; lng: number; fromGps: boolean }>((resolve) => {
      setTimeout(() => resolve({ ...fallback, fromGps: false }), 4500);
    }),
  ]);
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
