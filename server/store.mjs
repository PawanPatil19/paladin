import { createClient } from '@supabase/supabase-js';

function encodeGroup(group) {
  return { ...group, members: [...group.members.entries()] };
}
function decodeGroup(payload) {
  return payload ? { ...payload, members: new Map(payload.members || []) } : null;
}

class MemoryStore {
  requiresAuth = false;
  groups = new Map();
  async authenticate() { return null; }
  async has(code) { return this.groups.has(code); }
  async get(code) { return this.groups.get(code) || null; }
  async save(group) { this.groups.set(group.code, group); }
  async patchMember() {}
  async appendCheer() {}
  async findActiveByIdentity({ userId, deviceId }) {
    return [...this.groups.values()].find((group) => group.status !== 'ended' && [...group.members.values()].some((member) => userId ? member.userId === userId : member.deviceId === deviceId)) || null;
  }
  async history(userId) {
    return [...this.groups.values()].filter((group) => group.status === 'ended' && group.summary && [...group.members.values()].some((member) => member.userId === userId)).map((group) => ({ ...group.summary, viewerParticipantId: [...group.members.values()].find((member) => member.userId === userId)?.id })).sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  }
  async profile() { return null; }
  async saveProfile(_userId, profile) { return profile; }
  async reset() { this.groups.clear(); }
}

class SupabaseStore {
  requiresAuth = true;
  constructor(url, publishableKey, secretKey) {
    this.authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    this.admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  async authenticate(header = '') {
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    const { data, error } = await this.authClient.auth.getUser(token);
    return error ? null : data.user;
  }
  async has(code) { return Boolean(await this.get(code)); }
  async get(code) {
    const { data, error } = await this.admin.from('paladin_groups').select('payload').eq('code', code).maybeSingle();
    if (error) throw error;
    return decodeGroup(data?.payload);
  }
  async save(group) {
    const members = [...group.members.values()].filter((member) => member.userId).map((member) => ({
      user_id: member.userId, participant_id: member.id,
    }));
    const { error } = await this.admin.rpc('paladin_save_group', { p_code: group.code, p_status: group.status, p_payload: encodeGroup(group), p_members: members });
    if (error) throw error;
  }
  async patchMember(code, member) {
    const { error } = await this.admin.rpc('paladin_patch_member', { p_code: code, p_participant_id: member.id, p_member: member });
    if (error) throw error;
  }
  async appendCheer(code, cheer) {
    const { error } = await this.admin.rpc('paladin_append_cheer', { p_code: code, p_cheer: cheer });
    if (error) throw error;
  }
  async findActiveByIdentity({ userId }) {
    if (!userId) return null;
    const { data, error } = await this.admin.from('paladin_memberships').select('code').eq('user_id', userId).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data?.code ? this.get(data.code) : null;
  }
  async history(userId) {
    const { data, error } = await this.admin.from('paladin_memberships').select('summary,participant_id').eq('user_id', userId).eq('active', false).not('summary', 'is', null).order('updated_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).map((row) => ({ ...row.summary, viewerParticipantId: row.participant_id }));
  }
  async profile(userId) {
    const { data, error } = await this.admin.from('paladin_profiles').select('display_name,voice_enabled,units').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data ? { displayName: data.display_name, voiceEnabled: data.voice_enabled, units: data.units } : null;
  }
  async saveProfile(userId, profile) {
    const row = { id: userId, display_name: profile.displayName, voice_enabled: profile.voiceEnabled, units: profile.units, updated_at: new Date().toISOString() };
    const { error } = await this.admin.from('paladin_profiles').upsert(row);
    if (error) throw error;
    return profile;
  }
  async reset() { throw new Error('Refusing to reset the production database.'); }
}

export function createGroupStore(env = process.env) {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (url && publishableKey && secretKey) return new SupabaseStore(url, publishableKey, secretKey);
  if (env.NODE_ENV === 'production') throw new Error('Production requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.');
  return new MemoryStore();
}
