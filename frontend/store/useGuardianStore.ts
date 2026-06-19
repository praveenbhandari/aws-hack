import { create } from 'zustand';
import type { Hotspot, LatLng, Route, SafetyScoreResponse } from '../types/api';

export type CallState = 'idle' | 'connecting' | 'listening' | 'speaking';

export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
};

type GuardianState = {
  location: LatLng | null;
  hotspots: Hotspot[];
  activeRoute: Route | null;
  callState: CallState;
  transcript: TranscriptEntry[];
  safety: SafetyScoreResponse | null;

  setLocation: (location: LatLng) => void;
  setHotspots: (hotspots: Hotspot[]) => void;
  setActiveRoute: (route: Route | null) => void;
  setCallState: (callState: CallState) => void;
  appendTranscript: (entry: TranscriptEntry) => void;
  clearTranscript: () => void;
  setSafety: (safety: SafetyScoreResponse | null) => void;
};

export const useGuardianStore = create<GuardianState>((set) => ({
  location: null,
  hotspots: [],
  activeRoute: null,
  callState: 'idle',
  transcript: [],
  safety: null,

  setLocation: (location) => set({ location }),
  setHotspots: (hotspots) => set({ hotspots }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
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
  setSafety: (safety) => set({ safety }),
}));
