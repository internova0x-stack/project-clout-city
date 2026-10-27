-- Starter Week (owner, Oct 26: new players "don't know what to do"; spec section 28). Ten small missions that each teach
-- one part of the game by doing it; the game shows the first one not done yet, and pays each once.
--
--   * Who: players who joined after this migration (game_settings 'starter'.since). Older players never see it.
--   * Marks: triggers on the tables the game already writes mark a mission done the moment it happens (a visit at Sal's
--     Deli, arriving at Astoria Park, a gig taken and collected, a look saved, a home piece placed, a message, a piece of
--     gossip, rent paid, an event). They swallow their own errors, so gameplay never breaks for them.
--   * starter_state() is the pill and the sheet: what's done, what's next, the days left, and it pays what's due once
--     (ledger 'starter', ref the mission; finishing all ten: ledger 'starter_finish', C$500, the badge and a rug).
--   * It ends after 7 days or when hidden (starter_hide).

insert into public.game_settings (key, value)
values ('starter', jsonb_build_object('since', now(), 'days', 7, 'missions', '[
  {"id":"breakfast","cash":25,"clout":0},{"id":"park","cash":0,"clout":10},{"id":"gig","cash":0,"clout":15},
  {"id":"collect","cash":50,"clout":0},{"id":"look","cash":0,"clout":10},{"id":"furniture","cash":75,"clout":0},
  {"id":"message","cash":0,"clout":15},{"id":"gossip","cash":0,"clout":20},{"id":"rent","cash":0,"clout":20},
  {"id":"event","cash":0,"clout":25}]'::jsonb,
  'finish', '{"badge":"starter-week","cash":500,"item":"home-rug-violet"}'::jsonb))
on conflict (key) do nothing;

create table if not exists public.starter_progress (
  player_id   uuid primary key references public.players (id) on delete cascade,
  started_at  timestamptz not null default now(),
  hidden_at   timestamptz,
  finished_at timestamptz
);
create table if not exists public.starter_marks (
  player_id uuid not null references public.players (id) on delete cascade,
  mission   text not null,
  at        timestamptz not null default now(),
  primary key (player_id, mission)
);
alter table public.starter_progress enable row level security;
alter table public.starter_marks enable row level security;
revoke all on public.starter_progress, public.starter_marks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marks
-- ---------------------------------------------------------------------------
/** Starter Week is running for a player: joined after it shipped, not hidden, not finished, inside its days. */
create or replace function public.starter_active(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select p.created_at >= (s.v ->> 'since')::timestamptz
       and coalesce(sp.hidden_at, sp.finished_at) is null
       and coalesce(sp.started_at, now()) > now() - make_interval(days => (s.v ->> 'days')::int)
      from public.players p
      cross join (select public.game_settings_value('starter') v) s
      left join public.starter_progress sp on sp.player_id = p.id
     where p.id = p_player), false)
$$;

/** Marks a mission done (once), starting the week if this is the first thing the player does. */
create or replace function public.starter_mark(p_player uuid, p_mission text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_player is null or not public.starter_active(p_player) then return; end if;
  insert into public.starter_progress (player_id) values (p_player) on conflict do nothing;
  insert into public.starter_marks (player_id, mission) values (p_player, p_mission) on conflict do nothing;
exception when others then null;
end;
$$;

create or replace function public.starter_on_visit() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.place_id = 'ditmars-deli' then perform public.starter_mark(new.player_id, 'breakfast'); end if;
  if new.place_id = 'hell-gate-park' then perform public.starter_mark(new.player_id, 'park'); end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_visit on public.place_visits;
create trigger starter_visit after insert or update on public.place_visits for each row execute function public.starter_on_visit();

create or replace function public.starter_on_player() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.at_place is distinct from old.at_place and new.at_place = 'hell-gate-park' then perform public.starter_mark(new.id, 'park'); end if;
  if new.look is distinct from old.look and old.home_id is not null then perform public.starter_mark(new.id, 'look'); end if;
  if new.home_layout is distinct from old.home_layout and exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(new.home_layout) = 'array' then new.home_layout else '[]'::jsonb end) e
         join public.player_items i on e ->> 'id' = 'item:' || i.id and i.player_id = new.id and i.category = 'home' and i.acquired = 'bought') then
    perform public.starter_mark(new.id, 'furniture');
  end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_player on public.players;
create trigger starter_player after update of at_place, look, home_layout on public.players for each row execute function public.starter_on_player();

create or replace function public.starter_on_gig() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.accepted_at is not null and old.accepted_at is null then perform public.starter_mark(new.player_id, 'gig'); end if;
  if new.collected_at is not null and old.collected_at is null then perform public.starter_mark(new.player_id, 'collect'); end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_gig on public.gig_offers;
create trigger starter_gig after update on public.gig_offers for each row execute function public.starter_on_gig();

create or replace function public.starter_on_message() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'text' then perform public.starter_mark(new.sender, 'message'); end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_message on public.messages;
create trigger starter_message after insert on public.messages for each row execute function public.starter_on_message();

create or replace function public.starter_on_gossip() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.starter_mark(new.player_id, 'gossip');
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_gossip on public.gossip_found;
create trigger starter_gossip after insert on public.gossip_found for each row execute function public.starter_on_gossip();

create or replace function public.starter_on_bill() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'rent' and new.status = 'paid' and old.status is distinct from 'paid' then perform public.starter_mark(new.player_id, 'rent'); end if;
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_bill on public.bills;
create trigger starter_bill after update on public.bills for each row execute function public.starter_on_bill();

create or replace function public.starter_on_event() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.starter_mark(new.player_id, 'event');
  return null;
exception when others then return null;
end;
$$;
drop trigger if exists starter_event on public.event_attendance;
create trigger starter_event after insert on public.event_attendance for each row execute function public.starter_on_event();

-- ---------------------------------------------------------------------------
-- What the pill and the sheet show, and paying what's due
-- ---------------------------------------------------------------------------
create or replace function public.starter_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('starter');
  sp public.starter_progress;
  m jsonb;
  paid jsonb := '[]'::jsonb;
  fin jsonb := cfg -> 'finish';
  all_done boolean;
  finished boolean := false;
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  if not public.starter_active(uid) and not exists (select 1 from public.starter_progress where player_id = uid) then return null; end if;
  if public.starter_active(uid) then insert into public.starter_progress (player_id) values (uid) on conflict do nothing; end if;
  select * into sp from public.starter_progress where player_id = uid;
  for m in select jsonb_array_elements(cfg -> 'missions') loop
    if exists (select 1 from public.starter_marks where player_id = uid and mission = m ->> 'id')
       and public.ledger_once(uid, case when (m ->> 'cash')::int > 0 then 'cash' else 'clout' end,
                              greatest((m ->> 'cash')::int, (m ->> 'clout')::int), 'starter', m ->> 'id') then
      update public.players set bank_cash = bank_cash + (m ->> 'cash')::int, clout = clout + (m ->> 'clout')::int where id = uid;
      paid := paid || jsonb_build_array(m);
    end if;
  end loop;
  all_done := (select count(*) from public.starter_marks where player_id = uid) >= jsonb_array_length(cfg -> 'missions');
  if all_done and sp.finished_at is null then
    update public.starter_progress set finished_at = now() where player_id = uid returning * into sp;
    if public.ledger_once(uid, 'cash', (fin ->> 'cash')::int, 'starter_finish', 'week') then
      update public.players set bank_cash = bank_cash + (fin ->> 'cash')::int where id = uid;
      insert into public.player_badges (player_id, badge_id, arc_id) values (uid, fin ->> 'badge', 'starter') on conflict do nothing;
      insert into public.player_items (player_id, sku, category, value, acquired)
      values (uid, fin ->> 'item', 'home', 0, 'earned') on conflict do nothing;
      finished := true;
    end if;
  end if;
  return jsonb_build_object(
    'done', coalesce((select jsonb_agg(mission) from public.starter_marks where player_id = uid), '[]'::jsonb),
    'startedAt', sp.started_at,
    'daysLeft', greatest(0, (cfg ->> 'days')::int - (public.ny_today() - (sp.started_at at time zone 'America/New_York')::date)),
    'active', public.starter_active(uid),
    'paid', paid,
    'finished', finished);
end;
$$;

create or replace function public.starter_hide() returns void
language sql security definer set search_path = public
as $$ update public.starter_progress set hidden_at = coalesce(hidden_at, now()) where player_id = auth.uid() $$;

do $$
declare f text;
begin
  foreach f in array array['public.starter_state()', 'public.starter_hide()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.starter_active(uuid)', 'public.starter_mark(uuid, text)', 'public.starter_on_visit()', 'public.starter_on_player()',
    'public.starter_on_gig()', 'public.starter_on_message()', 'public.starter_on_gossip()', 'public.starter_on_bill()',
    'public.starter_on_event()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
