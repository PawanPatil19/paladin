import Constants from 'expo-constants';
import { accessToken } from './auth';

export type ApiCoordinate = { latitude: number; longitude: number; accuracy?: number | null };
export type ApiMember = {
  id: string; name: string; initials: string; color: string; pace: string;
  latitude: number | null; longitude: number | null; accuracy: number | null; speed: number;
  joinedAt: string; lastSeen: string; locationUpdatedAt: string | null;
};
export type ApiCheer = { id: string; senderId: string; senderName: string; message: string; createdAt: string };
export type RideSummary = {
  code: string; rideName: string; destination: ApiGroup['destination']; startedAt: string | null; endedAt: string;
  durationSeconds: number; distanceKm: number; averageSpeedKmh: number;
  riders: { id: string; name: string; initials: string; color: string }[];
};
export type ApiGroup = {
  code: string; groupName: string; rideName: string; activity: 'run' | 'ride'; status: 'lobby' | 'active' | 'ended'; hostId: string;
  destination: { name: string; area: string; address?: string; distance: string; latitude: number | null; longitude: number | null };
  members: ApiMember[]; cheers: ApiCheer[]; createdAt: string; startedAt: string | null; endedAt: string | null;
  summary: RideSummary | null; serverTime: string;
};

export class ApiError extends Error {
  constructor(message: string, public code = 'NETWORK_ERROR', public status = 0) { super(message); }
}

const expoDevHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL = (process.env.EXPO_PUBLIC_API_URL || `http://${expoDevHost || 'localhost'}:8787`).replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const token = await accessToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...options, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options?.headers }, signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(body.error || 'Paladin could not complete that action.', body.code, response.status);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new ApiError('The connection is taking too long. Check your internet and try again.', 'TIMEOUT');
    throw new ApiError('Paladin is offline. Check your connection and try again.', 'NETWORK_ERROR');
  } finally { clearTimeout(timeout); }
}

export const groupApi = {
  create(payload: { name: string; deviceId: string; activity: 'run' | 'ride'; groupName?: string; rideName?: string; destination: ApiGroup['destination']; coordinate?: ApiCoordinate }) {
    return request<{ group: ApiGroup; participantId: string; resumed?: boolean }>('/groups', { method: 'POST', body: JSON.stringify(payload) });
  },
  join(code: string, name: string, deviceId: string, coordinate?: ApiCoordinate) {
    return request<{ group: ApiGroup; participantId: string; resumed?: boolean }>(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name, deviceId, coordinate }) });
  },
  resume(code: string, deviceId: string) {
    return request<{ group: ApiGroup; participantId: string }>(`/groups/${code}/resume`, { method: 'POST', body: JSON.stringify({ deviceId }) });
  },
  snapshot(code: string, since = '') {
    return request<{ group: ApiGroup }>(`/groups/${code}${since ? `?since=${encodeURIComponent(since)}` : ''}`);
  },
  start(code: string, participantId: string) {
    return request<{ group: ApiGroup }>(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId }) });
  },
  destination(code: string, participantId: string, destination: ApiGroup['destination']) {
    return request<{ group: ApiGroup }>(`/groups/${code}/destination`, { method: 'PATCH', body: JSON.stringify({ participantId, destination }) });
  },
  updateLocation(code: string, participantId: string, coordinate: ApiCoordinate, pace: string, speed = 0) {
    return request<{ member: ApiMember }>(`/groups/${code}/participants/${participantId}`, { method: 'PATCH', body: JSON.stringify({ ...coordinate, pace, speed }) });
  },
  heartbeat(code: string, participantId: string) {
    return request<{ ok: true; serverTime: string }>(`/groups/${code}/heartbeat`, { method: 'POST', body: JSON.stringify({ participantId }) });
  },
  cheer(code: string, senderId: string, message: string) {
    return request<{ cheer: ApiCheer }>(`/groups/${code}/cheers`, { method: 'POST', body: JSON.stringify({ senderId, message }) });
  },
  leave(code: string, participantId: string, targetId = participantId) {
    return request<{ group: ApiGroup }>(`/groups/${code}/participants/${targetId}`, { method: 'DELETE', body: JSON.stringify({ participantId }) });
  },
  end(code: string, participantId: string, distanceKm: number) {
    return request<{ group: ApiGroup }>(`/groups/${code}/end`, { method: 'POST', body: JSON.stringify({ participantId, distanceKm }) });
  },
  history() { return request<{ rides: RideSummary[] }>('/history'); },
  active() { return request<{ group: ApiGroup | null; participantId: string | null }>('/active'); },
  profile() { return request<{ profile: { displayName: string; voiceEnabled: boolean; units: 'metric' | 'imperial' } }>('/me'); },
  saveProfile(profile: { displayName: string; voiceEnabled: boolean; units: 'metric' | 'imperial' }) {
    return request<{ profile: typeof profile }>('/me', { method: 'PATCH', body: JSON.stringify(profile) });
  },
};

export const groupServiceUrl = API_URL;
