-- The Guide (owner, Nov 20: "Still looking for how to solve the 'what do I do next?' problem"; "go with your recommendations";
-- "go ahead"; lib/guide.ts, docs/GUIDE.md). Steps in chapters, each with Lola's tip, explainer cards, "Show me" and a reward once
-- it's done. game_settings 'guide' (mirrored by lib/guide.ts guideSettings, checked by tests/guide.test.ts) says what counts as
-- done for each step and what it pays; guide_claim checks it here and pays once (ledger 'guide', ref the step id); a chapter's
-- last step also pays the chapter (ledger 'guide_chapter', ref its number) and its badge. "Seen" steps are marked by the game
-- when the player opens that screen (guide_seen). Start over moves the ledger to the archive, so the Guide pays again.

insert into public.game_settings (key, value) values ('guide', '{"steps":{"1.1":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.2":{"chapter":1,"check":{"seen":true},"cash":50,"clout":0},"1.3":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.4":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.5":{"chapter":1,"check":{"ledger":["visit","shift"]},"cash":0,"clout":20},"1.6":{"chapter":1,"check":{"ledger":["daily_bonus"]},"cash":150,"clout":0},"1.7":{"chapter":1,"check":{"gossip":true},"cash":0,"clout":20},"1.8":{"chapter":1,"check":{"events":true},"cash":0,"clout":30},"1.9":{"chapter":1,"check":{"seen":true},"cash":50,"clout":0},"1.10":{"chapter":1,"check":{"seen":true},"cash":0,"clout":15},"1.11":{"chapter":1,"check":{"streak":3},"cash":0,"clout":30},"1.12":{"chapter":1,"check":{"ledger":["goal"]},"cash":0,"clout":30},"1.13":{"chapter":1,"check":{"seen":true},"cash":150,"clout":0},"2.1":{"chapter":2,"check":{"rest":"sleep"},"cash":0,"clout":15},"2.2":{"chapter":2,"check":{"ledger":["eat"]},"cash":50,"clout":0},"2.3":{"chapter":2,"check":{"ledger":["groceries"]},"cash":50,"clout":0},"2.4":{"chapter":2,"check":{"skill":"cooking"},"cash":0,"clout":20},"2.5":{"chapter":2,"check":{"rest":"sit"},"cash":0,"clout":15},"2.6":{"chapter":2,"check":{"bill":true},"cash":100,"clout":0},"3.1":{"chapter":3,"check":{"seen":true},"cash":0,"clout":15},"3.2":{"chapter":3,"check":{"ledger":["gig"]},"cash":100,"clout":0},"3.3":{"chapter":3,"check":{"ledger":["shift"]},"cash":50,"clout":0},"3.4":{"chapter":3,"check":{"seen":true},"cash":0,"clout":15},"3.5":{"chapter":3,"check":{"has":"aspiration"},"cash":0,"clout":30},"3.6":{"chapter":3,"check":{"has":"job"},"cash":150,"clout":0},"3.7":{"chapter":3,"check":{"has":"workday"},"cash":100,"clout":0},"3.8":{"chapter":3,"check":{"has":"office_move"},"cash":0,"clout":20},"3.9":{"chapter":3,"check":{"ledger":["career_pay"]},"cash":0,"clout":30},"3.10":{"chapter":3,"check":{"has":"business"},"cash":200,"clout":0},"3.11":{"chapter":3,"check":{"has":"board_job"},"cash":0,"clout":20},"4.1":{"chapter":4,"check":{"seen":true},"cash":0,"clout":20},"4.2":{"chapter":4,"check":{"ledger":["vip"]},"cash":0,"clout":40},"4.3":{"chapter":4,"check":{"ledger":["place_life"]},"cash":0,"clout":20},"4.4":{"chapter":4,"check":{"has":"hunt_step"},"cash":0,"clout":30},"4.5":{"chapter":4,"check":{"ledger":["story_read"]},"cash":50,"clout":0},"4.6":{"chapter":4,"check":{"ledger":["calendar"]},"cash":0,"clout":30},"4.7":{"chapter":4,"check":{"ledger":["season_free"]},"cash":0,"clout":20},"4.8":{"chapter":4,"check":{"has":"shoutout"},"cash":0,"clout":20},"5.1":{"chapter":5,"check":{"has":"layout"},"cash":0,"clout":15},"5.2":{"chapter":5,"check":{"has":"placed_piece"},"cash":100,"clout":0},"5.3":{"chapter":5,"check":{"seen":true},"cash":0,"clout":15},"5.4":{"chapter":5,"check":{"has":"home_plan"},"cash":100,"clout":0},"5.5":{"chapter":5,"check":{"has":"garden"},"cash":0,"clout":30},"5.6":{"chapter":5,"check":{"seen":true},"cash":0,"clout":20},"5.7":{"chapter":5,"check":{"has":"moved_up"},"cash":200,"clout":0},"5.8":{"chapter":5,"check":{"seen":true},"cash":0,"clout":20},"5.9":{"chapter":5,"check":{"has":"hosted"},"cash":0,"clout":30},"6.1":{"chapter":6,"check":{"seen":true},"cash":0,"clout":15},"6.2":{"chapter":6,"check":{"has":"skill_task"},"cash":50,"clout":0},"6.3":{"chapter":6,"check":{"has":"skill2"},"cash":0,"clout":20},"6.4":{"chapter":6,"check":{"has":"skill3"},"cash":0,"clout":40},"6.5":{"chapter":6,"check":{"ledger":["skill_invite"]},"cash":0,"clout":20},"7.1":{"chapter":7,"check":{"has":"look_saved"},"cash":0,"clout":15},"7.2":{"chapter":7,"check":{"has":"fashion"},"cash":50,"clout":0},"7.3":{"chapter":7,"check":{"has":"dressed_out"},"cash":0,"clout":30},"7.4":{"chapter":7,"check":{"seen":true},"cash":0,"clout":15},"8.1":{"chapter":8,"check":{"seen":true},"cash":0,"clout":30},"8.2":{"chapter":8,"check":{"seen":true},"cash":0,"clout":15},"8.3":{"chapter":8,"check":{"has":"message"},"cash":0,"clout":15},"8.4":{"chapter":8,"check":{"ledger":["together"]},"cash":0,"clout":30},"8.5":{"chapter":8,"check":{"has":"crush"},"cash":0,"clout":15},"8.6":{"chapter":8,"check":{"ledger":["date_night"]},"cash":0,"clout":40},"8.7":{"chapter":8,"check":{"has":"couple"},"cash":200,"clout":0},"8.8":{"chapter":8,"check":{"has":"moved_in"},"cash":0,"clout":40},"8.9":{"chapter":8,"check":{"has":"gift"},"cash":0,"clout":20},"9.1":{"chapter":9,"check":{"has":"choice"},"cash":0,"clout":20},"9.2":{"chapter":9,"check":{"has":"favor"},"cash":50,"clout":0},"9.3":{"chapter":9,"check":{"has":"held"},"cash":0,"clout":15},"9.4":{"chapter":9,"check":{"has":"underworld"},"cash":0,"clout":20},"9.5":{"chapter":9,"check":{"ledger":["gala_donation"]},"cash":0,"clout":20},"10.1":{"chapter":10,"check":{"has":"enrolled"},"cash":0,"clout":30},"10.2":{"chapter":10,"check":{"ledger":["campus_class"]},"cash":50,"clout":0},"10.3":{"chapter":10,"check":{"has":"exam_pass"},"cash":0,"clout":40},"10.4":{"chapter":10,"check":{"has":"crown_race"},"cash":0,"clout":30},"10.5":{"chapter":10,"check":{"has":"campaign"},"cash":0,"clout":40},"10.6":{"chapter":10,"check":{"has":"campaign_week"},"cash":150,"clout":0},"10.7":{"chapter":10,"check":{"ledger":["career_promo"]},"cash":0,"clout":40},"10.8":{"chapter":10,"check":{"has":"biz_upgrade"},"cash":0,"clout":30},"11.1":{"chapter":11,"check":{"seen":true},"cash":0,"clout":15},"11.2":{"chapter":11,"check":{"has":"tv"},"cash":0,"clout":30},"11.3":{"chapter":11,"check":{"has":"mayor_letter"},"cash":0,"clout":30}},"chapters":{"1":{"badge":"guide-1","cash":500,"clout":0,"steps":["1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","1.10","1.11","1.12","1.13"]},"2":{"badge":"guide-2","cash":300,"clout":0,"steps":["2.1","2.2","2.3","2.4","2.5","2.6"]},"3":{"badge":"guide-3","cash":500,"clout":0,"steps":["3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8","3.9","3.10","3.11"]},"4":{"badge":"guide-4","cash":0,"clout":150,"steps":["4.1","4.2","4.3","4.4","4.5","4.6","4.7","4.8"]},"5":{"badge":"guide-5","cash":400,"clout":0,"steps":["5.1","5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9"]},"6":{"badge":"guide-6","cash":0,"clout":100,"steps":["6.1","6.2","6.3","6.4","6.5"]},"7":{"badge":"guide-7","cash":0,"clout":100,"steps":["7.1","7.2","7.3","7.4"]},"8":{"badge":"guide-8","cash":0,"clout":150,"steps":["8.1","8.2","8.3"]},"9":{"badge":"guide-9","cash":0,"clout":100,"steps":["9.1","9.2"]},"10":{"badge":"guide-10","cash":0,"clout":200,"need":3,"all":["10.1","10.2","10.3","10.4","10.5","10.6","10.7","10.8"]},"11":{"badge":"guide-11","cash":0,"clout":100,"steps":["11.1"]}}}'::jsonb)
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
  elsif p_check ? 'rest' then
    return exists (select 1 from public.player_rest where player_id = p_player and kind = p_check ->> 'rest' and uses > 0);
  elsif p_check ? 'skill' then
    return exists (select 1 from public.skill_log where player_id = p_player and skill = p_check ->> 'skill');
  elsif p_check ? 'bill' then
    return exists (select 1 from public.bills where player_id = p_player and status = 'paid');
  elsif p_check ->> 'has' = 'aspiration' then
    return exists (select 1 from public.aspirations where player_id = p_player);
  elsif p_check ->> 'has' = 'job' then
    return exists (select 1 from public.careers where player_id = p_player);
  elsif p_check ->> 'has' = 'workday' then
    return exists (select 1 from public.careers where player_id = p_player and last_work_day is not null);
  elsif p_check ->> 'has' = 'office_move' then
    return exists (select 1 from public.player_facts where player_id = p_player and key in ('career.helped', 'career.shared_credit',
      'career.teamed_up', 'career.took_credit', 'career.reported', 'career.started_rumor', 'career.covered', 'career.backed_boss', 'career.mentored'));
  elsif p_check ->> 'has' = 'business' then
    return exists (select 1 from public.player_businesses where player_id = p_player);
  elsif p_check ->> 'has' = 'board_job' then
    return exists (select 1 from public.jobs where poster = p_player or worker = p_player);
  elsif p_check ->> 'has' = 'hunt_step' then
    return exists (select 1 from public.hunt_progress where player_id = p_player and (step > 0 or completed_at is not null));
  elsif p_check ->> 'has' = 'shoutout' then
    return exists (select 1 from public.radio_shoutouts where player_id = p_player);
  elsif p_check ->> 'has' = 'layout' then
    return exists (select 1 from public.players where id = p_player and jsonb_typeof(home_layout) = 'array' and jsonb_array_length(home_layout) > 0);
  elsif p_check ->> 'has' = 'placed_piece' then
    return exists (select 1 from public.players p, jsonb_array_elements(case when jsonb_typeof(p.home_layout) = 'array' then p.home_layout else '[]' end) e
                    where p.id = p_player and e ->> 'id' like 'item:%');
  elsif p_check ->> 'has' = 'home_plan' then
    return exists (select 1 from public.players where id = p_player and home_plan is not null);
  elsif p_check ->> 'has' = 'garden' then
    return exists (select 1 from public.players where id = p_player and jsonb_array_length(coalesce(home_plan #> '{floors,out,pieces}', '[]')) > 0);
  elsif p_check ->> 'has' = 'moved_up' then
    return exists (select 1 from public.players where id = p_player and moved_up);
  elsif p_check ->> 'has' = 'hosted' then
    return exists (select 1 from public.visits where host = p_player);
  elsif p_check ->> 'has' = 'skill_task' then
    return exists (select 1 from public.daily_tasks where player_id = p_player and skill is not null and done_at is not null);
  elsif p_check ->> 'has' in ('skill2', 'skill3') then
    -- A new best level pays ledger 'skill', ref '<skill>:<level>'.
    return exists (select 1 from public.ledger where player_id = p_player and kind = 'skill'
                    and split_part(ref, ':', 2) ~ '^[0-9]+$' and split_part(ref, ':', 2)::int >= right(p_check ->> 'has', 1)::int);
  elsif p_check ->> 'has' = 'look_saved' then
    return exists (select 1 from public.players where id = p_player and look ? 'fit');
  elsif p_check ->> 'has' = 'fashion' then
    return exists (select 1 from public.player_items where player_id = p_player and category = 'fashion' and acquired = 'bought');
  elsif p_check ->> 'has' = 'message' then
    return exists (select 1 from public.messages where sender = p_player);
  elsif p_check ->> 'has' = 'crush' then
    return exists (select 1 from public.crushes where player_id = p_player);
  elsif p_check ->> 'has' = 'couple' then
    return exists (select 1 from public.relationships where a = p_player or b = p_player);
  elsif p_check ->> 'has' = 'moved_in' then
    return exists (select 1 from public.player_facts where player_id = p_player and key = 'couple.moved_in');
  elsif p_check ->> 'has' = 'gift' then
    return exists (select 1 from public.gifts where giver = p_player);
  elsif p_check ->> 'has' = 'choice' then
    return exists (select 1 from public.choice_log where player_id = p_player and status = 'chosen');
  elsif p_check ->> 'has' = 'favor' then
    return exists (select 1 from public.choice_log where player_id = p_player and status = 'chosen' and area = 'favor');
  elsif p_check ->> 'has' = 'held' then
    return exists (select 1 from public.choice_marks where player_id = p_player and kind = 'holding' and until < now());
  elsif p_check ->> 'has' = 'underworld' then
    return exists (select 1 from public.underworld where player_id = p_player);
  elsif p_check ->> 'has' = 'enrolled' then
    return exists (select 1 from public.campus_enrolments where player_id = p_player);
  elsif p_check ->> 'has' = 'exam_pass' then
    return public.exams_passed(p_player) >= 1;
  elsif p_check ->> 'has' = 'crown_race' then
    return exists (select 1 from public.school_races where player_id = p_player);
  elsif p_check ->> 'has' = 'campaign' then
    return exists (select 1 from public.campaigns where player_id = p_player);
  elsif p_check ->> 'has' = 'campaign_week' then
    return exists (select 1 from public.campaigns where player_id = p_player and week > 1);
  elsif p_check ->> 'has' = 'biz_upgrade' then
    return exists (select 1 from public.player_businesses where player_id = p_player and level > 0);
  elsif p_check ->> 'has' = 'tv' then
    return exists (select 1 from public.tv_submissions where player_id = p_player);
  elsif p_check ->> 'has' = 'mayor_letter' then
    return exists (select 1 from public.mayor_letters where player_id = p_player);
  elsif p_check ->> 'has' = 'dressed_out' then
    return exists (select 1 from public.player_items where player_id = p_player and category = 'fashion' and equipped)
       and (exists (select 1 from public.ledger where player_id = p_player and kind in ('event', 'calendar', 'party', 'vip'))
            or exists (select 1 from public.event_attendance where player_id = p_player));
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
  if ch is not null and (case when ch ? 'need'
    then (select count(*) from jsonb_array_elements_text(ch -> 'all') x(step)
           where exists (select 1 from public.ledger where player_id = me and kind = 'guide' and ref = x.step)) >= (ch ->> 'need')::int
    else not exists (select 1 from jsonb_array_elements_text(ch -> 'steps') x(step)
           where not exists (select 1 from public.ledger where player_id = me and kind = 'guide' and ref = x.step)) end) then
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
