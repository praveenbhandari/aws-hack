import polyline from '@mapbox/polyline';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useGuardianStore } from '../store/useGuardianStore';

const SEVERITY_COLOR = ['#9bd', '#7fd17f', '#f2c14e', '#f08a4b', '#e5383b'];

export default function GuardianMap() {
  const mapRef = useRef<MapView>(null);
  const location = useGuardianStore((s) => s.location);
  const hotspots = useGuardianStore((s) => s.hotspots);
  const activeRoute = useGuardianStore((s) => s.activeRoute);

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
});
