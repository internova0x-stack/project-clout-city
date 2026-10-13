-- v0.10 step 2 (docs/08-new-features-spec.md section 7; owner Oct 13): Lucky Star's weekly jackpot.
--
-- Every card scratched in a New York week (Monday to Sunday, free or bought) is one entry. The pot is
-- the seed (C$5,000) plus 10% of every bought card that week (lotto_cards.jackpot_cut, since 0032).
-- There's no scheduler: the first call to lotto_settle() after Sunday midnight in New York draws the
-- week, once (the draw's row is claimed before anything is paid). The winning card is picked
-- uniformly from that week's cards with the cryptographic random source; the winner's bank gets the
-- pot (ledger 'lotto_jackpot', ref the week) and the 🌟 Jackpot badge. A week with no cards has no
-- draw, and its seed doesn't carry over.
--
-- lotto_state() also returns the last three draws for Lola's News card. A winner who switched on
-- "Keep me out of the gossip" (0029) is never named: the card says "a lucky Astorian".

create table public.lotto_draws (
  week      date primary key check (extract(isodow from week) = 1),
  pool      int not null default 0,
  entries   int not null default 0,
  winner    uuid references public.players (id) on delete set null,
  card      bigint,
  drawn_at  timestamptz not null default now()
);
alter table public.lotto_draws enable row level security;
revoke all on public.lotto_draws from anon, authenticated;

/** A uniform whole number from 0 to n - 1, from the cryptographic random source, without modulo bias. */
create function public.lotto_rand(p_n int) returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  v bigint;
  lim bigint;
begin
  if p_n < 1 then return 0; end if;
  lim := 4294967296 - (4294967296 % p_n);
  loop
    v := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
    if v < lim then return (v % p_n)::int; end if;
  end loop;
end;
$$;
revoke all on function public.lotto_rand(int) from public, anon, authenticated;

/** Draw every finished week that hasn't been drawn. Safe to call any time, from anyone: each week pays once. */
create function public.lotto_settle()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  seed numeric := (public.city() -> 'economy' -> 'lotto' -> 'jackpot' ->> 'seed')::numeric;
  wk date;
  n int;
  cut numeric;
  v_pool int;
  c public.lotto_cards;
  drawn int := 0;
begin
  for wk in
    select distinct k.week from public.lotto_cards k
     where k.week < public.ny_week() and not exists (select 1 from public.lotto_draws d where d.week = k.week)
     order by k.week
  loop
    -- Claim the week first: a second caller waits here, then finds it taken.
    insert into public.lotto_draws (week) values (wk) on conflict do nothing;
    if not found then continue; end if;
    select count(*), coalesce(sum(jackpot_cut), 0) into n, cut from public.lotto_cards where week = wk;
    v_pool := floor(seed + cut)::int;
    select * into c from public.lotto_cards where week = wk order by id offset public.lotto_rand(n) limit 1;
    update public.lotto_draws set pool = v_pool, entries = n, winner = c.player_id, card = c.id, drawn_at = public.game_now() where week = wk;
    update public.players set bank_cash = bank_cash + v_pool where id = c.player_id;
    perform public.ledger_once(c.player_id, 'cash', v_pool, 'lotto_jackpot', wk::text);
    insert into public.player_badges (player_id, badge_id, arc_id) values (c.player_id, 'lotto-jackpot', 'lotto:' || wk) on conflict do nothing;
    drawn := drawn + 1;
  end loop;
  return drawn;
end;
$$;
revoke all on function public.lotto_settle() from public, anon;
grant execute on function public.lotto_settle() to authenticated;

/** The counter's numbers for me (0032), plus the last three jackpot draws for the News. */
create or replace function public.lotto_state()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  today date := public.ny_today();
  wk date := public.ny_week();
  me public.players;
  until timestamptz;
begin
  select * into me from public.players where id = uid;
  if me.id is null then return null; end if;
  until := me.created_at + make_interval(days => (l -> 'beginner' ->> 'days')::int);
  return jsonb_build_object(
    'freeUsed', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid = 0),
    'freeToday', public.lotto_free_today(me.created_at),
    'bought', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid > 0),
    'beginnerUntil', case when public.game_now() < until then until end,
    'week', jsonb_build_object(
      'start', wk,
      'pool', floor((l -> 'jackpot' ->> 'seed')::numeric + coalesce((select sum(jackpot_cut) from public.lotto_cards where week = wk), 0))::int,
      'entries', (select count(*) from public.lotto_cards where player_id = uid and week = wk)),
    'unscratched', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'game', game) order by id)
                             from public.lotto_cards where player_id = uid and scratched_at is null), '[]'::jsonb),
    'draws', coalesce((select jsonb_agg(x order by x ->> 'week' desc) from (
        select jsonb_build_object(
                 'week', d.week, 'pool', d.pool, 'entries', d.entries, 'drawnAt', d.drawn_at,
                 'mine', d.winner = uid,
                 -- Named only if they haven't opted out of the gossip; the winner always sees "you".
                 'winner', case when d.winner = uid then p.display_name when coalesce(p.news_opt_out, false) then null else p.display_name end) as x
          from public.lotto_draws d left join public.players p on p.id = d.winner
         where d.winner is not null
         order by d.week desc limit 3) s), '[]'::jsonb)
  );
end;
$$;
