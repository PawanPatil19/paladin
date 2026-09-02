export type ActivityKind = 'run' | 'ride';

export const ACTIVITY = {
  run: {
    label: 'Running',
    noun: 'run',
    participant: 'runner',
    participants: 'runners',
    icon: 'walk' as const,
    primaryMetric: 'PACE',
  },
  ride: {
    label: 'Cycling',
    noun: 'ride',
    participant: 'rider',
    participants: 'riders',
    icon: 'bicycle' as const,
    primaryMetric: 'SPEED',
  },
} satisfies Record<ActivityKind, object>;

export function activityCopy(kind: ActivityKind) {
  return ACTIVITY[kind];
}

export function distanceText(km: number, units: 'metric' | 'imperial', decimals = 2) {
  return units === 'imperial' ? `${(km * 0.621371).toFixed(decimals)} mi` : `${km.toFixed(decimals)} km`;
}

export function speedText(kmh: number, units: 'metric' | 'imperial') {
  return units === 'imperial' ? `${(kmh * 0.621371).toFixed(1)} mph` : `${kmh.toFixed(1)} km/h`;
}

export function paceText(kmh: number, units: 'metric' | 'imperial') {
  if (kmh <= 0.05) return units === 'imperial' ? '– min/mi' : '– min/km';
  const minutes = units === 'imperial' ? 60 / (kmh * 0.621371) : 60 / kmh;
  const whole = Math.floor(minutes);
  const seconds = Math.min(59, Math.round((minutes - whole) * 60));
  return `${whole}:${String(seconds).padStart(2, '0')} ${units === 'imperial' ? 'min/mi' : 'min/km'}`;
}

export function primaryMetricText(kind: ActivityKind, speedKmh: number, units: 'metric' | 'imperial') {
  return kind === 'run' ? paceText(speedKmh, units) : speedText(speedKmh, units);
}
