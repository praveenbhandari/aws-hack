import polyline from '@mapbox/polyline';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useGuardianStore } from '../store/useGuardianStore';
import type { NearbyPlace } from '../types/api';

const SEVERITY_COLOR = ['#9bd', '#7fd17f', '#f2c14e', '#f08a4b', '#e5383b'];

const PLACE_ICONS: Record<string, string> = {
  restaurant: '🍽️',
  subway_station: '🚇',
  train_station: '🚂',
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
  const activeRoute = useGuardianStore((s) => s.activeRoute);
  const nearbyPlaces = useGuardianStore((s) => s.nearbyPlaces);

  const heatmapPoints = useMemo(
    () =>
      hotspots.map((h) => ({
        latitude: h.lat,
        longitude: h.lng,
        weight: h.weight,
      })),
    [hotspots]
  );

  const routeCoords = useMemo(() => {
    if (!activeRoute) return [];
    return polyline
      .decode(activeRoute.polyline)
      .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  }, [activeRoute]);

  useEffect(() => {
    if (routeCoords.length > 1) {
      mapRef.current?.fitToCoordinates(routeCoords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [routeCoords]);

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
                : `${h.count} incidents in the last ${h.recencyDays} days`
            }
          />
        );
      })}

      {nearbyPlaces.map((place, index) => {
        const icon = placeIcon(place);
        const chosen = index === 0;
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

      {routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={activeRoute && activeRoute.riskLevel === 'safe' ? '#16a34a' : '#2563eb'}
          strokeWidth={5}
        />
      )}
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
