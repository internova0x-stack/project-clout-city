-- The Guide (owner, Nov 20: "Still looking for how to solve the 'what do I do next?' problem"; "go with your recommendations";
-- "go ahead"; lib/guide.ts, docs/GUIDE.md). Steps in chapters, each with Lola's tip, explainer cards, "Show me" and a reward once
-- it's done. game_settings 'guide' (mirrored by lib/guide.ts guideSettings, checked by tests/guide.test.ts) says what counts as
-- done for each step and what it pays; guide_claim checks it here and pays once (ledger 'guide', ref the step id); a chapter's
-- last step also pays the chapter (ledger 'guide_chapter', ref its number) and its badge. "Seen" steps are marked by the game
-- when the player opens that screen (guide_seen). Start over moves the ledger to the archive, so the Guide pays again.

insert into public.game_settings (key, value) values ('guide', '{"steps":{"1.1":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.2":{"chapter":1,"check":{"seen":true},"cash":50,"clout":0},"1.3":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.4":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.5":{"chapter":1,"check":{"ledger":["visit","shift"]},"cash":0,"clout":20},"1.6":{"chapter":1,"check":{"ledger":["daily_bonus"]},"cash":150,"clout":0},"1.7":{"chapter":1,"check":{"gossip":true},"cash":0,"clout":20},"1.8":{"chapter":1,"check":{"events":true},"cash":0,"clout":30},"1.9":{"chapter":1,"check":{"seen":true},"cash":50,"clout":0},"1.10":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.11":{"chapter":1,"check":{"streak":3},"cash":0,"clout":30},"1.12":{"chapter":1,"check":{"ledger":["goal"]},"cash":0,"clout":30},"1.13":{"chapter":1,"check":{"seen":true},"cash":150,"clout":0}},"chapters":{"1":{"badge":"guide-1","cash":500,"clout":0,"steps":["1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","1.10","1.11","1.12","1.13"]}}}'::jsonb)
on conflict (key) do update set value = excluded.value;

create table if not exists public.guide_seen (
  player_id uuid not null references public.players (id) on delete cascade,
  step      text not null,
  seen_at   timestamptz not null default now(),
  primary key (player_id, step)
);
alter table public.guide_seen enable row level security;
revoke all on public.guide_seen from anon, authenticated;

-- Has the player done what this step asks? (internal)
create or replace function public.guide_done(p_player uuid, p_step text, p_check jsonb) returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_check ? 'seen' then
    return exists (select 1 from public.guide_seen where player_id = p_player and step = p_step);
  elsif p_check ? 'ledger' then
    return exists (select 1 from public.ledger where player_id = p_player and kind in (select jsonb_array_elements_text(p_check -> 'ledger')));
  elsif p_check ? 'gossip' then
    return exists (select 1 from public.gossip_found where player_id = p_player);
  elsif p_check ? 'events' then
    return exists (select 1 from public.ledger where player_id = p_player and kind in ('event', 'vip', 'calendar', 'party'))
        or exists (select 1 from public.event_attendance where player_id = p_player);
  elsif p_check ? 'streak' then
    return exists (select 1 from public.player_streaks where player_id = p_player and greatest(current, best) >= (p_check ->> 'streak')::int);
  end if;
  return false;
end;
$$;
revoke all on function public.guide_done(uuid, text, jsonb) from public, anon, authenticated;

-- The game saw the player open a step's screen (only steps that count that way).
create or replace function public.guide_seen(p_step text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg jsonb := public.game_settings_value('guide');
begin
  if auth.uid() is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not coalesce((cfg #> array['steps', p_step, 'check']) ? 'seen', false) then raise exception 'bad_step' using errcode = '22023'; end if;
  insert into public.guide_seen (player_id, step) values (auth.uid(), p_step) on conflict do nothing;
end;
$$;
revoke all on function public.guide_seen(text) from public, anon;
grant execute on function public.guide_seen(text) to authenticated;

-- The player's Guide: steps paid, steps done and waiting to pay, chapters paid, and the account's New York day (1 = its first).
create or replace function public.guide_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cfg jsonb := public.game_settings_value('guide');
  paid text[];
  ready text[] := '{}';
  st record;
begin
  if me is null then raise exception 'no_player' using errcode = '28000'; end if;
  select coalesce(array_agg(distinct ref), '{}') into paid from public.ledger where player_id = me and kind = 'guide';
  for st in select key, value from jsonb_each(cfg -> 'steps') loop
    if not st.key = any(paid) and public.guide_done(me, st.key, st.value -> 'check') then ready := ready || st.key; end if;
  end loop;
  return jsonb_build_object(
    'paid', to_jsonb(paid), 'ready', to_jsonb(ready),
    'chapters', coalesce((select jsonb_agg(distinct ref::int) from public.ledger where player_id = me and kind = 'guide_chapter'), '[]'::jsonb),
    'day', (select public.ny_today() - (p.created_at at time zone 'America/New_York')::date + 1 from public.players p where p.id = me));
end;
$$;
revoke all on function public.guide_state() from public, anon;
grant execute on function public.guide_state() to authenticated;

-- Pays a done step once, and its chapter once the chapter's last step is paid. Returns what it paid.
create or replace function public.guide_claim(p_step text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cfg jsonb := public.game_settings_value('guide');
  s jsonb := cfg #> array['steps', p_step];
  ch jsonb;
  v_cash int := 0; v_clout int := 0; v_chapter int; n int;
begin
  if me is null or not exists (select 1 from public.players where id = me and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if s is null then raise exception 'bad_step' using errcode = '22023'; end if;
  if not public.guide_done(me, p_step, s -> 'check') then raise exception 'not_yet' using errcode = '22023'; end if;
  n := (s ->> 'cash')::int;
  if n > 0 and public.ledger_once(me, 'cash', n, 'guide', p_step) then
    update public.players set bank_cash = bank_cash + n where id = me;
    v_cash := n;
  end if;
  n := (s ->> 'clout')::int;
  if n > 0 and public.ledger_once(me, 'clout', n, 'guide', p_step) then
    update public.players set clout = clout + n where id = me;
    v_clout := n;
  end if;
  -- The chapter: every one of its steps paid (in either currency).
  ch := cfg #> array['chapters', s ->> 'chapter'];
  if ch is not null and not exists (
    select 1 from jsonb_array_elements_text(ch -> 'steps') x(step)
     where not exists (select 1 from public.ledger where player_id = me and kind = 'guide' and ref = x.step)) then
    n := (ch ->> 'cash')::int;
    if n > 0 and public.ledger_once(me, 'cash', n, 'guide_chapter', s ->> 'chapter') then
      update public.players set bank_cash = bank_cash + n where id = me;
      v_cash := v_cash + n; v_chapter := (s ->> 'chapter')::int;
    end if;
    n := (ch ->> 'clout')::int;
    if n > 0 and public.ledger_once(me, 'clout', n, 'guide_chapter', s ->> 'chapter') then
      update public.players set clout = clout + n where id = me;
      v_clout := v_clout + n; v_chapter := (s ->> 'chapter')::int;
    end if;
    insert into public.player_badges (player_id, badge_id, arc_id) values (me, ch ->> 'badge', 'guide') on conflict do nothing;
  end if;
  return jsonb_build_object('cash', v_cash, 'clout', v_clout, 'chapter', v_chapter);
end;
$$;
revoke all on function public.guide_claim(text) from public, anon;
grant execute on function public.guide_claim(text) to authenticated;
