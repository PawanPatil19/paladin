import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const COLORS = ['#FF6846', '#7CA8F8', '#C889E8', '#F5A45D', '#48A984', '#E16C9A'];
const groups = new Map();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
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

function makeCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    if (!groups.has(code)) return code;
  }
  return randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
}

function makeMember(name, index, coordinate = {}) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name,
    initials: name.slice(0, 1).toUpperCase(),
    color: COLORS[index % COLORS.length],
    pace: 'Ready',
    latitude: numeric(coordinate.latitude, 1.2903),
    longitude: numeric(coordinate.longitude, 103.852),
    joinedAt: now,
    lastSeen: now,
  };
}

function publicGroup(group, since = '') {
  return {
    code: group.code,
    activity: group.activity,
    status: group.status,
    destination: group.destination,
    members: [...group.members.values()],
    cheers: group.cheers.filter((cheer) => !since || cheer.createdAt > since).slice(-40),
    createdAt: group.createdAt,
    startedAt: group.startedAt,
    serverTime: new Date().toISOString(),
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

function routeParts(url) {
  return url.pathname.split('/').filter(Boolean);
}

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return json(response, 204, {});
      const url = new URL(request.url ?? '/', 'http://localhost');
      const parts = routeParts(url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { ok: true, groups: groups.size, time: new Date().toISOString() });
      }

      if (request.method === 'POST' && url.pathname === '/groups') {
        const body = await readBody(request);
        const name = cleanText(body.name, 24);
        if (name.length < 2) return json(response, 400, { error: 'Add your name first.' });
        const destinationName = cleanText(body.destination?.name, 50);
        if (!destinationName) return json(response, 400, { error: 'Choose a destination.' });

        const code = makeCode();
        const member = makeMember(name, 0, body.coordinate);
        const now = new Date().toISOString();
        const group = {
          code,
          activity: body.activity === 'ride' ? 'ride' : 'run',
          status: 'lobby',
          destination: {
            name: destinationName,
            area: cleanText(body.destination?.area, 50),
            distance: cleanText(body.destination?.distance, 16),
            latitude: numeric(body.destination?.latitude, 1.2807),
            longitude: numeric(body.destination?.longitude, 103.8712),
          },
          members: new Map([[member.id, member]]),
          cheers: [],
          createdAt: now,
          startedAt: null,
        };
        groups.set(code, group);
        return json(response, 201, { group: publicGroup(group), participantId: member.id });
      }

      if (parts[0] === 'groups' && parts[1]) {
        const code = cleanCode(parts[1]);
        const group = groups.get(code);
        if (!group) return json(response, 404, { error: 'That group code is not active. Check it and try again.' });

        if (request.method === 'GET' && parts.length === 2) {
          return json(response, 200, { group: publicGroup(group, url.searchParams.get('since') ?? '') });
        }

        if (request.method === 'POST' && parts[2] === 'join') {
          if (group.status === 'ended') return json(response, 409, { error: 'This outing has already ended.' });
          const body = await readBody(request);
          const name = cleanText(body.name, 24);
          if (name.length < 2) return json(response, 400, { error: 'Add your name first.' });
          if (group.members.size >= 30) return json(response, 409, { error: 'This group is full.' });
          const member = makeMember(name, group.members.size, body.coordinate);
          group.members.set(member.id, member);
          return json(response, 201, { group: publicGroup(group), participantId: member.id });
        }

        if (request.method === 'POST' && parts[2] === 'start') {
          const body = await readBody(request);
          if (!group.members.has(cleanText(body.participantId, 50))) return json(response, 403, { error: 'Rejoin the group to start.' });
          group.status = 'active';
          group.startedAt ??= new Date().toISOString();
          return json(response, 200, { group: publicGroup(group) });
        }

        if (request.method === 'PATCH' && parts[2] === 'participants' && parts[3]) {
          const participantId = cleanText(parts[3], 50);
          const member = group.members.get(participantId);
          if (!member) return json(response, 404, { error: 'Participant not found.' });
          const body = await readBody(request);
          member.latitude = numeric(body.latitude, member.latitude);
          member.longitude = numeric(body.longitude, member.longitude);
          member.pace = cleanText(body.pace, 12) || member.pace;
          member.lastSeen = new Date().toISOString();
          return json(response, 200, { member });
        }

        if (request.method === 'POST' && parts[2] === 'cheers') {
          const body = await readBody(request);
          const senderId = cleanText(body.senderId, 50);
          const sender = group.members.get(senderId);
          if (!sender) return json(response, 403, { error: 'Rejoin the group to send a cheer.' });
          const message = cleanText(body.message, 100);
          if (!message) return json(response, 400, { error: 'Choose a cheer first.' });
          const cheer = { id: randomUUID(), senderId, senderName: sender.name, message, createdAt: new Date().toISOString() };
          group.cheers.push(cheer);
          if (group.cheers.length > 100) group.cheers.splice(0, group.cheers.length - 100);
          return json(response, 201, { cheer });
        }
      }

      return json(response, 404, { error: 'Not found.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      return json(response, message.includes('JSON') ? 400 : 500, { error: message });
    }
  });
}

export function resetGroupsForTests() {
  groups.clear();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  createAppServer().listen(port, '0.0.0.0', () => {
    console.log(`Paladin group service running on http://0.0.0.0:${port}`);
  });
}
