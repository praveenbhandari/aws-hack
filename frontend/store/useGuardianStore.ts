import { create } from 'zustand';
import type { Hotspot, LatLng, NearbyPlace, Route, SafetyScoreResponse } from '../types/api';
import type { RoutePreference } from '../lib/utils';

export type CallState = 'idle' | 'connecting' | 'listening' | 'speaking';
export type MapMode = 'route' | 'nearby';

export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type GuardianState = {
  location: LatLng | null;
  hotspots: Hotspot[];
  routes: Route[];
  activeRoute: Route | null;
  selectedRouteId: string | null;
  routePreference: RoutePreference;
  mapMode: MapMode;
  nearbyPlaces: NearbyPlace[];
  selectedPlaceId: string | null;
  voiceSummary: string | null;
  originText: string;
  destinationText: string;
  placeType: string;
  resolvedDestination: LatLng | null;
  loading: boolean;
  error: string | null;
  callState: CallState;
  transcript: TranscriptEntry[];
  chatMessages: ChatMessage[];
  safety: SafetyScoreResponse | null;

  setLocation: (location: LatLng) => void;
  setHotspots: (hotspots: Hotspot[]) => void;
  setRoutes: (routes: Route[]) => void;
  setActiveRoute: (route: Route | null) => void;
  setSelectedRouteId: (id: string | null) => void;
  setRoutePreference: (preference: RoutePreference) => void;
  setMapMode: (mode: MapMode) => void;
  setNearbyPlaces: (places: NearbyPlace[]) => void;
  setSelectedPlaceId: (id: string | null) => void;
  setVoiceSummary: (summary: string | null) => void;
  setOriginText: (text: string) => void;
  setDestinationText: (text: string) => void;
  setPlaceType: (type: string) => void;
  setResolvedDestination: (pos: LatLng | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCallState: (callState: CallState) => void;
  appendTranscript: (entry: TranscriptEntry) => void;
  clearTranscript: () => void;
  appendChatMessage: (message: ChatMessage) => void;
  setSafety: (safety: SafetyScoreResponse | null) => void;
  selectRoute: (id: string) => void;
};

export const useGuardianStore = create<GuardianState>((set, get) => ({
  location: null,
  hotspots: [],
  routes: [],
  activeRoute: null,
  selectedRouteId: null,
  routePreference: 'safest',
  mapMode: 'route',
  nearbyPlaces: [],
  selectedPlaceId: null,
  voiceSummary: null,
  originText: 'Ferry Building, San Francisco',
  destinationText: 'Mission Dolores Park, San Francisco',
  placeType: 'restaurant',
  resolvedDestination: null,
  loading: false,
  error: null,
  callState: 'idle',
  transcript: [],
  chatMessages: [],
  safety: null,

  setLocation: (location) => set({ location }),
  setHotspots: (hotspots) => set({ hotspots }),
  setRoutes: (routes) => set({ routes }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setSelectedRouteId: (selectedRouteId) => set({ selectedRouteId }),
  setRoutePreference: (routePreference) => set({ routePreference }),
  setMapMode: (mapMode) => set({ mapMode }),
  setNearbyPlaces: (nearbyPlaces) => set({ nearbyPlaces }),
  setSelectedPlaceId: (selectedPlaceId) => set({ selectedPlaceId }),
  setVoiceSummary: (voiceSummary) => set({ voiceSummary }),
  setOriginText: (originText) => set({ originText }),
  setDestinationText: (destinationText) => set({ destinationText }),
  setPlaceType: (placeType) => set({ placeType }),
  setResolvedDestination: (resolvedDestination) => set({ resolvedDestination }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setCallState: (callState) => set({ callState }),
  appendTranscript: (entry) =>
    set((s) => {
      const existingIndex = s.transcript.findIndex((t) => t.id === entry.id);
      if (existingIndex >= 0) {
        const next = s.transcript.slice();
        next[existingIndex] = entry;
        return { transcript: next };
      }
      return { transcript: [...s.transcript, entry] };
    }),
  clearTranscript: () => set({ transcript: [] }),
  appendChatMessage: (message) => set((s) => ({ chatMessages: [...s.chatMessages, message] })),
  setSafety: (safety) => set({ safety }),
  selectRoute: (id) => {
    const route = get().routes.find((r) => r.id === id) ?? null;
    set({ selectedRouteId: id, activeRoute: route });
  },
}));
