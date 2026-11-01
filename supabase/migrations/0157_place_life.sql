-- 0157: Living places (owner, Nov 1: "there aren't interesting things to do at locations"; "go ahead"; lib/placeLife.ts).
--   * Signature activities, happenings, crowd moments and stamp cards are TypeScript like Careers: the server action
--     (app/home/placeLifeActions.ts) rolls with a crypto random source and the service role; this file only reads the
--     player's standing for it (`place_life_context`) and pays what it decided, once (`place_life_save`).
--   * place_life_log: one row per thing done, unique by its once-key: an activity once a New York day, a moment once a week
--     (and 5 moments a day), a stamp card's reward once ever. Start over keeps the log (a regular is still a regular).
--   * Payouts: ledger 'place_life' cash and clout (ref = the once-key), Mood and Energy on the player; caps per row
--     (cash -400..400, clout 0..60, Mood -12..12, Energy 0..20). A cost never takes the bank below zero.
--   * An activity needs the player at its place, the place open (C2's hours) and the player out of holding; rate bucket 'place_life' (60 a minute).
-- Safe to run more than once.

insert into public.game_settings (key, value) values
  ('place_life', '{"momentsPerDay":5,"momentCooldownDays":7,"cap":{"cash":400,"clout":60,"mood":12,"energy":20}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.place_life_log (
  id        bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  kind      text not null check (kind in ('activity', 'moment', 'stamp')),
  place     text,
  ref       text not null,
  once_key  text not null,
  ny_date   date not null,
  cash      int not null default 0,
  clout     int not null default 0,
  mood      int not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, once_key)
);
create index if not exists place_life_log_day_idx on public.place_life_log (player_id, ny_date);
alter table public.place_life_log enable row level security;

/** What the server needs to decide: where the player is, Energy, holding, today's and this week's done refs, days at each place. */
create or replace function public.place_life_context(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when p.id is null then null else jsonb_build_object(
    'at', p.at_place,
    'energy', p.energy,
    'holding', public.choice_marked(p.id, 'holding'),
    'today', public.ny_today(),
    'refs', coalesce((select jsonb_agg(l.ref) from public.place_life_log l
                       where l.player_id = p.id
                         and ((l.kind = 'activity' and l.ny_date = public.ny_today())
                           or (l.kind = 'moment' and l.ny_date > public.ny_today() - ((public.game_settings_value('place_life') ->> 'momentCooldownDays')::int))
                           or l.kind = 'stamp')), '[]'::jsonb),
    'momentsToday', (select count(*) from public.place_life_log l where l.player_id = p.id and l.kind = 'moment' and l.ny_date = public.ny_today()),
    'regularDays', coalesce((select jsonb_object_agg(v.place_id, v.days) from
                    (select place_id, count(*) as days from public.place_visits where player_id = p.id group by place_id) v), '{}'::jsonb)) end
  from (select 1) one
  left join public.players p on p.id = p_player and p.home_id is not null;
$$;

/** Pays what the server rolled, once. Raises: rate_limited, no_player, bad_effects, not_here, in_holding, closed_now, no_energy, done, moments_out. */
create or replace function public.place_life_save(
  p_player uuid, p_kind text, p_place text, p_ref text, p_cash int, p_clout int, p_mood int, p_energy int
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('place_life');
  me public.players;
  today date := public.ny_today();
  key text;
  cash int := coalesce(p_cash, 0);
  n int;
begin
  if not public.rate_hit(p_player, 'place_life', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_kind not in ('activity', 'moment', 'stamp') or coalesce(p_ref, '') !~ '^[a-z]:[a-z0-9:-]{1,100}$'
     or abs(cash) > (cfg #>> '{cap,cash}')::int or coalesce(p_clout, 0) not between 0 and (cfg #>> '{cap,clout}')::int
     or abs(coalesce(p_mood, 0)) > (cfg #>> '{cap,mood}')::int or coalesce(p_energy, 0) not between 0 and (cfg #>> '{cap,energy}')::int then
    raise exception 'bad_effects' using errcode = '22023';
  end if;
  select * into me from public.players where id = p_player and home_id is not null for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_kind = 'activity' then
    if me.at_place is distinct from p_place then raise exception 'not_here' using errcode = '22023'; end if;
    if public.choice_marked(p_player, 'holding') then raise exception 'in_holding' using errcode = '22023'; end if;
    if not public.place_hours_open(p_place) then raise exception 'closed_now' using errcode = '22023'; end if;
    if me.energy < coalesce(p_energy, 0) then raise exception 'no_energy' using errcode = '22023'; end if;
  end if;
  if p_kind = 'moment' then
    select count(*) into n from public.place_life_log where player_id = p_player and kind = 'moment' and ny_date = today;
    if n >= (cfg ->> 'momentsPerDay')::int then raise exception 'moments_out' using errcode = '22023'; end if;
    if exists (select 1 from public.place_life_log where player_id = p_player and kind = 'moment' and ref = p_ref
                 and ny_date > today - (cfg ->> 'momentCooldownDays')::int) then
      raise exception 'done' using errcode = '22023';
    end if;
  end if;
  key := case p_kind when 'activity' then p_ref || ':' || today when 'moment' then p_ref || ':' || today else p_ref end;
  -- A cost never takes the bank below zero.
  if cash < 0 then cash := greatest(cash, -greatest(me.bank_cash, 0)); end if;
  insert into public.place_life_log (player_id, kind, place, ref, once_key, ny_date, cash, clout, mood)
  values (p_player, p_kind, p_place, p_ref, key, today, cash, coalesce(p_clout, 0), coalesce(p_mood, 0))
  on conflict (player_id, once_key) do nothing;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'done' using errcode = '22023'; end if;
  if cash <> 0 and public.ledger_once(p_player, 'cash', cash, 'place_life', key) then
    update public.players set bank_cash = bank_cash + cash where id = p_player;
  end if;
  if coalesce(p_clout, 0) > 0 and public.ledger_once(p_player, 'clout', p_clout, 'place_life', key) then
    update public.players set clout = clout + p_clout where id = p_player;
  end if;
  if coalesce(p_mood, 0) <> 0 or coalesce(p_energy, 0) <> 0 then
    update public.players
       set mood = least(100, greatest(0, mood + coalesce(p_mood, 0))),
           energy = least(100, greatest(0, energy - coalesce(p_energy, 0)))
     where id = p_player;
  end if;
  return jsonb_build_object('cash', cash, 'clout', coalesce(p_clout, 0), 'mood', coalesce(p_mood, 0), 'energy', coalesce(p_energy, 0));
end;
$$;

revoke all on function public.place_life_context(uuid) from public, anon, authenticated;
revoke all on function public.place_life_save(uuid, text, text, text, int, int, int, int) from public, anon, authenticated;
