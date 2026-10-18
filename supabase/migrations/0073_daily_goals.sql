-- 0073: Daily tasks 2.0: goals, streaks and guest-list passes (docs/08-new-features-spec.md section 19; owner, Oct 18).
--   * The goal ladder the game suggests: first purchase, first gig payout, the next home up, pro gigs, first car, big
--     gigs, own a home. goal_current() is the first unfinished one with its progress in its own terms (cash, clout,
--     Confidence or a count); goal_settle() pays each finished goal's clout once (ledger clout 'goal', ref the goal).
--     Progress is framing only: no savings jar, the cash stays ordinary cash.
--   * The daily mix (owner, Oct 18): 5 tasks = 1 gossip (economy.gossip.tasksPerDay, now 1) + 2 for the active goal
--     (daily_tasks.goal) + 1 skill + 1 at random. Rewards are unchanged.
--   * Streaks: New York days with all five tasks done, counted when the daily bonus is written (a trigger on ledger
--     kind 'daily_bonus'). One missed day a week is forgiven (a freeze). Day 3 pays clout; every 7 days a task-only
--     collectible (odd multiples) or a guest-list pass (even multiples), clout instead when there's none left to give.
--   * Guest-list passes: use_guest_pass(place) puts the player on tonight's list at a club above their door clout or
--     with a VIP floor they can't get up to; travel and vip_access ('pass') accept it until midnight New York. Never a
--     locked borough, never cash.
--   * The Shop: four streak-reward furniture pieces (reward: true in the city seed) that buy_item never sells
--     ('reward_only') and sell_item never buys back ('reward_unsellable').
-- Numbers live in game_settings 'goals' (mirrored by lib/goals.ts); the city seed is regenerated (lib/city.ts).
-- Safe to run more than once.

do $$ begin
  if to_regprocedure('public.place_open(text)') is null or to_regprocedure('public.vip_access(uuid, text)') is null
     or to_regprocedure('public.campus_state()') is null then
    raise exception 'Run migrations 0046, 0066 and 0072 first.';
  end if;
end $$;

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":1,"taskClout":15,"restroom":{"clout":25,"mood":6}},"clubs":{"vip":{"medium":{"freeClout":5000,"cover":1500},"exclusive":{"freeClout":15000,"cover":5000}},"vipTimes":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]},"businesses":{"tillDays":2,"upgrade":{"cost":0.6,"pay":0.5,"value":0.5},"hype":{"clout":150000,"max":2},"goPublic":{"clout":50000,"fee":50000000,"times":3},"list":[{"id":"hot-dog-cart","name":"Dirty Water Dogs","emoji":"🌭","price":5000,"payPerDay":750,"blurb":"One cart, one umbrella, a hot dog water recipe older than the city.","upgrades":[{"name":"Second umbrella","emoji":"⛱️","blurb":"Twice the shade, twice the line."},{"name":"Secret menu","emoji":"🤫","blurb":"It''s the same hot dog. It costs more now."},{"name":"Influencer collab","emoji":"🤳","blurb":"A creator ate one on camera. The line goes around the block."}]},{"id":"bodega","name":"Bodega, Cat Included","emoji":"🐈","price":50000,"payPerDay":6000,"blurb":"Open 24 hours. The cat runs it; you just own it.","upgrades":[{"name":"Hot food counter","emoji":"🥪","blurb":"Chopped cheese, all day, every day."},{"name":"Lotto machine","emoji":"🎟️","blurb":"Everybody''s uncle comes in now."},{"name":"The cat gets an agent","emoji":"😼","blurb":"Brand deals. The cat negotiates better than you."}]},{"id":"laundromat","name":"Spin Cycle Laundromat","emoji":"🧺","price":250000,"payPerDay":22500,"blurb":"Twenty machines, three of them work. The quarters add up.","upgrades":[{"name":"Free Wi-Fi","emoji":"📶","blurb":"People stay. People buy snacks."},{"name":"Wash and fold","emoji":"👕","blurb":"You fold strangers'' socks for money. Lucrative."},{"name":"Laundromat by night","emoji":"🎧","blurb":"A DJ on Fridays. It''s a scene now."}]},{"id":"cafe","name":"Oat Milk Surcharge Café","emoji":"☕","price":1200000,"payPerDay":81600,"blurb":"Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".","upgrades":[{"name":"Latte art","emoji":"🎨","blurb":"Every cup a portrait of the customer. Mostly."},{"name":"Laptop ban (for vibes)","emoji":"💻","blurb":"Fewer screenwriters, more turnover."},{"name":"Second location","emoji":"📍","blurb":"Same café, different neighborhood, same oat milk."}]},{"id":"taco-trucks","name":"Taco Truck Fleet","emoji":"🌮","price":6000000,"payPerDay":300000,"blurb":"Five trucks, one group chat, zero parking tickets paid.","upgrades":[{"name":"Late-night route","emoji":"🌙","blurb":"Outside every club at 2 a.m."},{"name":"Festival permits","emoji":"🎪","blurb":"Every street fair in Queens."},{"name":"A truck in every borough","emoji":"🗽","blurb":"Even Staten Island. Especially Staten Island."}]},{"id":"nightclub","name":"Your Own Nightclub","emoji":"🪩","price":30000000,"payPerDay":1080000,"blurb":"Your name on the door. The bouncer still doesn''t respect you.","upgrades":[{"name":"VIP floor","emoji":"🥂","blurb":"Upstairs, where the expensive bottles live."},{"name":"Celebrity DJ residency","emoji":"🎛️","blurb":"Every Saturday, a famous person presses play."},{"name":"A gold-plated velvet rope","emoji":"✨","blurb":"Completely unnecessary. Wildly profitable."}]},{"id":"apartment-building","name":"Luxury* Apartment Building","emoji":"🏢","price":150000000,"payPerDay":3900000,"blurb":"*Exposed brick. Forty units, one elevator, rent that should be illegal.","upgrades":[{"name":"Rooftop amenity","emoji":"🌇","blurb":"Two lounge chairs and a view. Rent goes up 30%."},{"name":"Doorman with opinions","emoji":"🧑‍✈️","blurb":"He judges every delivery. Tenants love it."},{"name":"Condo conversion","emoji":"🔑","blurb":"Same units, now for sale, at three times the price."}]},{"id":"startup","name":"Disruptive App Startup","emoji":"📱","price":700000000,"payPerDay":12600000,"blurb":"It''s an app for apps. Investors are thrilled.","upgrades":[{"name":"Pivot to AI","emoji":"🤖","blurb":"Same app, new deck, valuation doubles."},{"name":"Celebrity board member","emoji":"🌟","blurb":"They don''t know what the app does. Nobody does."},{"name":"Ring the bell","emoji":"🔔","blurb":"Ready to go public."}]}]},"together":{"multiplier":1.5,"windowMinutes":10,"perDay":5,"minAccountDays":2,"tags":["library","university","club","nightlife"],"ride":{"modes":["subway","taxi"],"expireMinutes":3}},"jobs":{"perPairPerDay":1,"decorator":{"payMin":200,"payMax":20000,"payChoices":[500,1000,2500,5000],"minutes":30,"clout":25,"autoKeepHours":24},"manager":{"cutMin":5,"cutMax":20,"cutChoices":[5,10,15,20]}},"ranks":[{"clout":0,"netWorth":0},{"clout":100,"netWorth":25000},{"clout":500,"netWorth":50000},{"clout":1000,"netWorth":100000},{"clout":2000,"netWorth":250000},{"clout":5000,"netWorth":500000},{"clout":15000,"netWorth":1000000},{"clout":50000,"netWorth":10000000},{"clout":150000,"netWorth":1000000000},{"clout":500000,"netWorth":10000000000}]},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","club":{"vip":"medium"},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["mixer","social","tea","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","club":null,"borough":"queens","actions":[{"id":"speed-meet","kind":"visit","price":25,"pay":0,"energy":12,"mood":5,"confidence":6,"clout":null,"storyUnlock":false,"skill":"charisma"},{"id":"spill","kind":"visit","price":12,"pay":0,"energy":6,"mood":6,"confidence":0,"clout":null,"storyUnlock":false,"skill":"gossip"},{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7112,-73.965],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.715,-73.952],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7188,-73.9622],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":null,"at":[40.7105,-73.9392],"area":"East Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"st-copays","tags":["hospital","civic","astoria"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"checkup","kind":"visit","price":60,"pay":0,"energy":-30,"mood":6,"confidence":0,"clout":null,"storyUnlock":false},{"id":"volunteer","kind":"visit","price":0,"pay":0,"energy":15,"mood":5,"confidence":4,"clout":12,"storyUnlock":false,"skill":"charisma"}]},{"id":"brownstone-sessions","tags":["lounge","nightlife","music_venue"],"story":null,"at":[40.7128,-73.944],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"set","kind":"visit","price":35,"pay":0,"energy":8,"mood":8,"confidence":0,"clout":null,"storyUnlock":false},{"id":"open-mic","kind":"visit","price":0,"pay":0,"energy":18,"mood":3,"confidence":8,"clout":15,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7172,-73.957],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"fifs-furniture","tags":["furniture","shopping","home"],"story":null,"at":[40.7272,-73.9532],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7292,-73.944],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget"],"story":null,"at":[40.725,-73.9565],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["hub","diner","dining_medium","games","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"play","kind":"visit","price":12,"pay":0,"energy":8,"mood":6,"confidence":2,"clout":null,"storyUnlock":false},{"id":"hang","kind":"hangout","price":0,"pay":0,"energy":2,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7205,-73.9595],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife"],"story":null,"at":[40.7085,-73.942],"area":"East Williamsburg","club":{"vip":"medium"},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"the-sticky-floor","tags":["club","nightlife"],"story":null,"at":[40.7058,-73.9372],"area":"East Williamsburg","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":40,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"discount-disco","tags":["club","nightlife"],"story":null,"at":[40.7038,-73.9328],"area":"Bushwick","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"ultraviolet-society","tags":["club","nightlife","exclusive_club"],"story":null,"at":[40.7135,-73.9625],"area":"Williamsburg","club":{"vip":"exclusive","doorClout":2000},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":350,"pay":0,"energy":15,"mood":8,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus"],"story":null,"at":[40.7118,-73.9545],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym"],"story":null,"at":[40.7168,-73.9468],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot"],"story":null,"at":[40.7238,-73.9478],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena"],"story":null,"at":[40.7098,-73.9482],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7138,-73.9585],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"real-clout-fm","tags":["radio","station","astoria"],"story":null,"at":[40.7598,-73.9262],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"sit-in","kind":"visit","price":0,"pay":0,"energy":4,"mood":5,"confidence":2,"clout":6,"storyUnlock":false}]},{"id":"clout-tower","tags":["tv","station","astoria"],"story":null,"at":[40.7585,-73.9195],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"watch","kind":"visit","price":0,"pay":0,"energy":3,"mood":4,"confidence":3,"clout":6,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"two-dollar-night","placeId":"the-sticky-floor","startHour":21,"hours":5,"entry":55,"clout":20,"confidence":5,"mood":8},{"id":"clearance-rack-disco","placeId":"discount-disco","startHour":22,"hours":4,"entry":70,"clout":25,"confidence":5,"mood":8},{"id":"ultraviolet-afterglow","placeId":"ultraviolet-society","startHour":23,"hours":4,"entry":450,"clout":140,"confidence":10,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000},{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500},{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000},{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-neon-five-sign","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-trophy-shelf","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-employee-frame","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-streak-lava-lamp","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}],"homeLocations":{"sunnyside_gardens":[40.7472,-73.9182],"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956],"sj_dorm":[40.7208,-73.7972],"qu_dorm":[40.7352,-73.8192]}}'::jsonb, updated_at = now() where key = 'city';

-- ---------------------------------------------------------------------------
-- Settings: the goal ladder, goal-linked tasks and streak rewards (lib/goals.ts GOALS)
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values ('goals', '{"ladder":["first_purchase","first_gig","move_up","pro_gigs","first_car","big_gigs","own_home"],"rewards":{"first_purchase":50,"first_gig":75,"move_up":150,"pro_gigs":150,"first_car":200,"big_gigs":300,"own_home":500},"goalTasksPerDay":2,"tags":{"first_purchase":["boutique","shopping"],"first_gig":["gym","campus","club","monument"],"move_up":["gym","campus","club","monument"],"pro_gigs":["gym","campus","club","monument"],"first_car":["dealership","cars"],"big_gigs":["gym","campus","club","monument"],"own_home":["furniture","home"]},"streak":{"freezesPerWeek":1,"day3Clout":50,"every":7,"collectibles":["home-neon-five-sign","home-trophy-shelf","home-employee-frame","home-streak-lava-lamp"],"fallbackClout":100}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.goals_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = 'goals' $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
-- The goal a daily task was picked for (null for every other task).
alter table public.daily_tasks add column if not exists goal text;

create table if not exists public.player_streaks (
  player_id   uuid primary key references public.players (id) on delete cascade,
  current     int not null default 0,
  best        int not null default 0,
  started_on  date,
  last_day    date,
  -- The New York week (its Monday) whose one missed day was forgiven.
  freeze_week date
);
alter table public.player_streaks enable row level security;
revoke all on public.player_streaks from anon, authenticated;

-- One row per reward per streak run (a run is named by the day it started), so each pays once.
create table if not exists public.player_streak_rewards (
  player_id  uuid not null references public.players (id) on delete cascade,
  run        date not null,
  day        int not null,
  reward     text not null check (reward in ('clout', 'collectible', 'pass')),
  sku        text,
  created_at timestamptz not null default now(),
  primary key (player_id, run, day)
);
alter table public.player_streak_rewards enable row level security;
revoke all on public.player_streak_rewards from anon, authenticated;

create table if not exists public.guest_passes (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  earned_on  date not null,
  used_place text,
  used_on    date,
  created_at timestamptz not null default now()
);
create index if not exists guest_passes_player_idx on public.guest_passes (player_id, used_on);
alter table public.guest_passes enable row level security;
revoke all on public.guest_passes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Goals: the ladder, each goal's progress, and the one-time rewards
-- ---------------------------------------------------------------------------
create or replace function public.goal_part(p_have numeric, p_need numeric, p_unit text) returns jsonb
language sql immutable as $$ select jsonb_build_object('have', p_have, 'need', p_need, 'unit', p_unit) $$;

/**
 * Every goal on the ladder, in order: {id, done, parts, target}. A goal is done once its condition holds or its
 * reward has been paid (so a goal stays done when Confidence drifts down or a car is sold).
 */
create or replace function public.goal_list(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  gs jsonb := public.goals_settings();
  e jsonb := public.economy();
  c jsonb := public.city();
  me public.players;
  v_out jsonb := '[]'::jsonb;
  gid text;
  v_done boolean;
  v_parts jsonb;
  v_target text;
  nh jsonb;
  t jsonb;
  it jsonb;
begin
  select * into me from public.players where id = p_player;
  if me.id is null or gs is null then return '[]'::jsonb; end if;
  for gid in select jsonb_array_elements_text(gs -> 'ladder') loop
    v_target := null;
    v_parts := '[]'::jsonb;
    case gid
      when 'first_purchase' then
        v_done := exists (select 1 from public.player_items where player_id = p_player and acquired = 'bought')
               or exists (select 1 from public.ledger where player_id = p_player and currency = 'cash' and kind = 'purchase');
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'first_gig' then
        v_done := exists (select 1 from public.gig_offers where player_id = p_player and collected_at is not null);
        v_parts := jsonb_build_array(public.goal_part(case when v_done then 1 else 0 end, 1, 'count'));
      when 'move_up' then
        -- The next home up: the cheapest one dearer than where they live now (never a campus dorm).
        select h into nh from jsonb_array_elements(e -> 'homes') h
         where not h ? 'campus' and (h ->> 'rent')::int > coalesce(public.rent_for(me.home_id), 0)
         order by (h ->> 'rent')::int limit 1;
        v_done := me.moved_up or me.house_sku is not null or nh is null;
        v_target := nh ->> 'id';
        if nh is not null then
          if coalesce((nh ->> 'moveClout')::int, 0) > 0 then
            v_parts := v_parts || jsonb_build_array(public.goal_part(me.clout, (nh ->> 'moveClout')::int, 'clout'));
          end if;
          v_parts := v_parts || jsonb_build_array(public.goal_part(me.bank_cash,
                       (nh ->> 'rent')::int * (1 + coalesce((e -> 'moving' ->> 'brokerWeeks')::int, 1)), 'cash'));
        end if;
      when 'pro_gigs', 'big_gigs' then
        t := c -> 'economy' -> 'gigs' -> (case gid when 'pro_gigs' then 'pro' else 'big' end);
        v_done := me.clout >= coalesce((t ->> 'clout')::int, 0) and me.confidence >= coalesce((t ->> 'confidence')::int, 0);
        v_parts := jsonb_build_array(public.goal_part(me.clout, coalesce((t ->> 'clout')::int, 0), 'clout'),
                                     public.goal_part(me.confidence, coalesce((t ->> 'confidence')::int, 0), 'confidence'));
      when 'first_car', 'own_home' then
        select i into it from jsonb_array_elements(c -> 'shop') i
         where i ->> 'category' = (case gid when 'first_car' then 'cars' else 'houses' end)
           and not coalesce((i ->> 'collector')::boolean, false) and not coalesce((i ->> 'reward')::boolean, false)
         order by (i ->> 'price')::int limit 1;
        v_done := case gid when 'first_car' then me.car_sku is not null else me.house_sku is not null end;
        v_target := it ->> 'sku';
        if it is not null then v_parts := jsonb_build_array(public.goal_part(me.bank_cash, (it ->> 'price')::int, 'cash')); end if;
      else continue;
    end case;
    v_done := v_done or exists (select 1 from public.ledger where player_id = p_player and currency = 'clout' and kind = 'goal' and ref = gid);
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', gid, 'done', v_done, 'parts', v_parts, 'target', v_target));
  end loop;
  return v_out;
end;
$$;

/** The goal the game suggests: the first unfinished one on the ladder ({id, parts, target}), or null when all are done. */
create or replace function public.goal_current(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select g - 'done' from jsonb_array_elements(public.goal_list(p_player)) with ordinality x(g, n)
   where not (g ->> 'done')::boolean order by n limit 1
$$;

/** Pays each finished goal's clout once (ledger clout 'goal', ref the goal id). Returns the clout paid now. */
create or replace function public.goal_settle(p_player uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  gs jsonb := public.goals_settings();
  g jsonb;
  v_reward int;
  paid int := 0;
begin
  for g in select x from jsonb_array_elements(public.goal_list(p_player)) x where (x ->> 'done')::boolean loop
    v_reward := coalesce((gs -> 'rewards' ->> (g ->> 'id'))::int, 0);
    if v_reward > 0 and public.ledger_once(p_player, 'clout', v_reward, 'goal', g ->> 'id') then
      update public.players set clout = clout + v_reward where id = p_player;
      paid := paid + v_reward;
    end if;
  end loop;
  return paid;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Shop: streak rewards are never sold, and never sold back
-- ---------------------------------------------------------------------------
-- 0043's buy_item, plus the streak-reward check.
create or replace function public.buy_item(p_sku text, p_mode text default 'buy')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb := public.shop_item(p_sku);
  cat text := item ->> 'category';
  price int;
  e jsonb := public.city() -> 'economy';
  today date := public.ny_today();
  me public.players;
  v_clout int := 0;
  item_id bigint;
begin
  if item is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if coalesce((item ->> 'collector')::boolean, false) then raise exception 'real_money_only' using errcode = '22023'; end if;
  -- 0073: streak rewards arrive with a streak, never from the till.
  if coalesce((item ->> 'reward')::boolean, false) then raise exception 'reward_only' using errcode = '22023'; end if;
  -- Story-only items (e.g. the "Forever Our Bird" hoodie) are sold only while a story opens them.
  if coalesce((item ->> 'storyOnly')::boolean, false) and (select state from public.story_availability(null, p_sku)) <> 'open' then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  -- Fantasy outfits (#9) need clout as well as cash.
  if me.clout < coalesce((item ->> 'cloutReq')::int, 0) then raise exception 'outfit_needs_clout' using errcode = '22023'; end if;
  if p_mode = 'rent' and (cat <> 'cars' or coalesce((item ->> 'rentPerWeek')::int, 0) = 0) then raise exception 'not_rentable' using errcode = '22023'; end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if cat = 'houses' and me.house_sku is not null then raise exception 'already_own_house' using errcode = '22023'; end if;
  if cat = 'cars' and me.car_mode = 'owned' then raise exception 'already_own_car' using errcode = '22023'; end if;
  if cat = 'cars' and p_mode = 'rent' and me.car_mode = 'rented' then raise exception 'already_renting' using errcode = '22023'; end if;

  price := case when p_mode = 'rent' then (item ->> 'rentPerWeek')::int else (item ->> 'price')::int end;
  price := round(price * (select multiplier from public.story_price(jsonb_build_array(p_sku, cat), 'shop_price')));
  if me.bank_cash < price then raise exception 'cant_afford' using errcode = '22023'; end if;

  -- Clout once per item ever (buying back after a sale pays none).
  if p_mode <> 'rent' then
    v_clout := round((item ->> 'clout')::int * power((e ->> 'purchaseCloutDecay')::numeric, me.purchases_count));
    if not public.ledger_once(uid, 'clout', v_clout, 'purchase', p_sku) then v_clout := 0; end if;
  end if;

  update public.players
     set bank_cash = bank_cash - price,
         clout = clout + v_clout,
         purchases_count = purchases_count + case when p_mode = 'rent' then 0 else 1 end,
         house_sku = case when cat = 'houses' then p_sku else house_sku end,
         next_rent_due = case when cat = 'houses' then null else next_rent_due end,
         car_sku = case when cat = 'cars' then p_sku else car_sku end,
         car_mode = case when cat = 'cars' then (case when p_mode = 'rent' then 'rented' else 'owned' end) else car_mode end,
         next_car_due = case when cat <> 'cars' then next_car_due
                             when p_mode = 'rent' then today + (e -> 'bills' ->> 'carRentalDays')::int
                             else (today + (e -> 'bills' ->> 'every')::interval)::date end
   where id = uid;
  if p_mode = 'rent' then
    perform public.ledger_once(uid, 'cash', -price, 'car_rental', p_sku || ':' || today);
  else
    insert into public.player_items (player_id, sku, category, value) values (uid, p_sku, cat, (item ->> 'price')::int)
    returning id into item_id;
    perform public.ledger_once(uid, 'cash', -price, 'purchase', item_id::text);
  end if;
  return jsonb_build_object('cash', -price, 'clout', v_clout);
end;
$$;

-- 0009's sell_item, plus: a streak reward stays (selling it would only lose it, for C$0).
create or replace function public.sell_item(p_item bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  v_amount int;
  today date := public.ny_today();
  v_every interval := (public.city() -> 'economy' -> 'bills' ->> 'every')::interval;
begin
  select * into it from public.player_items where id = p_item and player_id = uid for update;
  if it.id is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  if it.acquired = 'collector' then raise exception 'not_sellable' using errcode = '22023'; end if;
  if coalesce((public.shop_item(it.sku) ->> 'reward')::boolean, false) then raise exception 'reward_unsellable' using errcode = '22023'; end if;
  v_amount := floor(it.value * (public.city() -> 'economy' ->> 'sellRate')::numeric);
  delete from public.player_items where id = it.id;
  update public.players
     set bank_cash = bank_cash + v_amount,
         house_sku = case when it.category = 'houses' then null else house_sku end,
         next_rent_due = case when it.category = 'houses' then (today + v_every)::date else next_rent_due end,
         car_sku = case when it.category = 'cars' then null else car_sku end,
         car_mode = case when it.category = 'cars' then null else car_mode end,
         next_car_due = case when it.category = 'cars' then null else next_car_due end
   where id = uid;
  perform public.ledger_once(uid, 'cash', v_amount, 'sale', it.id::text);
  return v_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily tasks: 1 gossip, 2 for the goal, 1 skill, the rest at random
-- ---------------------------------------------------------------------------
-- 0066's ensure_daily, plus: finished goals pay first, and two tasks are picked for the active goal (marked
-- daily_tasks.goal). Gossip comes from economy.gossip.tasksPerDay (now 1). Rewards are unchanged: ordinary cash.
create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  c jsonb := public.city();
  dt jsonb := c -> 'economy' -> 'dailyTasks';
  g jsonb := c -> 'economy' -> 'gigs';
  gs jsonb := public.goals_settings();
  rate int := (c -> 'economy' ->> 'shiftRate')::int;
  shift_energy int := (c -> 'economy' ->> 'shiftEnergy')::int;
  cand record;
  v_slot int := 0;
  v_tier text;
  t jsonb;
  rolls int;
  titles jsonb;
  lead record;
  gossip_max int := coalesce((c -> 'economy' -> 'gossip' ->> 'tasksPerDay')::int, 0);
  goal_max int := coalesce((gs ->> 'goalTasksPerDay')::int, 0);
  me_clout bigint;
  sk record;
  v_goal jsonb;
  v_gid text;
  v_cash boolean;
  v_tags text[];
begin
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today) then
    -- 0073: finished goals pay their clout first (once each), so today's goal is the next one up. Only here, when
    -- the day's list is made (and in goals_state), never in the middle of another action's tick.
    if gs is not null then perform public.goal_settle(p_player); end if;
    me_clout := coalesce((select clout from public.players where id = p_player), 0);
    -- v0.11: up to tasksPerDay tasks send the player to their next gossip piece (one per story, never
    -- two at the same place). Talking to a regular comes first; the rest of the list fills the five.
    for lead in
      select * from (select distinct on (gl.place) gl.* from public.gossip_leads(p_player) gl
                      order by gl.place, (gl.source = 'regular') desc, gl.story) one_per_place
       order by (source = 'regular') desc, random()
    loop
      exit when v_slot >= gossip_max;
      -- 0066: never a lead in a borough that hasn't opened.
      continue when not public.place_open(lead.place);
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, 'gossip', lead.place, 'gossip-' || lead.source,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;

    -- 0073 (owner, Oct 18): goal-linked tasks. Cash goals (and moving up, once its clout is there) get a shift,
    -- then a place that fits the goal (the dealership for a car), then free fun that leaves the savings alone;
    -- clout and Confidence goals get the places that give them, the goal's own kinds (gym, campus, club,
    -- monument) first. One of each kind before a second of any; never a place twice; same filters as below.
    v_goal := case when goal_max > 0 then public.goal_current(p_player) end;
    v_gid := v_goal ->> 'id';
    if v_gid is not null then
      v_cash := v_gid in ('first_purchase', 'first_car', 'own_home')
             or (v_gid = 'move_up' and not exists (select 1 from jsonb_array_elements(v_goal -> 'parts') pt
                                                    where pt ->> 'unit' = 'clout' and (pt ->> 'have')::numeric < (pt ->> 'need')::numeric));
      v_tags := coalesce(array(select jsonb_array_elements_text(gs -> 'tags' -> v_gid)), '{}');
      if v_cash and v_gid = 'move_up' then v_tags := '{}'; end if;
      for cand in
        select * from (
          select *, row_number() over (partition by prio order by random()) as k from (
            select *, row_number() over (partition by place_id order by prio, random()) as n from (
              select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id,
                     case when v_cash then
                            case when a ->> 'kind' = 'shift' then 1
                                 when coalesce(p -> 'tags', '[]'::jsonb) ?| v_tags then 2
                                 when coalesce((a ->> 'price')::int, 0) = 0 then 3 end
                          when coalesce((a ->> 'confidence')::int, 0) > 0 or coalesce((a ->> 'clout')::int, 0) > 0 then
                            case when coalesce(p -> 'tags', '[]'::jsonb) ?| v_tags then 1 else 2 end
                     end as prio
                from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
               where a ->> 'kind' <> 'gigs'
                 and p ->> 'story' is null
                 and not coalesce((a ->> 'storyUnlock')::boolean, false)
                 and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
                 and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
                 and public.place_open(p ->> 'id')
            ) x
            where x.prio is not null
              and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = x.place_id)
          ) one_each
          where one_each.n = 1
        ) ranked
        order by k, prio
        limit goal_max
      loop
        v_slot := v_slot + 1;
        insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward, goal)
        values (p_player, today, v_slot, cand.kind, cand.place_id, cand.action_id,
                5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5), v_gid);
      end loop;
    end if;

    -- 0063 (owner, Oct 16): one task levels up a skill. A skill at random (one with somewhere to train it today),
    -- then a place that trains it: cooking at home, a shift for hustle, or a place whose tags train a skill.
    select * into sk from (
      with cands as (
        select * from (
          select 'cook' as kind, 'home' as place_id, 'cook' as action_id, 'cooking' as skill
          union all
          select a ->> 'kind', p ->> 'id', a ->> 'id',
                 case when a ->> 'kind' = 'shift' then 'hustle' else coalesce(a ->> 'skill', public.skill_for_place(p ->> 'id')) end
            from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
           where a ->> 'kind' <> 'gigs'
             and p ->> 'story' is null
             and not coalesce((a ->> 'storyUnlock')::boolean, false)
             and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
             and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
             and public.place_open(p ->> 'id')
        ) x
        where x.skill is not null
          and not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = x.place_id)
      ),
      pick as (select skill from (select distinct skill from cands) d order by random() limit 1)
      select cands.* from cands join pick using (skill) order by random() limit 1
    ) q;
    if sk.place_id is not null and v_slot < (dt ->> 'count')::int then
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward, skill)
      values (p_player, today, v_slot, sk.kind, sk.place_id, sk.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5), sk.skill);
    end if;
    -- Every place action except the gigs board, plus each club event; only places that exist.
    for cand in
      select * from (select *, row_number() over (partition by place_id order by random()) as n from (select * from (
        select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id
          from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
         where a ->> 'kind' <> 'gigs'
           -- Never a closed or restricted place, a story place or a story-unlock action, so no task is impossible.
           and p ->> 'story' is null
           and not coalesce((a ->> 'storyUnlock')::boolean, false)
           and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
           -- #19 (0046): never a club whose bouncer would turn this player away.
           and coalesce((p -> 'club' ->> 'doorClout')::int, 0) <= me_clout
           -- 0066: never a place in a borough that hasn't opened.
           and public.place_open(p ->> 'id')
        union all
        select 'event', e ->> 'placeId', e ->> 'id' from jsonb_array_elements(c -> 'events') e
         where coalesce((select (p -> 'club' ->> 'doorClout')::int from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId'), 0) <= me_clout
           and public.place_open(e ->> 'placeId')
           and (select state from public.story_availability(
                  (select p -> 'tags' from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId') || jsonb_build_array(e ->> 'id'), null)) <> 'closed'
      ) all_actions
      where not exists (select 1 from public.daily_tasks d where d.player_id = p_player and d.ny_date = today and d.place_id = all_actions.place_id)
      ) candidates  -- 0066: one action per place (a place with several actions could otherwise come up twice)
      ) one_each where one_each.n = 1
      order by random()
      limit greatest(0, (dt ->> 'count')::int - v_slot)
    loop
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, cand.kind, cand.place_id, cand.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;
  end if;

  if not exists (select 1 from public.gig_offers where player_id = p_player and ny_date = today) then
    foreach v_tier in array array['side', 'pro', 'big'] loop
      t := g -> v_tier;
      titles := c -> 'gigs' -> v_tier;
      rolls := case when v_tier = 'side' then 2 else 1 end;
      for i in 1..rolls loop
        if random() < (t ->> 'chance')::numeric then
          insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
          values (p_player, today, v_tier,
                  titles ->> floor(random() * jsonb_array_length(titles))::int,
                  10 * round(rate * ((t ->> 'payMin')::numeric + random() * ((t ->> 'payMax')::numeric - (t ->> 'payMin')::numeric)) / 10),
                  round(shift_energy * (t ->> 'energy')::numeric),
                  (t ->> 'waitMinutes')::int,
                  (t ->> 'confidence')::int);
        end if;
      end loop;
    end loop;
  end if;

  -- Story gigs injected by a beat today (task_injection "gigs"), under the normal gig rules.
  insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, story_id)
  select p_player, today, sg ->> 'tier', sg ->> 'title',
         10 * round(rate * coalesce((sg ->> 'pay_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'payMin')::numeric) / 10),
         round(shift_energy * coalesce((sg ->> 'energy_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'energy')::numeric)),
         coalesce((sg ->> 'wait_minutes')::int, (g -> (sg ->> 'tier') ->> 'waitMinutes')::int),
         coalesce((sg ->> 'confidence')::int, (g -> (sg ->> 'tier') ->> 'confidence')::int),
         sg ->> 'id'
    from public.world_effects() w
   cross join lateral jsonb_array_elements(coalesce(w.effect -> 'gigs', '[]')) sg
   where w.effect ->> 'type' = 'task_injection'
     and not exists (select 1 from public.gig_offers o where o.player_id = p_player and o.ny_date = today and o.story_id = sg ->> 'id');
end;
$$;

-- ---------------------------------------------------------------------------
-- Streaks: New York days with all five tasks done
-- ---------------------------------------------------------------------------
/** What reaching day n of a streak pays: day 3 clout, then every 7 days a collectible (odd) or a pass (even). */
create or replace function public.streak_reward_on(p_day int) returns text
language sql stable security definer set search_path = public
as $$
  select case
    when p_day = 3 then 'clout'
    when p_day > 0 and p_day % (s ->> 'every')::int = 0 then
      case when (p_day / (s ->> 'every')::int) % 2 = 1 then 'collectible' else 'pass' end
  end
  from (select public.goals_settings() -> 'streak' as s) x
$$;

/** Pays day p_n of the streak run that started on p_run (once: player_streak_rewards). */
create or replace function public.streak_reward(p_player uuid, p_run date, p_n int, p_day date) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s jsonb := public.goals_settings() -> 'streak';
  v_kind text := public.streak_reward_on(p_n);
  v_ref text := p_run::text || ':' || p_n;
  v_clout int := 0;
  v_sku text;
begin
  if v_kind is null then return; end if;
  insert into public.player_streak_rewards (player_id, run, day, reward) values (p_player, p_run, p_n, v_kind)
  on conflict do nothing;
  if not found then return; end if;
  if v_kind = 'clout' then
    v_clout := (s ->> 'day3Clout')::int;
  elsif v_kind = 'collectible' then
    select sku into v_sku from jsonb_array_elements_text(s -> 'collectibles') with ordinality x(sku, n)
     where not exists (select 1 from public.player_items i where i.player_id = p_player and i.sku = x.sku)
       and public.shop_item(x.sku) is not null
     order by n limit 1;
    if v_sku is null then
      v_clout := (s ->> 'fallbackClout')::int;
    else
      insert into public.player_items (player_id, sku, category, value, acquired) values (p_player, v_sku, 'home', 0, 'earned');
    end if;
  else
    -- One pass held at a time: a second one becomes clout.
    if exists (select 1 from public.guest_passes where player_id = p_player and used_on is null) then
      v_clout := (s ->> 'fallbackClout')::int;
    else
      insert into public.guest_passes (player_id, earned_on) values (p_player, p_day);
    end if;
  end if;
  update public.player_streak_rewards set reward = case when v_clout > 0 then 'clout' else reward end, sku = v_sku
   where player_id = p_player and run = p_run and day = p_n;
  if v_clout > 0 and public.ledger_once(p_player, 'clout', v_clout, 'streak', v_ref) then
    update public.players set clout = clout + v_clout where id = p_player;
  end if;
end;
$$;

/**
 * Counts a full day (all five tasks) into the player's streak: the next day adds one; one missed day per New York
 * week is forgiven (the freeze); otherwise a new run starts at 1. Then pays the day's reward, if any.
 */
create or replace function public.streak_tick(p_player uuid, p_day date) returns int
language plpgsql security definer set search_path = public
as $$
declare
  s public.player_streaks;
  st jsonb := public.goals_settings() -> 'streak';
  v_gap int;
  v_n int;
  v_run date;
  v_freeze date;
begin
  select * into s from public.player_streaks where player_id = p_player for update;
  if s.player_id is not null and s.last_day is not null and p_day <= s.last_day then return s.current; end if;
  v_gap := case when s.last_day is null then null else p_day - s.last_day end;
  v_freeze := s.freeze_week;
  if v_gap = 1 then
    v_n := s.current + 1; v_run := s.started_on;
  elsif v_gap = 2 and coalesce((st ->> 'freezesPerWeek')::int, 0) > 0
        and s.freeze_week is distinct from date_trunc('week', p_day - 1)::date then
    v_n := s.current + 1; v_run := s.started_on; v_freeze := date_trunc('week', p_day - 1)::date;
  else
    v_n := 1; v_run := p_day;
  end if;
  insert into public.player_streaks (player_id, current, best, started_on, last_day, freeze_week)
  values (p_player, v_n, v_n, v_run, p_day, v_freeze)
  on conflict (player_id) do update
    set current = excluded.current, best = greatest(public.player_streaks.best, excluded.current),
        started_on = excluded.started_on, last_day = excluded.last_day, freeze_week = excluded.freeze_week;
  perform public.streak_reward(p_player, v_run, v_n, p_day);
  return v_n;
end;
$$;

/** The daily bonus (all five tasks, ref the New York date) counts the day into the streak. */
create or replace function public.streak_from_ledger() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.ref ~ '^\d{4}-\d{2}-\d{2}$' then perform public.streak_tick(new.player_id, new.ref::date); end if;
  return null;
end;
$$;
drop trigger if exists ledger_streaks on public.ledger;
create trigger ledger_streaks after insert on public.ledger
  for each row when (new.kind = 'daily_bonus') execute function public.streak_from_ledger();

-- ---------------------------------------------------------------------------
-- Guest-list passes: one night inside one club you can't get into yet
-- ---------------------------------------------------------------------------
/** Whether the player used a pass for this place tonight (until midnight New York). */
create or replace function public.pass_tonight(p_player uuid, p_place text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.guest_passes where player_id = p_player and used_place = p_place and used_on = public.ny_today()) $$;

-- 0046's vip_access, plus 'pass' for a guest-list pass used tonight at that club ('free' and 'paid' come first).
create or replace function public.vip_access(p_player uuid, p_place text) returns text
language sql stable security definer set search_path = public
as $$
  with pl as (select p -> 'club' ->> 'vip' as tier from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place),
       cfg as (select public.city() -> 'economy' -> 'clubs' -> 'vip' -> pl.tier as v from pl where pl.tier is not null)
  select case
    when (select clout from public.players where id = p_player) >= (select (v ->> 'freeClout')::int from cfg) then 'free'
    when exists (select 1 from public.ledger l where l.player_id = p_player and l.currency = 'cash' and l.kind = 'vip_cover'
                  and l.ref = p_place || ':' || public.ny_today()) then 'paid'
    when public.pass_tonight(p_player, p_place) then 'pass'
  end
  from cfg
$$;

-- 0046's travel, plus: a guest-list pass used tonight for this club gets past the door.
create or replace function public.travel(p_place text, p_mode text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t jsonb := public.city() -> 'economy' -> 'travel';
  me public.players;
  dest text := nullif(p_place, 'home');
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  v_from jsonb;
  v_to jsonb;
  v_miles numeric;
  band int;
  v_fare int := 0;
  v_energy int := 0;
  v_seconds int;
  v_arrives timestamptz;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if dest is not null and (place is null or (place ->> 'story' is not null and not public.arc_started(place ->> 'story'))) then
    raise exception 'unknown_place' using errcode = '22023';
  end if;
  -- #19 (0046): the exclusive club's bouncer checks your clout at the door; 0073: or your name on tonight's list.
  if dest is not null and me.clout < coalesce((place -> 'club' ->> 'doorClout')::int, 0) and not public.pass_tonight(uid, dest) then
    raise exception 'door_clout' using errcode = '22023';
  end if;
  if me.at_place is not distinct from dest then
    return jsonb_build_object('place', coalesce(dest, 'home'), 'already', true,
                              'seconds', greatest(0, ceil(extract(epoch from coalesce(me.arrives_at, now()) - clock_timestamp())))::int);
  end if;
  v_from := public.travel_point(uid, me.at_place);
  v_to := public.travel_point(uid, dest);
  v_miles := coalesce(public.miles_between(v_from, v_to), 0);
  band := case when v_miles < (t -> 'bandsMiles' ->> 0)::numeric then 0
               when v_miles < (t -> 'bandsMiles' ->> 1)::numeric then 1
               when v_miles < (t -> 'bandsMiles' ->> 2)::numeric then 2 else 3 end;
  case p_mode
    when 'walk' then
      if t -> 'walk' -> 'energy' -> band = 'null'::jsonb then raise exception 'too_far_to_walk' using errcode = '22023'; end if;
      v_energy := (t -> 'walk' -> 'energy' ->> band)::int;
    when 'subway' then v_fare := (t -> 'subway' ->> 'fare')::int;
    when 'taxi' then v_fare := (t -> 'taxi' -> 'fare' ->> band)::int;
    when 'car' then
      if me.car_sku is null then raise exception 'no_car' using errcode = '22023'; end if;
    else raise exception 'bad_mode' using errcode = '22023';
  end case;
  v_seconds := public.trip_seconds(p_mode, v_miles);
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_fare then raise exception 'cant_afford' using errcode = '22023'; end if;

  v_arrives := clock_timestamp() + make_interval(secs => v_seconds);
  update public.players set at_place = dest, arrives_at = v_arrives,
    bank_cash = bank_cash - v_fare, energy = energy - v_energy where id = uid;
  if v_fare > 0 then
    perform public.ledger_once(uid, 'cash', -v_fare, 'travel',
      p_mode || ':' || coalesce(dest, 'home') || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  return jsonb_build_object('place', coalesce(dest, 'home'), 'mode', p_mode, 'miles', round(v_miles, 2),
                            'cash', -v_fare, 'energy', -v_energy, 'seconds', v_seconds, 'arrivesAt', v_arrives);
end;
$$;

-- ---------------------------------------------------------------------------
-- What the Tasks sheet shows
-- ---------------------------------------------------------------------------
create or replace function public.goals_state_for(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  st jsonb := public.goals_settings() -> 'streak';
  v_list jsonb;
  s public.player_streaks;
  v_alive boolean;
  v_cur int;
  v_next int;
  v_tonight text;
begin
  perform public.goal_settle(p_player);
  v_list := public.goal_list(p_player);
  select * into s from public.player_streaks where player_id = p_player;
  -- A streak is alive through yesterday, or through the day before when this week's freeze can still cover the gap.
  v_alive := s.last_day is not null and (s.last_day >= today - 1
             or (s.last_day = today - 2 and coalesce((st ->> 'freezesPerWeek')::int, 0) > 0
                 and s.freeze_week is distinct from date_trunc('week', today - 1)::date));
  v_cur := case when v_alive then s.current else 0 end;
  v_next := case when v_cur < 3 then 3 else (v_cur / (st ->> 'every')::int + 1) * (st ->> 'every')::int end;
  select used_place into v_tonight from public.guest_passes where player_id = p_player and used_on = today order by id desc limit 1;
  return jsonb_build_object(
    'goal', (select g - 'done' from jsonb_array_elements(v_list) with ordinality x(g, n) where not (g ->> 'done')::boolean order by n limit 1),
    'done', coalesce((select jsonb_agg(g -> 'id' order by n) from jsonb_array_elements(v_list) with ordinality x(g, n) where (g ->> 'done')::boolean), '[]'::jsonb),
    'streak', jsonb_build_object(
      'current', v_cur, 'best', coalesce(s.best, 0), 'lastDay', s.last_day,
      'today', coalesce(s.last_day = today, false),
      'frozenThisWeek', coalesce(s.freeze_week = public.ny_week(), false),
      'next', jsonb_build_object('day', v_next, 'reward', coalesce(public.streak_reward_on(v_next), 'clout'))),
    'passes', jsonb_build_object(
      'held', (select count(*) from public.guest_passes where player_id = p_player and used_on is null),
      'tonight', case when v_tonight is null then null else jsonb_build_object('place', v_tonight) end));
end;
$$;

/** The player's goal, done goals, streak and guest-list passes (paying any goal that has just finished). */
create or replace function public.goals_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.players where id = uid and home_id is not null) then
    raise exception 'no_player' using errcode = '28000';
  end if;
  return public.goals_state_for(uid);
end;
$$;

/**
 * Use a guest-list pass tonight at a club the player can't get into yet: one above their door clout, or one with a
 * VIP floor they can't get up to. Never a place in a locked borough. Good until midnight New York.
 */
create or replace function public.use_guest_pass(p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.ny_today();
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  me public.players;
  v_pass bigint;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if place is null or place ->> 'story' is not null or jsonb_typeof(place -> 'club') is distinct from 'object' then
    raise exception 'not_a_club' using errcode = '22023';
  end if;
  if not public.place_open(p_place) then raise exception 'borough_locked' using errcode = '22023'; end if;
  if public.pass_tonight(uid, p_place) then return public.goals_state_for(uid); end if;
  if exists (select 1 from public.guest_passes where player_id = uid and used_on = today) then
    raise exception 'pass_used_tonight' using errcode = '22023';
  end if;
  select id into v_pass from public.guest_passes where player_id = uid and used_on is null order by id limit 1 for update;
  if v_pass is null then raise exception 'no_pass' using errcode = '22023'; end if;
  if not (me.clout < coalesce((place -> 'club' ->> 'doorClout')::int, 0)
          or (place -> 'club' ->> 'vip' is not null and public.vip_access(uid, p_place) is null)) then
    raise exception 'pass_not_needed' using errcode = '22023';
  end if;
  update public.guest_passes set used_place = p_place, used_on = today where id = v_pass;
  return public.goals_state_for(uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (hardening, 0049)
-- ---------------------------------------------------------------------------
revoke all on function public.goals_settings() from public, anon, authenticated;
revoke all on function public.goal_part(numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.goal_list(uuid) from public, anon, authenticated;
revoke all on function public.goal_current(uuid) from public, anon, authenticated;
revoke all on function public.goal_settle(uuid) from public, anon, authenticated;
revoke all on function public.ensure_daily(uuid) from public, anon, authenticated;
revoke all on function public.streak_reward_on(int) from public, anon, authenticated;
revoke all on function public.streak_reward(uuid, date, int, date) from public, anon, authenticated;
revoke all on function public.streak_tick(uuid, date) from public, anon, authenticated;
revoke all on function public.streak_from_ledger() from public, anon, authenticated;
revoke all on function public.pass_tonight(uuid, text) from public, anon, authenticated;
revoke all on function public.vip_access(uuid, text) from public, anon, authenticated;
revoke all on function public.goals_state_for(uuid) from public, anon, authenticated;
revoke all on function public.goals_state() from public, anon;
revoke all on function public.use_guest_pass(text) from public, anon;
revoke all on function public.buy_item(text, text) from public, anon;
revoke all on function public.sell_item(bigint) from public, anon;
revoke all on function public.travel(text, text) from public, anon;
grant execute on function public.goals_state() to authenticated;
grant execute on function public.use_guest_pass(text) to authenticated;
grant execute on function public.buy_item(text, text) to authenticated;
grant execute on function public.sell_item(bigint) to authenticated;
grant execute on function public.travel(text, text) to authenticated;
