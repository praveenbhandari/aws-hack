export type LatLng = { lat: number; lng: number };

export type RiskLevel = "low" | "moderate" | "high" | "very_high";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  category: string;
  severity: 1 | 2 | 3 | 4 | 5;
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

export type HotspotsResponse = {
  center: LatLng;
  radiusMeters: number;
  count: number;
  hotspots: Hotspot[];
};

export type SafetyScoreResponse = {
  lat: number;
  lng: number;
  radiusMeters: number;
  safetyScore: number;
  riskLevel: RiskLevel;
  hotspotCount: number;
  topHotspots: Hotspot[];
  explanation: string;
};

export type LocationInput = string | LatLng;

export type SafeRoutesRequest = {
  origin: LocationInput;
  destination: LocationInput;
  mode?: "walking" | "driving" | "transit";
};

export type ResolvedLocation = LatLng & { address: string | null };

export type SafeRoutesResponse = {
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  mode: string;
  routes: RouteCandidate[];
};

export type VapiToolCall = {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
};

export type VapiToolsRequest = {
  message?: {
    type?: string;
    toolCallList?: VapiToolCall[];
  };
};

export type VapiToolResult = {
  name: string;
  toolCallId: string;
  result?: string;
  error?: string;
};

export type VapiToolsResponse = {
  results: VapiToolResult[];
  message?: { content: string };
};

export type Trip = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  mode: string;
  createdAt: string;
};
