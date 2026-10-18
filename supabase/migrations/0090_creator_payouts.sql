-- Creators, step 4 (spec section 21, owner Oct 18): payouts, phase 1 (by hand during the soft launch).
--
--   * creator_payouts: one row per payout we send: creator, the month it covers, total, method (bank transfer,
--     PayPal, other, or a Stripe transfer once Connect is on), our reference (never bank details), note, who marked
--     it and when. A payout marked by mistake is voided, not deleted, and its commission becomes payable again.
--   * admin_payouts(): what each creator is owed today (payable after the 45-day hold), whether they've reached the
--     $50 minimum, and the payout history (admins only).
--   * admin_payout_mark(creator, method, reference, note, below_minimum): marks everything payable for a creator as
--     paid in one payout. The $50 minimum holds unless below_minimum is set (closing a deal).
--   * admin_payout_void(payout, reason): undoes a payout marked by mistake.
--   * creator_me() now lists the creator's payouts.

do $$
begin
  if to_regprocedure('public.creator_me()') is null then
    raise exception 'Run migration 0089 first.';
  end if;
end $$;

create table public.creator_payouts (
  id              bigint generated always as identity primary key,
  creator_id      uuid not null references public.creators (id),
  period          date not null,
  total_cents     int not null check (total_cents > 0),
  currency        text not null default 'usd',
  method          text not null check (method in ('bank_transfer', 'paypal', 'other', 'stripe_connect')),
  reference       text check (char_length(reference) <= 120),
  note            text check (char_length(note) <= 300),
  stripe_transfer text,
  paid_by         uuid,
  paid_at         timestamptz not null default now(),
  voided_at       timestamptz,
  void_reason     text check (char_length(void_reason) <= 300)
);
create index creator_payouts_creator_idx on public.creator_payouts (creator_id, paid_at desc);
alter table public.creator_payouts enable row level security;
alter table public.creator_commissions add constraint creator_commissions_payout_fk
  foreign key (payout_id) references public.creator_payouts (id);

/** What each creator is owed today and the payout history. */
create function public.admin_payouts()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  today date := public.ny_today();
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'today', today,
    'minimumCents', 5000,
    'due', coalesce((
      select jsonb_agg(x order by (x ->> 'payableCents')::int desc) from (
        select jsonb_build_object(
                 'creatorId', c.id, 'name', c.name, 'handle', c.handle, 'email', c.email, 'code', c.code, 'status', c.status,
                 'connectAccount', c.connect_account,
                 'payableCents', coalesce(sum(m.commission_cents) filter (where m.paid_at is null and m.payable_on <= today), 0),
                 'heldCents', coalesce(sum(m.commission_cents) filter (where m.paid_at is null and m.payable_on > today), 0),
                 'nextPayableOn', min(m.payable_on) filter (where m.paid_at is null and m.payable_on > today),
                 'lastPaidAt', (select max(p.paid_at) from public.creator_payouts p where p.creator_id = c.id and p.voided_at is null)) x
          from public.creators c left join public.creator_commissions m on m.creator_id = c.id
         group by c.id) t
      where (x ->> 'payableCents')::int <> 0 or (x ->> 'heldCents')::int <> 0), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'creatorId', p.creator_id, 'name', c.name, 'email', c.email, 'period', p.period,
               'totalCents', p.total_cents, 'currency', p.currency, 'method', p.method, 'reference', p.reference, 'note', p.note,
               'paidAt', p.paid_at, 'paidBy', (select u.email from auth.users u where u.id = p.paid_by),
               'items', (select count(*) from public.creator_commissions m where m.payout_id = p.id),
               'voidedAt', p.voided_at, 'voidReason', p.void_reason)
             order by p.paid_at desc)
        from (select * from public.creator_payouts order by paid_at desc limit 200) p join public.creators c on c.id = p.creator_id), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_payouts() from public, anon;
grant execute on function public.admin_payouts() to authenticated;

/** Marks everything payable for a creator as paid, in one payout. Returns the payout's id and total. */
create function public.admin_payout_mark(p_creator uuid, p_method text, p_reference text default null, p_note text default null,
                                         p_below_minimum boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  v_total int;
  v_id bigint;
begin
  perform public.require_story_admin();
  if p_method not in ('bank_transfer', 'paypal', 'other', 'stripe_connect') then raise exception 'bad_method' using errcode = '22023'; end if;
  if not exists (select 1 from public.creators where id = p_creator) then raise exception 'no_creator' using errcode = 'P0002'; end if;
  -- Lock the rows so two admins can't pay the same commission twice.
  perform 1 from public.creator_commissions where creator_id = p_creator and paid_at is null and payable_on <= today for update;
  select coalesce(sum(commission_cents), 0) into v_total
    from public.creator_commissions where creator_id = p_creator and paid_at is null and payable_on <= today;
  if v_total <= 0 then raise exception 'nothing_payable' using errcode = '22023'; end if;
  if v_total < 5000 and not coalesce(p_below_minimum, false) then raise exception 'below_minimum' using errcode = '22023'; end if;
  insert into public.creator_payouts (creator_id, period, total_cents, method, reference, note, paid_by)
  values (p_creator, date_trunc('month', today)::date, v_total, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  update public.creator_commissions set paid_at = now(), payout_id = v_id
   where creator_id = p_creator and paid_at is null and payable_on <= today;
  return jsonb_build_object('id', v_id, 'totalCents', v_total);
end;
$$;
revoke all on function public.admin_payout_mark(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_payout_mark(uuid, text, text, text, boolean) to authenticated;

/** Undoes a payout marked by mistake: it stays in the history as voided, and its commission is payable again. */
create function public.admin_payout_void(p_payout bigint, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.creator_payouts set voided_at = now(), void_reason = btrim(p_reason) where id = p_payout and voided_at is null;
  if not found then raise exception 'no_payout' using errcode = 'P0002'; end if;
  update public.creator_commissions set paid_at = null, payout_id = null where payout_id = p_payout;
end;
$$;
revoke all on function public.admin_payout_void(bigint, text) from public, anon;
grant execute on function public.admin_payout_void(bigint, text) to authenticated;

create or replace function public.creator_me()
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
    'payouts', (select coalesce(jsonb_agg(jsonb_build_object('period', p.period, 'totalCents', p.total_cents, 'paidAt', p.paid_at,
                                                              'method', p.method) order by p.paid_at desc), '[]'::jsonb)
                  from public.creator_payouts p where p.creator_id = c.id and p.voided_at is null));
end;
$$;
revoke all on function public.creator_me() from public, anon;
grant execute on function public.creator_me() to authenticated;
