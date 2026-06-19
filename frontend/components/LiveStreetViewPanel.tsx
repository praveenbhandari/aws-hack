import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COMPANION_API_BASE_URL, getStreetViewDescribe, streetViewImageUrl } from '../lib/api';
import { useGuardianStore } from '../store/useGuardianStore';

const REFRESH_MS = 20_000;

export default function LiveStreetViewPanel() {
  const location = useGuardianStore((s) => s.location);
  const destinationText = useGuardianStore((s) => s.destinationText);
  const [active, setActive] = useState(true);
  const [heading, setHeading] = useState(0);
  const [description, setDescription] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);
  const inFlight = useRef(false);
  const headingRef = useRef(0);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  const refresh = useCallback(async () => {
    if (!location || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await getStreetViewDescribe(
        location.lat,
        location.lng,
        headingRef.current,
        destinationText,
      );
      setDescription(data.description);
      const url =
        data.streetViewAvailable && data.imageUrl
          ? `${COMPANION_API_BASE_URL}${data.imageUrl}`
          : streetViewImageUrl(data.lat, data.lng, data.heading);
      setImageUrl(url);
      setSecondsLeft(REFRESH_MS / 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Street View failed');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [location, destinationText]);

  useEffect(() => {
    if (!active || !location) return;
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [active, location, refresh]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (pos) => {
          if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) {
            setHeading(pos.coords.heading);
            headingRef.current = pos.coords.heading;
          }
        },
      );
    })();
    return () => sub?.remove();
  }, [active]);

  if (!location) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>Waiting for GPS…</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Live Street View</Text>
          <Text style={styles.subtitle}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)} · heading {Math.round(heading)}°
            {active ? ` · next in ${secondsLeft}s` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => void refresh()} style={styles.iconBtn} disabled={loading}>
            <Text style={styles.iconBtnText}>{loading ? '…' : '↻'}</Text>
          </Pressable>
          <Pressable onPress={() => setActive((a) => !a)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>{active ? '⏸' : '▶'}</Text>
          </Pressable>
        </View>
      </View>

      {!active && <Text style={styles.muted}>Paused — tap play to resume.</Text>}

      {active && (
        <>
          <View style={styles.imageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.muted}>
                  {loading ? 'Loading Street View…' : 'No panorama — Nebius still describes the area.'}
                </Text>
              </View>
            )}
            {loading && imageUrl && (
              <View style={styles.imageOverlay}>
                <ActivityIndicator color="#34d399" />
              </View>
            )}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.description}>
            {description ?? (loading ? 'Analyzing with Nebius vision…' : 'Waiting for first update…')}
          </Text>
          <Text style={styles.badge}>Nebius vision · crime-aware</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#ecfdf5',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'Menlo',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  imageWrap: {
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muted: {
    color: '#6b7280',
    fontSize: 12,
  },
  error: {
    color: '#f87171',
    fontSize: 12,
  },
});
