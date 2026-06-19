import { Moon, Shield, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchFindNearbyPlace,
  fetchHealth,
  fetchHotspots,
  fetchSafeRoutes,
  getUserLocation,
  placeToRouteCandidate,
  SF_CENTER,
} from "./api/client";
import { MapView } from "./components/MapView";
import { AgentChat } from "./components/AgentChat";
import { PlacesPanel } from "./components/PlacesPanel";
import { LiveStreetViewPanel } from "./components/LiveStreetViewPanel";
import { RouteForm } from "./components/RouteForm";
import { RoutePanel } from "./components/RoutePanel";
import type { Hotspot, LatLng, MapMode, NearbyPlace, RouteCandidate, RoutePreference } from "./types";
import { hotspotQueryForPoints, hotspotLimitForRadius, type HotspotQuery } from "./lib/utils";

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
  const [mapMode, setMapMode] = useState<MapMode>("route");
  const [origin, setOrigin] = useState("Ferry Building, San Francisco");
  const [destination, setDestination] = useState("Mission Dolores Park, San Francisco");
  const [placeType, setPlaceType] = useState("restaurant");
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [resolvedOrigin, setResolvedOrigin] = useState<LatLng | null>(null);
  const [resolvedDest, setResolvedDest] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preference, setPreference] = useState<RoutePreference>("ask");
  const [userChoseAvoid, setUserChoseAvoid] = useState<boolean | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    fetchHealth()
      .then((h) => setApiMode(h.mode))
      .catch(() => setApiMode("offline"));
  }, []);

  const loadHotspots = useCallback(async (query: HotspotQuery) => {
    try {
      const limit = hotspotLimitForRadius(query.radius);
      const data = await fetchHotspots(query.lat, query.lng, query.radius, limit);
      setHotspots(data.hotspots);
    } catch {
      setHotspots([]);
    }
  }, []);

  const planRoute = useCallback(
    async (options?: { avoidHeatmap?: boolean }) => {
      setMapMode("route");
      setNearbyPlaces([]);
      setVoiceSummary(null);
      setSelectedPlaceId(null);
      setRouteLoading(true);
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
        const primary = data.routes[0];
        await loadHotspots(
          hotspotQueryForPoints([
            data.origin,
            data.destination,
            ...(primary?.polyline ?? []),
          ]),
        );
        setSelectedId(pickRoute(data.routes, preference, options?.avoidHeatmap ? true : null));
      } catch (e) {
        setError(apiErrorMessage(e, "Failed to load routes. Is the backend running on :3001?"));
        setRoutes([]);
      } finally {
        setRouteLoading(false);
      }
    },
    [origin, destination, loadHotspots, preference],
  );

  const findNearby = useCallback(async () => {
    setMapMode("nearby");
    setRoutes([]);
    setSelectedId(null);
    setNearbyLoading(true);
    setError(null);
    setVoiceSummary(null);
    setLocationHint(null);
    try {
      const fallback = resolvedOrigin ?? SF_CENTER;
      const loc = await getUserLocation(fallback);
      setResolvedOrigin({ lat: loc.lat, lng: loc.lng });
      setLocationHint(loc.fromGps ? "Using your location" : "Using map center (SF demo area)");
      const data = await fetchFindNearbyPlace(placeType, loc.lat, loc.lng);
      setNearbyPlaces(data.places);
      setVoiceSummary(data.voiceSummary);
      if (!data.places.length) {
        setError(data.voiceSummary || "No nearby places found.");
        setResolvedDest(null);
        return;
      }
      const chosen = data.chosen != null ? data.places[data.chosen] : data.places[0];
      setSelectedPlaceId(chosen.id);
      setResolvedDest({ lat: chosen.latitude, lng: chosen.longitude });
      const route = placeToRouteCandidate(chosen, data.voiceSummary);
      setRoutes([route]);
      setSelectedId(route.id);
      await loadHotspots(
        hotspotQueryForPoints([
          { lat: loc.lat, lng: loc.lng },
          { lat: chosen.latitude, lng: chosen.longitude },
          ...chosen.route.coords,
        ]),
      );
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to find nearby places."));
      setNearbyPlaces([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [placeType, loadHotspots, resolvedOrigin]);

  const selectNearbyPlace = useCallback(
    (placeId: string) => {
      const place = nearbyPlaces.find((p) => p.id === placeId);
      if (!place) return;
      setSelectedPlaceId(placeId);
      setResolvedDest({ lat: place.latitude, lng: place.longitude });
      const route = placeToRouteCandidate(place, voiceSummary ?? undefined);
      setRoutes([route]);
      setSelectedId(route.id);
    },
    [nearbyPlaces, voiceSummary],
  );

  useEffect(() => {
    void planRoute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapMode === "route" && routes.length) {
      setSelectedId(pickRoute(routes, preference, userChoseAvoid));
    }
  }, [preference, userChoseAvoid, routes, mapMode]);

  const showPrompt =
    mapMode === "route" &&
    preference === "ask" &&
    userChoseAvoid === null &&
    routes.length >= 2 &&
    routes[0].safetyScore - routes[routes.length - 1].safetyScore >= 8;


  const onLiveLocation = useCallback((pos: LatLng) => {
    setResolvedOrigin(pos);
  }, []);

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
            mode={mapMode}
            onModeChange={setMapMode}
            origin={origin}
            destination={destination}
            placeType={placeType}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onPlaceTypeChange={setPlaceType}
            onSubmitRoute={() => void planRoute()}
            onSubmitNearby={() => void findNearby()}
            loading={mapMode === "nearby" ? nearbyLoading : routeLoading}
            locationHint={locationHint}
          />
        </div>

        <div className="flex-1 grid lg:grid-cols-[1fr_380px] gap-4 min-h-[480px]">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[400px] lg:min-h-0">
            <MapView
              hotspots={hotspots}
              routes={routes}
              selectedRouteId={selectedId}
              origin={resolvedOrigin}
              destination={resolvedDest}
              nearbyPlaces={nearbyPlaces}
              selectedPlaceId={selectedPlaceId}
            />
          </div>
          <div className="flex flex-col gap-4 min-h-[320px] max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <LiveStreetViewPanel
              destinationLabel={destination}
              onLocation={onLiveLocation}
            />
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-4 flex-1 min-h-[240px]">
            {mapMode === "nearby" ? (
              <PlacesPanel
                places={nearbyPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelect={selectNearbyPlace}
                voiceSummary={voiceSummary}
                loading={nearbyLoading}
                error={error}
              />
            ) : (
              <RoutePanel
                routes={routes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                loading={routeLoading}
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
            )}
            </div>
          </div>
        </div>
      </main>
      <AgentChat
        userLat={resolvedOrigin?.lat}
        userLng={resolvedOrigin?.lng}
      />
    </div>
  );
}
