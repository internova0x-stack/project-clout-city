-- 0136: Careers, part 2: office politics (owner, Oct 31: "careers part 2"; spec section 30). The moves themselves run in
-- lib/careers.ts on the server (help, share the credit, team up; take credit, report mistakes, feed the gossip a rumor;
-- grudges and revenge; work mood), stored in the job's state like everything else. This migration adds what they pay
-- and touch outside the job:
--   * career_save (same as 0135) also pays a landed joint project: ledger 'career_team' (cash, up to C$1,000).
--   * career_office(player, job, integrity, headline): an office move nudges the private Halo <-> Hustler meter (Moral
--     Choices, migration 0131; within ±12) and a rumor can make Lola's Blotter (choice_headline: never for players who opted
--     out of News mentions). Only for the player's own running job; service role only.

create or replace function public.career_save(
  p_player uuid, p_id uuid, p_version int, p_state jsonb, p_level int, p_status text, p_workday date, p_energy int, p_mood int, p_payouts jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v int;
  job public.careers;
  me public.players;
  today date := public.ny_today();
  p jsonb;
  kind text;
  cur text;
  amt bigint;
  k text;
begin
  if not public.rate_hit(p_player, 'career', 60, 60) then raise exception 'rate_limited' using errcode = '22023'; end if;
  if p_status not in ('employed', 'quit', 'fired') then raise exception 'bad_status' using errcode = '22023'; end if;
  if p_level not between 1 and 5 then raise exception 'bad_level' using errcode = '22023'; end if;
  if coalesce(p_energy, 0) not between -40 and 15 or coalesce(p_mood, 0) not between -20 and 10 then
    raise exception 'bad_effects' using errcode = '22023';
  end if;
  select * into job from public.careers where id = p_id and player_id = p_player for update;
  select * into me from public.players where id = p_player for update;
  if p_workday is not null then
    if p_workday <> today then raise exception 'bad_day' using errcode = '22023'; end if;
    if job.last_work_day = today then raise exception 'worked_today' using errcode = '22023'; end if;
    if exists (select 1 from public.ledger l where l.player_id = p_player and l.currency = 'cash' and l.kind = 'shift'
                and l.ref like '%:' || today::text || ':%') then
      raise exception 'shifted_today' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_energy, 0) < 0 and me.energy < -p_energy then raise exception 'no_energy' using errcode = '22023'; end if;

  update public.careers
     set state = p_state, level = p_level, best_level = greatest(best_level, p_level), status = p_status,
         last_work_day = coalesce(p_workday, last_work_day), version = version + 1, updated_at = now(),
         ended_at = case when p_status <> 'employed' then now() else ended_at end
   where id = p_id and player_id = p_player and version = p_version and status = 'employed'
   returning version into v;
  if v is null then raise exception 'conflict' using errcode = '40001'; end if;

  if coalesce(p_energy, 0) <> 0 or coalesce(p_mood, 0) <> 0 then
    update public.players
       set energy = least(100, greatest(0, energy + coalesce(p_energy, 0))),
           mood = least(100, greatest(0, mood + coalesce(p_mood, 0)))
     where id = p_player;
  end if;
  if p_workday is not null then
    foreach k in array public.career_skills(job.track) loop
      perform public.skill_practice(p_player, k, 'career:' || p_id::text || ':' || p_workday::text);
    end loop;
  end if;

  for p in select x from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) x loop
    kind := p ->> 'kind';
    cur := p ->> 'currency';
    amt := (p ->> 'amount')::bigint;
    -- Only this job's own kinds, refs and sizes.
    continue when not (p ->> 'ref' like p_id::text || ':%');
    continue when not ((kind = 'career_pay' and cur = 'cash' and amt between 1 and 5000)
                    or (kind = 'career_promo' and cur = 'clout' and amt between 1 and 250)
                    or (kind = 'career_screen' and cur = 'clout' and amt between 1 and 50)
                    or (kind = 'career_team' and cur = 'cash' and amt between 1 and 1000));
    if public.ledger_once(p_player, cur, amt, kind, p ->> 'ref') then
      if cur = 'cash' then update public.players set bank_cash = bank_cash + amt where id = p_player;
      else update public.players set clout = greatest(0, clout + amt) where id = p_player;
      end if;
    end if;
  end loop;
  return v;
end;
$$;

create or replace function public.career_office(p_player uuid, p_id uuid, p_integrity int, p_headline text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  now_int int;
  d int;
begin
  if not exists (select 1 from public.careers where id = p_id and player_id = p_player and status = 'employed') then
    raise exception 'not_employed' using errcode = '22023';
  end if;
  if coalesce(p_integrity, 0) not between -12 and 12 then raise exception 'bad_effects' using errcode = '22023'; end if;
  if coalesce(p_integrity, 0) <> 0 then
    insert into public.reputation (player_id) values (p_player) on conflict (player_id) do nothing;
    select integrity into now_int from public.reputation where player_id = p_player for update;
    d := least(100, greatest(0, now_int + p_integrity)) - now_int;
    if d <> 0 then update public.reputation set integrity = integrity + d, updated_at = now() where player_id = p_player; end if;
  end if;
  if p_headline is not null and length(p_headline) <= 260 then perform public.choice_headline(p_player, p_headline); end if;
end;
$$;

revoke all on function public.career_save(uuid, uuid, int, jsonb, int, text, date, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.career_office(uuid, uuid, int, text) from public, anon, authenticated;
