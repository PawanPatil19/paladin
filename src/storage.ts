import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiGroup, RideSummary } from './api';

const KEYS = {
  onboarding: 'paladin:onboarding:v1', profile: 'paladin:profile:v1', session: 'paladin:session:v1',
  history: 'paladin:history:v1', rideStats: 'paladin:ride-stats:v1',
};

export type Profile = { deviceId: string; displayName: string; voiceEnabled: boolean; units: 'metric' | 'imperial'; demoMode: boolean };
export type StoredSession = { code: string; participantId: string; group?: ApiGroup };
export type StoredRideStats = { code: string; distanceKm: number; maxSpeedKmh: number; lastCoordinate?: { latitude: number; longitude: number; timestamp: number } };

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try { const value = await AsyncStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
async function setJson(key: string, value: unknown) { await AsyncStorage.setItem(key, JSON.stringify(value)); }

export const storage = {
  hasOnboarded: () => getJson(KEYS.onboarding, false),
  completeOnboarding: () => setJson(KEYS.onboarding, true),
  async profile(): Promise<Profile> {
    const stored = await getJson<Partial<Profile>>(KEYS.profile, {});
    const deviceId = stored.deviceId || `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const profile: Profile = { deviceId, displayName: stored.displayName || '', voiceEnabled: stored.voiceEnabled ?? true, units: stored.units || 'metric', demoMode: __DEV__ && (stored.demoMode ?? false) };
    if (!stored.deviceId) await setJson(KEYS.profile, profile);
    return profile;
  },
  saveProfile: (profile: Profile) => setJson(KEYS.profile, profile),
  session: () => getJson<StoredSession | null>(KEYS.session, null),
  saveSession: (session: StoredSession) => setJson(KEYS.session, session),
  clearSession: () => AsyncStorage.removeItem(KEYS.session),
  history: () => getJson<RideSummary[]>(KEYS.history, []),
  async addHistory(summary: RideSummary) {
    const history = await storage.history();
    await setJson(KEYS.history, [summary, ...history.filter((item) => item.code !== summary.code)].slice(0, 25));
  },
  rideStats: (code: string) => getJson<StoredRideStats>(KEYS.rideStats, { code, distanceKm: 0, maxSpeedKmh: 0 }),
  saveRideStats: (stats: StoredRideStats) => setJson(KEYS.rideStats, stats),
  clearRideStats: () => AsyncStorage.removeItem(KEYS.rideStats),
};
