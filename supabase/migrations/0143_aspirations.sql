-- 0143: aspirations (owner, Oct 31: "Let careers be the entry point to choosing archetypes"; lib/aspirations.ts).
-- The Careers app opens with a welcome screen ("What's your aspiration?"): Corporate Bro / Corporate Girlie, Budding
-- Influencer, Streamer, Future Celebrity, Hustler, Public Servant or Stay-at-home Spouse. The pick is the player's life
-- path (separate from the creator's looks and traits), changeable once every 30 days; Start over clears it.
--   * aspirations: the pick and when.
--   * aspiration_state() (players): the pick, when it can change, and the degree: 3 campus exams passed at C or better
--     (owner, Oct 31: passed exams count as a degree until Campus Life has a graduation).
--   * aspiration_set(id) (players): 30 days between picks ('too_soon').
--   * aspiration_of(player) (service role): the pick and the degree, for the careers, campaign and choices servers.
--   * visit_settle: a Stay-at-home Spouse's hosting pays a quarter more clout.
--   * admin_career_stats(days) (Studio admins; Insights): jobs taken, kept 14 days, promoted at least once, working now
--     by track, and aspirations picked.
-- Safe to run more than once.

create table if not exists public.aspirations (
  player_id  uuid primary key references public.players (id) on delete cascade,
  aspiration text not null check (aspiration in ('corporate', 'influencer', 'streamer', 'celebrity', 'hustler', 'public', 'home')),
  chosen_at  timestamptz not null default now()
);
alter table public.aspirations enable row level security;
revoke all on public.aspirations from anon, authenticated;

/** Exams passed at C or better (never a caught one) since the player's last Start over. */
create or replace function public.exams_passed(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.campus_exams e
   where e.player_id = p_player and e.grade in ('A', 'B', 'C') and not e.caught
     and e.taken_at > coalesce((select max(restarted_at) from public.player_restarts where player_id = p_player), '-infinity'::timestamptz)
$$;

create or replace function public.aspiration_of(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'aspiration', a.aspiration, 'chosenAt', a.chosen_at,
    'exams', public.exams_passed(p_player), 'degree', public.exams_passed(p_player) >= 3)
    from (select 1) one left join public.aspirations a on a.player_id = p_player
$$;

create or replace function public.aspiration_state() returns jsonb
language sql stable security definer set search_path = public
as $$ select public.aspiration_of(auth.uid()) $$;

create or replace function public.aspiration_set(p_aspiration text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.aspirations;
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then raise exception 'no_player' using errcode = '42501'; end if;
  if p_aspiration not in ('corporate', 'influencer', 'streamer', 'celebrity', 'hustler', 'public', 'home') then
    raise exception 'unknown' using errcode = '22023';
  end if;
  select * into cur from public.aspirations where player_id = uid for update;
  if cur.player_id is not null and cur.aspiration = p_aspiration then
    return public.aspiration_of(uid);
  end if;
  if cur.player_id is not null and cur.aspiration <> p_aspiration and cur.chosen_at > now() - interval '30 days' then
    raise exception 'too_soon' using errcode = '22023';
  end if;
  insert into public.aspirations (player_id, aspiration, chosen_at) values (uid, p_aspiration, now())
  on conflict (player_id) do update set aspiration = excluded.aspiration, chosen_at = now();
  perform public.fact_note(uid, 'life.aspiration', p_aspiration);
  return public.aspiration_of(uid);
end;
$$;

-- Start over is a new life: the aspiration goes too.
create or replace function public.aspiration_restart() returns trigger
language plpgsql security definer set search_path = public
as $$ begin delete from public.aspirations where player_id = new.player_id; return new; end $$;
drop trigger if exists player_restarts_aspiration on public.player_restarts;
create trigger player_restarts_aspiration after insert on public.player_restarts for each row execute function public.aspiration_restart();

create or replace function public.visit_settle(p_visit bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v public.visits;
  cfg jsonb := public.game_settings_value('visits');
  k jsonb;
  g public.visit_guests;
  host_c int;
  add_mood int;
  rel public.relationships;
begin
  select * into v from public.visits where id = p_visit for update;
  if v.id is null or now() < v.starts_at then return; end if;
  k := cfg -> 'kinds' -> v.kind;
  host_c := round((k ->> 'hostClout')::int * (1 + v.crib / 100.0))::int;
  -- Migration 0143: a Stay-at-home Spouse's hosting pays a quarter more (lib/aspirations.ts ASPIRE.homeHosting).
  if exists (select 1 from public.aspirations a where a.player_id = v.host and a.aspiration = 'home') then
    host_c := round(host_c * 1.25)::int;
  end if;
  for g in select * from public.visit_guests where visit_id = v.id and paid_at is null and status in ('accepted', 'left')
             and arrived_at is not null and arrived_at < v.ends_at for update loop
    -- Stayed: seen in the room at least the stay time after arriving.
    if g.seen_at < g.arrived_at + make_interval(mins => (cfg ->> 'stayMinutes')::int) then continue; end if;
    update public.visit_guests set paid_at = now() where visit_id = v.id and player_id = g.player_id;
    if public.ledger_once(g.player_id, 'clout', (k ->> 'guestClout')::int, 'visit_guest', v.id::text) then
      update public.players set clout = clout + (k ->> 'guestClout')::int, mood = least(100, mood + (k ->> 'guestMood')::int)
       where id = g.player_id;
    end if;
    if public.ledger_once(v.host, 'clout', host_c, 'visit_host', v.id || ':' || g.player_id) then
      add_mood := greatest(0, least((k ->> 'hostMood')::int, (cfg ->> 'hostMoodMax')::int - v.host_mood));
      update public.players set clout = clout + host_c, mood = least(100, mood + add_mood) where id = v.host;
      if add_mood > 0 then
        update public.visits set host_mood = host_mood + add_mood where id = v.id;
        v.host_mood := v.host_mood + add_mood;
      end if;
    end if;
    rel := public.couple_rel(v.host);
    if rel.id is not null and g.player_id in (rel.a, rel.b) then
      insert into public.couple_days (rel_id, ny_date) values (rel.id, public.ny_today()) on conflict do nothing;
    end if;
  end loop;
end;
$$;

/** Studio → Insights: how careers are doing (owner, Oct 31: the careers spec's "kept a job 14 days, reached level 2"). */
create or replace function public.admin_career_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 7), 365);
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'days', d,
    'hired', (select count(*) from public.careers where status <> 'abandoned' and started_at > now() - make_interval(days => d)),
    -- Jobs old enough to have lasted two weeks (started 14+ days ago, within the period), and how many did.
    'cohort14', (select count(*) from public.careers where status <> 'abandoned'
                  and started_at <= now() - interval '14 days' and started_at > now() - make_interval(days => d + 14)),
    'kept14', (select count(*) from public.careers where status <> 'abandoned'
                and started_at <= now() - interval '14 days' and started_at > now() - make_interval(days => d + 14)
                and coalesce(ended_at, now()) >= started_at + interval '14 days'),
    'promoted', (select count(*) from public.careers c where status <> 'abandoned' and started_at > now() - make_interval(days => d)
                  and exists (select 1 from jsonb_array_elements(coalesce(c.state -> 'log', '[]'::jsonb)) e where e ->> 'kind' = 'promotion')),
    'working', coalesce((select jsonb_object_agg(track, n) from (select track, count(*) n from public.careers where status = 'employed' group by track) t), '{}'::jsonb),
    'aspirations', coalesce((select jsonb_object_agg(aspiration, n) from (select aspiration, count(*) n from public.aspirations group by aspiration) a), '{}'::jsonb));
end;
$$;

revoke all on function public.admin_career_stats(int) from public, anon;
grant execute on function public.admin_career_stats(int) to authenticated;
revoke all on function public.exams_passed(uuid) from public, anon, authenticated;
revoke all on function public.aspiration_of(uuid) from public, anon, authenticated;
revoke all on function public.aspiration_restart() from public, anon, authenticated;
revoke all on function public.aspiration_state() from public, anon;
revoke all on function public.aspiration_set(text) from public, anon;
grant execute on function public.aspiration_state() to authenticated;
grant execute on function public.aspiration_set(text) to authenticated;
grant execute on function public.aspiration_of(uuid) to service_role;
grant execute on function public.exams_passed(uuid) to service_role;
