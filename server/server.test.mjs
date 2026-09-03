import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAppServer, resetGroupsForTests } from './index.mjs';

let server;
let baseUrl;

before(async () => {
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => resetGroupsForTests());
after(() => new Promise((resolve) => server.close(resolve)));

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { status: response.status, body: await response.json() };
}

test('two phones can share a code, positions, and cheers', async () => {
  const created = await call('/groups', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Pawan',
      deviceId: 'phone-a',
      activity: 'run',
      coordinate: { latitude: 1.29, longitude: 103.85 },
      destination: { name: 'Marina Barrage', area: 'Marina Bay', distance: '5.2 km', latitude: 1.2807, longitude: 103.8712 },
    }),
  });
  assert.equal(created.status, 201);
  assert.match(created.body.group.code, /^[A-Z0-9]{6}$/);

  const code = created.body.group.code;
  const joined = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei', deviceId: 'phone-b' }) });
  assert.equal(joined.status, 201);
  assert.equal(joined.body.group.members.length, 2);

  const started = await call(`/groups/${code}/start`, {
    method: 'POST',
    body: JSON.stringify({ participantId: created.body.participantId }),
  });
  assert.equal(started.status, 200);

  const consented = await call(`/groups/${code}/participants/${joined.body.participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility: 'approximate' }),
  });
  assert.equal(consented.status, 200);

  const moved = await call(`/groups/${code}/participants/${joined.body.participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude: 1.301, longitude: 103.861, pace: '6:02' }),
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.member.latitude, 1.301);

  const cheered = await call(`/groups/${code}/cheers`, {
    method: 'POST',
    body: JSON.stringify({ senderId: joined.body.participantId, message: 'Nice!' }),
  });
  assert.equal(cheered.status, 201);

  const snapshot = await call(`/groups/${code}`);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.body.group.members.find((member) => member.name === 'Mei').pace, '6:02');
  assert.equal(snapshot.body.group.cheers[0].message, 'Nice!');
});

test('running and cycling activities persist distinct start and end points', async () => {
  const created = await call('/groups', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ari',
      deviceId: 'runner-phone',
      activity: 'run',
      start: { name: 'Sports Hub', area: 'Kallang', latitude: 1.304, longitude: 103.8746 },
      destination: { name: 'East Coast Park', area: 'Marine Cove', latitude: 1.3018, longitude: 103.9127 },
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.group.activity, 'run');
  assert.equal(created.body.group.start.name, 'Sports Hub');
  assert.equal(created.body.group.destination.name, 'East Coast Park');

  const changed = await call(`/groups/${created.body.group.code}/route`, {
    method: 'PATCH',
    body: JSON.stringify({
      participantId: created.body.participantId,
      start: { name: 'Sports Hub', area: 'Kallang', latitude: 1.304, longitude: 103.8746 },
      destination: { name: 'Marina Barrage', area: 'Marina Bay', latitude: 1.2807, longitude: 103.8712 },
    }),
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.group.destination.name, 'Marina Barrage');

  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  const ended = await call(`/groups/${created.body.group.code}/end`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, distanceKm: 4.2 }) });
  assert.equal(ended.body.group.summary.activity, 'run');
  assert.equal(ended.body.group.summary.start.name, 'Sports Hub');
});

test('rejects unknown codes and participants', async () => {
  const missing = await call('/groups/ABC123');
  assert.equal(missing.status, 404);
});

test('duplicate device resumes one membership and start is host-only and idempotent', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Pawan', deviceId: 'phone-a', activity: 'ride', destination: { name: 'East Coast Park' } }) });
  const { code } = created.body.group;
  const joined = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei', deviceId: 'phone-b' }) });
  const duplicate = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei L', deviceId: 'phone-b' }) });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.participantId, joined.body.participantId);
  assert.equal(duplicate.body.group.members.length, 2);
  const sameNameOtherPhone = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei L', deviceId: 'phone-c' }) });
  assert.equal(sameNameOtherPhone.status, 409);
  assert.equal(sameNameOtherPhone.body.code, 'NAME_IN_USE');

  const denied = await call(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId: joined.body.participantId }) });
  assert.equal(denied.status, 403);
  const started = await call(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  const startedAgain = await call(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  assert.equal(started.status, 200);
  assert.equal(started.body.group.startedAt, startedAgain.body.group.startedAt);
  const lateJoin = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Late', deviceId: 'phone-c' }) });
  assert.equal(lateJoin.status, 409);
  assert.equal(lateJoin.body.code, 'RIDE_STARTED');
});

test('host transfers on leave and new host can finish once', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Pawan', deviceId: 'phone-a', activity: 'ride', destination: { name: 'Marina Barrage' } }) });
  const { code } = created.body.group;
  const joined = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei', deviceId: 'phone-b' }) });
  const left = await call(`/groups/${code}/participants/${created.body.participantId}`, { method: 'DELETE', body: JSON.stringify({ participantId: created.body.participantId }) });
  assert.equal(left.body.group.hostId, joined.body.participantId);
  await call(`/groups/${code}/start`, { method: 'POST', body: JSON.stringify({ participantId: joined.body.participantId }) });
  const ended = await call(`/groups/${code}/end`, { method: 'POST', body: JSON.stringify({ participantId: joined.body.participantId, distanceKm: 12.4 }) });
  const endedAgain = await call(`/groups/${code}/end`, { method: 'POST', body: JSON.stringify({ participantId: joined.body.participantId, distanceKm: 99 }) });
  assert.equal(ended.body.group.status, 'ended');
  assert.equal(ended.body.group.summary.distanceKm, 12.4);
  assert.equal(endedAgain.body.group.summary.distanceKm, 12.4);
});

test('resume restores membership without creating a rider', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Pawan', deviceId: 'phone-a', activity: 'ride', destination: { name: 'Rail Corridor' } }) });
  const resumed = await call(`/groups/${created.body.group.code}/resume`, { method: 'POST', body: JSON.stringify({ deviceId: 'phone-a' }) });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.participantId, created.body.participantId);
  assert.equal(resumed.body.group.members.length, 1);
});

test('location requires active consent and rejects impossible coordinates', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Ari', deviceId: 'safe-a', activity: 'ride', destination: { name: 'East Coast Park' } }) });
  const path = `/groups/${created.body.group.code}/participants/${created.body.participantId}`;
  const lobbyLocation = await call(path, { method: 'PATCH', body: JSON.stringify({ latitude: 1.3, longitude: 103.8 }) });
  assert.equal(lobbyLocation.status, 400);
  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  const pausedLocation = await call(path, { method: 'PATCH', body: JSON.stringify({ latitude: 1.3, longitude: 103.8 }) });
  assert.equal(pausedLocation.body.code, 'SHARING_PAUSED');
  await call(path, { method: 'PATCH', body: JSON.stringify({ visibility: 'approximate' }) });
  const impossible = await call(path, { method: 'PATCH', body: JSON.stringify({ latitude: 999, longitude: -999, accuracy: -5 }) });
  assert.equal(impossible.status, 400);
  assert.equal(impossible.body.code, 'INVALID_LOCATION');
});

test('host removal bans re-entry for the same identity', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Host', deviceId: 'ban-host', destination: { name: 'East Coast Park' } }) });
  const joined = await call(`/groups/${created.body.group.code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Guest', deviceId: 'ban-guest' }) });
  const removed = await call(`/groups/${created.body.group.code}/participants/${joined.body.participantId}`, { method: 'DELETE', body: JSON.stringify({ participantId: created.body.participantId }) });
  assert.equal(removed.status, 200);
  const rejoin = await call(`/groups/${created.body.group.code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Guest Again', deviceId: 'ban-guest' }) });
  assert.equal(rejoin.status, 403);
  assert.equal(rejoin.body.code, 'REMOVED_FROM_GROUP');
});

test('cheers are allow-listed and rate limited', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Host', deviceId: 'cheer-host', destination: { name: 'East Coast Park' } }) });
  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  const injected = await call(`/groups/${created.body.group.code}/cheers`, { method: 'POST', body: JSON.stringify({ senderId: created.body.participantId, message: 'Call me at 555-0100' }) });
  assert.equal(injected.status, 400);
  const first = await call(`/groups/${created.body.group.code}/cheers`, { method: 'POST', body: JSON.stringify({ senderId: created.body.participantId, message: 'All good' }) });
  const rapid = await call(`/groups/${created.body.group.code}/cheers`, { method: 'POST', body: JSON.stringify({ senderId: created.body.participantId, message: 'Nice!' }) });
  assert.equal(first.status, 201);
  assert.equal(rapid.status, 429);
});

test('Kaki Again reveals a connection only after mutual intent', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Ari', deviceId: 'connect-a', activity: 'run', destination: { name: 'Marina Barrage' } }) });
  const joined = await call(`/groups/${created.body.group.code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei', deviceId: 'connect-b' }) });
  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  await call(`/groups/${created.body.group.code}/end`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, distanceKm: 3 }) });
  const first = await call(`/groups/${created.body.group.code}/connect`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, targetId: joined.body.participantId }) });
  assert.equal(first.body.matched, false);
  assert.deepEqual(first.body.group.connections, []);
  const mutual = await call(`/groups/${created.body.group.code}/connect`, { method: 'POST', body: JSON.stringify({ participantId: joined.body.participantId, targetId: created.body.participantId }) });
  assert.equal(mutual.body.matched, true);
  assert.equal(mutual.body.group.connections.length, 1);
});

test('blocking hides a participant and prevents Kaki Again matching', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Ari', deviceId: 'block-a', activity: 'run', destination: { name: 'Marina Barrage' } }) });
  const joined = await call(`/groups/${created.body.group.code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei', deviceId: 'block-b' }) });
  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  await call(`/groups/${created.body.group.code}/end`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, distanceKm: 3 }) });
  const blocked = await call(`/groups/${created.body.group.code}/safety`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, targetId: joined.body.participantId, action: 'block' }) });
  assert.equal(blocked.status, 200);
  assert.deepEqual(blocked.body.group.members.map((member) => member.id), [created.body.participantId]);
  const connect = await call(`/groups/${created.body.group.code}/connect`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, targetId: joined.body.participantId }) });
  assert.equal(connect.status, 403);
  assert.equal(connect.body.code, 'CONNECTION_BLOCKED');
});

test('summary distance is bounded to a plausible product limit', async () => {
  const created = await call('/groups', { method: 'POST', body: JSON.stringify({ name: 'Ari', deviceId: 'distance-a', activity: 'run', destination: { name: 'Marina Barrage' } }) });
  await call(`/groups/${created.body.group.code}/start`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId }) });
  const ended = await call(`/groups/${created.body.group.code}/end`, { method: 'POST', body: JSON.stringify({ participantId: created.body.participantId, distanceKm: 1e300 }) });
  assert.equal(ended.body.group.summary.distanceKm, 200);
});
