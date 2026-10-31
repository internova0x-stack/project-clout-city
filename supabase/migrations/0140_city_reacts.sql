-- 0140: the Content Engine, step 4: the city reacts (docs/CONTENT-ENGINE.md section 4; owner, Oct 31: "go").
--
-- City conditions change the city for everyone for a while, through the World State layer's own effects, so every price,
-- door and place banner that already reads world_effects() reacts without new code:
--   * Weekly conditions (content/conditions/<Monday>.json, lib/cityConditions.ts): a heatwave, a cold snap, a festival,
--     a brownout. Stored like the weekly storylets: scheduled, live 24 hours after they arrive unless vetoed in
--     Studio → Storylets (held while the 'storylets' autopilot is off), and in force between their start and end.
--   * City storylets (content/city/reactions.json): when players together cross a line in the city's tallies
--     (world_tally, migration 0138), e.g. 12 office sabotage moves at Tech in 7 days, a condition fires at once from an
--     approved template ("HR crackdown week"), with a cooldown, and Lola posts the headline.
--   * Players in each other's News: the first campaign win, a business going public, a scholarship post a 🏆 line in
--     Lola's Blotter (News → City), never for News opt-outs. City headlines have no player.
--
--   * city_conditions: the condition, its effects (only price_multiplier, availability and place_state notes: never
--     chatter, tasks, flags or spawned events, which belong to stories), its window and the Studio's decision.
--   * world_effects() now adds the effects of every condition in force (arc 'condition:<id>').
--   * city_conditions_now() (players): what's on now and in the next 48 hours, for News → City and storylets.
--   * content_import_conditions(week, items), city_react(rules) (service role, run by syncWeeklyContent).
--   * admin_conditions(), admin_condition_set(id, action) for the Studio.
-- Safe to run more than once.

create table if not exists public.city_conditions (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  kind       text not null check (kind ~ '^[a-z_]+$'),
  subject    text not null default '',
  emoji      text not null,
  title      text not null,
  blurb      text not null,
  effects    jsonb not null default '[]'::jsonb,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  week       date,
  source     text not null default 'weekly' check (source in ('weekly', 'reaction')),
  rule       text,
  status     text not null default 'scheduled' check (status in ('scheduled', 'paused', 'vetoed', 'live')),
  live_at    timestamptz not null default now(),
  went_live  boolean not null default false,
  arrived_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create index if not exists city_conditions_when_idx on public.city_conditions (ends_at desc);
create index if not exists city_conditions_rule_idx on public.city_conditions (rule, starts_at desc);
alter table public.city_conditions enable row level security;
revoke all on public.city_conditions from anon, authenticated;

/** In force now: approved by its window (or the Studio) and between its start and end. */
create or replace function public.condition_on(c public.city_conditions) returns boolean
language sql stable as $$
  select public.storylet_state(c.status, c.live_at) = 'live' and now() >= c.starts_at and now() < c.ends_at
$$;

-- ---------------------------------------------------------------------------
-- World State: conditions' effects join the main stories' effects.
-- ---------------------------------------------------------------------------
create or replace function public.world_effects()
returns table (arc_id text, beat_id text, beat_day int, story_day int, effect jsonb)
language sql stable security definer set search_path = public
as $$
  select a.id, b ->> 'id', (b ->> 'day')::int, d.sd, e
    from public.story_arcs a
   cross join lateral (select public.arc_day(a) as sd) d
   cross join lateral jsonb_array_elements(a.data -> 'beats') b
   cross join lateral jsonb_array_elements(coalesce(b -> 'effects', '[]')) e
   where a.type = 'main' and d.sd is not null
     and coalesce(b ->> 'status', 'active') = 'active'
     and (b ->> 'day')::int <= d.sd
     and d.sd < coalesce((e ->> 'expires_day')::int,
                         case when e ->> 'type' = 'task_injection' then (b ->> 'day')::int + 1 end,
                         2147483647)
  union all
  -- Migration 0140: city conditions in force. Only prices, doors and place notes (never story machinery).
  select 'condition:' || c.id, c.id, 0, 0, e
    from public.city_conditions c
   cross join lateral jsonb_array_elements(c.effects) e
   where public.condition_on(c)
     and e ->> 'type' in ('price_multiplier', 'availability', 'place_state')
     and not (e ? 'spawn_event' or e ? 'cancel_event' or e ? 'unlock_action')
$$;

/** What's on now and coming in the next 48 hours (players: News → City, the place card, storylets). */
create or replace function public.city_conditions_now() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'kind', c.kind, 'subject', c.subject, 'emoji', c.emoji, 'title', c.title, 'blurb', c.blurb,
           'startsAt', c.starts_at, 'endsAt', c.ends_at, 'now', public.condition_on(c), 'source', c.source)
         order by c.starts_at), '[]'::jsonb)
    from public.city_conditions c
   where public.storylet_state(c.status, c.live_at) = 'live'
     and c.ends_at > now() and c.starts_at < now() + interval '48 hours'
$$;

-- ---------------------------------------------------------------------------
-- Weekly conditions (service role)
-- ---------------------------------------------------------------------------
create or replace function public.content_import_conditions(p_week date, p_items jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  c jsonb;
  n int := 0;
  hrs numeric := coalesce((public.game_settings_value('storylets') ->> 'window_hours')::numeric, 24);
  held boolean := not (public.autopilot() ->> 'storylets')::boolean;
begin
  if p_week is null or jsonb_typeof(p_items) <> 'array' then raise exception 'bad_week' using errcode = '22023'; end if;
  for c in select * from jsonb_array_elements(p_items) loop
    insert into public.city_conditions (id, kind, subject, emoji, title, blurb, effects, starts_at, ends_at, week, source, status, live_at)
    values (c ->> 'id', c ->> 'kind', coalesce(c ->> 'subject', ''), c ->> 'emoji', c ->> 'title', c ->> 'blurb',
            coalesce(c -> 'effects', '[]'::jsonb), (c ->> 'startsAt')::timestamptz, (c ->> 'endsAt')::timestamptz, p_week, 'weekly',
            case when held then 'paused' else 'scheduled' end, now() + make_interval(secs => (hrs * 3600)::double precision))
    on conflict (id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- City storylets: the city's tallies cross a line, a condition fires (service role)
-- ---------------------------------------------------------------------------
-- Headlines without a player (city news) and with a kind: 'scandal' (choices), 'win' (players' wins), 'city'.
alter table public.choice_headlines alter column player_id drop not null;
alter table public.choice_headlines add column if not exists kind text not null default 'scandal';

/**
 * p_rules: [{id, key, subject?, subjectStarts?, days, min, cooldownDays, headline?, condition: {kind, subject?, emoji,
 * title, blurb, hours, effects}}] (content/city/reactions.json, checked by lib/cityConditions.ts). Fires each rule whose
 * tally over its last `days` New York days reaches `min`, at most once per cooldown. Returns the conditions fired.
 */
create or replace function public.city_react(p_rules jsonb) returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
  total int;
  cid text;
  fired text[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtext('city_react'));
  for r in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    select coalesce(sum(t.count), 0) into total
      from public.world_tally t
     where t.key = r ->> 'key'
       and (r ->> 'subject' is null or t.subject = r ->> 'subject')
       and (r ->> 'subjectStarts' is null or t.subject like (r ->> 'subjectStarts') || '%')
       and t.day > public.ny_today() - greatest(1, coalesce((r ->> 'days')::int, 1));
    continue when total < coalesce((r ->> 'min')::int, 2147483647);
    continue when exists (select 1 from public.city_conditions
                           where rule = r ->> 'id' and starts_at > now() - make_interval(days => greatest(1, coalesce((r ->> 'cooldownDays')::int, 7))));
    cid := (r ->> 'id') || '-' || to_char(now() at time zone 'America/New_York', 'YYYYMMDD');
    insert into public.city_conditions (id, kind, subject, emoji, title, blurb, effects, starts_at, ends_at, source, rule, status, live_at, went_live)
    values (cid, r -> 'condition' ->> 'kind', coalesce(r -> 'condition' ->> 'subject', ''), r -> 'condition' ->> 'emoji',
            r -> 'condition' ->> 'title', r -> 'condition' ->> 'blurb', coalesce(r -> 'condition' -> 'effects', '[]'::jsonb),
            now(), now() + make_interval(hours => greatest(1, least(168, coalesce((r -> 'condition' ->> 'hours')::int, 24)))),
            'reaction', r ->> 'id', 'live', now(), true)
    on conflict (id) do nothing;
    if found then
      fired := fired || cid;
      if r ? 'headline' then
        insert into public.choice_headlines (player_id, text, kind) values (null, left(r ->> 'headline', 260), 'city');
      end if;
    end if;
  end loop;
  return fired;
end;
$$;

-- ---------------------------------------------------------------------------
-- Players in each other's News: a first big win posts a line in Lola's Blotter
-- ---------------------------------------------------------------------------
create or replace function public.fact_win_headline() returns trigger
language plpgsql security definer set search_path = public
as $$
declare me public.players; line text;
begin
  line := case new.key
    when 'campaign.won' then '🏆 {name} just managed a campaign all the way to City Hall. Staffers are already asking for selfies.'
    when 'campaign.won_dirty' then null
    when 'business.went_public' then '🔔 {name} took a business public. The bell was rung. The bell was a cowbell.'
    when 'campus.scholarship' then '🎓 {name} won a scholarship. Their professors call it "earned." Their roommate calls it "suspicious."'
    else null end;
  if line is null then return new; end if;
  select * into me from public.players where id = new.player_id;
  if me.id is null or coalesce(me.news_opt_out, false) then return new; end if;
  insert into public.choice_headlines (player_id, text, kind) values (new.player_id, replace(line, '{name}', '@' || me.display_name), 'win');
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists player_facts_win_headline on public.player_facts;
create trigger player_facts_win_headline after insert on public.player_facts
  for each row execute function public.fact_win_headline();

/** Lola's Blotter: the last week's headlines, scandals, wins and city news (opted-out players' lines left out). */
create or replace function public.choice_blotter() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'text', h.text, 'at', h.created_at, 'kind', h.kind) order by h.created_at desc), '[]'::jsonb)
    from (select h.* from public.choice_headlines h left join public.players p on p.id = h.player_id
           where h.created_at > now() - interval '7 days'
             and (h.player_id is null or (p.id is not null and not coalesce(p.news_opt_out, false)))
           order by h.created_at desc limit 12) h
$$;

-- ---------------------------------------------------------------------------
-- Studio
-- ---------------------------------------------------------------------------
create or replace function public.admin_conditions() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'subject', c.subject, 'emoji', c.emoji, 'title', c.title, 'blurb', c.blurb, 'effects', c.effects,
      'starts_at', c.starts_at, 'ends_at', c.ends_at, 'week', c.week, 'source', c.source, 'rule', c.rule,
      'status', public.storylet_state(c.status, c.live_at), 'live_at', c.live_at, 'on', public.condition_on(c),
      'decided_at', c.decided_at) order by c.starts_at desc)
    from public.city_conditions c where c.ends_at > now() - interval '14 days'), '[]'::jsonb);
end;
$$;

/** veto (ends it, final once in force), pause, restore, now (skips the rest of the window). */
create or replace function public.admin_condition_set(p_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.city_conditions;
begin
  perform public.require_story_admin();
  select * into r from public.city_conditions where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.storylet_state(r.status, r.live_at) = 'live' then r.went_live := true; end if;
  if p_action = 'veto' then r.status := 'vetoed';
  elsif p_action = 'pause' then
    if r.status = 'vetoed' then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'paused';
  elsif p_action in ('restore', 'now') then
    if r.status = 'vetoed' and r.went_live then raise exception 'vetoed' using errcode = '22023'; end if;
    r.status := 'scheduled';
    if p_action = 'now' then r.live_at := least(r.live_at, now()); r.went_live := true; end if;
  else raise exception 'bad_action' using errcode = '22023';
  end if;
  update public.city_conditions set status = r.status, live_at = r.live_at, went_live = r.went_live, decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return public.admin_conditions();
end;
$$;

revoke all on function public.condition_on(public.city_conditions) from public, anon, authenticated;
revoke all on function public.content_import_conditions(date, jsonb) from public, anon, authenticated;
revoke all on function public.city_react(jsonb) from public, anon, authenticated;
revoke all on function public.fact_win_headline() from public, anon, authenticated;
revoke all on function public.city_conditions_now() from public, anon;
grant execute on function public.city_conditions_now() to authenticated, service_role;
revoke all on function public.admin_conditions() from public, anon;
grant execute on function public.admin_conditions() to authenticated;
revoke all on function public.admin_condition_set(text, text) from public, anon;
grant execute on function public.admin_condition_set(text, text) to authenticated;
grant execute on function public.condition_on(public.city_conditions) to service_role;
grant execute on function public.content_import_conditions(date, jsonb) to service_role;
grant execute on function public.city_react(jsonb) to service_role;
