-- Insights (owner, Oct 15: "basic metrics like total number of players, revenue, session length, new
-- signups"; plus retention, the first-day funnel, feature use and spending). An admin-only tab in the
-- Story Studio reads admin_insights().
--   * Sessions: the game pings session_ping() about once a minute while it's open and visible. A ping
--     within 5 minutes of the last one extends that session; otherwise a new session starts. Session
--     length = last ping - first ping (a single-ping visit counts as under a minute).
--   * Revenue: first payments come from purchases (paid); subscription renewals are now recorded too
--     (payment_renewal, from Stripe's invoice.paid). Refunded purchases don't count.
--   * Active players: anyone with a session ping or the daily 'session' event that day.

do $$
begin
  if to_regprocedure('public.vip_member(uuid)') is null then
    raise exception 'Run migration 0052_vip.sql first: 0053 builds on it.';
  end if;
end $$;

create table public.player_sessions (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  ny_date    date not null,
  pings      int not null default 1
);
create index player_sessions_player_idx on public.player_sessions (player_id, last_seen desc);
create index player_sessions_day_idx on public.player_sessions (ny_date);
alter table public.player_sessions enable row level security;

/** Called by the game about once a minute while it's open. Extends the current session or starts one. */
create function public.session_ping() returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.player_sessions;
begin
  if uid is null or not exists (select 1 from public.players where id = uid) then return; end if;
  select * into s from public.player_sessions where player_id = uid order by last_seen desc limit 1 for update;
  if s.id is not null and s.last_seen > now() - interval '5 minutes' then
    -- At most one ping counted per 30 seconds, so a busy tab can't inflate anything.
    if s.last_seen < now() - interval '30 seconds' then
      update public.player_sessions set last_seen = now(), pings = pings + 1 where id = s.id;
    end if;
  else
    insert into public.player_sessions (player_id, ny_date) values (uid, public.ny_today());
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Subscription renewals (Stripe invoice.paid, billing_reason subscription_cycle)
-- ---------------------------------------------------------------------------
create table public.subscription_payments (
  stripe_event_id text primary key,
  subscription_id text not null,
  player_id       uuid references public.players (id) on delete set null,
  sku             text,
  amount_cents    int not null,
  currency        text not null,
  created_at      timestamptz not null default now()
);
alter table public.subscription_payments enable row level security;

/** Records a renewal payment once per Stripe event. Service role only (the webhook). */
create function public.payment_renewal(p_event text, p_subscription text, p_amount int, p_currency text) returns text
language plpgsql security definer set search_path = public
as $$
declare
  e public.entitlements;
begin
  select * into e from public.entitlements where stripe_payment_id = p_subscription limit 1;
  insert into public.subscription_payments (stripe_event_id, subscription_id, player_id, sku, amount_cents, currency)
  values (p_event, p_subscription, e.player_id, e.sku, coalesce(p_amount, 0), coalesce(p_currency, 'usd'))
  on conflict (stripe_event_id) do nothing;
  return case when found then 'recorded' else 'duplicate' end;
end;
$$;
revoke all on function public.payment_renewal(text, text, int, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Insights tab
-- ---------------------------------------------------------------------------
/** Everything the Insights tab shows, for the last p_days days (7 to 90). Story Studio admins only. */
create function public.admin_insights(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = public set client_min_messages = warning
as $$
declare
  today date := public.ny_today();
  days int := least(90, greatest(7, coalesce(p_days, 30)));
  since date := today - (days - 1);
  result jsonb;
begin
  perform public.require_story_admin();

  create temp table if not exists ins_active (player_id uuid, d date) on commit drop;
  truncate ins_active;
  insert into ins_active
  select distinct player_id, ny_date from (
    select player_id, ny_date from public.analytics_events where name = 'session'
    union all select player_id, ny_date from public.player_sessions
  ) a;

  create temp table if not exists ins_pay (player_id uuid, sku text, cents bigint, d date) on commit drop;
  truncate ins_pay;
  insert into ins_pay
  select u.player_id, u.sku, coalesce(u.amount_cents, 0), (u.updated_at at time zone 'America/New_York')::date
    from public.purchases u where u.status = 'paid'
  union all
  select s.player_id, s.sku, s.amount_cents, (s.created_at at time zone 'America/New_York')::date from public.subscription_payments s;

  create temp table if not exists ins_players (id uuid, joined date) on commit drop;
  truncate ins_players;
  insert into ins_players
  select id, (created_at at time zone 'America/New_York')::date from public.players where home_id is not null and banned_at is null;

  result := jsonb_build_object(
    'days', days,
    'today', today,
    'totals', jsonb_build_object(
      'players', (select count(*) from ins_players),
      'accounts', (select count(*) from auth.users),
      'signupsToday', (select count(*) from ins_players where joined = today),
      'signups7', (select count(*) from ins_players where joined > today - 7),
      'signupsPeriod', (select count(*) from ins_players where joined >= since),
      'activeToday', (select count(distinct player_id) from ins_active where d = today),
      'active7', (select count(distinct player_id) from ins_active where d > today - 7),
      'active30', (select count(distinct player_id) from ins_active where d > today - 30),
      'activePeriod', (select count(distinct player_id) from ins_active where d >= since),
      'revenueCents', (select coalesce(sum(cents), 0) from ins_pay),
      'revenuePeriodCents', (select coalesce(sum(cents), 0) from ins_pay where d >= since),
      'revenue7Cents', (select coalesce(sum(cents), 0) from ins_pay where d > today - 7),
      'payers', (select count(distinct player_id) from ins_pay),
      'vipMembers', (select count(distinct player_id) from public.entitlements
                      where sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly') and status = 'active'),
      'chatForever', (select count(*) from public.entitlements where sku = 'chat-unlimited-forever' and status = 'active'),
      'refunds', (select count(*) from public.purchases where status = 'refunded'),
      'sessionsPeriod', (select count(*) from public.player_sessions where ny_date >= since),
      'avgSessionSeconds', (select coalesce(round(avg(extract(epoch from last_seen - started_at))), 0) from public.player_sessions where ny_date >= since),
      'medianSessionSeconds', (select coalesce(round(percentile_cont(0.5) within group (order by extract(epoch from last_seen - started_at))), 0)
                                 from public.player_sessions where ny_date >= since),
      'sessionsPerActiveDay', (select case when count(*) = 0 then 0 else round(sum(n)::numeric / count(*), 2) end
                                 from (select count(*) n from public.player_sessions where ny_date >= since group by player_id, ny_date) x),
      'minutesPerActiveDay', (select case when count(*) = 0 then 0 else round(sum(secs)::numeric / count(*) / 60, 1) end
                                from (select sum(extract(epoch from last_seen - started_at)) secs from public.player_sessions
                                       where ny_date >= since group by player_id, ny_date) x)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', g.d,
        'signups', (select count(*) from ins_players p where p.joined = g.d),
        'active', (select count(distinct a.player_id) from ins_active a where a.d = g.d),
        'revenueCents', (select coalesce(sum(cents), 0) from ins_pay y where y.d = g.d),
        'avgSessionSeconds', (select coalesce(round(avg(extract(epoch from s.last_seen - s.started_at))), 0) from public.player_sessions s where s.ny_date = g.d))
      order by g.d), '[]'::jsonb)
      from (select generate_series(since, today, interval '1 day')::date d) g),
    'retention', jsonb_build_object(
      'd1', (select jsonb_build_object('cohort', count(*), 'returned', count(*) filter (where exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 1)))
               from ins_players p where p.joined <= today - 1),
      'd7', (select jsonb_build_object('cohort', count(*), 'returned', count(*) filter (where exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 7)))
               from ins_players p where p.joined <= today - 7),
      'd30', (select jsonb_build_object('cohort', count(*), 'returned', count(*) filter (where exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 30)))
               from ins_players p where p.joined <= today - 30)),
    'cohorts', (select coalesce(jsonb_agg(c order by c ->> 'week' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'week', w.week,
          'size', count(*),
          'd1', count(*) filter (where p.joined <= today - 1 and exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 1)),
          'd1Eligible', count(*) filter (where p.joined <= today - 1),
          'd7', count(*) filter (where p.joined <= today - 7 and exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 7)),
          'd7Eligible', count(*) filter (where p.joined <= today - 7),
          'd30', count(*) filter (where p.joined <= today - 30 and exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 30)),
          'd30Eligible', count(*) filter (where p.joined <= today - 30)) c
          from ins_players p cross join lateral (select date_trunc('week', p.joined)::date week) w
         where p.joined > today - 56
         group by w.week) x),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Signed up', 'n', (select count(*) from auth.users)),
      jsonb_build_object('step', 'Made a character', 'n', (select count(*) from public.players)),
      jsonb_build_object('step', 'Moved into a home', 'n', (select count(*) from public.players where home_id is not null)),
      jsonb_build_object('step', 'Went to the first party', 'n', (select count(*) from public.players where first_party_at is not null)),
      jsonb_build_object('step', 'Came back the next day', 'n', (select count(*) from ins_players p where exists (select 1 from ins_active a where a.player_id = p.id and a.d = p.joined + 1))),
      jsonb_build_object('step', 'Made a purchase', 'n', (select count(distinct player_id) from ins_pay))),
    'features', jsonb_build_array(
      jsonb_build_object('feature', 'Visited a place', 'players', (select count(distinct player_id) from public.place_visits where ny_date >= since)),
      jsonb_build_object('feature', 'Finished a daily task', 'players', (select count(distinct player_id) from public.daily_tasks where ny_date >= since and done_at is not null)),
      jsonb_build_object('feature', 'Read a story beat', 'players', (select count(distinct player_id) from public.story_beats_seen where (seen_at at time zone 'America/New_York')::date >= since)),
      jsonb_build_object('feature', 'Sent a chat message', 'players', (select count(distinct sender) from public.messages where ny_date >= since)),
      jsonb_build_object('feature', 'Found gossip', 'players', (select count(distinct player_id) from public.gossip_found where (found_at at time zone 'America/New_York')::date >= since)),
      jsonb_build_object('feature', 'Played a treasure hunt', 'players', (select count(distinct player_id) from public.hunt_progress where (joined_at at time zone 'America/New_York')::date >= since)),
      jsonb_build_object('feature', 'Went to a club event', 'players', (select count(distinct player_id) from public.event_attendance where ny_date >= since)),
      jsonb_build_object('feature', 'Went on a crew outing', 'players', (select count(distinct player_id) from public.crew_outing_members where went_at is not null and (went_at at time zone 'America/New_York')::date >= since)),
      jsonb_build_object('feature', 'Bought a lotto card', 'players', (select count(distinct player_id) from public.lotto_cards where ny_date >= since)),
      jsonb_build_object('feature', 'Owns a business', 'players', (select count(distinct player_id) from public.player_businesses)),
      jsonb_build_object('feature', 'Earned a together bonus', 'players', (select count(distinct player_id) from public.together_bonuses where ny_date >= since)),
      jsonb_build_object('feature', 'Took a job', 'players', (select count(distinct worker) from public.jobs where taken_at is not null and (taken_at at time zone 'America/New_York')::date >= since))),
    'spending', (select coalesce(jsonb_agg(x order by (x ->> 'cents')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object('type', coalesce(s.product_type, 'other'), 'count', count(*), 'cents', sum(y.cents), 'buyers', count(distinct y.player_id)) x
          from ins_pay y left join public.store_products s on s.sku = y.sku
         group by s.product_type) z),
    'topProducts', (select coalesce(jsonb_agg(x order by (x ->> 'cents')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object('sku', y.sku, 'name', coalesce(s.name, y.sku), 'count', count(*), 'cents', sum(y.cents)) x
          from ins_pay y left join public.store_products s on s.sku = y.sku
         group by y.sku, s.name order by sum(y.cents) desc limit 8) z),
    'ranks', (select coalesce(jsonb_agg(jsonb_build_object('level', lvl, 'players', n) order by lvl), '[]'::jsonb) from (
        select public.rank_level(p.clout, public.net_worth(p.id)) lvl, count(*) n
          from public.players p where p.home_id is not null and p.banned_at is null group by 1) r),
    'economy', (select jsonb_build_object(
        'medianCash', coalesce(percentile_cont(0.5) within group (order by bank_cash), 0),
        'medianClout', coalesce(percentile_cont(0.5) within group (order by clout), 0))
      from public.players where home_id is not null and banned_at is null)
  );
  return result;
end;
$$;
