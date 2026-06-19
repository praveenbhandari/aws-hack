import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useGuardianStore } from '../store/useGuardianStore';
import type { NearbyPlace, Route } from '../types/api';

const SEVERITY_COLOR = ['#9bd', '#7fd17f', '#f2c14e', '#f08a4b', '#e5383b'];
const ROUTE_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b'];

const PLACE_ICONS: Record<string, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  bar: '🍺',
  hospital: '🏥',
  pharmacy: '💊',
  lodging: '🏨',
  default: '📍',
};

function placeIcon(place: NearbyPlace): string {
  for (const t of place.types) {
    if (PLACE_ICONS[t]) return PLACE_ICONS[t];
  }
  return PLACE_ICONS.default;
}

export default function GuardianMap() {
  const mapRef = useRef<MapView>(null);
  const location = useGuardianStore((s) => s.location);
  const hotspots = useGuardianStore((s) => s.hotspots);
  const routes = useGuardianStore((s) => s.routes);
  const selectedRouteId = useGuardianStore((s) => s.selectedRouteId);
  const activeRoute = useGuardianStore((s) => s.activeRoute);
  const nearbyPlaces = useGuardianStore((s) => s.nearbyPlaces);
  const selectedPlaceId = useGuardianStore((s) => s.selectedPlaceId);
  const resolvedDestination = useGuardianStore((s) => s.resolvedDestination);
  const mapMode = useGuardianStore((s) => s.mapMode);

  const heatmapPoints = useMemo(
    () =>
      hotspots.map((h) => ({
        latitude: h.lat,
        longitude: h.lng,
        weight: h.weight,
      })),
    [hotspots],
  );

  const displayRoutes: Route[] = useMemo(() => {
    if (mapMode === 'nearby' && activeRoute) return [activeRoute];
    return routes;
  }, [mapMode, routes, activeRoute]);

  const fitCoords = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (location) coords.push({ latitude: location.lat, longitude: location.lng });
    if (resolvedDestination) {
      coords.push({ latitude: resolvedDestination.lat, longitude: resolvedDestination.lng });
    }
    for (const route of displayRoutes) {
      for (const p of route.polyline) {
        coords.push({ latitude: p.lat, longitude: p.lng });
      }
    }
    return coords;
  }, [location, resolvedDestination, displayRoutes]);

  useEffect(() => {
    if (fitCoords.length > 1) {
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    }
  }, [fitCoords]);

  if (!location) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Finding your location…</Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      showsUserLocation
      showsMyLocationButton
    >
      {heatmapPoints.length > 0 && (
        <Heatmap
          points={heatmapPoints}
          radius={40}
          opacity={0.7}
          gradient={{
            colorMapSize: 256,
            colors: ['#34d399', '#fbbf24', '#f97316', '#dc2626'],
            startPoints: [0.1, 0.4, 0.7, 1],
          }}
        />
      )}

      {hotspots.map((h) => {
        const avoided = activeRoute?.avoidedHotspots.some((a) => a.id === h.id);
        return (
          <Marker
            key={h.id}
            coordinate={{ latitude: h.lat, longitude: h.lng }}
            pinColor={avoided ? '#10b981' : SEVERITY_COLOR[Math.min(h.severity, 5) - 1]}
            title={`${h.category} (severity ${h.severity})`}
            description={
              avoided
                ? 'Avoided by the current safe route'
                : `Reported ${new Date(h.occurredAt).toLocaleDateString()}`
            }
          />
        );
      })}

      {resolvedDestination && (
        <Marker
          coordinate={{
            latitude: resolvedDestination.lat,
            longitude: resolvedDestination.lng,
          }}
          pinColor="#ef4444"
          title="Destination"
        />
      )}

      {nearbyPlaces.map((place) => {
        const icon = placeIcon(place);
        const chosen = place.id === selectedPlaceId;
        return (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description={`${place.address} · Risk: ${place.riskScore}`}
          >
            <View style={[styles.markerContainer, chosen ? styles.markerChosen : styles.markerOther]}>
              <Text style={styles.markerEmoji}>{icon}</Text>
              {place.rating != null && (
                <Text style={styles.markerRating}>★ {place.rating}</Text>
              )}
            </View>
          </Marker>
        );
      })}

      {displayRoutes.map((route, index) => {
        const selected = route.id === selectedRouteId;
        const coords = route.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng }));
        if (coords.length < 2) return null;
        return (
          <Polyline
            key={route.id}
            coordinates={coords}
            strokeColor={
              selected
                ? route.riskLevel === 'low'
                  ? '#16a34a'
                  : '#2563eb'
                : ROUTE_COLORS[index % ROUTE_COLORS.length]
            }
            strokeWidth={selected ? 5 : 3}
            lineDashPattern={selected ? undefined : [8, 6]}
            zIndex={selected ? 2 : 1}
          />
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#e2e8f0',
  },
  markerContainer: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markerChosen: {
    borderColor: '#22c55e',
  },
  markerOther: {
    borderColor: '#94a3b8',
  },
  markerEmoji: {
    fontSize: 18,
  },
  markerRating: {
    color: '#fbbf24',
    fontSize: 10,
    marginTop: 2,
  },
});
