-- Scenario test for migrations 0001-0003. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-00000000000f');

-- A signs up (v0.1 style), then five friends join through A's link.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select invite_code as a_code from public.create_player('Ana', 'bodega_drip', '{}', null, true) \gset
do $$ begin
  perform 1 from public.players where display_name = 'Ana';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select 1 from public.create_player('Bea', 'arcade_nerd', '{}', :'a_code', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select 1 from public.create_player('Cyd', 'arcade_nerd', '{}', :'a_code', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select 1 from public.create_player('Dee', 'arcade_nerd', '{}', :'a_code', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select 1 from public.create_player('Eli', 'arcade_nerd', '{}', :'a_code', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select 1 from public.create_player('Fay', 'arcade_nerd', '{}', :'a_code', true);

-- Direct writes are blocked by RLS / grants.
do $$ begin
  begin
    update public.players set clout = 999999;
    if found then raise exception 'FAIL: direct update allowed'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ana: 5 invites x 50 + bonus 500 = 750 clout.
reset role;
do $$ declare c bigint; begin
  select clout into c from public.players where display_name = 'Ana';
  if c <> 750 then raise exception 'FAIL: invite clout %, expected 750', c; end if;
end $$;

-- Ana finishes creation: traits, lottery (once), home, party (once).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  begin perform public.set_traits(array['loud']); raise exception 'FAIL: one trait accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.roll_birth_lottery(); raise exception 'FAIL: lottery before traits';
  exception when sqlstate '22023' then null; end;
end $$;
select onboarding_step from public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery() as roll1 \gset
select public.roll_birth_lottery() as roll2 \gset
select pg_temp.assert(:roll1 = :roll2, 'lottery rolled twice');
select pg_temp.assert(:roll1 between (public.economy() -> 'birthLottery' ->> 'min')::int and (public.economy() -> 'birthLottery' ->> 'max')::int and :roll1 % 100 = 0, 'lottery out of range');
select home_id, bank_cash, onboarding_step from public.move_in('astoria_studio');
select bank_cash, clout, confidence, energy, onboarding_step from public.attend_first_party(true);
select bank_cash as bank_after, clout as clout_after from public.attend_first_party(false) \gset
select pg_temp.assert(:bank_after = :roll1 - 600 - 150 + 300, 'bank after party (weekly studio rent, v0.8)');
select pg_temp.assert(:clout_after = 750 + 100, 'clout after party');
select * from public.leaderboard('queens', 10);
select * from public.my_rank('clique');
select public.finish_handoff();
select onboarding_step from public.players;

-- LIC high-rise is refused when the cash can't cover a week's rent + phone + party.
reset role;
update public.players set bank_cash = 1700 where display_name = 'Bea';
update public.players set traits = array['loud','hustler'], birth_cash = 1700, onboarding_step = 'lottery_done' where display_name = 'Bea';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin perform public.move_in('lic_highrise'); raise exception 'FAIL: unaffordable home accepted';
  exception when sqlstate '22023' then null; end;
end $$;
select home_id from public.move_in('jackson_heights_1br');

-- Guest pulse works for anon.
set role anon;
select * from public.city_pulse();
select count(*) from public.recent_arrivals(3);
select 'ALL CHECKS PASSED' as result;
