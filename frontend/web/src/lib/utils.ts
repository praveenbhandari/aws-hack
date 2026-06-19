import type { RiskLevel } from "../types";

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "#22c55e";
    case "moderate":
      return "#f59e0b";
    case "high":
      return "#f97316";
    case "very_high":
      return "#ef4444";
    default:
      return "#71717a";
  }
}

export function riskLabel(level: RiskLevel): string {
  return level.replace("_", " ");
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function hotspotRadius(weight: number, severity: number): number {
  return 3 + weight * 10 + severity * 1.2;
}

export function hotspotFill(weight: number, severity: number): string {
  const t = Math.min(1, weight * 0.8 + severity / 12);
  if (t > 0.55) return "#ef4444";
  if (t > 0.3) return "#f97316";
  if (t > 0.12) return "#f59e0b";
  return "#facc15";
}
