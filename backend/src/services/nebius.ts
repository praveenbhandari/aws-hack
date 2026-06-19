import OpenAI from "openai";
import { config, hasNebius } from "../config.js";
import type { Hotspot } from "../types/contract.js";
import { templateExplanation } from "./scoring.js";

const explanationCache = new Map<string, string>();

function cacheKey(kind: string, lat: number, lng: number, radius: number): string {
  return `${kind}:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
}

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!hasNebius()) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.nebius.apiKey, baseURL: config.nebius.baseUrl });
  }
  return client;
}

export async function generateExplanation(
  kind: "area" | "route",
  safetyScore: number,
  riskLevel: string,
  topHotspots: Hotspot[],
  lat: number,
  lng: number,
  radiusMeters = 300,
): Promise<string> {
  const key = cacheKey(kind, lat, lng, radiusMeters);
  const cached = explanationCache.get(key);
  if (cached) return cached;

  const fallback = templateExplanation(kind, topHotspots, safetyScore);
  const openai = getClient();
  if (!openai) {
    explanationCache.set(key, fallback);
    return fallback;
  }

  const hotspotSummary = topHotspots
    .slice(0, 5)
    .map((h) => `${h.category} (severity ${h.severity}, weight ${h.weight})`)
    .join("; ");

  try {
    const completion = await openai.chat.completions.create({
      model: config.nebius.model,
      max_tokens: 80,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are Guardian, a calm travel-safety companion for mobility-limited users. Write exactly one short reassuring sentence about route/area safety. Be plain, factual, not alarmist.",
        },
        {
          role: "user",
          content: `Type: ${kind}. Safety score: ${safetyScore}/100 (${riskLevel}). Top incidents: ${hotspotSummary || "none nearby"}.`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim().replace(/\n/g, " ");
    const result = text && text.length > 10 ? text : fallback;
    explanationCache.set(key, result);
    return result;
  } catch (e) {
    console.warn("[nebius] explanation failed:", e);
    explanationCache.set(key, fallback);
    return fallback;
  }
}

export function getOpenAIClient(): OpenAI | null {
  return getClient();
}
