-- 0139: the Content Engine, step 3: weekly storylets with a veto window (docs/CONTENT-ENGINE.md sections 6 and 8;
-- owner, Oct 31: "automatic with a veto window", 24 hours for generated content).
--
-- The weekly routine drafts storylet cards (content/storylets/<Monday>.json, checked by lib/storyletWeeks.ts) in
-- families (a favor, a temptation, a betrayal, a windfall, a test of loyalty). The game server stores each new card
-- here as 'scheduled', live 24 hours later (game_settings 'storylets' {window_hours}) unless the owner vetoes or pauses it
-- in Studio → Storylets. A card already stored is never touched (the Studio's decision stands).
--
--   * storylet_cards: the card's JSON (outcomes included: no player access, the server reads it with the service role).
--     Status is stored as the Studio set it; "live" is worked out on read (scheduled and past live_at).
--   * content_import_storylets(week, cards) (service role, run by syncWeeklyContent): adds new cards; while the
--     'storylets' autopilot is off they arrive 'paused' and wait for the Studio.
--   * storylets_live() (service role): every card that has gone live, with `offer` true while it's live now (a vetoed or
--     paused card stays readable so an open card or a player's history still finds it).
--   * admin_storylets(), admin_storylet_set(id, action) for the Studio (veto, pause, restore, now).
--   * autopilot() and admin_autopilot_set() learn the 'storylets' switch.
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('storylets', '{"window_hours": 24}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.storylet_cards (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  week       date not null,
  family     text not null check (family in ('favor', 'temptation', 'betrayal', 'windfall', 'loyalty')),
  card       jsonb not null,
  status     text not null default 'scheduled' check (status in ('scheduled', 'paused', 'vetoed', 'live')),
  arrived_at timestamptz not null default now(),
  live_at    timestamptz not null,
  went_live  boolean not null default false,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create index if not exists storylet_cards_week_idx on public.storylet_cards (week desc);
alter table public.storylet_cards enable row level security;
revoke all on public.storylet_cards from anon, authenticated;

/** What a card is now: a scheduled card past its window is live. */
create or replace function public.storylet_state(s text, live_at timestamptz) returns text
language sql stable as $$ select case when s = 'scheduled' and live_at <= now() then 'live' else s end $$;

create or replace function public.autopilot() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'news', coalesce((s ->> 'news')::boolean, true), 'hunts', coalesce((s ->> 'hunts')::boolean, true),
    'gossip', coalesce((s ->> 'gossip')::boolean, true), 'stories', coalesce((s ->> 'stories')::boolean, true),
    'storylets', coalesce((s ->> 'storylets')::boolean, true))
  from (select coalesce(public.game_settings_value('autopilot'), '{}'::jsonb) as s) x
$$;

create or replace function public.admin_autopilot_set(p_kind text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_kind not in ('news', 'hunts', 'gossip', 'stories', 'storylets') or p_on is null then raise exception 'bad_kind' using errcode = '22023'; end if;
  insert into public.game_settings (key, value) values ('autopilot', jsonb_build_object(p_kind, p_on))
  on conflict (key) do update set value = public.game_settings.value || jsonb_build_object(p_kind, p_on), updated_at = now();
  return public.autopilot();
end;
$$;

/** Stores a week's new cards (service role). Returns how many were added. */
create or replace function public.content_import_storylets(p_week date, p_cards jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  c jsonb;
  n int := 0;
  hrs numeric := coalesce((public.game_settings_value('storylets') ->> 'window_hours')::numeric, 24);
  held boolean := not (public.autopilot() ->> 'storylets')::boolean;
begin
  if p_week is null or jsonb_typeof(p_cards) <> 'array' then raise exception 'bad_week' using errcode = '22023'; end if;
  for c in select * from jsonb_array_elements(p_cards) loop
    insert into public.storylet_cards (id, week, family, card, status, live_at)
    values (c ->> 'id', p_week, c ->> 'family', c, case when held then 'paused' else 'scheduled' end,
            now() + make_interval(secs => (hrs * 3600)::double precision))
    on conflict (id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

/** Every card that has gone live (service role), `offer` while it's live now. */
create or replace function public.storylets_live() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('card', card, 'offer', public.storylet_state(status, live_at) = 'live')
                            order by week, id), '[]'::jsonb)
  from public.storylet_cards
  where went_live or public.storylet_state(status, live_at) = 'live'
$$;

/** The Studio's list: newest weeks first, each card with its state and when it goes live. */
create or replace function public.admin_storylets() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'window_hours', coalesce((public.game_settings_value('storylets') ->> 'window_hours')::numeric, 24),
    'autopilot', (public.autopilot() ->> 'storylets')::boolean,
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'week', week, 'family', family, 'card', card, 'status', public.storylet_state(status, live_at),
        'live_at', live_at, 'arrived_at', arrived_at, 'decided_at', decided_at) order by week desc, arrived_at, id)
      from public.storylet_cards), '[]'::jsonb));
end;
$$;

/**
 * The owner's decision on one card: 'veto' (never shows; final once it has gone live), 'pause' (held until restored),
 * 'restore' (back on its clock; live at once if the window has passed), 'now' (live now, skipping the rest of the window).
 */
create or replace function public.admin_storylet_set(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.storylet_cards;
begin
  perform public.require_story_admin();
  select * into r from public.storylet_cards where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- A card that went live keeps it on record (open cards and histories still find it).
  if public.storylet_state(r.status, r.live_at) = 'live' then r.went_live := true; end if;
  if p_action = 'veto' then r.status := 'vetoed';
  elsif p_action = 'pause' then
    if r.status = 'vetoed' then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'paused';
  elsif p_action = 'restore' then
    if r.status = 'vetoed' and r.went_live then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'scheduled';
  elsif p_action = 'now' then
    if r.status = 'vetoed' and r.went_live then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'scheduled'; r.live_at := least(r.live_at, now()); r.went_live := true;
  else raise exception 'bad_action' using errcode = '22023';
  end if;
  update public.storylet_cards set status = r.status, live_at = r.live_at, went_live = r.went_live,
         decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return public.admin_storylets();
end;
$$;

revoke all on function public.storylet_state(text, timestamptz) from public, anon, authenticated;
revoke all on function public.content_import_storylets(date, jsonb) from public, anon, authenticated;
revoke all on function public.storylets_live() from public, anon, authenticated;
revoke all on function public.admin_storylets() from public, anon;
grant execute on function public.admin_storylets() to authenticated;
revoke all on function public.admin_storylet_set(text, text) from public, anon;
grant execute on function public.admin_storylet_set(text, text) to authenticated;
grant execute on function public.storylet_state(text, timestamptz) to service_role;
grant execute on function public.content_import_storylets(date, jsonb) to service_role;
grant execute on function public.storylets_live() to service_role;
