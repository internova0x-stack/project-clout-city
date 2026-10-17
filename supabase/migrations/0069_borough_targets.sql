-- Borough targets (owner, Oct 17): every locked borough has its own target of players out at once, and they open
-- in order: Brooklyn (100), The Bronx (250), Staten Island (500), Manhattan last (1,000), each on 3 different days.
-- A borough's days only count once the borough before it has opened (from that New York day on), so the city
-- opens one borough at a time. Studio admins can still open any borough by hand (admin_open_borough).
-- Targets live in borough_gates: change one with an update, no code change needed.
-- Safe to run more than once.

alter table public.borough_gates add column if not exists position int;
update public.borough_gates set position = 1 where id = 'brooklyn' and position is null;
insert into public.borough_gates (id, target, days_needed, position) values
  ('bronx', 250, 3, 2), ('staten_island', 500, 3, 3), ('manhattan', 1000, 3, 4)
on conflict (id) do nothing;

/** The first New York day a gate's days count from: when the borough before it opened (null: not yet). */
create or replace function public.borough_counts_from(p_borough text) returns date
language sql stable security definer set search_path = public
as $$
  select case
           when prev.id is null then date '2000-01-01'
           when prev.opened_at is null then null
           else (prev.opened_at at time zone 'America/New_York')::date
         end
    from public.borough_gates g
    left join lateral (select * from public.borough_gates p where p.position < g.position order by p.position desc limit 1) prev on true
   where g.id = p_borough
$$;

/** Days that reached a gate's target since its days started counting. */
create or replace function public.borough_days_hit(p_borough text) returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.concurrency_days d, public.borough_gates g
   where g.id = p_borough and d.peak >= g.target and d.ny_date >= public.borough_counts_from(p_borough)
$$;

/** Records today's peak and opens the next borough in line once its rule is met (one at a time). */
create or replace function public.borough_tick() returns void
language plpgsql security definer set search_path = public
as $$
declare n int := public.players_online();
begin
  insert into public.concurrency_days (ny_date, peak) values (public.ny_today(), n)
  on conflict (ny_date) do update set peak = greatest(public.concurrency_days.peak, excluded.peak);
  update public.borough_gates g set opened_at = now(), opened_by = 'players'
   where g.id = (select id from public.borough_gates where opened_at is null order by position limit 1)
     and public.borough_counts_from(g.id) is not null
     and public.borough_days_hit(g.id) >= g.days_needed;
end;
$$;

/** What the app shows for each gated borough, in unlock order. counting: its days are being counted now. */
create or replace function public.borough_state() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'open', g.opened_at is not null, 'target', g.target, 'daysNeeded', g.days_needed,
           'counting', g.opened_at is null and public.borough_counts_from(g.id) is not null,
           'daysHit', coalesce(public.borough_days_hit(g.id), 0),
           'online', public.players_online(),
           'peakToday', coalesce((select peak from public.concurrency_days where ny_date = public.ny_today()), 0))
         order by g.position), '[]'::jsonb)
    from public.borough_gates g
   where auth.uid() is not null
$$;

revoke all on function public.borough_counts_from(text) from public, anon, authenticated;
revoke all on function public.borough_days_hit(text) from public, anon, authenticated;
revoke all on function public.borough_tick() from public, anon, authenticated;
revoke all on function public.borough_state() from public, anon;
grant execute on function public.borough_state() to authenticated;
