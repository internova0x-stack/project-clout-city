-- Company health (owner, Nov 4: "the health of the business should be part of the world state"; lib/companies.ts).
-- Every employer (career track) has one shared state: its health, this week's target, the players' part of the week and
-- the last weeks. The server (lib/companyServer.ts, service role) rolls a week over when it ends, posting Lola's Blotter
-- when a company turns Thriving or falls to Struggling; workdays add to the week through company_add, which only adds to
-- the week it names (a stale write after the rollover does nothing). Players never touch the table: RLS on, no grants.
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
