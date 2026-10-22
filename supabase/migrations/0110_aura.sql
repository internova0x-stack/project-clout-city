-- Charisma is called Aura (owner, Oct 22). The skill's id stays 'charisma' everywhere (skill_log, ledger refs, perks:
-- renaming stored data isn't worth the risk); only what players read changes. lib/skills.ts names it in the game; here,
-- the level-up push (migration 0083's push_on_reward) says "Aura level 5" instead of "Charisma level 5".
-- Safe to run more than once.

create or replace function public.push_on_reward() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- Players see Aura for the skill stored as 'charisma' (owner, Oct 22; lib/skills.ts).
  skill text := case split_part(new.ref, ':', 1) when 'charisma' then 'Aura' else initcap(replace(split_part(new.ref, ':', 1), '_', ' ')) end;
begin
  case new.kind
    when 'goal' then
      perform public.push_enqueue(new.player_id, 'goal_done', 'goal:' || new.ref, '🏆 Goal done',
        'Lola says she always believed in you. Lola is lying. Collect your next one.', '/home?open=tasks');
    when 'streak' then
      perform public.push_enqueue(new.player_id, 'streak_reward', 'streakr:' || new.ref, '🔥 Streak reward unlocked',
        'Consistency: the least glamorous superpower. Your reward is waiting.', '/home?open=tasks');
    when 'skill' then
      perform public.push_enqueue(new.player_id, 'skill_up', 'skill:' || new.ref, '📈 ' || skill || ' level ' || split_part(new.ref, ':', 2),
        'Practice paid off. Literally: there''s clout in it.', '/home');
    when 'lotto_jackpot' then
      perform public.push_enqueue(new.player_id, 'lotto_win', 'jackpot:' || new.ref, '🌟 You won the weekly jackpot',
        'C$' || to_char(new.amount, 'FM999,999,999') || ' just landed. Act normal.', '/home');
    when 'lotto_pot' then
      perform public.push_enqueue(new.player_id, 'lotto_win', 'pot:' || new.ref, '⭐ You hit a Lucky Star pot',
        'C$' || to_char(new.amount, 'FM999,999,999') || '. The ticket guy is pretending he isn''t jealous.', '/home');
    when 'scholarship' then
      perform public.push_enqueue(new.player_id, 'grades', 'scholarship:' || new.ref, '🎓 Your grades paid off',
        'Scholarship money is in. Your GPA would like a thank-you note.', '/home');
    else null;
  end case;
  return null;
exception when others then return null;
end;
$$;
