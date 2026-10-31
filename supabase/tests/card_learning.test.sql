-- Scenario test for migration 0141 (learning what works): players can't read or call it; card_stats counts each card's
-- showings, choices, skips and options; the automatic weights store and mark today's run, never over the owner's own
-- setting; card_weights_live gives 0 for a retired card; the Studio is admins only. Rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
create function pg_temp.as_(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, false) $$;
create function pg_temp.u(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000141' || lpad(n::text, 2, '0'))::uuid $$;

insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 2) n;
insert into public.story_admins (user_id) values (pg_temp.u(2));
set role authenticated;
select pg_temp.as_(pg_temp.u(1)::text);
select public.create_player('Learner', 'bodega_drip', '{}', null, true);
reset role;

-- Players can't see or move the weights.
set role authenticated;
do $$ begin
  begin perform 1 from public.card_weights; raise exception 'FAIL: card_weights readable';
  exception when insufficient_privilege then null; end;
  begin perform public.card_stats(28); raise exception 'FAIL: card_stats callable';
  exception when insufficient_privilege then null; end;
  begin perform public.card_weights_auto('[]'); raise exception 'FAIL: card_weights_auto callable';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert(pg_temp.raises($$select public.admin_card_learning()$$, 'not_admin'), 'the Studio list is admins only');
reset role;

-- Four showings of one card: two chosen (both option a), one skipped, one expired; one of another card, open (not counted).
insert into public.choice_log (player_id, card, base, area, day, status, option) values
  (pg_temp.u(1), 'test-card', 'test', 'life', public.ny_today(), 'chosen', 'a'),
  (pg_temp.u(1), 'test-card', 'test', 'life', public.ny_today(), 'chosen', 'a'),
  (pg_temp.u(1), 'test-card', 'test', 'life', public.ny_today(), 'skipped', null),
  (pg_temp.u(1), 'test-card', 'test', 'life', public.ny_today(), 'expired', null),
  (pg_temp.u(1), 'other-card', 'other', 'life', public.ny_today(), 'open', null);
select pg_temp.assert((select s ->> 'shown' = '4' and s ->> 'chosen' = '2' and s ->> 'skipped' = '1' and s ->> 'expired' = '1' and s -> 'options' ->> 'a' = '2'
                         from jsonb_array_elements(public.card_stats(28)) s where s ->> 'card' = 'test-card'), 'counts a card''s showings');
select pg_temp.assert((select s ->> 'shown' = '0' from jsonb_array_elements(public.card_stats(28)) s where s ->> 'card' = 'other-card'), 'an open card isn''t counted yet');

-- The automatic weights, and today's run marked.
select pg_temp.assert(public.card_learning_due(), 'due before today''s run');
select pg_temp.assert(public.card_weights_auto('[{"card": "test-card", "weight": 1.4, "retired": false}, {"card": "dud", "weight": 0.5, "retired": true}, {"card": "huge", "weight": 99}]') = 3, 'three stored');
select pg_temp.assert(not public.card_learning_due(), 'done for today');
select pg_temp.assert((public.card_weights_live() ->> 'test-card')::numeric = 1.4, 'weight live');
select pg_temp.assert((public.card_weights_live() ->> 'dud')::numeric = 0, 'a retired card weighs 0');
select pg_temp.assert((public.card_weights_live() ->> 'huge')::numeric = 3, 'capped at 3');

-- The owner's setting wins until handed back.
set role authenticated;
select pg_temp.as_(pg_temp.u(2)::text);
select pg_temp.assert(public.admin_card_weight('dud', 1.2, false) is not null, 'the owner restores a card');
reset role;
select public.card_weights_auto('[{"card": "dud", "weight": 0.5, "retired": true}]');
select pg_temp.assert((public.card_weights_live() ->> 'dud')::numeric = 1.2, 'the automatic weights never overwrite the owner');
set role authenticated;
select pg_temp.as_(pg_temp.u(2)::text);
select pg_temp.assert(public.admin_card_weight('dud', null, null, true) is not null, 'handed back');
select pg_temp.assert(pg_temp.raises($$select public.admin_card_weight('Bad Card!', 1, false)$$, 'bad_card'), 'card ids checked');
reset role;
select public.card_weights_auto('[{"card": "dud", "weight": 0.5, "retired": true}]');
select pg_temp.assert((public.card_weights_live() ->> 'dud')::numeric = 0, 'automatic again once handed back');

rollback;
