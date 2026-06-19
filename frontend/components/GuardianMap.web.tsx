import { StyleSheet, Text, View } from 'react-native';
import { useGuardianStore } from '../store/useGuardianStore';

// react-native-maps has no usable web target (Marker/Heatmap/Polyline rely on
// native codegen specs that crash the web bundle). This stub keeps `expo start
// --web` usable for previewing the rest of the UI; the real map only renders
// on iOS/Android via GuardianMap.tsx.
export default function GuardianMap() {
  const hotspots = useGuardianStore((s) => s.hotspots);
  const activeRoute = useGuardianStore((s) => s.activeRoute);

  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Map preview unavailable on web</Text>
      <Text style={styles.subtitle}>
        react-native-maps requires a native build (iOS/Android dev client).
      </Text>
      <Text style={styles.meta}>{hotspots.length} hotspots loaded</Text>
      {activeRoute && <Text style={styles.meta}>Active route: {activeRoute.summary}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
});
