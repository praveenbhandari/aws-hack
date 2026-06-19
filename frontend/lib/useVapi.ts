import { useEffect, useMemo, useRef } from 'react';
import * as Location from 'expo-location';
import Vapi from '@vapi-ai/react-native';
import { applyVoiceNearbyPlace, applyVoiceSafeRoutes, resolveCurrentLocation } from './useGuardianActions';
import { useGuardianStore } from '../store/useGuardianStore';
import type { LatLng, RouteMode } from '../types/api';

const VAPI_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPI_PUBLIC_KEY ?? '';
const VAPI_ASSISTANT_ID = process.env.EXPO_PUBLIC_VAPI_ASSISTANT_ID ?? '';

type FindSafeRouteArgs = {
  origin: LatLng | string;
  destination: LatLng | string;
  mode?: RouteMode;
};

type FindNearbyPlaceArgs = {
  place_type?: string;
  user_latitude?: number;
  user_longitude?: number;
};

function parseArgs<T>(raw: unknown): T {
  if (typeof raw === 'string') return JSON.parse(raw) as T;
  return raw as T;
}

export function useVapi() {
  const vapiRef = useRef<Vapi | null>(null);
  const setCallState = useGuardianStore((s) => s.setCallState);
  const appendTranscript = useGuardianStore((s) => s.appendTranscript);
  const clearTranscript = useGuardianStore((s) => s.clearTranscript);
  const setLocation = useGuardianStore((s) => s.setLocation);

  const vapi = useMemo(() => {
    if (vapiRef.current) return vapiRef.current;
    const instance = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = instance;
    return instance;
  }, []);

  useEffect(() => {
    const onCallStart = () => setCallState('listening');
    const onCallEnd = () => setCallState('idle');
    const onSpeechStart = () => setCallState('speaking');
    const onSpeechEnd = () => setCallState('listening');

    const onMessage = async (m: any) => {
      if (m?.type === 'transcript') {
        appendTranscript({
          id: `${m.role}-${m.transcriptType === 'final' ? 'final' : 'partial'}-${Date.now()}`,
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.transcript ?? '',
          final: m.transcriptType === 'final',
        });
        return;
      }

      if (m?.type === 'tool-calls') {
        const toolCalls = m.toolCallList ?? m.toolCalls ?? [];
        for (const tc of toolCalls) {
          const toolName = tc.function?.name ?? tc.name;
          const rawArgs = tc.function?.arguments ?? tc.arguments ?? tc.parameters;

          if (toolName === 'find_safe_route' || toolName === 'get_safe_routes') {
            const args = parseArgs<FindSafeRouteArgs>(rawArgs);
            const current = useGuardianStore.getState().location;
            try {
              await applyVoiceSafeRoutes(args.origin, args.destination, current);
            } catch (err) {
              console.warn('find_safe_route re-fetch failed', err);
            }
            continue;
          }

          if (toolName === 'find_nearby_place') {
            const args = parseArgs<FindNearbyPlaceArgs>(rawArgs);
            const placeType = args.place_type ?? 'restaurant';
            const current = useGuardianStore.getState().location;
            try {
              const coords = await resolveCurrentLocation(
                args.user_latitude != null && args.user_longitude != null
                  ? { lat: args.user_latitude, lng: args.user_longitude }
                  : current,
              );
              setLocation(coords);
              await applyVoiceNearbyPlace(placeType, coords);
            } catch (err) {
              console.warn('find_nearby_place fetch failed', err);
            }
          }
        }
      }
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('message', onMessage);

    return () => {
      vapi.removeListener('call-start', onCallStart);
      vapi.removeListener('call-end', onCallEnd);
      vapi.removeListener('speech-start', onSpeechStart);
      vapi.removeListener('speech-end', onSpeechEnd);
      vapi.removeListener('message', onMessage);
    };
  }, [vapi, appendTranscript, setCallState, setLocation]);

  const startCall = async () => {
    clearTranscript();
    setCallState('connecting');
    try {
      const coords = await resolveCurrentLocation(useGuardianStore.getState().location);
      setLocation(coords);
      await vapi.start(VAPI_ASSISTANT_ID, {
        variableValues: {
          user_latitude: coords.lat,
          user_longitude: coords.lng,
        },
      });
    } catch (err) {
      setCallState('idle');
      throw err;
    }
  };

  const stopCall = () => {
    vapi.stop();
    setCallState('idle');
  };

  return { startCall, stopCall };
}
