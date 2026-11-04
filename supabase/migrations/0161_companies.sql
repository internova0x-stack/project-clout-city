-- Company health (owner, Nov 4: "the health of the business should be part of the world state"; lib/companies.ts).
-- Every employer (career track) has one shared state: its health, this week's target, the players' part of the week and
-- the last weeks. The server (lib/companyServer.ts, service role) rolls a week over when it ends, posting Lola's Blotter
-- when a company turns Thriving or falls to Struggling; workdays add to the week through company_add, which only adds to
-- the week it names (a stale write after the rollover does nothing). Players never touch the table: RLS on, no grants.
-- Also (owner, Nov 4: "Campaign mode is a full-time job… put the job on leave"): a running campaign puts the manager's
-- career job on leave (worked out by the server from the campaigns table, no column needed), and the campaign pays its
-- manager a fee from its own funds each campaign week: campaign_save accepts ledger 'campaign_fee' (0128's function with
-- that one kind added).
-- Safe to run more than once.

create table if not exists public.companies (
  track text primary key,
  state jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;
revoke all on table public.companies from public, anon, authenticated;

/** Adds a workday's part to this week's progress. False when the week has already rolled over (or no such company). */
create or replace function public.company_add(p_track text, p_week text, p_amount numeric) returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then return false; end if;
  update public.companies
     set state = jsonb_set(state, '{contrib}', to_jsonb(coalesce((state ->> 'contrib')::numeric, 0) + p_amount)),
         version = version + 1, updated_at = now()
   where track = p_track and state ->> 'week' = p_week;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.company_add(text, text, numeric) from public, anon, authenticated;

create or replace function public.campaign_save(
  p_player uuid, p_id uuid, p_version int, p_state jsonb, p_week int, p_status text, p_ending text, p_debate_won boolean, p_payouts jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  p jsonb;
  kind text;
  cur text;
  amt bigint;
  skimmed bigint;
  bank bigint;
begin
  if not public.rate_hit(p_player, 'campaign', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_status not in ('running', 'over') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.campaigns
     set state = p_state, week = p_week, status = p_status, ending = p_ending, debate_won = coalesce(p_debate_won, debate_won),
         version = version + 1, updated_at = now(), ended_at = case when p_status = 'over' then now() else ended_at end
   where id = p_id and player_id = p_player and version = p_version and status = 'running'
   returning version into v;
  if v is null then raise exception 'conflict' using errcode = '40001'; end if;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    kind := p ->> 'kind';
    cur := p ->> 'currency';
    amt := (p ->> 'amount')::bigint;
    -- Only this campaign's own kinds, refs and signs.
    continue when not (p ->> 'ref' like p_id::text || '%');
    continue when not ((kind = 'campaign_poll' and cur = 'clout' and amt between 1 and 30)
                    or (kind = 'campaign_reward' and cur = 'clout' and amt between -100 and 500)
                    or (kind = 'campaign_task' and cur = 'clout' and amt between 1 and 25)
                    or (kind = 'campaign_skim' and cur = 'cash' and amt > 0)
                    or (kind = 'campaign_repay' and cur = 'cash' and amt < 0)
                    -- 0161: the campaign manager's fee, paid from the campaign's funds each campaign week.
                    or (kind = 'campaign_fee' and cur = 'cash' and amt between 1 and 1000));
    if kind = 'campaign_skim' then
      skimmed := coalesce((select sum(l.amount) from public.ledger l where l.player_id = p_player and l.kind = 'campaign_skim' and l.ref like p_id::text || '%'), 0);
      amt := least(amt, 1500 - skimmed);
      continue when amt <= 0;
    end if;
    if kind = 'campaign_repay' then
      select bank_cash into bank from public.players where id = p_player;
      amt := greatest(amt, -bank);
      continue when amt = 0;
    end if;
    if public.ledger_once(p_player, cur, amt, kind, p ->> 'ref') then
      if cur = 'cash' then update public.players set bank_cash = bank_cash + amt where id = p_player;
      else update public.players set clout = greatest(0, clout + amt) where id = p_player;
      end if;
    end if;
  end loop;

  if p_status = 'over' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'campaign-ran', 'campaign') on conflict do nothing;
    if p_ending in ('clean_win', 'dirty_win') then
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, 'campaign-mayor', 'campaign') on conflict do nothing;
    end if;
  end if;
  return v;
end;
$$;
