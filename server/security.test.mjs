import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createGroupStore } from './store.mjs';

test('production fails closed without durable database credentials', () => {
  assert.throws(() => createGroupStore({ NODE_ENV: 'production' }), /Production requires SUPABASE/);
});

test('database migration enables RLS and revokes direct app access', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202609020001_paladin_public_v1.sql', import.meta.url), 'utf8');
  for (const table of ['paladin_profiles', 'paladin_groups', 'paladin_memberships']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'));
  }
  assert.match(sql, /create or replace function public\.paladin_save_group/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.paladin_save_group[^;]+from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.paladin_patch_member[^;]+from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.paladin_append_cheer[^;]+from public, anon, authenticated/i);
});

test('server secret is never declared as an Expo public variable', async () => {
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.doesNotMatch(example, /EXPO_PUBLIC_SUPABASE_SECRET/i);
  assert.match(example, /^SUPABASE_SECRET_KEY=/m);
});

test('local demo mode is gated behind Expo development builds', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const localDemoMode = __DEV__ && process\.env\.EXPO_PUBLIC_DEMO_MODE === 'true'/);
  assert.doesNotMatch(app, /const localDemoMode = process\.env\.EXPO_PUBLIC_DEMO_MODE/);
});
