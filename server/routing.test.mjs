import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingService } from './routing.mjs';

test('routing service requests activity-specific paths and caches the geometry', async () => {
  const calls = [];
  const route = createRoutingService({
    runUrl: 'https://routes.test/foot', rideUrl: 'https://routes.test/bike',
    fetcher: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ routes: [{ distance: 5300, duration: 1800, geometry: { coordinates: [[103.87, 1.30], [103.88, 1.31]] } }] }) };
    },
  });
  const start = { latitude: 1.30, longitude: 103.87 };
  const end = { latitude: 1.31, longitude: 103.88 };
  const first = await route('run', start, end);
  const second = await route('run', start, end);
  assert.match(calls[0], /\/foot\/route\/v1\/driving\/103\.87,1\.3;103\.88,1\.31/);
  assert.equal(calls.length, 1);
  assert.equal(first.distanceKm, 5.3);
  assert.equal(second.cached, true);
  assert.deepEqual(first.points[0], start);
});

test('routing service rejects coordinates outside Singapore before fetching', async () => {
  const route = createRoutingService({ fetcher: async () => assert.fail('fetch should not run') });
  await assert.rejects(() => route('ride', { latitude: 51.5, longitude: -0.1 }, { latitude: 1.31, longitude: 103.88 }), /within Singapore/);
});

