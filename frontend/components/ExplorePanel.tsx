import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getAgentChat } from '../lib/api';
import { findNearbyPlaces, planSafeRoute, selectNearbyPlace, selectRouteWithHotspots } from '../lib/useGuardianActions';
import { formatDistance, formatDuration, riskColor, type RoutePreference } from '../lib/utils';
import { useGuardianStore } from '../store/useGuardianStore';
import LiveStreetViewPanel from './LiveStreetViewPanel';

const PLACE_TYPES = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'bar', label: 'Bar' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'lodging', label: 'Hotel' },
];

const PREFERENCE_OPTIONS: { id: RoutePreference; label: string }[] = [
  { id: 'safest', label: 'Safest' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'compare', label: 'Compare' },
];

type Tab = 'route' | 'nearby' | 'street' | 'chat';

export default function ExplorePanel() {
  const [tab, setTab] = useState<Tab>('route');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const originText = useGuardianStore((s) => s.originText);
  const destinationText = useGuardianStore((s) => s.destinationText);
  const placeType = useGuardianStore((s) => s.placeType);
  const routePreference = useGuardianStore((s) => s.routePreference);
  const routes = useGuardianStore((s) => s.routes);
  const selectedRouteId = useGuardianStore((s) => s.selectedRouteId);
  const nearbyPlaces = useGuardianStore((s) => s.nearbyPlaces);
  const selectedPlaceId = useGuardianStore((s) => s.selectedPlaceId);
  const voiceSummary = useGuardianStore((s) => s.voiceSummary);
  const loading = useGuardianStore((s) => s.loading);
  const error = useGuardianStore((s) => s.error);
  const location = useGuardianStore((s) => s.location);
  const chatMessages = useGuardianStore((s) => s.chatMessages);
  const activeRoute = useGuardianStore((s) => s.activeRoute);

  const setOriginText = useGuardianStore((s) => s.setOriginText);
  const setDestinationText = useGuardianStore((s) => s.setDestinationText);
  const setPlaceType = useGuardianStore((s) => s.setPlaceType);
  const setRoutePreference = useGuardianStore((s) => s.setRoutePreference);
  const appendChatMessage = useGuardianStore((s) => s.appendChatMessage);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    appendChatMessage({ id: `u-${Date.now()}`, role: 'user', text });
    setChatLoading(true);
    try {
      const res = await getAgentChat(text, location?.lat, location?.lng);
      appendChatMessage({ id: `a-${Date.now()}`, role: 'assistant', text: res.reply });
    } catch (err) {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: err instanceof Error ? err.message : 'Agent request failed',
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {(
          [
            ['route', 'Route'],
            ['nearby', 'Nearby'],
            ['street', 'Street'],
            ['chat', 'Ask'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        {error && <Text style={styles.error}>{error}</Text>}

        {tab === 'route' && (
          <View style={styles.section}>
            <Text style={styles.label}>Origin</Text>
            <TextInput
              style={styles.input}
              value={originText}
              onChangeText={setOriginText}
              placeholder="Start address or leave for GPS"
              placeholderTextColor="#6b7280"
            />
            <Text style={styles.label}>Destination</Text>
            <TextInput
              style={styles.input}
              value={destinationText}
              onChangeText={setDestinationText}
              placeholder="Where to?"
              placeholderTextColor="#6b7280"
            />
            <View style={styles.pillRow}>
              {PREFERENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setRoutePreference(opt.id);
                    if (opt.id === 'safest') void planSafeRoute({ avoidHeatmap: true });
                    if (opt.id === 'fastest') void planSafeRoute({ avoidHeatmap: false });
                  }}
                  style={[styles.pill, routePreference === opt.id && styles.pillActive]}
                >
                  <Text style={[styles.pillText, routePreference === opt.id && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void planSafeRoute()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Find safe route</Text>
              )}
            </Pressable>
            {routes.map((route) => {
              const selected = route.id === selectedRouteId;
              return (
                <Pressable
                  key={route.id}
                  onPress={() => selectRouteWithHotspots(route.id)}
                  style={[styles.card, selected && styles.cardSelected]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {route.summary}
                    </Text>
                    <Text style={[styles.score, { color: riskColor(route.riskLevel) }]}>
                      {route.safetyScore}
                    </Text>
                  </View>
                  <Text style={styles.cardMeta}>
                    {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                  </Text>
                  {selected && route.explanation ? (
                    <Text style={styles.cardExplain}>{route.explanation}</Text>
                  ) : null}
                  {selected && route.navigationSummary ? (
                    <Text style={styles.cardNav}>Ahead: {route.navigationSummary}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {tab === 'nearby' && (
          <View style={styles.section}>
            <View style={styles.pillRow}>
              {PLACE_TYPES.map((pt) => (
                <Pressable
                  key={pt.id}
                  onPress={() => setPlaceType(pt.id)}
                  style={[styles.pill, placeType === pt.id && styles.pillActive]}
                >
                  <Text style={[styles.pillText, placeType === pt.id && styles.pillTextActive]}>
                    {pt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void findNearbyPlaces()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Find safe {placeType}</Text>
              )}
            </Pressable>
            {voiceSummary && <Text style={styles.summary}>{voiceSummary}</Text>}
            {nearbyPlaces.map((place) => {
              const selected = place.id === selectedPlaceId;
              return (
                <Pressable
                  key={place.id}
                  onPress={() => selectNearbyPlace(place.id)}
                  style={[styles.card, selected && styles.cardSelected]}
                >
                  <Text style={styles.cardTitle}>{place.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {place.address} · risk {place.riskScore}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {formatDistance(place.route.distanceMeters)} · {place.route.durationText}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {tab === 'street' && <LiveStreetViewPanel />}

        {tab === 'chat' && (
          <View style={styles.section}>
            {chatMessages.length === 0 && (
              <Text style={styles.muted}>
                Ask about safe routes, nearby places, or what you see ahead. Uses your GPS when available.
              </Text>
            )}
            {chatMessages.map((m) => (
              <Text
                key={m.id}
                style={[styles.chatLine, m.role === 'user' ? styles.chatUser : styles.chatAssistant]}
              >
                {m.role === 'user' ? 'You: ' : 'Guardian: '}
                {m.text}
              </Text>
            ))}
            {activeRoute?.navigationSummary && (
              <Text style={styles.muted}>Current route: {activeRoute.navigationSummary}</Text>
            )}
            <View style={styles.chatRow}>
              <TextInput
                style={[styles.input, styles.chatInput]}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask Guardian…"
                placeholderTextColor="#6b7280"
                onSubmitEditing={() => void sendChat()}
              />
              <Pressable style={styles.sendBtn} onPress={() => void sendChat()} disabled={chatLoading}>
                <Text style={styles.sendBtnText}>{chatLoading ? '…' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#34d399',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ecfdf5',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 12,
    paddingBottom: 24,
    gap: 8,
  },
  section: {
    gap: 8,
  },
  label: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f3f4f6',
    fontSize: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pillActive: {
    backgroundColor: '#064e3b',
    borderColor: '#34d399',
  },
  pillText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ecfdf5',
  },
  primaryBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  cardSelected: {
    borderColor: '#34d399',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  cardExplain: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 16,
  },
  cardNav: {
    color: '#6ee7b7',
    fontSize: 11,
    lineHeight: 15,
  },
  summary: {
    color: '#6ee7b7',
    fontSize: 12,
    lineHeight: 16,
  },
  error: {
    color: '#f87171',
    fontSize: 12,
  },
  muted: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 16,
  },
  chatLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  chatUser: {
    color: '#e5e7eb',
  },
  chatAssistant: {
    color: '#7dd3fc',
  },
  chatRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  chatInput: {
    flex: 1,
  },
  sendBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
