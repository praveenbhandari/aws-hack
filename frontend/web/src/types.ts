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

export type NearbyPlaceRoute = {
  summary: string;
  encodedPolyline: string;
  polyline: string;
  coords: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  durationText: string;
  safetyScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  hotspotExposure: number;
};

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  types: string[];
  businessStatus?: string;
  riskScore: number;
  route: NearbyPlaceRoute;
};

export type FindNearbyPlaceResponse = {
  places: NearbyPlace[];
  chosen: number | null;
  voiceSummary: string;
};

export type NavigationCue = {
  segment: string;
  lat: number;
  lng: number;
  heading: number;
  streetViewAvailable: boolean;
  description: string;
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
  reroutedAroundHeatmap?: boolean;
  navigationCues?: NavigationCue[];
  navigationSummary?: string;
};

export type SafeRoutesResponse = {
  origin: LatLng & { address: string | null };
  destination: LatLng & { address: string | null };
  mode: string;
  avoidHeatmap?: boolean;
  routes: RouteCandidate[];
};

export type HotspotsResponse = {
  center: LatLng;
  radiusMeters: number;
  count: number;
  hotspots: Hotspot[];
};

export type RoutePreference = "safest" | "compare" | "fastest";

export type MapMode = "route" | "nearby";
