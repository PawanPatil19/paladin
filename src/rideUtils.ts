export type Point = { latitude: number; longitude: number };

export function distanceKmBetween(a: Point, b: Point) {
  const radiusKm = 6371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function acceptedMovement(previous: Point & { timestamp: number }, next: Point & { timestamp: number }, accuracy: number | null | undefined) {
  if (accuracy != null && accuracy > 60) return 0;
  const distance = distanceKmBetween(previous, next);
  const seconds = Math.max(1, (next.timestamp - previous.timestamp) / 1000);
  const speedKmh = distance / (seconds / 3600);
  if (distance < 0.008 || distance > 0.4 || speedKmh > 75) return 0;
  return distance;
}

export function elapsedSeconds(startedAt: string | null, now = Date.now()) {
  return startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
}

export function freshness(lastSeen: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(lastSeen)) / 1000));
  if (seconds < 20) return { state: 'live' as const, label: 'Live · updated now' };
  if (seconds < 90) return { state: 'delayed' as const, label: `Delayed · ${seconds}s ago` };
  const minutes = Math.max(2, Math.round(seconds / 60));
  return { state: 'offline' as const, label: `Offline · last seen ${minutes} min ago` };
}

export function formatDuration(total: number) {
  const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
