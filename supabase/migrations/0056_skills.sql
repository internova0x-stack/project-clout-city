-- Skills (owner, Oct 16, after a reference game's Skills tab): nine skills from 0 to 10 on the profile.
--
--   * Practice comes from what players already do, through triggers (no game function changes):
--       ledger rows   visits (by the place's tags), club and campus events, shifts, gigs, jobs, tills,
--                     gossip, dates, crew outings and together bonuses;
--       messages      charisma, once a day per conversation;
--       cooking       the fridge going down while energy goes up.
--     skill_log keeps each practice once (a cash row and a clout row for the same thing count once).
--   * Levels need 3, 8, 15, 25, 40, 60, 85, 115, 150, 200 practice in all (lib/skills.ts LEVEL_AT).
--   * Rust: 7 days without practice, then a level every 20 days, never more than 2 under your best.
--     Rust is worked out when read; practicing settles it (practice drops to the rusted level's floor).
--   * A new best level pays 10 × the level in clout once (ledger 'skill', ref skill:level); levels 5 and
--     10 also earn a badge (player_badges 'skill-<id>-5|10', arc 'skills').
--   * my_skills() for your profile; skills_of(player) for player cards (top three, level 1 and up).

do $$
begin
  if to_regprocedure('public.admin_player(uuid)') is null then
    raise exception 'Run migration 0055 first.';
  end if;
end $$;

create table public.player_skills (
  player_id      uuid not null references public.players (id) on delete cascade,
  skill          text not null check (skill in ('cooking', 'charisma', 'fitness', 'smarts', 'music', 'hustle', 'dance', 'gossip', 'photography')),
  practice       int not null default 0,
  best           smallint not null default 0,
  last_practiced date,
  primary key (player_id, skill)
);
alter table public.player_skills enable row level security;
create policy "own skills" on public.player_skills for select to authenticated using (player_id = auth.uid());

create table public.skill_log (
  player_id  uuid not null references public.players (id) on delete cascade,
  skill      text not null,
  key        text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, skill, key)
);
alter table public.skill_log enable row level security;

-- ---------------------------------------------------------------------------
-- Levels and rust
-- ---------------------------------------------------------------------------
create function public.skill_level(p_practice int) returns int
language sql immutable as $$
  select count(*)::int from unnest(array[3, 8, 15, 25, 40, 60, 85, 115, 150, 200]) t where p_practice >= t
$$;

create function public.skill_floor(p_level int) returns int
language sql immutable as $$
  select (array[0, 3, 8, 15, 25, 40, 60, 85, 115, 150, 200])[greatest(0, least(10, p_level)) + 1]
$$;

/** The level after rust: a level every 20 days once 7 days have passed, never more than 2 under the best. */
create function public.skill_effective(p_practice int, p_best int, p_last date) returns int
language sql stable as $$
  select least(public.skill_level(p_practice),
               greatest(public.skill_level(p_practice) - greatest(0, floor(((public.ny_today() - coalesce(p_last, public.ny_today())) - 7) / 20.0))::int,
                        p_best - 2, 0))
$$;

-- ---------------------------------------------------------------------------
-- Practice (internal)
-- ---------------------------------------------------------------------------
create function public.skill_practice(p_player uuid, p_skill text, p_key text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  inserted int;
  s public.player_skills;
  eff int;
  lvl int;
  l int;
begin
  if p_player is null or p_skill is null then return; end if;
  insert into public.skill_log (player_id, skill, key) values (p_player, p_skill, p_key) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  insert into public.player_skills (player_id, skill) values (p_player, p_skill) on conflict do nothing;
  select * into s from public.player_skills where player_id = p_player and skill = p_skill for update;
  -- Settle any rust before this practice counts ("using a skill stops it").
  eff := public.skill_effective(s.practice, s.best, s.last_practiced);
  if eff < public.skill_level(s.practice) then s.practice := public.skill_floor(eff); end if;
  s.practice := s.practice + 1;
  lvl := public.skill_level(s.practice);
  if lvl > s.best then
    for l in (s.best + 1)..lvl loop
      if public.ledger_once(p_player, 'clout', 10 * l, 'skill', p_skill || ':' || l) then
        update public.players set clout = clout + 10 * l where id = p_player;
      end if;
      if l in (5, 10) then
        insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'skill-' || p_skill || '-' || l, 'skills') on conflict do nothing;
      end if;
    end loop;
    s.best := lvl;
  end if;
  update public.player_skills set practice = s.practice, best = s.best, last_practiced = public.ny_today()
   where player_id = p_player and skill = p_skill;
end;
$$;

/** The skill a place trains, from its tags (lib/city.ts). */
create function public.skill_for_place(p_place text) returns text
language sql stable as $$
  select case
    when tags ?| array['gym', 'park', 'outdoors'] then 'fitness'
    when tags ?| array['library', 'university', 'college', 'campus'] then 'smarts'
    when tags ?| array['monument', 'rooftop', 'waterfront'] then 'photography'
    when tags ?| array['lounge'] then 'music'
    when tags ?| array['club'] then 'dance'
    else null end
  from (select coalesce(p -> 'tags', '[]'::jsonb) as tags from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place) x
$$;

/** The skill a club or campus event trains: open mics and sets are music, club nights dance, the rest charisma. */
create function public.skill_for_event(p_event text) returns text
language sql stable as $$
  select case
    when p_event ~ '(mic|jazz|karaoke|band|choir)' then 'music'
    when public.skill_for_place(e ->> 'placeId') in ('dance', 'music') then public.skill_for_place(e ->> 'placeId')
    when e is not null then 'charisma'
    else null end
  from (select (select x from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event) as e) y
$$;

create function public.skill_from_ledger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  head text := split_part(new.ref, ':', 1);
begin
  case new.kind
    when 'visit' then perform public.skill_practice(new.player_id, public.skill_for_place(head), 'visit:' || new.ref);
    when 'event', 'event_entry' then perform public.skill_practice(new.player_id, public.skill_for_event(head), 'event:' || new.ref);
    when 'party' then perform public.skill_practice(new.player_id, 'dance', 'party:' || new.ref);
    when 'shift', 'gig', 'job_pay', 'business_till' then perform public.skill_practice(new.player_id, 'hustle', new.kind || ':' || new.ref);
    when 'gossip', 'gossip_restroom' then perform public.skill_practice(new.player_id, 'gossip', new.kind || ':' || new.ref);
    when 'date_night', 'crew_friend', 'crew_full', 'together' then perform public.skill_practice(new.player_id, 'charisma', new.kind || ':' || new.ref);
    else null;
  end case;
  return null;
end;
$$;
create trigger ledger_skills after insert on public.ledger for each row execute function public.skill_from_ledger();

create function public.skill_from_message() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.skill_practice(new.sender, 'charisma', 'chat:' || new.conversation_id || ':' || new.ny_date);
  return null;
end;
$$;
create trigger messages_skills after insert on public.messages for each row execute function public.skill_from_message();

create function public.skill_from_cooking() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.skill_practice(new.id, 'cooking', 'cook:' || clock_timestamp()::text);
  return null;
end;
$$;
create trigger players_cooking_skill after update of fridge_meals on public.players
  for each row when (new.fridge_meals < old.fridge_meals and new.energy > old.energy)
  execute function public.skill_from_cooking();

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
create function public.my_skills() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_player' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', k.id,
             'level', coalesce(public.skill_effective(s.practice, s.best, s.last_practiced), 0),
             'best', coalesce(s.best, 0),
             'practice', coalesce(s.practice, 0),
             'rusty', coalesce(public.skill_effective(s.practice, s.best, s.last_practiced) < public.skill_level(s.practice), false))
           order by k.ord)
      from unnest(array['cooking', 'charisma', 'fitness', 'smarts', 'music', 'hustle', 'dance', 'gossip', 'photography']) with ordinality k(id, ord)
      left join public.player_skills s on s.player_id = uid and s.skill = k.id), '[]'::jsonb);
end;
$$;

/** Someone's top three skills (level 1 and up), for their player card. */
create function public.skills_of(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.skill, 'level', x.level) order by x.level desc, x.skill), '[]'::jsonb)
    from (select s.skill, public.skill_effective(s.practice, s.best, s.last_practiced) as level
            from public.player_skills s
           where s.player_id = p_player and auth.uid() is not null
           order by 2 desc, s.skill limit 3) x
   where x.level > 0
$$;

revoke all on function public.skill_practice(uuid, text, text) from public, anon, authenticated;
revoke all on function public.skill_from_ledger() from public, anon, authenticated;
revoke all on function public.skill_from_message() from public, anon, authenticated;
revoke all on function public.skill_from_cooking() from public, anon, authenticated;
grant execute on function public.my_skills() to authenticated;
grant execute on function public.skills_of(uuid) to authenticated;
