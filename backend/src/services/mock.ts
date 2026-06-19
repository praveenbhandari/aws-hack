import type { Hotspot, LatLng, RiskLevel, RouteCandidate, SafeRoutesResponse, SafetyScoreResponse } from "../types/contract.js";

const SF_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

const MOCK_HOTSPOTS: Hotspot[] = [
  {
    id: "hs-001",
    lat: 37.7849,
    lng: -122.4094,
    category: "ROBBERY",
    severity: 5,
    occurredAt: "2015-04-26T03:03:00Z",
    source: "sfpd",
    weight: 0.82,
  },
  {
    id: "hs-002",
    lat: 37.7785,
    lng: -122.4258,
    category: "ASSAULT",
    severity: 4,
    occurredAt: "2006-09-25T22:15:00Z",
    source: "sfpd",
    weight: 0.71,
  },
  {
    id: "hs-003",
    lat: 37.7928,
    lng: -122.397,
    category: "LARCENY/THEFT",
    severity: 3,
    occurredAt: "2016-06-21T17:27:00Z",
    source: "sfpd",
    weight: 0.45,
  },
];

const MOCK_POLYLINE: LatLng[] = [
  { lat: 37.7955, lng: -122.3937 },
  { lat: 37.793, lng: -122.398 },
  { lat: 37.79, lng: -122.402 },
  { lat: 37.787, lng: -122.406 },
  { lat: 37.7849, lng: -122.4094 },
];

const MOCK_POLYLINE_ALT: LatLng[] = [
  { lat: 37.7955, lng: -122.3937 },
  { lat: 37.797, lng: -122.401 },
  { lat: 37.792, lng: -122.408 },
  { lat: 37.788, lng: -122.412 },
  { lat: 37.7849, lng: -122.4094 },
];

export const mock = {
  health: () => ({ status: "ok" as const, version: "0.1.0", mode: "mock" as const }),

  hotspots(lat: number, lng: number, radius: number) {
    return {
      center: { lat, lng },
      radiusMeters: radius,
      count: MOCK_HOTSPOTS.length,
      hotspots: MOCK_HOTSPOTS,
    };
  },

  safetyScore(lat: number, lng: number, radiusMeters: number): SafetyScoreResponse {
    return {
      lat,
      lng,
      radiusMeters,
      safetyScore: 68,
      riskLevel: "moderate",
      hotspotCount: 3,
      topHotspots: MOCK_HOTSPOTS.slice(0, 3),
      explanation:
        "This area has moderate incident history — mostly thefts and a few assault reports nearby. Stay alert after dark.",
    };
  },

  safeRoutes(): SafeRoutesResponse {
    const routes: RouteCandidate[] = [
      {
        id: "route_0",
        summary: "Embarcadero via Market St",
        polyline: MOCK_POLYLINE,
        encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        distanceMeters: 1420,
        durationSeconds: 1020,
        safetyScore: 78,
        riskLevel: "moderate",
        hotspotExposure: 1.2,
        avoidedHotspots: [MOCK_HOTSPOTS[0]],
        explanation: "This route avoids the densest hotspot cluster near Mission St and scores 78 out of 100 for safety.",
      },
      {
        id: "route_1",
        summary: "Via Folsom St",
        polyline: MOCK_POLYLINE_ALT,
        encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        distanceMeters: 1680,
        durationSeconds: 1200,
        safetyScore: 85,
        riskLevel: "low",
        hotspotExposure: 0.7,
        avoidedHotspots: [MOCK_HOTSPOTS[0], MOCK_HOTSPOTS[1]],
        explanation: "The Folsom St alternative passes fewer high-severity incidents and is the safest option at 85 out of 100.",
      },
    ];
    return {
      origin: { lat: 37.7955, lng: -122.3937, address: "Ferry Building, San Francisco, CA" },
      destination: { lat: 37.7849, lng: -122.4094, address: "Mission Dolores Park area" },
      mode: "walking",
      routes: routes.sort((a, b) => b.safetyScore - a.safetyScore),
    };
  },

  vapiToolResult(toolName: string, toolCallId: string): { result: string; message: string } {
    if (toolName === "get_hotspots") {
      const data = mock.hotspots(SF_CENTER.lat, SF_CENTER.lng, 500);
      return {
        result: JSON.stringify(data),
        message: `Found ${data.count} hotspots within 500 meters.`,
      };
    }
    if (toolName === "score_safety") {
      const data = mock.safetyScore(SF_CENTER.lat, SF_CENTER.lng, 300);
      return {
        result: JSON.stringify(data),
        message: `Safety score is ${data.safetyScore} out of 100 (${data.riskLevel} risk).`,
      };
    }
    const data = mock.safeRoutes();
    return {
      result: JSON.stringify(data),
      message: `Found ${data.routes.length} routes. Safest scores ${data.routes[0].safetyScore} out of 100.`,
    };
  },
};
