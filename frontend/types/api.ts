export type RiskLevel = 'safe' | 'caution' | 'risky' | 'dangerous';

export type LatLng = { lat: number; lng: number };

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  category: string;
  severity: number; // 1..5
  recencyDays: number;
  count: number;
  weight: number; // 0..1, heatmap intensity
};

export type HotspotsResponse = {
  hotspots: Hotspot[];
};

export type SafetyScoreRequest = {
  lat: number;
  lng: number;
  radius?: number;
};

export type SafetyScoreResponse = {
  safetyScore: number; // 0..100, 100 = safest
  riskLevel: RiskLevel;
  explanation: string;
  topHotspots: Hotspot[];
};

export type RouteMode = 'walking' | 'driving' | 'transit' | 'bicycling';

export type SafeRouteRequest = {
  origin: LatLng | string;
  destination: LatLng | string;
  mode: RouteMode;
};

export type Route = {
  id: string;
  summary: string;
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  safetyScore: number;
  riskLevel: RiskLevel;
  explanation: string;
  avoidedHotspots: Hotspot[];
};

export type SafeRouteResponse = {
  routes: Route[];
};

export type GeocodeRequest = {
  query: string;
};

export type GeocodeResponse = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

export function riskLevelFromScore(safetyScore: number): RiskLevel {
  if (safetyScore >= 80) return 'safe';
  if (safetyScore >= 60) return 'caution';
  if (safetyScore >= 40) return 'risky';
  return 'dangerous';
}
