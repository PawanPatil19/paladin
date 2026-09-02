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
      activity: 'run',
      coordinate: { latitude: 1.29, longitude: 103.85 },
      destination: { name: 'Marina Barrage', area: 'Marina Bay', distance: '5.2 km', latitude: 1.2807, longitude: 103.8712 },
    }),
  });
  assert.equal(created.status, 201);
  assert.match(created.body.group.code, /^[A-Z0-9]{6}$/);

  const code = created.body.group.code;
  const joined = await call(`/groups/${code}/join`, { method: 'POST', body: JSON.stringify({ name: 'Mei' }) });
  assert.equal(joined.status, 201);
  assert.equal(joined.body.group.members.length, 2);

  const moved = await call(`/groups/${code}/participants/${joined.body.participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude: 1.301, longitude: 103.861, pace: '6:02' }),
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.member.latitude, 1.301);

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
