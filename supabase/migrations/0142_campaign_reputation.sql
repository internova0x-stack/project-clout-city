-- 0142: reputation option C (owner, Oct 31: "Stay with option c"). The candidate's Integrity in Campaign Mode and the
-- manager's own Halo ↔ Hustler meter stay separate but linked (lib/campaign.ts CAMPAIGN.rep):
--   * going in, the server reads the manager's band (reputation, once revealed) and the engine starts the candidate a
--     little cleaner or dirtier (no database change);
--   * coming out, each End Week the engine records a nudge (half of how far the candidate's Integrity moved, both ways,
--     at most ±8 a week); campaign_rep applies it to the manager's meter once per (campaign, week), capped at ±15 a
--     campaign in total, after the campaign's save.
-- Safe to run more than once.

create table if not exists public.campaign_rep (
  campaign  uuid not null references public.campaigns (id) on delete cascade,
  week      smallint not null check (week between 1 and 10),
  delta     smallint not null check (delta between -8 and 8),
  applied   smallint not null,
  at        timestamptz not null default now(),
  primary key (campaign, week)
);
alter table public.campaign_rep enable row level security;
revoke all on public.campaign_rep from anon, authenticated;

/** Applies one End Week's nudge to the manager's meter, once (service role). Returns what moved. */
create or replace function public.campaign_rep(p_player uuid, p_campaign uuid, p_week int, p_delta int) returns int
language plpgsql security definer set search_path = public
as $$
declare
  so_far int;
  d int;
  now_int int;
begin
  if not exists (select 1 from public.campaigns where id = p_campaign and player_id = p_player) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_delta is null or p_delta not between -8 and 8 or p_week is null then raise exception 'bad_effects' using errcode = '22023'; end if;
  perform 1 from public.campaigns where id = p_campaign for update;
  if exists (select 1 from public.campaign_rep where campaign = p_campaign and week = p_week) then return 0; end if;
  select coalesce(sum(applied), 0) into so_far from public.campaign_rep where campaign = p_campaign;
  d := greatest(-15 - so_far, least(15 - so_far, p_delta));
  insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
  select integrity into now_int from public.reputation where player_id = p_player for update;
  d := least(100, greatest(0, now_int + d)) - now_int;
  insert into public.campaign_rep (campaign, week, delta, applied) values (p_campaign, p_week, p_delta, d);
  if d <> 0 then update public.reputation set integrity = integrity + d, updated_at = now() where player_id = p_player; end if;
  return d;
end;
$$;

revoke all on function public.campaign_rep(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.campaign_rep(uuid, uuid, int, int) to service_role;
