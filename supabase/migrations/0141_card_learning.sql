-- 0141: the Content Engine, step 6: learning what works (docs/CONTENT-ENGINE.md section 7; owner, Oct 31: "go").
--
-- Every situation card shown is already in choice_log (chosen, skipped or left to expire, and the option picked). Once a
-- New York day, the game server (lib/contentImport.ts) reads the last 28 days per card (card_stats), works out a weight
-- with lib/cardLearning.ts (cards players engage with and split on come up more, cards nearly everyone skips are
-- retired) and stores it (card_weights_auto). The server's card picker multiplies each card's fit by its weight
-- (card_weights_live). The Studio sees every card's numbers and can boost, lower, retire or restore one; the owner's
-- setting is never overwritten by the automatic one until it's handed back.
--
--   * card_weights: card → weight (0.25 to 3), retired, who set it ('auto' or 'admin'), the stats it was based on.
--   * card_stats(days), card_weights_auto(rows), card_weights_live() (service role).
--   * admin_card_learning(), admin_card_weight(card, weight, retired, auto) (Studio admins).
-- Safe to run more than once.

create table if not exists public.card_weights (
  card       text primary key,
  weight     numeric not null default 1 check (weight between 0.25 and 3),
  retired    boolean not null default false,
  set_by     text not null default 'auto' check (set_by in ('auto', 'admin')),
  stats      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.card_weights enable row level security;
revoke all on public.card_weights from anon, authenticated;

insert into public.game_settings (key, value) values ('card_learning', '{"last_run": null}'::jsonb)
on conflict (key) do nothing;

/** Per card over the last p_days: shown, chosen, skipped, expired, and how often each option was picked. */
create or replace function public.card_stats(p_days int default 28) returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'card', s.card, 'base', s.base, 'shown', s.shown, 'chosen', s.chosen, 'skipped', s.skipped, 'expired', s.expired,
           'options', coalesce(o.options, '{}'::jsonb)) order by s.shown desc), '[]'::jsonb)
    from (select card, min(base) as base, count(*) filter (where status <> 'open') as shown,
                 count(*) filter (where status = 'chosen') as chosen, count(*) filter (where status = 'skipped') as skipped,
                 count(*) filter (where status = 'expired') as expired
            from public.choice_log where shown_at > now() - make_interval(days => greatest(1, p_days))
           group by card) s
    left join lateral (select jsonb_object_agg(option, n) as options
                         from (select option, count(*) as n from public.choice_log
                                where card = s.card and status = 'chosen' and option is not null
                                  and shown_at > now() - make_interval(days => greatest(1, p_days))
                                group by option) x) o on true
$$;

/** The automatic weights (service role): rows the owner set by hand are left alone. Marks today's run. */
create or replace function public.card_weights_auto(p_rows jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into public.card_weights as w (card, weight, retired, set_by, stats, updated_at)
    values (r ->> 'card', least(3, greatest(0.25, coalesce((r ->> 'weight')::numeric, 1))), coalesce((r ->> 'retired')::boolean, false),
            'auto', coalesce(r -> 'stats', '{}'::jsonb), now())
    on conflict (card) do update set weight = excluded.weight, retired = excluded.retired, stats = excluded.stats, updated_at = now()
     where w.set_by = 'auto';
    if found then n := n + 1; end if;
  end loop;
  insert into public.game_settings (key, value) values ('card_learning', jsonb_build_object('last_run', public.ny_today()))
  on conflict (key) do update set value = public.game_settings.value || jsonb_build_object('last_run', public.ny_today()), updated_at = now();
  return n;
end;
$$;

/** Whether today's learning run is still to do. */
create or replace function public.card_learning_due() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((public.game_settings_value('card_learning') ->> 'last_run')::date < public.ny_today(), true)
$$;

/** What the card picker multiplies by: {card: weight}, 0 for a retired card. Cards without a row weigh 1. */
create or replace function public.card_weights_live() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(card, case when retired then 0 else weight end), '{}'::jsonb) from public.card_weights
$$;

-- ---------------------------------------------------------------------------
-- Studio
-- ---------------------------------------------------------------------------
create or replace function public.admin_card_learning() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return jsonb_build_object(
    'stats', public.card_stats(28),
    'weights', coalesce((select jsonb_agg(jsonb_build_object('card', card, 'weight', weight, 'retired', retired, 'set_by', set_by, 'updated_at', updated_at))
                           from public.card_weights), '[]'::jsonb),
    'last_run', public.game_settings_value('card_learning') ->> 'last_run');
end;
$$;

/** The owner's setting for one card (p_auto hands it back to the automatic weights). */
create or replace function public.admin_card_weight(p_card text, p_weight numeric, p_retired boolean, p_auto boolean default false) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_card is null or p_card !~ '^[a-z0-9-]+$' then raise exception 'bad_card' using errcode = '22023'; end if;
  if p_auto then
    update public.card_weights set set_by = 'auto', updated_at = now() where card = p_card;
  else
    insert into public.card_weights as w (card, weight, retired, set_by, updated_at)
    values (p_card, least(3, greatest(0.25, coalesce(p_weight, 1))), coalesce(p_retired, false), 'admin', now())
    on conflict (card) do update set weight = excluded.weight, retired = excluded.retired, set_by = 'admin', updated_at = now();
  end if;
  return public.admin_card_learning();
end;
$$;

revoke all on function public.card_stats(int) from public, anon, authenticated;
revoke all on function public.card_weights_auto(jsonb) from public, anon, authenticated;
revoke all on function public.card_learning_due() from public, anon, authenticated;
revoke all on function public.card_weights_live() from public, anon, authenticated;
revoke all on function public.admin_card_learning() from public, anon;
grant execute on function public.admin_card_learning() to authenticated;
revoke all on function public.admin_card_weight(text, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_card_weight(text, numeric, boolean, boolean) to authenticated;
grant execute on function public.card_stats(int) to service_role;
grant execute on function public.card_weights_auto(jsonb) to service_role;
grant execute on function public.card_learning_due() to service_role;
grant execute on function public.card_weights_live() to service_role;
