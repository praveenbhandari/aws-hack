import * as Location from 'expo-location';
import {
  getFindNearbyPlace,
  getHotspots,
  getSafeRoutes,
  nearbyPlaceToRoute,
  resolveHere,
} from './api';
import { hotspotLimitForRadius, hotspotQueryForPoints, pickRouteId, SF_CENTER } from './utils';
import { useGuardianStore } from '../store/useGuardianStore';
import type { LatLng, Route } from '../types/api';

export async function resolveCurrentLocation(fallback: LatLng | null): Promise<LatLng> {
  if (fallback) return fallback;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return SF_CENTER;
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

async function loadHotspotsForPoints(points: LatLng[]) {
  const query = hotspotQueryForPoints(points);
  const limit = hotspotLimitForRadius(query.radius);
  const res = await getHotspots(query.lat, query.lng, query.radius, limit);
  useGuardianStore.getState().setHotspots(res.hotspots);
}

function applyRoutes(routes: Route[], preference = useGuardianStore.getState().routePreference) {
  const store = useGuardianStore.getState();
  store.setRoutes(routes);
  const id = pickRouteId(routes, preference);
  store.setSelectedRouteId(id);
  const active = routes.find((r) => r.id === id) ?? routes[0] ?? null;
  store.setActiveRoute(active);
}

export async function planSafeRoute(options?: { avoidHeatmap?: boolean }) {
  const store = useGuardianStore.getState();
  const { originText, destinationText, routePreference, location } = store;
  const avoidHeatmap = options?.avoidHeatmap ?? routePreference === 'safest';

  store.setMapMode('route');
  store.setNearbyPlaces([]);
  store.setVoiceSummary(null);
  store.setSelectedPlaceId(null);
  store.setLoading(true);
  store.setError(null);

  try {
    const current = location ?? (await resolveCurrentLocation(null));
    const data = await getSafeRoutes({
      origin: originText.trim() || resolveHere('here', current),
      destination: destinationText,
      mode: 'walking',
      avoidHeatmap,
      includeNavigationCues: true,
    });
    store.setLocation({ lat: data.origin.lat, lng: data.origin.lng });
    store.setResolvedDestination({ lat: data.destination.lat, lng: data.destination.lng });
    applyRoutes(data.routes, routePreference);
    const active = useGuardianStore.getState().activeRoute;
    await loadHotspotsForPoints([
      data.origin,
      data.destination,
      ...(active?.polyline ?? []),
    ]);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to load routes');
    store.setRoutes([]);
    store.setActiveRoute(null);
  } finally {
    store.setLoading(false);
  }
}

export async function findNearbyPlaces() {
  const store = useGuardianStore.getState();
  const { placeType, location } = store;

  store.setMapMode('nearby');
  store.setRoutes([]);
  store.setActiveRoute(null);
  store.setSelectedRouteId(null);
  store.setLoading(true);
  store.setError(null);
  store.setVoiceSummary(null);

  try {
    const coords = location ?? (await resolveCurrentLocation(null));
    store.setLocation(coords);
    const data = await getFindNearbyPlace(placeType, coords.lat, coords.lng);
    store.setNearbyPlaces(data.places);
    store.setVoiceSummary(data.voiceSummary);
    if (!data.places.length) {
      store.setError(data.voiceSummary || 'No nearby places found.');
      store.setResolvedDestination(null);
      return;
    }
    const chosen = data.chosen != null ? data.places[data.chosen] : data.places[0];
    store.setSelectedPlaceId(chosen.id);
    store.setResolvedDestination({ lat: chosen.latitude, lng: chosen.longitude });
    const route = nearbyPlaceToRoute(chosen, data.voiceSummary);
    store.setRoutes([route]);
    store.setActiveRoute(route);
    store.setSelectedRouteId(route.id);
    await loadHotspotsForPoints([
      coords,
      { lat: chosen.latitude, lng: chosen.longitude },
      ...chosen.route.coords,
    ]);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to find nearby places');
    store.setNearbyPlaces([]);
  } finally {
    store.setLoading(false);
  }
}

export function selectRouteWithHotspots(routeId: string) {
  const store = useGuardianStore.getState();
  store.selectRoute(routeId);
  const route = useGuardianStore.getState().activeRoute;
  const origin = store.location;
  const dest = store.resolvedDestination;
  if (!route || !origin) return;
  void loadHotspotsForPoints([origin, ...(dest ? [dest] : []), ...route.polyline]);
}

export function selectNearbyPlace(placeId: string) {
  const store = useGuardianStore.getState();
  const place = store.nearbyPlaces.find((p) => p.id === placeId);
  if (!place) return;
  store.setSelectedPlaceId(placeId);
  store.setResolvedDestination({ lat: place.latitude, lng: place.longitude });
  const route = nearbyPlaceToRoute(place, store.voiceSummary ?? undefined);
  store.setRoutes([route]);
  store.setActiveRoute(route);
  store.setSelectedRouteId(route.id);
  const origin = store.location;
  if (origin) {
    void loadHotspotsForPoints([
      origin,
      { lat: place.latitude, lng: place.longitude },
      ...place.route.coords,
    ]);
  }
}

export async function applyVoiceSafeRoutes(
  origin: LatLng | string,
  destination: LatLng | string,
  current: LatLng | null,
) {
  const { routes, origin: resolvedOrigin, destination: resolvedDest } = await getSafeRoutes({
    origin: resolveHere(origin, current),
    destination: resolveHere(destination, current),
    mode: 'walking',
    avoidHeatmap: true,
    includeNavigationCues: true,
  });
  const store = useGuardianStore.getState();
  store.setMapMode('route');
  store.setNearbyPlaces([]);
  store.setLocation({ lat: resolvedOrigin.lat, lng: resolvedOrigin.lng });
  store.setResolvedDestination({ lat: resolvedDest.lat, lng: resolvedDest.lng });
  applyRoutes(routes);
  const active = useGuardianStore.getState().activeRoute;
  await loadHotspotsForPoints([resolvedOrigin, resolvedDest, ...(active?.polyline ?? [])]);
}

export async function applyVoiceNearbyPlace(
  placeType: string,
  coords: LatLng,
) {
  const response = await getFindNearbyPlace(placeType, coords.lat, coords.lng);
  const store = useGuardianStore.getState();
  store.setMapMode('nearby');
  store.setNearbyPlaces(response.places);
  store.setVoiceSummary(response.voiceSummary);
  const chosen = response.places[0];
  if (chosen) {
    store.setSelectedPlaceId(chosen.id);
    store.setResolvedDestination({ lat: chosen.latitude, lng: chosen.longitude });
    const route = nearbyPlaceToRoute(chosen, response.voiceSummary);
    store.setRoutes([route]);
    store.setActiveRoute(route);
    store.setSelectedRouteId(route.id);
    await loadHotspotsForPoints([
      coords,
      { lat: chosen.latitude, lng: chosen.longitude },
      ...chosen.route.coords,
    ]);
  }
}
