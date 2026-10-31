-- 0138: the Content Engine, step 1: player memory (docs/CONTENT-ENGINE.md section 3; owner, Oct 31: "go").
--
-- One place that remembers what each player did, readable by every system, so content can react to combinations
-- ("fired from Tech, dating someone, leaning Hustler"). Nothing reads it yet: storylets (step 2) will.
--
--   * player_facts: (player, key, subject) → value, count, first and last time, optional expiry. Keys are namespaced
--     ("career.took_credit", subject "tech:rival"); lib/memory.ts lists every key (tests check the list against the
--     writers). Written only through fact_note, which never raises: a memory write can't break a shift or a purchase.
--   * world_tally: the city's totals by (key, subject, New York day), bumped by the same writes; who did what is never
--     kept there. City storylets (step 4) read it.
--   * player_snapshot(player): what's true about the player now, read from the tables that already hold it (rank,
--     meter, home, job, businesses, couple, campus, campaign, marks, crew, skills). Never stored twice.
--   * player_memory(player): the snapshot plus the facts still in force, for the server's engines.
--   * Writers: the ledger (shifts, gigs, dates, parties, hunts, businesses, skills, visits…), careers (hired, promoted,
--     demoted, fired, quit), campaigns (ran, won, won dirty), choices (each dilemma's pick), lasting marks (bans, gig
--     locks, holding), relationships (official, breakup), campus (enrolled, exams: aced, peeked, caught). The careers
--     server adds office moves and the interview through fact_note.
--   * Start over is a new life: the player's facts go. Deleting an account removes them (cascade); tallies stay.

create table if not exists public.player_facts (
  player_id  uuid not null references public.players (id) on delete cascade,
  key        text not null check (key ~ '^[a-z]+\.[a-z_]+$'),
  subject    text not null default '',
  value      jsonb not null default '{}'::jsonb,
  count      int not null default 1,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  expires_at timestamptz,
  primary key (player_id, key, subject)
);
create index if not exists player_facts_key_idx on public.player_facts (key, last_at desc);
alter table public.player_facts enable row level security;
revoke all on public.player_facts from anon, authenticated;

create table if not exists public.world_tally (
  key     text not null,
  subject text not null default '',
  day     date not null,
  count   int not null default 0,
  primary key (key, subject, day)
);
alter table public.world_tally enable row level security;
revoke all on public.world_tally from anon, authenticated;

/** Remembers that a player did something (and counts it for the city). Never raises. */
create or replace function public.fact_note(p_player uuid, p_key text, p_subject text default '', p_value jsonb default '{}'::jsonb, p_ttl_days int default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_player is null or p_key is null then return; end if;
  insert into public.player_facts as f (player_id, key, subject, value, expires_at)
  values (p_player, p_key, coalesce(p_subject, ''), coalesce(p_value, '{}'::jsonb),
          case when p_ttl_days is null then null else now() + make_interval(days => p_ttl_days) end)
  on conflict (player_id, key, subject) do update
     set value = excluded.value, count = f.count + 1, last_at = now(),
         expires_at = case when p_ttl_days is null then f.expires_at else excluded.expires_at end;
  insert into public.world_tally as t (key, subject, day, count) values (p_key, coalesce(p_subject, ''), public.ny_today(), 1)
  on conflict (key, subject, day) do update set count = t.count + 1;
exception when others then
  return;
end;
$$;

/** What's true about the player now, from the tables that hold it. */
create or replace function public.player_snapshot(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.players;
  job public.careers;
  meter int;
begin
  select * into me from public.players where id = p_player;
  if me.id is null then return null; end if;
  select * into job from public.careers where player_id = p_player and status = 'employed';
  meter := coalesce((select integrity from public.reputation where player_id = p_player), 50);
  return jsonb_build_object(
    'rank', greatest(me.best_rank, public.rank_level(me.clout, me.bank_cash)),
    'clout', me.clout,
    'bank', me.bank_cash,
    'meter', meter,
    'band', case when meter >= 70 then 'halo' when meter <= 30 then 'hustler' else 'middle' end,
    'home', me.home_id,
    'at', me.at_place,
    'job', case when job.id is null then null else jsonb_build_object(
      'track', job.track, 'level', job.level, 'workMood', coalesce((job.state ->> 'workMood')::int, 60)) end,
    'businesses', coalesce((select jsonb_agg(business_id order by bought_at) from public.player_businesses where player_id = p_player), '[]'::jsonb),
    'partner', (select case when r.a = p_player then r.b else r.a end from public.relationships r
                 where (r.a = p_player or r.b = p_player) and r.ended_at is null limit 1),
    'campus', (select campus from public.campus_enrolments where player_id = p_player),
    'campaign', (select candidate from public.campaigns where player_id = p_player and status = 'running' limit 1),
    'marks', coalesce((select jsonb_agg(distinct kind) from public.choice_marks where player_id = p_player and until > now()), '[]'::jsonb),
    'crew', (select count(*) from public.invites where inviter_id = p_player),
    'skills', (select jsonb_object_agg(s, public.skill_now(p_player, s))
                 from unnest(array['cooking', 'charisma', 'fitness', 'smarts', 'music', 'hustle', 'dance', 'gossip', 'photography']) s));
end;
$$;

/** The snapshot and every fact still in force, newest first: what the server's engines read. */
create or replace function public.player_memory(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'snapshot', public.player_snapshot(p_player),
    'facts', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'subject', subject, 'value', value, 'count', count,
                                                          'first', first_at, 'last', last_at, 'expires', expires_at) order by last_at desc)
                         from public.player_facts where player_id = p_player and (expires_at is null or expires_at > now())), '[]'::jsonb))
$$;

-- ---- Writers ----

/** The ledger already records most of what players do: each kind that matters becomes a fact. */
create or replace function public.memory_from_ledger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  head text := split_part(coalesce(new.ref, ''), ':', 1);
  k text;
  subj text := '';
begin
  k := case new.kind
    when 'shift' then 'work.shift'
    when 'gig' then 'work.gig'
    when 'skill_gig' then 'work.skill_gig'
    when 'job_pay' then 'jobs.hired_out'
    when 'business_buy' then 'business.bought'
    when 'business_upgrade' then 'business.upgraded'
    when 'business_public' then 'business.went_public'
    when 'date_night' then 'dating.date'
    when 'party' then 'nightlife.party'
    when 'event_entry' then 'nightlife.event'
    when 'hunt' then 'hunt.finished'
    when 'prediction' then 'story.predicted'
    when 'story_read' then 'story.read'
    when 'gossip' then 'gossip.found'
    when 'lotto_prize' then 'money.lotto_win'
    when 'lotto_jackpot' then 'money.lotto_jackpot'
    when 'skill' then 'skill.level_up'
    when 'visit_host' then 'home.hosted'
    when 'visit_guest' then 'home.visited'
    when 'sublet_income' then 'home.sublet_host'
    when 'sublet_rent' then 'home.sublet_tenant'
    when 'scholarship' then 'campus.scholarship'
    when 'showtime' then 'transit.showtime'
    when 'bail' then 'police.bailed'
    else null end;
  if k is null then return new; end if;
  -- Only what was earned or done, not refunds or reversals.
  if new.kind in ('shift', 'gig', 'skill_gig', 'job_pay', 'lotto_prize', 'lotto_jackpot', 'sublet_income') and new.amount <= 0 then return new; end if;
  if new.kind in ('shift', 'gig', 'skill_gig', 'party', 'event_entry', 'gossip', 'business_buy', 'business_upgrade', 'business_public', 'skill') then subj := head; end if;
  perform public.fact_note(new.player_id, k, subj, jsonb_build_object('amount', new.amount, 'currency', new.currency));
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_ledger on public.ledger;
create trigger memory_from_ledger after insert on public.ledger for each row execute function public.memory_from_ledger();

/** Careers: hired, promoted, demoted, fired, quit (subject: the track). */
create or replace function public.memory_from_careers() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.fact_note(new.player_id, 'career.hired', new.track, jsonb_build_object('level', new.level));
    return new;
  end if;
  if new.level > old.level then perform public.fact_note(new.player_id, 'career.promoted', new.track, jsonb_build_object('level', new.level)); end if;
  if new.level < old.level then perform public.fact_note(new.player_id, 'career.demoted', new.track, jsonb_build_object('level', new.level)); end if;
  if new.status <> old.status and new.status in ('fired', 'quit') then
    perform public.fact_note(new.player_id, 'career.' || new.status, new.track, jsonb_build_object('level', new.level));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_careers on public.careers;
create trigger memory_from_careers after insert or update on public.careers for each row execute function public.memory_from_careers();

/** Campaigns: ran (and how it ended), subject: the candidate. */
create or replace function public.memory_from_campaigns() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'over' and old.status is distinct from 'over' then
    perform public.fact_note(new.player_id, 'campaign.ran', new.candidate, jsonb_build_object('ending', new.ending));
    if new.ending = 'clean_win' then perform public.fact_note(new.player_id, 'campaign.won', new.candidate, '{"clean": true}'); end if;
    if new.ending = 'dirty_win' then perform public.fact_note(new.player_id, 'campaign.won', new.candidate, '{"clean": false}');
                                     perform public.fact_note(new.player_id, 'campaign.won_dirty', new.candidate); end if;
    if new.ending = 'loss' then perform public.fact_note(new.player_id, 'campaign.lost', new.candidate); end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_campaigns on public.campaigns;
create trigger memory_from_campaigns after update on public.campaigns for each row execute function public.memory_from_campaigns();

/** Moral Choices: which way each dilemma went (key choice.made, subject "<dilemma>:<option>"). */
create or replace function public.memory_from_choices() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'chosen' and old.status is distinct from 'chosen' and new.option is not null then
    perform public.fact_note(new.player_id, 'choice.made', new.base || ':' || new.option,
                             jsonb_build_object('card', new.card, 'place', new.place, 'effects', new.effects));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_choices on public.choice_log;
create trigger memory_from_choices after update on public.choice_log for each row execute function public.memory_from_choices();

/** Lasting marks: banned from a place, gigs locked, a stay in holding (these facts expire with the mark). */
create or replace function public.memory_from_marks() returns trigger
language plpgsql security definer set search_path = public
as $$
declare days int := greatest(1, ceil(extract(epoch from (new.until - now())) / 86400)::int);
begin
  perform public.fact_note(new.player_id,
    case new.kind when 'ban' then 'place.banned' when 'gig_lock' then 'work.gigs_locked' else 'police.held' end,
    coalesce(new.place, ''), '{}'::jsonb, case when new.kind = 'holding' then null else days end);
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_marks on public.choice_marks;
create trigger memory_from_marks after insert on public.choice_marks for each row execute function public.memory_from_marks();

/** Relationships: official, and how it ended (subject: the other player). */
create or replace function public.memory_from_relationships() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.fact_note(new.a, 'dating.official', new.b::text);
    perform public.fact_note(new.b, 'dating.official', new.a::text);
  elsif new.ended_at is not null and old.ended_at is null then
    perform public.fact_note(new.a, 'dating.breakup', new.b::text, jsonb_build_object('reason', new.end_reason, 'byMe', new.ended_by = new.a));
    perform public.fact_note(new.b, 'dating.breakup', new.a::text, jsonb_build_object('reason', new.end_reason, 'byMe', new.ended_by = new.b));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_relationships on public.relationships;
create trigger memory_from_relationships after insert or update on public.relationships for each row execute function public.memory_from_relationships();

/** Campus: enrolled (subject: the campus) and exams (aced, peeked at the answers, caught). */
create or replace function public.memory_from_campus() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'campus_enrolments' then
    perform public.fact_note(new.player_id, 'campus.enrolled', new.campus);
  else
    if new.grade = 'A' then perform public.fact_note(new.player_id, 'campus.aced', new.course_id); end if;
    if new.peeked then perform public.fact_note(new.player_id, 'campus.peeked', new.course_id); end if;
    if new.caught then perform public.fact_note(new.player_id, 'campus.caught_cheating', new.course_id); end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_from_enrolments on public.campus_enrolments;
create trigger memory_from_enrolments after insert on public.campus_enrolments for each row execute function public.memory_from_campus();
drop trigger if exists memory_from_exams on public.campus_exams;
create trigger memory_from_exams after insert on public.campus_exams for each row execute function public.memory_from_campus();

/** Start over is a new life: the player's memory goes with it. */
create or replace function public.memory_on_restart() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.player_facts where player_id = new.player_id;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists memory_on_restart on public.player_restarts;
create trigger memory_on_restart after insert on public.player_restarts for each row execute function public.memory_on_restart();

do $$
declare f text;
begin
  foreach f in array array['fact_note(uuid, text, text, jsonb, integer)', 'player_snapshot(uuid)', 'player_memory(uuid)',
                           'memory_from_ledger()', 'memory_from_careers()', 'memory_from_campaigns()', 'memory_from_choices()',
                           'memory_from_marks()', 'memory_from_relationships()', 'memory_from_campus()', 'memory_on_restart()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
