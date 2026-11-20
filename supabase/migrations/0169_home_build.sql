-- Build mode (owner, Nov 20: "Can we build out the building time sink. Move walls, add rooms, landscapes etc";
-- "Renters can move walls"; the contractor is "Instant"). A player's plan for their home lives in players.home_plan:
-- the rooms on each floor (walls and doorways follow the rooms), the wall paint and the Outside floor's garden
-- (lib/homeBuild.ts HomePlan). The server action (app/home/buildActions.ts) checks a plan and prices it with
-- lib/homeBuild.ts, then home_build_save charges the price (ledger 'home_build', never below zero) and stores it.
-- Moving out (another home or house, eviction, Start over) clears the plan: it was built for that home.

alter table public.players add column if not exists home_plan jsonb;

insert into public.game_settings (key, value) values ('home_build', '{"wallPerMetre":40,"demolishPerMetre":10,"floorPerSqm":12,"zonePerSqm":8,"paint":150,"maxRooms":10,"maxPieces":40,"minSide":1.5}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Service role only: the price comes from the server's own check of the plan, never from the browser.
create or replace function public.home_build_save(p_player uuid, p_plan jsonb, p_cost int, p_ref text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
begin
  if not public.rate_hit(p_player, 'home_build', 30, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if jsonb_typeof(p_plan) <> 'object' or octet_length(p_plan::text) > 60000
     or coalesce(p_cost, -1) not between 0 and 500000 or coalesce(p_ref, '') !~ '^b:[a-z0-9-]{8,60}$' then
    raise exception 'bad_plan' using errcode = '22023';
  end if;
  select * into me from public.players where id = p_player and home_id is not null for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.bank_cash < p_cost then raise exception 'cant_afford' using errcode = '22023'; end if;
  if p_cost > 0 then
    if not public.ledger_once(p_player, 'cash', -p_cost, 'home_build', p_ref) then raise exception 'done' using errcode = '22023'; end if;
    update public.players set bank_cash = bank_cash - p_cost where id = p_player;
  end if;
  update public.players set home_plan = p_plan where id = p_player;
  return jsonb_build_object('cost', p_cost, 'bank', me.bank_cash - p_cost);
end;
$$;
revoke all on function public.home_build_save(uuid, jsonb, int, text) from public, anon, authenticated;

-- Someone else's home as they built it (a visit, a partner's or a host's place, decorating): walls and gardens aren't
-- private. Up to 20 players at once.
create or replace function public.home_plans(p_ids uuid[])
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(id, home_plan), '{}'::jsonb)
    from public.players
   where id = any(p_ids[1:20]) and home_plan is not null;
$$;
revoke all on function public.home_plans(uuid[]) from public, anon;
grant execute on function public.home_plans(uuid[]) to authenticated;

-- A plan belongs to the home it was built in.
create or replace function public.players_home_plan_moves()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.home_id is distinct from old.home_id or new.house_sku is distinct from old.house_sku then new.home_plan := null; end if;
  return new;
end;
$$;
drop trigger if exists players_home_plan_moves on public.players;
create trigger players_home_plan_moves before update of home_id, house_sku on public.players
  for each row execute function public.players_home_plan_moves();
revoke all on function public.players_home_plan_moves() from public, anon, authenticated;
