import axios from "axios";
import type { HotspotsResponse, SafeRoutesResponse } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

export async function fetchHealth() {
  const { data } = await api.get<{ status: string; mode: string }>("/health");
  return data;
}

export async function fetchHotspots(lat: number, lng: number, radius = 600) {
  const { data } = await api.get<HotspotsResponse>("/hotspots", {
    params: { lat, lng, radius },
  });
  return data;
}

export async function fetchSafeRoutes(
  origin: string,
  destination: string,
  mode: "walking" | "driving" = "walking",
) {
  const { data } = await api.post<SafeRoutesResponse>("/routes/safe", {
    origin,
    destination,
    mode,
  });
  return data;
}
