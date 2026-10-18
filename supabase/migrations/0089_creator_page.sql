-- Creators, step 3 (spec section 21, owner Oct 18): the creator page at /creator. A creator signs in with the email
-- the Studio has for them and sees their own numbers: their code and links (read-only; only admins make links),
-- clicks, sign-ups, paying players and earnings per link, earnings by state, by month, payouts and the next payout
-- date. Counts only: never player names, chats or anything personal.
--
--   * creator_me(): the signed-in creator's page, or null when the email isn't a creator's.

do $$
begin
  if to_regprocedure('public.creator_owed(uuid, date)') is null then
    raise exception 'Run migration 0088 first.';
  end if;
end $$;

create function public.creator_me()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c public.creators;
  today date := public.ny_today();
  since date := public.ny_today() - 29;
  next_payout date := (date_trunc('month', public.ny_today()) + interval '1 month')::date;
begin
  select cr.* into c from public.creators cr join auth.users u on lower(u.email) = lower(btrim(cr.email))
   where u.id = auth.uid() limit 1;
  if c.id is null then return null; end if;
  return jsonb_build_object(
    'name', c.name, 'handle', c.handle, 'code', c.code, 'rate', c.rate, 'months', c.months, 'status', c.status,
    'termsAt', c.terms_at, 'giftCash', c.gift_cash, 'giftItem', c.gift_item,
    'owed', public.creator_owed(c.id),
    'nextPayout', next_payout,
    'totals', jsonb_build_object(
      'clicks', (select coalesce(sum(k.clicks), 0) from public.creator_clicks k join public.creator_links l on l.id = k.link_id where l.creator_id = c.id),
      'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id),
      'payers', (select count(distinct p.player_id) from public.creator_payments() p where p.creator_id = c.id and not p.refunded),
      'earnedCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m where m.creator_id = c.id)),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', l.slug, 'label', l.label, 'lands', l.lands, 'status', l.status,
               'clicks', coalesce((select sum(k.clicks) from public.creator_clicks k where k.link_id = l.id), 0),
               'signups', (select count(*) from public.creator_referrals r where r.link_id = l.id),
               'payers', (select count(distinct p.player_id) from public.creator_payments() p where p.link_id = l.id and not p.refunded),
               'earnedCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m
                                 join public.creator_referrals r on r.player_id = m.player_id
                                where m.creator_id = c.id and r.link_id = l.id))
               order by l.status, l.created_at)
        from public.creator_links l where l.creator_id = c.id), '[]'::jsonb),
    'byCode', jsonb_build_object(
      'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and r.how = 'code'),
      'payers', (select count(distinct p.player_id) from public.creator_payments() p
                   join public.creator_referrals r on r.player_id = p.player_id
                  where p.creator_id = c.id and r.how = 'code' and not p.refunded),
      'earnedCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m
                        join public.creator_referrals r on r.player_id = m.player_id
                       where m.creator_id = c.id and r.how = 'code')),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', g.d,
        'clicks', (select coalesce(sum(k.clicks), 0) from public.creator_clicks k join public.creator_links l on l.id = k.link_id where l.creator_id = c.id and k.day = g.d),
        'signups', (select count(*) from public.creator_referrals r where r.creator_id = c.id and (r.attributed_at at time zone 'America/New_York')::date = g.d),
        'revenueCents', 0,
        'commissionCents', (select coalesce(sum(m.commission_cents), 0) from public.creator_commissions m
                             where m.creator_id = c.id and (m.created_at at time zone 'America/New_York')::date = g.d))
      order by g.d), '[]'::jsonb)
      from (select generate_series(since, today, interval '1 day')::date d) g),
    'byMonth', (select coalesce(jsonb_agg(jsonb_build_object('month', x.m, 'earnedCents', x.cents, 'payments', x.n) order by x.m desc), '[]'::jsonb)
                 from (select date_trunc('month', m.created_at at time zone 'America/New_York')::date m,
                              sum(m.commission_cents) cents, count(*) filter (where m.kind <> 'reversal') n
                         from public.creator_commissions m where m.creator_id = c.id
                        group by 1 order by 1 desc limit 12) x),
    -- Payouts arrive with step 4; until then this list stays empty.
    'payouts', '[]'::jsonb);
end;
$$;
revoke all on function public.creator_me() from public, anon;
grant execute on function public.creator_me() to authenticated;
