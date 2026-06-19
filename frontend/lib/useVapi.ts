import { useEffect, useMemo, useRef } from 'react';
import Vapi from '@vapi-ai/react-native';
import { getSafeRoutes } from './api';
import { useGuardianStore } from '../store/useGuardianStore';
import type { LatLng, RouteMode } from '../types/api';

const VAPI_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPI_PUBLIC_KEY ?? '';
const VAPI_ASSISTANT_ID = process.env.EXPO_PUBLIC_VAPI_ASSISTANT_ID ?? '';

type FindSafeRouteArgs = {
  origin: LatLng | string;
  destination: LatLng | string;
  mode?: RouteMode;
};

function resolveHere(point: LatLng | string, current: LatLng | null): LatLng | string {
  if (typeof point === 'string' && point.trim().toLowerCase() === 'here' && current) {
    return current;
  }
  return point;
}

export function useVapi() {
  const vapiRef = useRef<Vapi | null>(null);
  const setCallState = useGuardianStore((s) => s.setCallState);
  const appendTranscript = useGuardianStore((s) => s.appendTranscript);
  const clearTranscript = useGuardianStore((s) => s.clearTranscript);
  const setActiveRoute = useGuardianStore((s) => s.setActiveRoute);

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
          if (tc.function?.name !== 'find_safe_route') continue;
          const rawArgs = tc.function.arguments;
          const args: FindSafeRouteArgs =
            typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

          const current = useGuardianStore.getState().location;
          try {
            const { routes } = await getSafeRoutes({
              origin: resolveHere(args.origin, current),
              destination: resolveHere(args.destination, current),
              mode: args.mode ?? 'walking',
            });
            setActiveRoute(routes[0] ?? null);
          } catch (err) {
            console.warn('find_safe_route re-fetch failed', err);
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
  }, [vapi, appendTranscript, setActiveRoute, setCallState]);

  const startCall = async () => {
    clearTranscript();
    setCallState('connecting');
    try {
      await vapi.start(VAPI_ASSISTANT_ID);
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
