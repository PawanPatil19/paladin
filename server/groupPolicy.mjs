export const LOCATION_DELAYED_MS = 30_000;
export const LOCATION_EXPIRES_MS = 90_000;
export const CONNECTION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
export const CHEER_COOLDOWN_MS = 5_000;

export const ALLOWED_CHEERS = new Set([
  "Let’s go!",
  'Wait up!',
  'Nice!',
  'I’m behind',
  'All good',
  'Stop ahead',
]);

export const PRESENCE_SIGNALS = new Set(['together', 'ease', 'break', 'help']);
export const VISIBILITY_MODES = new Set(['paused', 'approximate', 'precise']);

function coordinateIsValid(latitude, longitude, accuracy) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && (accuracy == null || (Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 10_000));
}

function clearCoordinates(member) {
  member.latitude = null;
  member.longitude = null;
  member.accuracy = null;
  member.speed = 0;
  member.locationUpdatedAt = null;
}

export function updatePresence(member, body, groupStatus, now = new Date()) {
  if (body.visibility != null) {
    if (!VISIBILITY_MODES.has(body.visibility)) return { error: ['INVALID_VISIBILITY', 'Choose paused, approximate, or precise location sharing.'] };
    member.visibility = body.visibility;
    if (body.visibility === 'paused') clearCoordinates(member);
    else member.consentAt = now.toISOString();
  }

  if (body.signal != null) {
    if (!PRESENCE_SIGNALS.has(body.signal)) return { error: ['INVALID_SIGNAL', 'Choose one of the available Circle Check states.'] };
    member.signal = body.signal;
    member.signalUpdatedAt = now.toISOString();
  }

  const hasCoordinate = body.latitude != null || body.longitude != null || body.accuracy != null;
  if (!hasCoordinate) return { member };
  if (groupStatus !== 'active') return { error: ['ACTIVITY_NOT_ACTIVE', 'Location sharing starts only after the activity begins.'] };
  if ((member.visibility || 'approximate') === 'paused') return { error: ['SHARING_PAUSED', 'Resume location sharing before sending a position.'] };
  if (!coordinateIsValid(body.latitude, body.longitude, body.accuracy)) return { error: ['INVALID_LOCATION', 'That location update is not valid.'] };

  const approximate = (member.visibility || 'approximate') === 'approximate';
  member.latitude = approximate ? Math.round(body.latitude * 1000) / 1000 : body.latitude;
  member.longitude = approximate ? Math.round(body.longitude * 1000) / 1000 : body.longitude;
  member.accuracy = approximate ? Math.max(150, body.accuracy || 0) : (body.accuracy ?? null);
  member.speed = Math.max(0, Math.min(25, Number.isFinite(body.speed) ? body.speed : member.speed || 0));
  member.pace = typeof body.pace === 'string' ? body.pace.trim().slice(0, 20) || member.pace : member.pace;
  member.locationUpdatedAt = now.toISOString();
  return { member };
}

export function publicMember(member, now = Date.now()) {
  const { deviceId: _deviceId, userId: _userId, lastCheerAt: _lastCheerAt, ...safe } = member;
  const updatedAt = Date.parse(member.locationUpdatedAt || '');
  const age = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : Infinity;
  const visibility = member.visibility || 'approximate';
  const hidden = visibility === 'paused' || age > LOCATION_EXPIRES_MS;
  return {
    ...safe,
    visibility,
    locationState: visibility === 'paused' ? 'paused' : hidden ? 'stale' : age > LOCATION_DELAYED_MS ? 'delayed' : 'live',
    latitude: hidden ? null : safe.latitude,
    longitude: hidden ? null : safe.longitude,
    accuracy: hidden ? null : safe.accuracy,
  };
}

export function identityKey(memberOrIdentity) {
  if (memberOrIdentity.userId) return `user:${memberOrIdentity.userId}`;
  return `device:${memberOrIdentity.deviceId || ''}`;
}

export function isBlocked(group, firstId, secondId) {
  return (group.blocks || []).some((block) => (block.blockerId === firstId && block.targetId === secondId) || (block.blockerId === secondId && block.targetId === firstId));
}

export function activeConnectionIntents(group, now = Date.now()) {
  return (group.connectionIntents || []).filter((intent) => now - Date.parse(intent.createdAt) <= CONNECTION_EXPIRES_MS);
}

export function pairKey(firstId, secondId) {
  return [firstId, secondId].sort().join(':');
}
