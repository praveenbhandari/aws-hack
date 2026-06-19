// @vapi-ai/react-native pulls in @daily-co/react-native-webrtc, which has no
// web target and crashes the bundle on import. This stub keeps the web
// preview usable; real voice calls only work on the native dev client.
export function useVapi() {
  const startCall = async () => {
    console.warn('Voice calls require the native dev client (iOS/Android), not web.');
  };
  const stopCall = () => {};

  return { startCall, stopCall, nearbyPlaces: [] as const };
}
