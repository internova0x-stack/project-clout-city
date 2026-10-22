-- Realistic weekly rent (owner, Oct 22): "$2000/week in rent is a lot for the starter apartments in NY."
-- The homes carried real New York MONTHLY rents but were billed every week. Rent is now about a quarter:
--   room share C$225 (was 900), Astoria studio C$425 (1,750), Jackson Heights 1BR C$600 (2,600),
--   Sunnyside Gardens C$750 (3,200), LIC high-rise C$1,050 (4,500), the dorms C$250 (1,100).
-- So the first weeks still feel tight, the birth lottery rolls C$1,500 to 3,000 (was 5,000 to 10,000);
-- even the lowest roll still covers a first week anywhere (the v0.8 rule). Rolls already made are kept.
-- Rent is read from these settings when it's billed (rent_for), so every player moves to the new rent; rent
-- bills still open are lowered to it now, never raised.

update public.game_settings set value = '{"homes":[{"id":"astoria_share","rent":225,"roommate":"priya"},{"id":"astoria_studio","rent":425},{"id":"jackson_heights_1br","rent":600},{"id":"sunnyside_gardens","rent":750,"signup":false,"moveClout":1000},{"id":"lic_highrise","rent":1050,"moveClout":3000},{"id":"sj_dorm","rent":250,"campus":"st-johnsons","signup":false},{"id":"qu_dorm","rent":250,"campus":"queensborough-u","signup":false}],"moving":{"brokerWeeks":1},"invites":{"cliqueSize":5,"paidAtOnce":5,"cliqueBonus":500,"cloutPerInvite":50},"phoneBill":60,"firstParty":{"entry":150,"energy":20,"cashReward":300,"confidence":15,"cloutReward":100},"birthLottery":{"max":3000,"min":1500,"step":100},"startingStats":{"mood":60,"energy":100,"confidence":40},"playersOnlineThreshold":1}'::jsonb, updated_at = now() where key = 'economy';

update public.bills b
   set amount = least(b.amount, public.rent_for(p.home_id))
  from public.players p
 where p.id = b.player_id and b.kind = 'rent' and b.status = 'due' and public.rent_for(p.home_id) is not null;
