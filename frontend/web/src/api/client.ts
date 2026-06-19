import axios from "axios";
import type { HotspotsResponse, SafeRoutesResponse } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

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

export async function fetchStreetView(lat: number, lng: number) {
  const { data } = await api.get<{
    available: boolean;
    status: string;
    imageUrl: string | null;
  }>("/maps/streetview", { params: { lat, lng } });
  return data;
}
