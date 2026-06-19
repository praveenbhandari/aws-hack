import * as Location from 'expo-location';
import { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import GuardianMap from './components/GuardianMap';
import SafetyChip from './components/SafetyChip';
import VoicePanel from './components/VoicePanel';
import { getHotspots, getSafetyScore } from './lib/api';
import { DEFAULT_LOCATION } from './mocks/data';
import { useGuardianStore } from './store/useGuardianStore';

export default function App() {
  const location = useGuardianStore((s) => s.location);
  const setLocation = useGuardianStore((s) => s.setLocation);
  const setHotspots = useGuardianStore((s) => s.setHotspots);
  const setSafety = useGuardianStore((s) => s.setSafety);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(DEFAULT_LOCATION);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    })();
  }, [setLocation]);

  useEffect(() => {
    if (!location) return;
    getHotspots(location.lat, location.lng).then((res) => setHotspots(res.hotspots));
    getSafetyScore({ lat: location.lat, lng: location.lng }).then(setSafety);
  }, [location, setHotspots, setSafety]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Guardian</Text>
        <SafetyChip />
      </View>
      <View style={styles.mapSection}>
        <GuardianMap />
      </View>
      <View style={styles.voiceSection}>
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
    paddingVertical: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  mapSection: {
    flex: 6,
  },
  voiceSection: {
    flex: 4,
  },
});
