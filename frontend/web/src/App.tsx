import { Moon, Shield, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchHealth, fetchHotspots, fetchSafeRoutes } from "./api/client";
import { MapView } from "./components/MapView";
import { RouteForm } from "./components/RouteForm";
import { RoutePanel } from "./components/RoutePanel";
import type { Hotspot, LatLng, RouteCandidate, RoutePreference } from "./types";

function pickRoute(routes: RouteCandidate[], preference: RoutePreference, userChoseAvoid: boolean | null) {
  if (!routes.length) return null;
  if (preference === "avoid" || userChoseAvoid === true) return routes[0].id;
  if (preference === "fastest" || userChoseAvoid === false) {
    return [...routes].sort((a, b) => a.distanceMeters - b.distanceMeters)[0].id;
  }
  return routes[0].id;
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [apiMode, setApiMode] = useState("…");
  const [origin, setOrigin] = useState("Ferry Building, San Francisco");
  const [destination, setDestination] = useState("Mission Dolores Park, San Francisco");
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [resolvedOrigin, setResolvedOrigin] = useState<LatLng | null>(null);
  const [resolvedDest, setResolvedDest] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preference, setPreference] = useState<RoutePreference>("ask");
  const [userChoseAvoid, setUserChoseAvoid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    fetchHealth()
      .then((h) => setApiMode(h.mode))
      .catch(() => setApiMode("offline"));
  }, []);

  const loadHotspots = useCallback(async (center: LatLng) => {
    try {
      const data = await fetchHotspots(center.lat, center.lng);
      setHotspots(data.hotspots);
    } catch {
      setHotspots([]);
    }
  }, []);

  const planRoute = useCallback(
    async (options?: { avoidHeatmap?: boolean }) => {
      setLoading(true);
      setError(null);
      const avoidHeatmap = options?.avoidHeatmap ?? preference === "avoid";
      if (options?.avoidHeatmap === undefined) {
        setUserChoseAvoid(null);
      }
      try {
        const data = await fetchSafeRoutes(origin, destination, "walking", avoidHeatmap);
        setRoutes(data.routes);
        setResolvedOrigin(data.origin);
        setResolvedDest(data.destination);
        const center = {
          lat: (data.origin.lat + data.destination.lat) / 2,
          lng: (data.origin.lng + data.destination.lng) / 2,
        };
        await loadHotspots(center);
        setSelectedId(pickRoute(data.routes, preference, options?.avoidHeatmap ? true : null));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load routes. Is the backend running on :3001?");
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    },
    [origin, destination, loadHotspots, preference],
  );

  useEffect(() => {
    void planRoute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (routes.length) {
      setSelectedId(pickRoute(routes, preference, userChoseAvoid));
    }
  }, [preference, userChoseAvoid, routes]);

  const showPrompt =
    preference === "ask" &&
    userChoseAvoid === null &&
    routes.length >= 2 &&
    routes[0].safetyScore - routes[routes.length - 1].safetyScore >= 8;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Guardian</h1>
              <p className="text-xs text-zinc-500">Safe routes for everyone · API: {apiMode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-300"
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 flex flex-col gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-4">
          <RouteForm
            origin={origin}
            destination={destination}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onSubmit={planRoute}
            loading={loading}
          />
        </div>

        <div className="flex-1 grid lg:grid-cols-[1fr_340px] gap-4 min-h-[480px]">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[400px] lg:min-h-0">
            <MapView
              hotspots={hotspots}
              routes={routes}
              selectedRouteId={selectedId}
              origin={resolvedOrigin}
              destination={resolvedDest}
            />
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-4 min-h-[320px]">
            <RoutePanel
              routes={routes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={loading}
              error={error}
              preference={preference}
              onPreferenceChange={(p) => {
                setPreference(p);
                setUserChoseAvoid(null);
                if (p === "avoid") void planRoute({ avoidHeatmap: true });
                if (p === "fastest") void planRoute({ avoidHeatmap: false });
              }}
              showPrompt={showPrompt}
              onConfirmPreference={(avoid) => {
                setUserChoseAvoid(avoid);
                if (avoid) void planRoute({ avoidHeatmap: true });
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
