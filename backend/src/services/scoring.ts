/** Map raw SFPD categories → severity 1–5 (5 = most severe for pedestrians). */

const CATEGORY_SEVERITY: Record<string, 1 | 2 | 3 | 4 | 5> = {
  HOMICIDE: 5,
  KIDNAPPING: 5,
  "SEX OFFENSES": 5,
  ROBBERY: 5,
  ASSAULT: 4,
  ARSON: 4,
  "WEAPON LAWS": 4,
  EXTORTION: 4,
  BURGLARY: 3,
  "VEHICLE THEFT": 3,
  "LARCENY/THEFT": 3,
  VANDALISM: 2,
  TRESPASS: 2,
  "DISORDERLY CONDUCT": 2,
  "DRUG OFFENSE": 2,
  FRAUD: 2,
  "OTHER OFFENSES": 2,
  SUSPICIOUS: 2,
  PROSTITUTION: 2,
  "NON-CRIMINAL": 1,
  "MISSING PERSON": 1,
  WARRANTS: 1,
  "TRAFFIC CITATION": 1,
  "TRAFFIC VIOLATION ARREST": 1,
};

export function categoryToSeverity(category: string): 1 | 2 | 3 | 4 | 5 {
  return CATEGORY_SEVERITY[category.toUpperCase().trim()] ?? 2;
}

/** Days since incident → 0..1 multiplier (recent = higher). */
export function recencyDecay(occurredAt: string, now = Date.now()): number {
  const then = new Date(occurredAt).getTime();
  if (Number.isNaN(then)) return 0.3;
  const days = Math.max(0, (now - then) / 86_400_000);
  // Half-life ~3 years for demo data that's mostly historical
  return Math.exp(-days / 1095);
}

/** Distance in meters → 0..1 (closer = higher). */
export function proximityDecay(distanceMeters: number, radiusMeters: number): number {
  if (distanceMeters >= radiusMeters) return 0;
  return 1 - distanceMeters / radiusMeters;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

import type { Hotspot, LatLng, RiskLevel } from "../types/contract.js";

export type RawHotspot = Omit<Hotspot, "weight">;

export function computeWeight(
  hotspot: RawHotspot,
  center: LatLng,
  radiusMeters: number,
): number {
  const dist = haversineM(center, { lat: hotspot.lat, lng: hotspot.lng });
  const prox = proximityDecay(dist, radiusMeters);
  const rec = recencyDecay(hotspot.occurredAt);
  const sev = hotspot.severity / 5;
  return Math.min(1, sev * rec * prox);
}

const MAX_AREA_RISK = 15;
const MAX_ROUTE_EXPOSURE = 25;

export function areaRiskToSafetyScore(totalWeight: number): number {
  const normalized = Math.min(totalWeight / MAX_AREA_RISK, 1);
  return Math.round(Math.max(0, Math.min(100, 100 - normalized * 100)));
}

export function routeExposureToSafetyScore(exposure: number): number {
  const normalized = Math.min(exposure / MAX_ROUTE_EXPOSURE, 1);
  return Math.round(Math.max(0, Math.min(100, 100 - normalized * 100)));
}

export function scoreToRiskLevel(safetyScore: number): RiskLevel {
  if (safetyScore >= 75) return "low";
  if (safetyScore >= 50) return "moderate";
  if (safetyScore >= 25) return "high";
  return "very_high";
}

export function withWeights(hotspots: RawHotspot[], center: LatLng, radiusMeters: number): Hotspot[] {
  return hotspots
    .map((h) => ({ ...h, weight: Math.round(computeWeight(h, center, radiusMeters) * 1000) / 1000 }))
    .filter((h) => h.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

export function samplePolyline(points: LatLng[], spacingM = 40): LatLng[] {
  if (points.length < 2) return points;
  const out: LatLng[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = haversineM(a, b);
    if (dist < 1) continue;
    const steps = Math.max(1, Math.floor((carry + dist) / spacingM));
    for (let s = 1; s <= steps; s++) {
      const t = Math.min(1, (s * spacingM - carry) / dist);
      if (t <= 1) {
        out.push({ lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) });
      }
    }
    carry = Math.max(0, carry + dist - steps * spacingM);
  }
  if (out[out.length - 1].lat !== points[points.length - 1].lat) {
    out.push(points[points.length - 1]);
  }
  return out;
}

export function templateExplanation(
  kind: "area" | "route",
  top: Hotspot[],
  safetyScore: number,
): string {
  if (top.length === 0) {
    return kind === "route"
      ? `This route scores ${safetyScore} out of 100 — very few incidents reported along the path.`
      : `This area scores ${safetyScore} out of 100 — relatively quiet based on historical reports.`;
  }
  const cats = [...new Set(top.slice(0, 3).map((h) => h.category.toLowerCase()))].join(", ");
  return kind === "route"
    ? `This route scores ${safetyScore} out of 100. Main concerns nearby include ${cats} — consider the safer alternative if available.`
    : `This area scores ${safetyScore} out of 100 with nearby reports of ${cats}. Stay aware of your surroundings.`;
}
