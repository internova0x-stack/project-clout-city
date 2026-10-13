-- v0.7 step 3, the new profile (docs/testing-feedback.md): a player's card adds their rank in Queens
-- and "Recently", their last few public moments. The owner decided Recently is visible to other
-- players (Oct 13), so it lists only things that already happen in public: places visited, events,
-- Shop buys, hunts finished and the first party. Never cash amounts, bills, sales, dates or chats.
--
-- Built from the clout ledger: every one of those moments pays clout once, under a stable ref.

create or replace function public.player_recent(p_player uuid, p_limit int default 5)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'ref', x.ref, 'at', x.created_at, 'theme', x.theme)
                            order by x.created_at desc, x.id desc), '[]'::jsonb)
    from (select l.id, l.kind, l.ref, l.created_at, case when l.kind = 'hunt' then h.data ->> 'theme' end as theme
            from public.ledger l
            left join public.hunts h on l.kind = 'hunt' and h.id = l.ref
           where l.player_id = p_player and l.currency = 'clout'
             and l.kind in ('visit', 'event', 'purchase', 'hunt', 'party')
           order by l.created_at desc, l.id desc
           limit least(greatest(coalesce(p_limit, 5), 1), 10)) x;
$$;

create or replace function public.player_card(p_player uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.display_name, 'style', p.starting_style, 'clout', p.clout, 'homeId', p.home_id,
    'badges', (select count(*) from public.player_badges b where b.player_id = p.id),
    'joined', p.created_at,
    'blocked', exists (select 1 from public.blocks k where k.blocker = auth.uid() and k.blocked = p.id),
    'isMe', p.id = auth.uid(),
    'crush', case when p.id <> auth.uid() then public.crush_status(p.id) end,
    -- Same order as the Queens leaderboard (leaderboard_people): clout, then who arrived first.
    'rank', 1 + (select count(*) from public.players o
                  where o.banned_at is null
                    and (o.clout > p.clout or (o.clout = p.clout and o.created_at < p.created_at))),
    'recent', public.player_recent(p.id, 5))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- player_recent is read through player_card only.
revoke all on function public.player_recent(uuid, int) from public, anon, authenticated;
