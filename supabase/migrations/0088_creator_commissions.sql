-- Creators, step 2 (spec section 21, owner Oct 18): commissions and performance.
--
--   * creator_commissions: one row per payment by a referred player inside the creator's window (sale or renewal),
--     written by the Stripe webhook once per payment (source), on net revenue: the price minus Stripe's fee and tax,
--     at the creator's rate on the day of the payment. Refunds (full or partial) add a reversal row per refund event,
--     in proportion to what was refunded. Nothing is "held" or "payable" in storage: a row is held until payable_on
--     (45 days after the payment), payable after, paid once a payout marks it (payouts are step 4).
--   * creator_referred(player), creator_subscription_player(subscription), creator_commission_record(...),
--     creator_commission_refund(...): the webhook's calls
--     (service role only).
--   * creator_payments(): every payment by a referred player since they were attributed (internal).
--   * admin_creators(days) gains the money columns; admin_affiliates_overview(days) and admin_creator(id, days) are
--     the Studio's Overview and one affiliate's page (admins only). The player list there is admin-only.

do $$
begin
  if to_regprocedure('public.creator_attach(text, text)') is null then
    raise exception 'Run migration 0087 first.';
  end if;
end $$;

create table public.creator_commissions (
  id               bigint generated always as identity primary key,
  creator_id       uuid not null references public.creators (id),
  player_id        uuid references public.players (id) on delete set null,
  kind             text not null check (kind in ('sale', 'renewal', 'reversal')),
  source           text not null,
  stripe_event     text not null,
  payment_intent   text,
  invoice          text,
  sku              text,
  gross_cents      int not null,
  fee_cents        int not null,
  tax_cents        int not null,
  net_cents        int not null,
  fee_estimated    boolean not null default false,
  rate             numeric(4, 1) not null,
  commission_cents int not null,
  currency         text not null default 'usd',
  payable_on       date not null,
  paid_at          timestamptz,
  payout_id        bigint,
  created_at       timestamptz not null default now(),
  unique (source, stripe_event)
);
create unique index creator_commissions_payment_idx on public.creator_commissions (source) where kind <> 'reversal';
create index creator_commissions_creator_idx on public.creator_commissions (creator_id, created_at);
create index creator_commissions_pi_idx on public.creator_commissions (payment_intent);
create index creator_commissions_invoice_idx on public.creator_commissions (invoice);
alter table public.creator_commissions enable row level security;

-- ---------------------------------------------------------------------------
-- The webhook's calls
-- ---------------------------------------------------------------------------

/** Whether a player came through a creator (so the webhook only asks Stripe for fees when it matters). */
create function public.creator_referred(p_player uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.creator_referrals where player_id = p_player) $$;
revoke all on function public.creator_referred(uuid) from public, anon, authenticated;
grant execute on function public.creator_referred(uuid) to service_role;

/** The referred player behind a VIP subscription (for renewals), or null when they didn't come through a creator. */
create function public.creator_subscription_player(p_subscription text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select e.player_id from public.entitlements e
   where e.stripe_payment_id = p_subscription and exists (select 1 from public.creator_referrals r where r.player_id = e.player_id)
   limit 1
$$;
revoke all on function public.creator_subscription_player(text) from public, anon, authenticated;
grant execute on function public.creator_subscription_player(text) to service_role;

/** One payment's commission, once per source ('purchase:<session>' or 'renewal:<invoice>'). */
create function public.creator_commission_record(
  p_event text, p_source text, p_kind text, p_player uuid, p_sku text, p_payment_intent text, p_invoice text,
  p_gross int, p_fee int, p_tax int, p_currency text, p_fee_estimated boolean default false
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  r public.creator_referrals;
  c public.creators;
  v_net int;
begin
  if p_kind not in ('sale', 'renewal') then raise exception 'bad_kind' using errcode = '22023'; end if;
  select * into r from public.creator_referrals where player_id = p_player;
  if r.player_id is null then return 'not_referred'; end if;
  if r.commission_until is not null and now() > r.commission_until then return 'window_over'; end if;
  if exists (select 1 from public.creator_commissions where source = p_source and kind <> 'reversal') then return 'duplicate'; end if;
  select * into c from public.creators where id = r.creator_id;
  v_net := greatest(0, coalesce(p_gross, 0) - coalesce(p_fee, 0) - coalesce(p_tax, 0));
  insert into public.creator_commissions (creator_id, player_id, kind, source, stripe_event, payment_intent, invoice, sku,
                                          gross_cents, fee_cents, tax_cents, net_cents, fee_estimated, rate, commission_cents,
                                          currency, payable_on)
  values (c.id, p_player, p_kind, p_source, p_event, p_payment_intent, p_invoice, p_sku,
          coalesce(p_gross, 0), coalesce(p_fee, 0), coalesce(p_tax, 0), v_net, coalesce(p_fee_estimated, false), c.rate,
          round(v_net * c.rate / 100)::int, coalesce(lower(p_currency), 'usd'), public.ny_today() + 45)
  on conflict do nothing;
  return case when found then 'recorded' else 'duplicate' end;
end;
$$;
revoke all on function public.creator_commission_record(text, text, text, uuid, text, text, text, int, int, int, text, boolean) from public, anon, authenticated;
grant execute on function public.creator_commission_record(text, text, text, uuid, text, text, text, int, int, int, text, boolean) to service_role;

/**
 * A refund (full or partial) of a payment that earned a commission: takes back the same share of it. Stripe sends
 * the running total refunded on the charge, so each event tops the reversal up to that share and replays add nothing.
 * Reversals of unpaid commission land with the original (inside the hold); of paid commission, against the next payout.
 */
create function public.creator_commission_refund(p_event text, p_payment_intent text, p_invoice text, p_refunded int, p_amount int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  o public.creator_commissions;
  share numeric := case when coalesce(p_amount, 0) > 0 then least(1, greatest(0, coalesce(p_refunded, 0)::numeric / p_amount)) else 1 end;
  back int;
  done int;
  n int := 0;
begin
  for o in select * from public.creator_commissions
            where kind <> 'reversal'
              and ((p_payment_intent is not null and payment_intent = p_payment_intent) or (p_invoice is not null and invoice = p_invoice))
  loop
    select coalesce(-sum(commission_cents), 0) into done from public.creator_commissions where source = o.source and kind = 'reversal';
    back := round(o.commission_cents * share)::int - done;
    if back > 0 then
      insert into public.creator_commissions (creator_id, player_id, kind, source, stripe_event, payment_intent, invoice, sku,
                                              gross_cents, fee_cents, tax_cents, net_cents, fee_estimated, rate, commission_cents,
                                              currency, payable_on)
      values (o.creator_id, o.player_id, 'reversal', o.source, p_event, o.payment_intent, o.invoice, o.sku,
              -round(o.gross_cents * share)::int, 0, 0, -round(o.net_cents * share)::int, false, o.rate, -back,
              o.currency, case when o.paid_at is null then o.payable_on else public.ny_today() end)
      on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.creator_commission_refund(text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.creator_commission_refund(text, text, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- What referred players paid (internal)
-- ---------------------------------------------------------------------------

/** Every real-money payment by a referred player since they were attributed: purchases and VIP renewals. */
create function public.creator_payments()
returns table (creator_id uuid, link_id bigint, player_id uuid, sku text, cents bigint, refunded boolean, d date)
language sql stable security definer set search_path = public
as $$
  select r.creator_id, r.link_id, r.player_id, u.sku, coalesce(u.amount_cents, 0)::bigint, u.status = 'refunded',
         (u.created_at at time zone 'America/New_York')::date
    from public.creator_referrals r join public.purchases u on u.player_id = r.player_id
   where u.status in ('paid', 'refunded') and u.created_at >= r.attributed_at
  union all
  select r.creator_id, r.link_id, r.player_id, s.sku, s.amount_cents::bigint, false,
         (s.created_at at time zone 'America/New_York')::date
    from public.creator_referrals r join public.subscription_payments s on s.player_id = r.player_id
   where s.created_at >= r.attributed_at
$$;
revoke all on function public.creator_payments() from public, anon, authenticated;

/** A creator's commission by state, today: held (inside the 45 days), payable, paid. */
create function public.creator_owed(p_creator uuid, p_since date default '-infinity')
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'heldCents', coalesce(sum(commission_cents) filter (where paid_at is null and payable_on > public.ny_today()), 0),
    'payableCents', coalesce(sum(commission_cents) filter (where paid_at is null and payable_on <= public.ny_today()), 0),
    'paidCents', coalesce(sum(commission_cents) filter (where paid_at is not null), 0),
    'periodCents', coalesce(sum(commission_cents) filter (where (created_at at time zone 'America/New_York')::date >= p_since), 0),
    'periodNetCents', coalesce(sum(net_cents) filter (where (created_at at time zone 'America/New_York')::date >= p_since), 0))
  from public.creator_commissions where creator_id = p_creator
$$;
revoke all on function public.creator_owed(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Studio (admins only)
-- ---------------------------------------------------------------------------

/** Every creator with their links and numbers for the last p_days days (0 = all time), now with money. */
create or replace function public.admin_creators(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  since date := case when coalesce(p_days, 0) > 0 then public.ny_today() - (p_days - 1) else '-infinity'::date end;
  since_ts timestamptz := case when coalesce(p_days, 0) > 0 then (since::timestamp at time zone 'America/New_York') else '-infinity'::timestamptz end;
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'days', coalesce(p_days, 0),
    'creators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'handle', c.handle, 'email', c.email, 'code', c.code, 'rate', c.rate,
               'months', c.months, 'giftCash', c.gift_cash, 'giftItem', c.gift_item, 'status', c.status,
               'termsAt', c.terms_at, 'note', c.note, 'createdAt', c.created_at,
               'clicks', coalesce((select sum(k.clicks) from public.creator_clicks k join public.creator_links l on l.id = k.link_id
                                    where l.creator_id = c.id and k.day >= since), 0),
               'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and r.attributed_at >= since_ts),
               'byCode', (select count(*) from public.creator_referrals r where r.creator_id = c.id and r.attributed_at >= since_ts and r.how = 'code'),
               'signupsAll', (select count(*) from public.creator_referrals r where r.creator_id = c.id),
               'payers', (select count(distinct p.player_id) from public.creator_payments() p where p.creator_id = c.id and not p.refunded and p.d >= since),
               'revenueCents', (select coalesce(sum(p.cents), 0) from public.creator_payments() p where p.creator_id = c.id and not p.refunded and p.d >= since),
               'refundRate', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where p.refunded) / count(*), 1) end
                                from public.creator_payments() p where p.creator_id = c.id and p.d >= since),
               'owed', public.creator_owed(c.id, since),
               'links', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', l.id, 'slug', l.slug, 'label', l.label, 'lands', l.lands, 'campaign', l.campaign,
                          'videoUrl', l.video_url, 'status', l.status, 'createdAt', l.created_at,
                          'clicks', coalesce((select sum(k.clicks) from public.creator_clicks k where k.link_id = l.id and k.day >= since), 0),
                          'signups', (select count(*) from public.creator_referrals r where r.link_id = l.id and r.attributed_at >= since_ts),
                          'payers', (select count(distinct p.player_id) from public.creator_payments() p where p.link_id = l.id and not p.refunded and p.d >= since),
                          'revenueCents', (select coalesce(sum(p.cents), 0) from public.creator_payments() p where p.link_id = l.id and not p.refunded and p.d >= since))
                          order by l.status, l.created_at)
                   from public.creator_links l where l.creator_id = c.id), '[]'::jsonb))
             order by c.status, c.created_at)
        from public.creators c), '[]'::jsonb));
end;
$$;

/** The Affiliates Overview: totals for the period, by day, and the top creators and links. */
create function public.admin_affiliates_overview(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  days int := case when coalesce(p_days, 0) > 0 then least(366, p_days) else 0 end;
  since date := case when days > 0 then today - (days - 1) else '-infinity'::date end;
  chart_from date;
begin
  perform public.require_story_admin();
  -- All time charts from the first sign-up, at most 90 days back.
  chart_from := case when days > 0 then since
                     else greatest(today - 89, coalesce((select min((attributed_at at time zone 'America/New_York')::date) from public.creator_referrals), today)) end;
  return jsonb_build_object(
    'days', days,
    'today', today,
    'totals', jsonb_build_object(
      'clicks', (select coalesce(sum(clicks), 0) from public.creator_clicks where day >= since),
      'signups', (select count(*) from public.creator_referrals where (attributed_at at time zone 'America/New_York')::date >= since),
      'payers', (select count(distinct player_id) from public.creator_payments() where not refunded and d >= since),
      'revenueCents', (select coalesce(sum(cents), 0) from public.creator_payments() where not refunded and d >= since),
      'netCents', (select coalesce(sum(net_cents), 0) from public.creator_commissions where (created_at at time zone 'America/New_York')::date >= since),
      'commissionCents', (select coalesce(sum(commission_cents), 0) from public.creator_commissions where (created_at at time zone 'America/New_York')::date >= since),
      'heldCents', (select coalesce(sum(commission_cents), 0) from public.creator_commissions where paid_at is null and payable_on > today),
      'payableCents', (select coalesce(sum(commission_cents), 0) from public.creator_commissions where paid_at is null and payable_on <= today),
      'paidCents', (select coalesce(sum(commission_cents), 0) from public.creator_commissions where paid_at is not null)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', g.d,
        'clicks', (select coalesce(sum(clicks), 0) from public.creator_clicks k where k.day = g.d),
        'signups', (select count(*) from public.creator_referrals r where (r.attributed_at at time zone 'America/New_York')::date = g.d),
        'revenueCents', (select coalesce(sum(cents), 0) from public.creator_payments() p where not p.refunded and p.d = g.d),
        'commissionCents', (select coalesce(sum(commission_cents), 0) from public.creator_commissions m where (m.created_at at time zone 'America/New_York')::date = g.d))
      order by g.d), '[]'::jsonb)
      from (select generate_series(chart_from, today, interval '1 day')::date d) g),
    'topCreators', (select coalesce(jsonb_agg(x order by (x ->> 'revenueCents')::bigint desc, (x ->> 'signups')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'name', c.name,
                 'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and (r.attributed_at at time zone 'America/New_York')::date >= since),
                 'revenueCents', (select coalesce(sum(cents), 0) from public.creator_payments() p where p.creator_id = c.id and not p.refunded and p.d >= since)) x
          from public.creators c) t limit 5),
    'topLinks', (select coalesce(jsonb_agg(x order by (x ->> 'signups')::int desc, (x ->> 'clicks')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', l.id, 'slug', l.slug, 'creator', c.name,
                 'clicks', (select coalesce(sum(k.clicks), 0) from public.creator_clicks k where k.link_id = l.id and k.day >= since),
                 'signups', (select count(*) from public.creator_referrals r where r.link_id = l.id and (r.attributed_at at time zone 'America/New_York')::date >= since)) x
          from public.creator_links l join public.creators c on c.id = l.creator_id) t limit 5));
end;
$$;
revoke all on function public.admin_affiliates_overview(int) from public, anon;
grant execute on function public.admin_affiliates_overview(int) to authenticated;

/**
 * One affiliate's page: by-day numbers, the funnel, what their players bought, retention, commission history and
 * the players they brought in (admins only; creators never see who their players are).
 */
create function public.admin_creator(p_creator uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  days int := case when coalesce(p_days, 0) > 0 then least(366, p_days) else 0 end;
  since date := case when days > 0 then today - (days - 1) else '-infinity'::date end;
  c public.creators;
  chart_from date;
begin
  perform public.require_story_admin();
  select * into c from public.creators where id = p_creator;
  if c.id is null then raise exception 'no_creator' using errcode = 'P0002'; end if;
  chart_from := case when days > 0 then since else greatest((c.created_at at time zone 'America/New_York')::date, today - 89) end;
  return jsonb_build_object(
    'days', days,
    'today', today,
    'creator', jsonb_build_object('id', c.id, 'name', c.name, 'handle', c.handle, 'code', c.code, 'rate', c.rate, 'months', c.months, 'status', c.status),
    'owed', public.creator_owed(c.id, since),
    'funnel', jsonb_build_object(
      'clicks', (select coalesce(sum(k.clicks), 0) from public.creator_clicks k join public.creator_links l on l.id = k.link_id where l.creator_id = c.id and k.day >= since),
      'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and (r.attributed_at at time zone 'America/New_York')::date >= since),
      'movedIn', (select count(*) from public.creator_referrals r join public.players p on p.id = r.player_id
                   where r.creator_id = c.id and p.home_id is not null and (r.attributed_at at time zone 'America/New_York')::date >= since),
      'payers', (select count(distinct x.player_id) from public.creator_payments() x
                   join public.creator_referrals r on r.player_id = x.player_id
                  where x.creator_id = c.id and not x.refunded and (r.attributed_at at time zone 'America/New_York')::date >= since),
      'vip', (select count(distinct r.player_id) from public.creator_referrals r
               where r.creator_id = c.id and (r.attributed_at at time zone 'America/New_York')::date >= since
                 and exists (select 1 from public.entitlements e where e.player_id = r.player_id
                              and e.sku in ('chat-unlimited-monthly', 'chat-unlimited-yearly') and e.created_at >= r.attributed_at))),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', g.d,
        'clicks', (select coalesce(sum(k.clicks), 0) from public.creator_clicks k join public.creator_links l on l.id = k.link_id where l.creator_id = c.id and k.day = g.d),
        'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and (r.attributed_at at time zone 'America/New_York')::date = g.d),
        'revenueCents', (select coalesce(sum(p.cents), 0) from public.creator_payments() p where p.creator_id = c.id and not p.refunded and p.d = g.d))
      order by g.d), '[]'::jsonb)
      from (select generate_series(chart_from, today, interval '1 day')::date d) g),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('sku', x.sku, 'name', coalesce(s.name, x.sku), 'type', s.product_type,
                                                                'count', x.n, 'revenueCents', x.cents) order by x.cents desc), '[]'::jsonb)
                   from (select p.sku, count(*) n, sum(p.cents) cents from public.creator_payments() p
                          where p.creator_id = c.id and not p.refunded and p.d >= since group by p.sku) x
                   left join public.store_products s on s.sku = x.sku),
    'retention', (
      with joined as (
        select r.player_id, (r.attributed_at at time zone 'America/New_York')::date j from public.creator_referrals r where r.creator_id = c.id),
      active as (select distinct s.player_id, s.ny_date d from public.player_sessions s where s.player_id in (select player_id from joined))
      select jsonb_build_object(
        'd1', jsonb_build_object('cohort', count(*) filter (where j <= today - 1),
                                 'returned', count(*) filter (where j <= today - 1 and exists (select 1 from active a where a.player_id = joined.player_id and a.d = j + 1))),
        'd7', jsonb_build_object('cohort', count(*) filter (where j <= today - 7),
                                 'returned', count(*) filter (where j <= today - 7 and exists (select 1 from active a where a.player_id = joined.player_id and a.d = j + 7))),
        'd30', jsonb_build_object('cohort', count(*) filter (where j <= today - 30),
                                  'returned', count(*) filter (where j <= today - 30 and exists (select 1 from active a where a.player_id = joined.player_id and a.d = j + 30))))
      from joined),
    'commissions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'sku', m.sku, 'name', coalesce(s.name, m.sku), 'player', p.display_name, 'at', m.created_at,
        'grossCents', m.gross_cents, 'feeCents', m.fee_cents, 'taxCents', m.tax_cents, 'netCents', m.net_cents,
        'feeEstimated', m.fee_estimated, 'rate', m.rate, 'commissionCents', m.commission_cents, 'payableOn', m.payable_on,
        'state', case when m.paid_at is not null then 'paid' when m.payable_on > today then 'held' else 'payable' end)
        order by m.created_at desc), '[]'::jsonb)
      from (select * from public.creator_commissions where creator_id = c.id order by created_at desc limit 200) m
      left join public.store_products s on s.sku = m.sku
      left join public.players p on p.id = m.player_id),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'joinedAt', r.attributed_at, 'how', r.how, 'link', l.slug,
        'spendCents', (select coalesce(sum(x.cents), 0) from public.creator_payments() x where x.player_id = p.id and not x.refunded),
        'commissionCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m where m.player_id = p.id and m.creator_id = c.id),
        'lastSeen', greatest(p.seen_at, (select max(s.last_seen) from public.player_sessions s where s.player_id = p.id)),
        'until', r.commission_until)
        order by r.attributed_at desc), '[]'::jsonb)
      from public.creator_referrals r join public.players p on p.id = r.player_id
      left join public.creator_links l on l.id = r.link_id
      where r.creator_id = c.id));
end;
$$;
revoke all on function public.admin_creator(uuid, int) from public, anon;
grant execute on function public.admin_creator(uuid, int) to authenticated;
