import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createGroupStore } from './store.mjs';

const COLORS = ['#FF6846', '#7CA8F8', '#C889E8', '#F5A45D', '#48A984', '#E16C9A'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_MEMBERS = 20;
const store = createGroupStore();
const requestWindows = new Map();

function withinRateLimit(key, now = Date.now()) {
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) { requestWindows.set(key, { startedAt: now, count: 1 }); return true; }
  current.count += 1;
  return current.count <= 240;
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? 'null' : '*'),
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  });
  response.end(JSON.stringify(body));
}

function cleanText(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanCode(value) {
  return cleanText(value, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function numeric(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function makeCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    if (!(await store.has(code))) return code;
  }
  return randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
}

function makeMember(name, deviceId, userId, index, coordinate = {}) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(), deviceId, userId, name, initials: name.slice(0, 2).toUpperCase(),
    color: COLORS[index % COLORS.length], pace: 'Ready',
    latitude: numeric(coordinate.latitude, null), longitude: numeric(coordinate.longitude, null),
    accuracy: numeric(coordinate.accuracy, null), speed: 0, joinedAt: now, lastSeen: now, locationUpdatedAt: coordinate.latitude != null ? now : null,
  };
}

function publicGroup(group, since = '') {
  return {
    code: group.code, groupName: group.groupName, rideName: group.rideName,
    activity: group.activity, status: group.status, hostId: group.hostId,
    destination: group.destination, members: [...group.members.values()].map(({ deviceId: _deviceId, userId: _userId, ...member }) => member),
    cheers: group.cheers.filter((cheer) => !since || cheer.createdAt > since).slice(-40),
    createdAt: group.createdAt, startedAt: group.startedAt, endedAt: group.endedAt,
    summary: group.summary, serverTime: new Date().toISOString(),
  };
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_000) throw new Error('Request is too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

function requireMember(group, participantId, userId = '') {
  const member = group.members.get(cleanText(participantId, 64));
  return member && (!userId || member.userId === userId) ? member : null;
}

function requireHost(group, participantId, userId = '') {
  return group.hostId === cleanText(participantId, 64) && Boolean(requireMember(group, group.hostId, userId));
}

function routeParts(url) {
  return url.pathname.split('/').filter(Boolean);
}

function buildSummary(group, body = {}) {
  const endedAt = new Date().toISOString();
  const startedMs = Date.parse(group.startedAt || group.createdAt);
  const durationSeconds = Math.max(0, Math.round((Date.parse(endedAt) - startedMs) / 1000));
  const distanceKm = Math.max(0, numeric(body.distanceKm, 0));
  return {
    code: group.code, rideName: group.rideName, destination: group.destination,
    startedAt: group.startedAt, endedAt, durationSeconds, distanceKm,
    averageSpeedKmh: durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0,
    riders: [...group.members.values()].map((member) => ({ id: member.id, name: member.name, initials: member.initials, color: member.color })),
  };
}

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return json(response, 204, {});
      const url = new URL(request.url ?? '/', 'http://localhost');
      const parts = routeParts(url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { ok: true, persistent: store.requiresAuth, time: new Date().toISOString() });
      }

      const currentUser = await store.authenticate(request.headers.authorization || '');
      if (store.requiresAuth && !currentUser) return json(response, 401, { code: 'AUTH_REQUIRED', error: 'Sign in to continue with Paladin.' });
      const userId = currentUser?.id || '';
      const rateKey = userId || request.socket.remoteAddress || 'local';
      if (!withinRateLimit(rateKey)) return json(response, 429, { code: 'RATE_LIMITED', error: 'Paladin is receiving too many requests. Wait a moment and try again.' });

      if (request.method === 'GET' && url.pathname === '/history') return json(response, 200, { rides: await store.history(userId) });
      if (request.method === 'GET' && url.pathname === '/active') {
        const active = await store.findActiveByIdentity({ userId, deviceId: '' });
        const member = active ? [...active.members.values()].find((item) => item.userId === userId) : null;
        return json(response, 200, { group: active ? publicGroup(active) : null, participantId: member?.id || null });
      }
      if (request.method === 'GET' && url.pathname === '/me') {
        const profile = await store.profile(userId);
        return json(response, 200, { profile: profile || { displayName: cleanText(currentUser?.user_metadata?.display_name, 24), voiceEnabled: true, units: 'metric' } });
      }
      if (request.method === 'PATCH' && url.pathname === '/me') {
        const body = await readBody(request);
        const profile = { displayName: cleanText(body.displayName, 24), voiceEnabled: body.voiceEnabled !== false, units: body.units === 'imperial' ? 'imperial' : 'metric' };
        if (profile.displayName.length < 2) return json(response, 400, { code: 'NAME_REQUIRED', error: 'Add your display name first.' });
        return json(response, 200, { profile: await store.saveProfile(userId, profile) });
      }

      if (request.method === 'POST' && url.pathname === '/groups') {
        const body = await readBody(request);
        const name = cleanText(body.name, 24);
        const deviceId = cleanText(body.deviceId, 80) || randomUUID();
        const destinationName = cleanText(body.destination?.name, 60);
        if (name.length < 2) return json(response, 400, { code: 'NAME_REQUIRED', error: 'Add your display name first.' });
        if (!destinationName) return json(response, 400, { code: 'DESTINATION_REQUIRED', error: 'Choose where your group is heading.' });
        const existing = await store.findActiveByIdentity({ userId, deviceId });
        if (existing) {
          const member = [...existing.members.values()].find((item) => userId ? item.userId === userId : item.deviceId === deviceId);
          return json(response, 200, { group: publicGroup(existing), participantId: member.id, resumed: true });
        }

        const code = await makeCode();
        const member = makeMember(name, deviceId, userId, 0, body.coordinate);
        const now = new Date().toISOString();
        const group = {
          code, groupName: cleanText(body.groupName, 40), rideName: cleanText(body.rideName, 50),
          activity: body.activity === 'run' ? 'run' : 'ride', status: 'lobby', hostId: member.id,
          destination: {
            name: destinationName, area: cleanText(body.destination?.area, 80), address: cleanText(body.destination?.address, 120),
            distance: cleanText(body.destination?.distance, 16), latitude: numeric(body.destination?.latitude, null), longitude: numeric(body.destination?.longitude, null),
          },
          members: new Map([[member.id, member]]), cheers: [], createdAt: now, startedAt: null, endedAt: null, summary: null,
        };
        await store.save(group);
        return json(response, 201, { group: publicGroup(group), participantId: member.id });
      }

      if (parts[0] === 'groups' && parts[1]) {
        const code = cleanCode(parts[1]);
        const group = await store.get(code);
        if (!group) return json(response, 404, { code: 'GROUP_NOT_FOUND', error: 'That ride could not be found. Check the code and try again.' });

        if (request.method === 'GET' && parts.length === 2) {
          if (store.requiresAuth && ![...group.members.values()].some((member) => member.userId === userId)) return json(response, 403, { code: 'NOT_A_MEMBER', error: 'You are not a member of this ride.' });
          return json(response, 200, { group: publicGroup(group, url.searchParams.get('since') ?? '') });
        }

        if (request.method === 'POST' && parts[2] === 'join') {
          const body = await readBody(request);
          if (group.status === 'ended') return json(response, 409, { code: 'RIDE_FINISHED', error: 'This ride has already finished.' });
          if (group.status === 'active') return json(response, 409, { code: 'RIDE_STARTED', error: 'This ride has already started and cannot currently be joined.' });
          const name = cleanText(body.name, 24);
          const deviceId = cleanText(body.deviceId, 80) || randomUUID();
          if (name.length < 2) return json(response, 400, { code: 'NAME_REQUIRED', error: 'Add your display name first.' });
          const otherActive = await store.findActiveByIdentity({ userId, deviceId });
          if (otherActive && otherActive.code !== group.code) return json(response, 409, { code: 'ACTIVE_RIDE_EXISTS', error: 'You already belong to another active ride. Leave or finish it before joining this one.' });
          const existing = [...group.members.values()].find((member) => userId ? member.userId === userId : member.deviceId === deviceId);
          if (existing) {
            existing.deviceId = deviceId; existing.name = name; existing.initials = name.slice(0, 2).toUpperCase(); existing.lastSeen = new Date().toISOString();
            await store.save(group);
            return json(response, 200, { group: publicGroup(group), participantId: existing.id, resumed: true });
          }
          if ([...group.members.values()].some((member) => member.name.toLowerCase() === name.toLowerCase())) {
            return json(response, 409, { code: 'NAME_IN_USE', error: 'That display name is already in this ride. Add an initial so riders can tell you apart.' });
          }
          if (group.members.size >= MAX_MEMBERS) return json(response, 409, { code: 'GROUP_FULL', error: 'This ride group is full.' });
          const member = makeMember(name, deviceId, userId, group.members.size, body.coordinate);
          group.members.set(member.id, member);
          await store.save(group);
          return json(response, 201, { group: publicGroup(group), participantId: member.id });
        }

        if (request.method === 'POST' && parts[2] === 'resume') {
          const body = await readBody(request);
          const deviceId = cleanText(body.deviceId, 80);
          const member = [...group.members.values()].find((item) => userId ? item.userId === userId : item.deviceId === deviceId);
          if (!member) return json(response, 404, { code: 'MEMBERSHIP_NOT_FOUND', error: 'Your previous membership is no longer active.' });
          member.deviceId = deviceId;
          member.lastSeen = new Date().toISOString();
          await store.save(group);
          return json(response, 200, { group: publicGroup(group), participantId: member.id });
        }

        if (request.method === 'POST' && parts[2] === 'start') {
          const body = await readBody(request);
          if (!requireHost(group, body.participantId, userId)) return json(response, 403, { code: 'HOST_ONLY', error: 'Only the ride host can start the ride.' });
          if (group.status === 'ended') return json(response, 409, { code: 'RIDE_FINISHED', error: 'This ride has already finished.' });
          group.status = 'active';
          group.startedAt ??= new Date().toISOString();
          await store.save(group);
          return json(response, 200, { group: publicGroup(group) });
        }

        if (request.method === 'PATCH' && parts[2] === 'destination') {
          const body = await readBody(request);
          if (!requireHost(group, body.participantId, userId)) return json(response, 403, { code: 'HOST_ONLY', error: 'Only the ride host can change the destination.' });
          if (group.status !== 'lobby') return json(response, 409, { code: 'RIDE_STARTED', error: 'The destination is locked after the ride starts.' });
          const name = cleanText(body.destination?.name, 60);
          if (!name) return json(response, 400, { code: 'DESTINATION_REQUIRED', error: 'Choose where your group is heading.' });
          group.destination = { ...group.destination, ...body.destination, name };
          await store.save(group);
          return json(response, 200, { group: publicGroup(group) });
        }

        if (request.method === 'PATCH' && parts[2] === 'participants' && parts[3]) {
          const participantId = cleanText(parts[3], 64);
          const member = requireMember(group, participantId, userId);
          if (!member) return json(response, 404, { code: 'MEMBERSHIP_NOT_FOUND', error: 'Your ride membership could not be found.' });
          const body = await readBody(request);
          member.latitude = numeric(body.latitude, member.latitude); member.longitude = numeric(body.longitude, member.longitude);
          member.accuracy = numeric(body.accuracy, member.accuracy); member.speed = Math.max(0, Math.min(25, numeric(body.speed, member.speed)));
          member.pace = cleanText(body.pace, 20) || member.pace; member.lastSeen = new Date().toISOString();
          member.locationUpdatedAt = member.lastSeen;
          await store.patchMember(group.code, member);
          const { deviceId: _deviceId, userId: _userId, ...publicMember } = member;
          return json(response, 200, { member: publicMember });
        }

        if (request.method === 'POST' && parts[2] === 'heartbeat') {
          const body = await readBody(request);
          const member = requireMember(group, body.participantId, userId);
          if (!member) return json(response, 404, { code: 'MEMBERSHIP_NOT_FOUND', error: 'Your ride membership could not be found.' });
          member.lastSeen = new Date().toISOString();
          await store.patchMember(group.code, member);
          return json(response, 200, { ok: true, serverTime: member.lastSeen });
        }

        if (request.method === 'POST' && parts[2] === 'cheers') {
          const body = await readBody(request);
          if (group.status !== 'active') return json(response, 409, { code: 'RIDE_NOT_ACTIVE', error: 'Cheers are available while the ride is active.' });
          const sender = requireMember(group, body.senderId, userId);
          if (!sender) return json(response, 403, { code: 'MEMBERSHIP_NOT_FOUND', error: 'Rejoin the ride to send a cheer.' });
          const message = cleanText(body.message, 100);
          if (!message) return json(response, 400, { code: 'CHEER_REQUIRED', error: 'Choose a cheer first.' });
          const cheer = { id: randomUUID(), senderId: sender.id, senderName: sender.name, message, createdAt: new Date().toISOString() };
          group.cheers.push(cheer);
          if (group.cheers.length > 100) group.cheers.splice(0, group.cheers.length - 100);
          await store.appendCheer(group.code, cheer);
          return json(response, 201, { cheer });
        }

        if (request.method === 'DELETE' && parts[2] === 'participants' && parts[3]) {
          const body = await readBody(request);
          const targetId = cleanText(parts[3], 64);
          const actorId = cleanText(body.participantId, 64);
          if (!requireMember(group, actorId, userId) || (actorId !== targetId && !requireHost(group, actorId, userId))) return json(response, 403, { code: 'NOT_ALLOWED', error: 'You cannot remove this rider.' });
          if (!group.members.has(targetId)) return json(response, 200, { group: publicGroup(group) });
          group.members.delete(targetId);
          if (group.members.size === 0) {
            group.status = 'ended'; group.endedAt = new Date().toISOString(); group.summary = buildSummary(group);
          } else if (group.hostId === targetId) {
            group.hostId = [...group.members.values()].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0].id;
          }
          await store.save(group);
          return json(response, 200, { group: publicGroup(group) });
        }

        if (request.method === 'POST' && parts[2] === 'end') {
          const body = await readBody(request);
          if (!requireHost(group, body.participantId, userId)) return json(response, 403, { code: 'HOST_ONLY', error: 'Only the ride host can end the ride.' });
          if (group.status !== 'ended') {
            group.status = 'ended'; group.summary = buildSummary(group, body); group.endedAt = group.summary.endedAt;
            group.cheers = [];
            for (const member of group.members.values()) {
              member.latitude = null; member.longitude = null; member.accuracy = null; member.speed = 0; member.pace = 'Finished';
            }
          }
          await store.save(group);
          return json(response, 200, { group: publicGroup(group) });
        }
      }

      return json(response, 404, { code: 'NOT_FOUND', error: 'That action is not available.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      return json(response, message.includes('JSON') ? 400 : 500, { code: 'SERVER_ERROR', error: 'Paladin hit a problem. Please try again.' });
    }
  });
}

export function resetGroupsForTests() { requestWindows.clear(); return store.reset(); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  createAppServer().listen(port, '0.0.0.0', () => console.log(`Paladin group service running on http://0.0.0.0:${port}`));
}
