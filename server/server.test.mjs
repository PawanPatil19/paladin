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

  const moved = await call(`/groups/${code}/participants/${joined.body.participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude: 1.301, longitude: 103.861, pace: '6:02' }),
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.member.latitude, 1.301);

  const started = await call(`/groups/${code}/start`, {
    method: 'POST',
    body: JSON.stringify({ participantId: created.body.participantId }),
  });
  assert.equal(started.status, 200);

  const cheered = await call(`/groups/${code}/cheers`, {
    method: 'POST',
    body: JSON.stringify({ senderId: joined.body.participantId, message: 'Steady lah!' }),
  });
  assert.equal(cheered.status, 201);

  const snapshot = await call(`/groups/${code}`);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.body.group.members.find((member) => member.name === 'Mei').pace, '6:02');
  assert.equal(snapshot.body.group.cheers[0].message, 'Steady lah!');
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
