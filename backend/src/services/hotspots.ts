import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminClient, createClient } from "@insforge/sdk";
import { config, hasInsforge } from "../config.js";
import type { RawHotspot } from "./scoring.js";
import { categoryToSeverity } from "./scoring.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "../../data/seed-hotspots.json");

let seedCache: RawHotspot[] | null = null;

function getInsforgeClient() {
  if (config.insforge.apiKey) {
    return createAdminClient({ baseUrl: config.insforge.url, apiKey: config.insforge.apiKey });
  }
  return createClient({ baseUrl: config.insforge.url, anonKey: config.insforge.anonKey });
}

function loadSeed(): RawHotspot[] {
  if (seedCache) return seedCache;
  if (!existsSync(SEED_PATH)) {
    seedCache = [];
    return seedCache;
  }
  seedCache = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as RawHotspot[];
  return seedCache;
}

function bboxFilter(lat: number, lng: number, radiusM: number, rows: RawHotspot[]): RawHotspot[] {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.cos((lat * Math.PI) / 180));
  return rows.filter(
    (h) =>
      h.lat >= lat - dLat &&
      h.lat <= lat + dLat &&
      h.lng >= lng - dLng &&
      h.lng <= lng + dLng,
  );
}

export async function queryHotspotsNear(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit = 200,
): Promise<RawHotspot[]> {
  if (hasInsforge()) {
    try {
      const client = getInsforgeClient();
      const dLat = radiusMeters / 111_000;
      const dLng = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
      const { data, error } = await client.database
        .from("hotspots")
        .select("id,lat,lng,category,severity,occurred_at,source")
        .gte("lat", lat - dLat)
        .lte("lat", lat + dLat)
        .gte("lng", lng - dLng)
        .lte("lng", lng + dLng)
        .limit(limit);

      if (!error && data?.length) {
        return data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          lat: Number(row.lat),
          lng: Number(row.lng),
          category: String(row.category),
          severity: Number(row.severity) as 1 | 2 | 3 | 4 | 5,
          occurredAt: String(row.occurred_at ?? row.occurredAt),
          source: String(row.source ?? "sfpd"),
        }));
      }
      console.warn("[insforge] hotspots query failed, using seed:", error?.message);
    } catch (e) {
      console.warn("[insforge] hotspots error, using seed:", e);
    }
  }

  const seed = loadSeed();
  return bboxFilter(lat, lng, radiusMeters, seed).slice(0, limit);
}

export async function insertHotspotsBatch(rows: Omit<RawHotspot, "id">[]): Promise<number> {
  if (!hasInsforge()) {
    console.warn("[insforge] not configured — skipping insert");
    return 0;
  }
  const client = getInsforgeClient();
  const payload = rows.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    category: r.category,
    severity: r.severity,
    occurred_at: r.occurredAt,
    source: r.source,
  }));
  const { error } = await client.database.from("hotspots").insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

export { categoryToSeverity, loadSeed };
