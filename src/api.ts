export type ApiCoordinate = { latitude: number; longitude: number };

export type ApiMember = ApiCoordinate & {
  id: string;
  name: string;
  initials: string;
  color: string;
  pace: string;
  joinedAt: string;
  lastSeen: string;
};

export type ApiCheer = {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

export type ApiGroup = {
  code: string;
  activity: 'run' | 'ride';
  status: 'lobby' | 'active' | 'ended';
  destination: ApiCoordinate & { name: string; area: string; distance: string };
  members: ApiMember[];
  cheers: ApiCheer[];
  createdAt: string;
  startedAt: string | null;
  serverTime: string;
};

const expoDevHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL = (process.env.EXPO_PUBLIC_API_URL || `http://${expoDevHost || 'localhost'}:8787`).replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...options?.headers },
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Paladin could not reach the group service.');
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The group service took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const groupApi = {
  create(payload: {
    name: string;
    activity: 'run' | 'ride';
    destination: ApiGroup['destination'];
    coordinate?: ApiCoordinate;
  }) {
    return request<{ group: ApiGroup; participantId: string }>('/groups', { method: 'POST', body: JSON.stringify(payload) });
  },
  join(code: string, name: string, coordinate?: ApiCoordinate) {
    return request<{ group: ApiGroup; participantId: string }>(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name, coordinate }) });
  },
  snapshot(code: string, since = '') {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return request<{ group: ApiGroup }>(`/groups/${code}${query}`);
  },
  start(code: string, participantId: string) {
    return request<{ group: ApiGroup }>(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId }) });
  },
  updateLocation(code: string, participantId: string, coordinate: ApiCoordinate, pace: string) {
    return request<{ member: ApiMember }>(`/groups/${code}/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...coordinate, pace }),
    });
  },
  cheer(code: string, senderId: string, message: string) {
    return request<{ cheer: ApiCheer }>(`/groups/${code}/cheers`, {
      method: 'POST',
      body: JSON.stringify({ senderId, message }),
    });
  },
};

export const groupServiceUrl = API_URL;
import Constants from 'expo-constants';
