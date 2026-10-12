-- Clout City v0.1 "Tap In": players and invites.
-- Player data is built to last (Milestones rule 2): later versions add columns
-- and tables, they never rebuild these.

-- ---------------------------------------------------------------------------
-- Players: one row per signed-up account, created at the end of the creator.
-- ---------------------------------------------------------------------------
create table public.players (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null,
  starting_style   text not null,
  -- Free Look choices (skin now; hair, glasses, coverings later).
  look             jsonb not null default '{}'::jsonb,
  invite_code      text not null unique,
  age_confirmed_at timestamptz not null,
  -- Which creator steps are done. v0.1 ships "look"; v0.2 adds traits,
  -- birth lottery and home, and sends v0.1 players through them next visit.
  onboarding_step  text not null default 'look_done',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint players_name_length check (char_length(display_name) between 2 and 20),
  constraint players_name_chars check (display_name ~ '^[A-Za-z0-9 ._''-]+$'),
  constraint players_style check (starting_style in (
    'bodega_drip', 'thrift_store_icon', 'midtown_finance', 'night_owl_goth',
    'pilates_princess', 'startup_founder', 'influencer_soft_glam', 'arcade_nerd'
  )),
  constraint players_invite_code_format check (invite_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
  constraint players_look_size check (pg_column_size(look) < 2048)
);

-- Names are claimed: unique regardless of case or surrounding spaces.
create unique index players_display_name_key on public.players (lower(btrim(display_name)));

-- ---------------------------------------------------------------------------
-- Invites: who brought whom. One row per invited player, ever.
-- reward_paid_at stays null until v0.2 pays invite clout (retroactively).
-- ---------------------------------------------------------------------------
create table public.invites (
  id             bigint generated always as identity primary key,
  inviter_id     uuid not null references public.players (id) on delete cascade,
  invitee_id     uuid not null unique references public.players (id) on delete cascade,
  invite_code    text not null,
  created_at     timestamptz not null default now(),
  reward_paid_at timestamptz,

  constraint invites_not_self check (inviter_id <> invitee_id)
);

create index invites_inviter_idx on public.invites (inviter_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security: players read their own row; nobody writes directly.
-- All writes go through the security-definer functions below.
-- ---------------------------------------------------------------------------
alter table public.players enable row level security;
alter table public.invites enable row level security;

create policy "players read own row" on public.players
  for select to authenticated using (id = auth.uid());

create policy "inviters read own invites" on public.invites
  for select to authenticated using (inviter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger players_touch_updated_at
  before update on public.players
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Invite code generator (same alphabet as lib/invite.ts)
-- ---------------------------------------------------------------------------
create function public.generate_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.players where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_player: the end of the creator. Creates the player and credits the
-- inviter in one transaction. Called by the signed-in user.
-- ---------------------------------------------------------------------------
create function public.create_player(
  p_display_name text,
  p_starting_style text,
  p_look jsonb,
  p_invite_code text,
  p_age_confirmed boolean
) returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  inviter uuid;
  created public.players;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce(p_age_confirmed, false) is not true then
    raise exception 'age_not_confirmed' using errcode = '22023';
  end if;

  if exists (select 1 from public.players where id = uid) then
    select * into created from public.players where id = uid;
    return created;
  end if;

  if exists (select 1 from public.players where lower(btrim(display_name)) = lower(clean_name)) then
    raise exception 'name_taken' using errcode = '23505';
  end if;

  insert into public.players (id, display_name, starting_style, look, invite_code, age_confirmed_at)
  values (uid, clean_name, p_starting_style, coalesce(p_look, '{}'::jsonb), public.generate_invite_code(), now())
  returning * into created;

  if p_invite_code is not null then
    select id into inviter from public.players
      where invite_code = upper(btrim(p_invite_code)) and id <> uid;
    if inviter is not null then
      insert into public.invites (inviter_id, invitee_id, invite_code)
      values (inviter, uid, upper(btrim(p_invite_code)))
      on conflict (invitee_id) do nothing;
    end if;
  end if;

  return created;
end;
$$;

revoke all on function public.create_player(text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.create_player(text, text, jsonb, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- my_clique: the signed-in player's invited friends, oldest first.
-- Exposes only display name, style and join time of people they invited.
-- ---------------------------------------------------------------------------
create function public.my_clique()
returns table (display_name text, starting_style text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, p.starting_style, i.created_at
  from public.invites i
  join public.players p on p.id = i.invitee_id
  where i.inviter_id = auth.uid()
  order by i.created_at asc;
$$;

revoke all on function public.my_clique() from public, anon;
grant execute on function public.my_clique() to authenticated;

-- ---------------------------------------------------------------------------
-- is_name_available: lets the creator check a name before submitting.
-- ---------------------------------------------------------------------------
create function public.is_name_available(p_display_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.players
    where lower(btrim(display_name)) = lower(btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g')))
  );
$$;

revoke all on function public.is_name_available(text) from public, anon;
grant execute on function public.is_name_available(text) to authenticated;

revoke all on function public.generate_invite_code() from public, anon, authenticated;
