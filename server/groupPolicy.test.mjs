import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCATION_EXPIRES_MS, publicMember, updatePresence } from './groupPolicy.mjs';

function participant(overrides = {}) {
  return { id: 'p1', userId: 'u1', deviceId: 'd1', visibility: 'approximate', latitude: 1.3, longitude: 103.8, accuracy: 150, speed: 0, locationUpdatedAt: new Date(0).toISOString(), ...overrides };
}

test('location expiry is based on coordinate freshness, not heartbeat freshness', () => {
  const member = participant({ lastSeen: new Date(LOCATION_EXPIRES_MS + 10_000).toISOString() });
  const visible = publicMember(member, LOCATION_EXPIRES_MS + 1);
  assert.equal(visible.locationState, 'stale');
  assert.equal(visible.latitude, null);
  assert.equal(visible.longitude, null);
});

test('pausing immediately clears persisted coordinates', () => {
  const member = participant();
  const result = updatePresence(member, { visibility: 'paused' }, 'active', new Date());
  assert.equal(result.error, undefined);
  assert.equal(member.latitude, null);
  assert.equal(member.locationUpdatedAt, null);
});
