-- Scenario test for migration 0136 (Careers part 2): a landed joint project pays once, inside its cap; office moves
-- nudge the private meter within ±12 and can make Lola's Blotter, never for News opt-outs; only for a running job.
-- Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000136' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.c(n int) returns uuid language sql as $$ select ('10000000-0000-0000-0000-0000000136' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.raises(q text, msg text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlerrm = msg; end $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
set role authenticated;
do $$
declare n text; i int := 1;
begin
  foreach n in array array['Plotter', 'Private'] loop
    perform pg_temp.as_(pg_temp.u(i)::text);
    perform public.create_player(n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']); perform public.roll_birth_lottery(); perform public.move_in('astoria_studio');
    i := i + 1;
  end loop;
end $$;
select pg_temp.as_(pg_temp.u(1)::text);
do $$ begin
  begin perform public.career_office(auth.uid(), gen_random_uuid(), 0, null); raise exception 'FAIL: career_office callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select public.career_hire(pg_temp.u(1), pg_temp.c(1), 'tech', 1, '{}');
select public.career_hire(pg_temp.u(2), pg_temp.c(2), 'media', 1, '{}');

-- ---- Team bonus: once, capped ----
select public.career_save(pg_temp.u(1), pg_temp.c(1), 1, '{}', 1, 'employed', null, 0, 0,
  format('[{"currency":"cash","amount":105,"kind":"career_team","ref":"%s:team:1"},{"currency":"cash","amount":5000,"kind":"career_team","ref":"%s:team:2"}]', pg_temp.c(1), pg_temp.c(1))::jsonb);
select public.career_save(pg_temp.u(1), pg_temp.c(1), 2, '{}', 1, 'employed', null, 0, 0,
  format('[{"currency":"cash","amount":105,"kind":"career_team","ref":"%s:team:1"}]', pg_temp.c(1))::jsonb);
select pg_temp.assert((select count(*) from public.ledger where player_id = pg_temp.u(1) and kind = 'career_team') = 1, 'team bonus paid once, inside the cap');

-- ---- The meter and the Blotter ----
select public.career_office(pg_temp.u(1), pg_temp.c(1), -8, 'BREAKING: {name} started the rumor.');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(1)) = 42, 'the meter moved toward Hustler');
select pg_temp.assert((select text from public.choice_headlines where player_id = pg_temp.u(1)) = 'BREAKING: @Plotter started the rumor.', 'a Blotter headline with the name');
select pg_temp.assert(pg_temp.raises(format($$select public.career_office(%L, %L, 30, null)$$, pg_temp.u(1), pg_temp.c(1)), 'bad_effects'), 'within ±12');
select pg_temp.assert(pg_temp.raises(format($$select public.career_office(%L, %L, 3, null)$$, pg_temp.u(1), pg_temp.c(2)), 'not_employed'), 'only your own job');
update public.players set news_opt_out = true where id = pg_temp.u(2);
select public.career_office(pg_temp.u(2), pg_temp.c(2), 3, 'BREAKING: {name} did a thing.');
select pg_temp.assert(not exists (select 1 from public.choice_headlines where player_id = pg_temp.u(2)), 'never for News opt-outs');
select pg_temp.assert((select integrity from public.reputation where player_id = pg_temp.u(2)) = 53, 'the meter still moves');

\echo 'career_office: all assertions passed'
rollback;
