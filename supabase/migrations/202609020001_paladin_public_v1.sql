create table if not exists public.paladin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  voice_enabled boolean not null default true,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paladin_groups (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  status text not null check (status in ('lobby', 'active', 'ended')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paladin_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.paladin_groups(code) on delete cascade,
  participant_id uuid not null,
  active boolean not null default true,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, code)
);

create unique index if not exists paladin_one_active_ride_per_user
  on public.paladin_memberships(user_id) where active;
create index if not exists paladin_memberships_code on public.paladin_memberships(code);
create index if not exists paladin_memberships_history on public.paladin_memberships(user_id, updated_at desc) where not active;

alter table public.paladin_profiles enable row level security;
alter table public.paladin_groups enable row level security;
alter table public.paladin_memberships enable row level security;

revoke all on public.paladin_profiles from anon, authenticated;
revoke all on public.paladin_groups from anon, authenticated;
revoke all on public.paladin_memberships from anon, authenticated;

create or replace function public.paladin_save_group(
  p_code text,
  p_status text,
  p_payload jsonb,
  p_members jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.paladin_groups(code, status, payload, updated_at)
  values (p_code, p_status, p_payload, now())
  on conflict (code) do update
    set status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at;

  update public.paladin_memberships membership
  set active = false,
      summary = case when p_status = 'ended' then p_payload -> 'summary' else membership.summary end,
      updated_at = now()
  where membership.code = p_code
    and not exists (
      select 1 from jsonb_array_elements(p_members) item
      where (item ->> 'user_id')::uuid = membership.user_id
    );

  insert into public.paladin_memberships(user_id, code, participant_id, active, summary, updated_at)
  select
    (item ->> 'user_id')::uuid,
    p_code,
    (item ->> 'participant_id')::uuid,
    p_status <> 'ended',
    case when p_status = 'ended' then p_payload -> 'summary' else null end,
    now()
  from jsonb_array_elements(p_members) item
  on conflict (user_id, code) do update
    set participant_id = excluded.participant_id,
        active = excluded.active,
        summary = excluded.summary,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.paladin_save_group(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.paladin_save_group(text, text, jsonb, jsonb) to service_role;

create or replace function public.paladin_patch_member(
  p_code text,
  p_participant_id uuid,
  p_member jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.paladin_groups
  set payload = jsonb_set(
        payload,
        '{members}',
        coalesce((
          select jsonb_agg(
            case when item ->> 0 = p_participant_id::text
              then jsonb_build_array(item -> 0, p_member)
              else item
            end
          )
          from jsonb_array_elements(payload -> 'members') item
        ), '[]'::jsonb)
      ),
      updated_at = now()
  where code = p_code and status <> 'ended';
$$;

create or replace function public.paladin_append_cheer(
  p_code text,
  p_cheer jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_cheers jsonb;
begin
  select coalesce(jsonb_agg(value order by ordinal), '[]'::jsonb)
  into next_cheers
  from jsonb_array_elements(
    coalesce((select payload -> 'cheers' from public.paladin_groups where code = p_code), '[]'::jsonb) || jsonb_build_array(p_cheer)
  ) with ordinality as cheer(value, ordinal)
  where ordinal > greatest(0, jsonb_array_length(
    coalesce((select payload -> 'cheers' from public.paladin_groups where code = p_code), '[]'::jsonb) || jsonb_build_array(p_cheer)
  ) - 100);

  update public.paladin_groups
  set payload = jsonb_set(payload, '{cheers}', next_cheers), updated_at = now()
  where code = p_code and status = 'active';
end;
$$;

revoke all on function public.paladin_patch_member(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.paladin_append_cheer(text, jsonb) from public, anon, authenticated;
grant execute on function public.paladin_patch_member(text, uuid, jsonb) to service_role;
grant execute on function public.paladin_append_cheer(text, jsonb) to service_role;

-- Paladin's authenticated API is the sole data boundary. Its secret key stays
-- server-side and bypasses RLS; mobile clients receive only a publishable key.
