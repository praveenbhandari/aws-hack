import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import ExplorePanel from './components/ExplorePanel';
import GuardianMap from './components/GuardianMap';
import SafetyChip from './components/SafetyChip';
import VoicePanel from './components/VoicePanel';
import { getHealth, getHotspots, getSafetyScore } from './lib/api';
import { planSafeRoute } from './lib/useGuardianActions';
import { hotspotLimitForRadius, hotspotQueryForPoints } from './lib/utils';
import { DEFAULT_LOCATION } from './mocks/data';
import { useGuardianStore } from './store/useGuardianStore';

export default function App() {
  const [apiMode, setApiMode] = useState('…');
  const location = useGuardianStore((s) => s.location);
  const setLocation = useGuardianStore((s) => s.setLocation);
  const setHotspots = useGuardianStore((s) => s.setHotspots);
  const setSafety = useGuardianStore((s) => s.setSafety);
  const routes = useGuardianStore((s) => s.routes);

  useEffect(() => {
    getHealth()
      .then((h) => setApiMode(h.mode))
      .catch(() => setApiMode('offline'));
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(DEFAULT_LOCATION);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15 },
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      );
    })();

    return () => subscription?.remove();
  }, [setLocation]);

  useEffect(() => {
    if (!location) return;
    const query = hotspotQueryForPoints([location]);
    const limit = hotspotLimitForRadius(query.radius);
    getHotspots(query.lat, query.lng, query.radius, limit).then((res) => setHotspots(res.hotspots));
    getSafetyScore({ lat: location.lat, lng: location.lng, radiusMeters: 300 }).then(setSafety);
  }, [location, setHotspots, setSafety]);

  useEffect(() => {
    if (location && routes.length === 0) {
      void planSafeRoute();
    }
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Guardian</Text>
          <Text style={styles.subtitle}>API: {apiMode}</Text>
        </View>
        <SafetyChip />
      </View>
      <View style={styles.mapSection}>
        <GuardianMap />
      </View>
      <View style={styles.bottomSection}>
        <ExplorePanel />
        <VoicePanel />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  mapSection: {
    flex: 4,
  },
  bottomSection: {
    flex: 5,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
});
