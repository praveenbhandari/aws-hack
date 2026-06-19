import * as polylineCodec from "@googlemaps/polyline-codec";
import { config, hasGoogleMaps } from "../config.js";
import type { LatLng, ResolvedLocation } from "../types/contract.js";

type TravelMode = "walking" | "driving" | "transit";

const MODE_MAP: Record<TravelMode, string> = {
  walking: "walking",
  driving: "driving",
  transit: "transit",
};

export type GoogleRoute = {
  summary: string;
  encodedPolyline: string;
  polyline: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

function isLatLng(v: unknown): v is LatLng {
  return typeof v === "object" && v !== null && "lat" in v && "lng" in v;
}

export async function resolveLocation(input: string | LatLng): Promise<ResolvedLocation> {
  if (isLatLng(input)) {
    return { lat: input.lat, lng: input.lng, address: null };
  }

  if (!hasGoogleMaps()) {
    // Demo fallback: Ferry Building area
    return { lat: 37.7955, lng: -122.3937, address: String(input) };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", input);
  url.searchParams.set("key", config.googleMapsApiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Geocoding failed for "${input}": ${data.status}`);
  }

  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    address: r.formatted_address,
  };
}

export async function fetchDirections(
  origin: ResolvedLocation,
  destination: ResolvedLocation,
  mode: TravelMode = "walking",
): Promise<GoogleRoute[]> {
  if (!hasGoogleMaps()) {
    return fallbackRoutes(origin, destination);
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", MODE_MAP[mode]);
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("key", config.googleMapsApiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    routes?: {
      summary: string;
      legs: { distance: { value: number }; duration: { value: number } }[];
      overview_polyline: { points: string };
    }[];
  };

  if (data.status !== "OK" || !data.routes?.length) {
    console.warn("[google] directions failed, using fallback:", data.status);
    return fallbackRoutes(origin, destination);
  }

  return data.routes.map((route) => {
    const encoded = route.overview_polyline.points;
    const decoded = polylineCodec.decode(encoded).map(([lat, lng]) => ({ lat, lng }));
    return {
      summary: route.summary,
      encodedPolyline: encoded,
      polyline: decoded,
      distanceMeters: route.legs.reduce((s, l) => s + l.distance.value, 0),
      durationSeconds: route.legs.reduce((s, l) => s + l.duration.value, 0),
    };
  });
}

function fallbackRoutes(origin: ResolvedLocation, destination: ResolvedLocation): GoogleRoute[] {
  const mid1: LatLng = {
    lat: (origin.lat + destination.lat) / 2 + 0.002,
    lng: (origin.lng + destination.lng) / 2 - 0.003,
  };
  const mid2: LatLng = {
    lat: (origin.lat + destination.lat) / 2 - 0.001,
    lng: (origin.lng + destination.lng) / 2 + 0.004,
  };
  const poly1 = [origin, mid1, destination];
  const poly2 = [origin, mid2, destination];

  const enc = (pts: LatLng[]) =>
    pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  return [
    {
      summary: "Direct path (seed)",
      encodedPolyline: enc(poly1),
      polyline: poly1,
      distanceMeters: 1400,
      durationSeconds: 1000,
    },
    {
      summary: "Alternate path (seed)",
      encodedPolyline: enc(poly2),
      polyline: poly2,
      distanceMeters: 1650,
      durationSeconds: 1180,
    },
  ];
}
