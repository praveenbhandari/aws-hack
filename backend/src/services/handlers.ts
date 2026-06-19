import { config } from "../config.js";
import { mock } from "./mock.js";
import { queryHotspotsNear } from "./hotspots.js";
import { fetchDirections, resolveLocation } from "./googleMaps.js";
import { generateExplanation } from "./nebius.js";
import {
  areaRiskToSafetyScore,
  computeWeight,
  routeExposureToSafetyScore,
  samplePolyline,
  scoreToRiskLevel,
  withWeights,
} from "./scoring.js";
import type {
  HotspotsResponse,
  RouteCandidate,
  SafeRoutesRequest,
  SafeRoutesResponse,
  SafetyScoreResponse,
} from "../types/contract.js";

export async function getHotspots(lat: number, lng: number, radius: number): Promise<HotspotsResponse> {
  if (config.useMock) return mock.hotspots(lat, lng, radius);

  const raw = await queryHotspotsNear(lat, lng, radius);
  const hotspots = withWeights(raw, { lat, lng }, radius);
  return { center: { lat, lng }, radiusMeters: radius, count: hotspots.length, hotspots };
}

export async function scoreSafety(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<SafetyScoreResponse> {
  if (config.useMock) return mock.safetyScore(lat, lng, radiusMeters);

  const raw = await queryHotspotsNear(lat, lng, radiusMeters);
  const hotspots = withWeights(raw, { lat, lng }, radiusMeters);
  const totalRisk = hotspots.reduce((s, h) => s + h.weight, 0);
  const safetyScore = areaRiskToSafetyScore(totalRisk);
  const riskLevel = scoreToRiskLevel(safetyScore);
  const topHotspots = hotspots.slice(0, 5);
  const explanation = await generateExplanation(
    "area",
    safetyScore,
    riskLevel,
    topHotspots,
    lat,
    lng,
    radiusMeters,
  );

  return {
    lat,
    lng,
    radiusMeters,
    safetyScore,
    riskLevel,
    hotspotCount: hotspots.length,
    topHotspots,
    explanation,
  };
}

export async function planSafeRoutes(body: SafeRoutesRequest): Promise<SafeRoutesResponse> {
  if (config.useMock) return mock.safeRoutes();

  const mode = body.mode ?? "walking";
  const origin = await resolveLocation(body.origin);
  const destination = await resolveLocation(body.destination);
  const googleRoutes = await fetchDirections(origin, destination, mode);

  const allRaw = await queryHotspotsNear(
    (origin.lat + destination.lat) / 2,
    (origin.lng + destination.lng) / 2,
    800,
    500,
  );

  const scored: RouteCandidate[] = [];

  for (let i = 0; i < googleRoutes.length; i++) {
    const gr = googleRoutes[i];
    const samples = samplePolyline(gr.polyline, 40);
    let exposure = 0;
    const nearHotspots: typeof allRaw = [];

    for (const pt of samples) {
      for (const h of allRaw) {
        const w = computeWeight(h, pt, 80);
        if (w > 0.05) {
          exposure += w;
          if (!nearHotspots.find((x) => x.id === h.id)) nearHotspots.push(h);
        }
      }
    }

    const weighted = withWeights(nearHotspots, samples[0] ?? origin, 200);
    const safetyScore = routeExposureToSafetyScore(exposure);
    const riskLevel = scoreToRiskLevel(safetyScore);
    const top = weighted.slice(0, 5);
    const avoided = weighted.filter((h) => h.weight >= 0.4 && h.severity >= 4).slice(0, 3);

    const explanation = await generateExplanation(
      "route",
      safetyScore,
      riskLevel,
      top,
      samples[0]?.lat ?? origin.lat,
      samples[0]?.lng ?? origin.lng,
      200,
    );

    scored.push({
      id: `route_${i}`,
      summary: gr.summary,
      polyline: gr.polyline,
      encodedPolyline: gr.encodedPolyline,
      distanceMeters: gr.distanceMeters,
      durationSeconds: gr.durationSeconds,
      safetyScore,
      riskLevel,
      hotspotExposure: Math.round(exposure * 100) / 100,
      avoidedHotspots: avoided,
      explanation,
    });
  }

  scored.sort((a, b) => b.safetyScore - a.safetyScore);

  return { origin, destination, mode, routes: scored };
}
