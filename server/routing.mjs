const SINGAPORE_BOUNDS = { minLatitude: 1.13, maxLatitude: 1.49, minLongitude: 103.59, maxLongitude: 104.12 };
const DEFAULT_PROVIDERS = {
  run: 'https://routing.openstreetmap.de/routed-foot',
  ride: 'https://routing.openstreetmap.de/routed-bike',
};

function inSingapore(point) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= SINGAPORE_BOUNDS.minLatitude && point.latitude <= SINGAPORE_BOUNDS.maxLatitude
    && point.longitude >= SINGAPORE_BOUNDS.minLongitude && point.longitude <= SINGAPORE_BOUNDS.maxLongitude;
}

function thin(points, limit = 450) {
  if (points.length <= limit) return points;
  const step = Math.ceil(points.length / limit);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

export function createRoutingService({ fetcher = fetch, runUrl = process.env.ROUTING_RUN_URL, rideUrl = process.env.ROUTING_RIDE_URL } = {}) {
  const cache = new Map();
  const providers = { run: runUrl || DEFAULT_PROVIDERS.run, ride: rideUrl || DEFAULT_PROVIDERS.ride };

  return async function route(activity, start, end) {
    if (!inSingapore(start) || !inSingapore(end)) throw new Error('Route points must be within Singapore.');
    const kind = activity === 'run' ? 'run' : 'ride';
    const cacheKey = `${kind}:${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}:${end.latitude.toFixed(5)},${end.longitude.toFixed(5)}`;
    if (cache.has(cacheKey)) return { ...cache.get(cacheKey), cached: true };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
      const response = await fetcher(`${providers[kind]}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
        headers: { 'user-agent': 'Paladin/1.0 (group activity routing)' }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Routing provider returned ${response.status}.`);
      const payload = await response.json();
      const best = payload.routes?.[0];
      if (!best?.geometry?.coordinates?.length) throw new Error('No route was found between those points.');
      const result = {
        activity: kind,
        distanceKm: best.distance / 1000,
        durationSeconds: Math.round(best.duration),
        points: thin(best.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))),
        provider: 'OpenStreetMap routing',
        cached: false,
      };
      cache.set(cacheKey, result);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  };
}
