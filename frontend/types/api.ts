// Mirrors backend/guardian (FastAPI). See guardian/services/scoring.py + handlers.py —
// this is the real wire shape, not the older API_CONTRACT.md draft.

export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';

export type LatLng = { lat: number; lng: number };

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  category: string; // upper-case, e.g. "ROBBERY"
  severity: number; // 1..5
  occurredAt: string; // ISO timestamp
  source: string;
  weight: number; // 0..1, heatmap intensity
};

export type HotspotsResponse = {
  center: LatLng;
  radiusMeters: number;
  count: number;
  hotspots: Hotspot[];
};

export type SafetyScoreRequest = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export type SafetyScoreResponse = {
  lat: number;
  lng: number;
  radiusMeters: number;
  safetyScore: number; // 0..100, 100 = safest
  riskLevel: RiskLevel;
  hotspotCount: number;
  topHotspots: Hotspot[];
  explanation: string;
};

export type RouteMode = 'walking' | 'driving' | 'transit' | 'bicycling';

export type ResolvedLocation = LatLng & { address?: string | null };

export type SafeRouteRequest = {
  origin: LatLng | string;
  destination: LatLng | string;
  mode?: RouteMode;
  includeNavigationCues?: boolean;
  avoidHeatmap?: boolean;
};

export type NavigationCue = {
  segment: string;
  lat: number;
  lng: number;
  heading: number;
  streetViewAvailable: boolean;
  description: string;
};

export type Route = {
  id: string;
  summary: string;
  polyline: LatLng[]; // decoded points — render directly, no decoding needed
  encodedPolyline: string; // Google encoded polyline, if you need it
  distanceMeters: number;
  durationSeconds: number;
  safetyScore: number;
  riskLevel: RiskLevel;
  hotspotExposure: number;
  avoidedHotspots: Hotspot[];
  explanation: string;
  reroutedAroundHeatmap: boolean;
  navigationCues?: NavigationCue[];
  navigationSummary?: string;
};

export type SafeRouteResponse = {
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  mode: RouteMode;
  avoidHeatmap: boolean;
  routes: Route[];
};

// guardian/services/nearby_places.py — note this sub-shape names polyline/coords
// the OPPOSITE of Route: here `polyline` is the encoded string and `coords` is
// the decoded points array. Convert via nearbyPlaceToRoute() in lib/api.ts.
export type NearbyPlaceRoute = {
  summary: string;
  polyline: string;
  encodedPolyline: string;
  coords: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  durationText: string;
  safetyScore: number;
  riskScore: number;
  riskLevel: string;
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

export function riskLevelFromScore(safetyScore: number): RiskLevel {
  if (safetyScore >= 75) return 'low';
  if (safetyScore >= 50) return 'moderate';
  if (safetyScore >= 25) return 'high';
  return 'very_high';
}
