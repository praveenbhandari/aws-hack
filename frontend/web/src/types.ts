export type LatLng = { lat: number; lng: number };

export type RiskLevel = "low" | "moderate" | "high" | "very_high";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  category: string;
  severity: number;
  occurredAt: string;
  source: string;
  weight: number;
};

export type RouteCandidate = {
  id: string;
  summary: string;
  polyline: LatLng[];
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  safetyScore: number;
  riskLevel: RiskLevel;
  hotspotExposure: number;
  avoidedHotspots: Hotspot[];
  explanation: string;
};

export type SafeRoutesResponse = {
  origin: LatLng & { address: string | null };
  destination: LatLng & { address: string | null };
  mode: string;
  routes: RouteCandidate[];
};

export type HotspotsResponse = {
  center: LatLng;
  radiusMeters: number;
  count: number;
  hotspots: Hotspot[];
};

export type RoutePreference = "ask" | "avoid" | "fastest";
