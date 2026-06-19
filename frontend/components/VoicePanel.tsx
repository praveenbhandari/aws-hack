import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGuardianStore } from '../store/useGuardianStore';
import { useVapi } from '../lib/useVapi';

const STATE_LABEL: Record<string, string> = {
  idle: 'Tap and hold to talk',
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Speaking…',
};

export default function VoicePanel() {
  const callState = useGuardianStore((s) => s.callState);
  const transcript = useGuardianStore((s) => s.transcript);
  const { startCall, stopCall } = useVapi();

  const isActive = callState !== 'idle';

  return (
    <View style={styles.panel}>
      <View style={styles.transcriptBox}>
        {transcript.length === 0 ? (
          <Text style={styles.placeholder}>Your conversation will appear here.</Text>
        ) : (
          transcript
            .filter((t) => t.final)
            .slice(-4)
            .map((t) => (
              <Text key={t.id} style={[styles.line, t.role === 'user' ? styles.user : styles.assistant]}>
                {t.role === 'user' ? 'You: ' : 'Guardian: '}
                {t.text}
              </Text>
            ))
        )}
      </View>

      <View style={styles.controls}>
        <Text style={styles.stateLabel}>{STATE_LABEL[callState]}</Text>
        <Pressable
          style={[styles.talkButton, isActive && styles.talkButtonActive]}
          onPress={() => (isActive ? stopCall() : startCall())}
        >
          <View style={[styles.talkButtonInner, isActive && styles.talkButtonInnerActive]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  transcriptBox: {
    maxHeight: 56,
    marginBottom: 6,
  },
  placeholder: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  line: {
    fontSize: 14,
    lineHeight: 20,
  },
  user: {
    color: '#e2e8f0',
  },
  assistant: {
    color: '#7dd3fc',
  },
  controls: {
    alignItems: 'center',
    gap: 10,
  },
  stateLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  talkButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkButtonActive: {
    borderColor: '#ef4444',
  },
  talkButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
  },
  talkButtonInnerActive: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
  },
});
