import "dotenv/config";

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  useMock: envBool("USE_MOCK", true),
  insforge: {
    url: process.env.INSFORGE_URL ?? "",
    anonKey: process.env.INSFORGE_ANON_KEY ?? "",
    apiKey: process.env.INSFORGE_API_KEY ?? "",
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  nebius: {
    apiKey: process.env.NEBIUS_API_KEY ?? "",
    baseUrl: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
    model: process.env.NEBIUS_MODEL ?? "meta-llama/Meta-Llama-3.1-8B-Instruct-fast",
  },
  crimeCsvPath:
    process.env.CRIME_CSV_PATH ??
    "../data/Police_Department_Incident_Reports__Historical_2003_to_May_2018_20260619.csv",
};

export function hasInsforge(): boolean {
  return Boolean(config.insforge.url && (config.insforge.anonKey || config.insforge.apiKey));
}

export function hasGoogleMaps(): boolean {
  return Boolean(config.googleMapsApiKey);
}

export function hasNebius(): boolean {
  return Boolean(config.nebius.apiKey);
}
