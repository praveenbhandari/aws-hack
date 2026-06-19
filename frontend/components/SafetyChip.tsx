import { StyleSheet, Text, View } from 'react-native';
import type { RiskLevel } from '../types/api';
import { useGuardianStore } from '../store/useGuardianStore';

const RISK_COLOR: Record<RiskLevel, string> = {
  low: '#16a34a',
  moderate: '#d97706',
  high: '#ea580c',
  very_high: '#dc2626',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Safe',
  moderate: 'Caution',
  high: 'Risky',
  very_high: 'Dangerous',
};

export default function SafetyChip() {
  const safety = useGuardianStore((s) => s.safety);

  if (!safety) {
    return (
      <View style={[styles.chip, { backgroundColor: '#475569' }]}>
        <Text style={styles.label}>Checking safety…</Text>
      </View>
    );
  }

  const color = RISK_COLOR[safety.riskLevel];

  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <View style={styles.dot} />
      <Text style={styles.label}>
        {RISK_LABEL[safety.riskLevel]} · {safety.safetyScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  label: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
