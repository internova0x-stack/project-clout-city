-- 0072: Campus life (v0.15 "Campus"; docs/08-new-features-spec.md section 18; owner, Oct 18).
-- At the two parody universities in Queens (St. Johnsons, Queensborough):
--   * enrolment at one campus (transfer after a week), three courses a week, a class once a day per course
--     (Energy for Confidence, a little clout and Smarts practice) with an attendance streak;
--   * Friday-to-Sunday exams: five questions per course, answers kept on the server, a grade from attendance and
--     answers (half each), a GPA, and a scholarship once a week for a week's GPA of 3.5 or better;
--     "peek at your neighbor's paper" adds an answer but can get you caught (an F);
--   * the dining hall (student price for enrolled students), the dorm rooms (homes for enrolled students only), and
--     the school-vs-school leaderboard.
-- Numbers live in game_settings 'campus' (mirrored by lib/campus.ts). The economy and city seeds are regenerated
-- for the dorms (lib/economy.ts, lib/city.ts). Safe to run more than once.

do $$ begin
  if to_regprocedure('public.ny_week()') is null or to_regprocedure('public.skill_practice(uuid, text, text)') is null then
    raise exception 'Run migrations 0032 and 0056 first.';
  end if;
end $$;

update public.game_settings set value = '{"birthLottery":{"min":5000,"max":10000,"step":100},"phoneBill":60,"firstParty":{"entry":150,"cashReward":300,"cloutReward":100,"confidence":15,"energy":20},"invites":{"cloutPerInvite":50,"cliqueSize":5,"cliqueBonus":500,"paidAtOnce":5},"startingStats":{"energy":100,"mood":60,"confidence":40},"playersOnlineThreshold":1,"homes":[{"id":"astoria_studio","rent":1750},{"id":"jackson_heights_1br","rent":2600},{"id":"sunnyside_gardens","rent":3200,"moveClout":1000,"signup":false},{"id":"lic_highrise","rent":4500,"moveClout":3000},{"id":"sj_dorm","rent":1100,"signup":false,"campus":"st-johnsons"},{"id":"qu_dorm","rent":1100,"signup":false,"campus":"queensborough-u"}],"moving":{"brokerWeeks":1}}'::jsonb, updated_at = now() where key = 'economy';

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":2,"taskClout":15,"restroom":{"clout":25,"mood":6}},"clubs":{"vip":{"medium":{"freeClout":5000,"cover":1500},"exclusive":{"freeClout":15000,"cover":5000}},"vipTimes":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]},"businesses":{"tillDays":2,"upgrade":{"cost":0.6,"pay":0.5,"value":0.5},"hype":{"clout":150000,"max":2},"goPublic":{"clout":50000,"fee":50000000,"times":3},"list":[{"id":"hot-dog-cart","name":"Dirty Water Dogs","emoji":"🌭","price":5000,"payPerDay":750,"blurb":"One cart, one umbrella, a hot dog water recipe older than the city.","upgrades":[{"name":"Second umbrella","emoji":"⛱️","blurb":"Twice the shade, twice the line."},{"name":"Secret menu","emoji":"🤫","blurb":"It''s the same hot dog. It costs more now."},{"name":"Influencer collab","emoji":"🤳","blurb":"A creator ate one on camera. The line goes around the block."}]},{"id":"bodega","name":"Bodega, Cat Included","emoji":"🐈","price":50000,"payPerDay":6000,"blurb":"Open 24 hours. The cat runs it; you just own it.","upgrades":[{"name":"Hot food counter","emoji":"🥪","blurb":"Chopped cheese, all day, every day."},{"name":"Lotto machine","emoji":"🎟️","blurb":"Everybody''s uncle comes in now."},{"name":"The cat gets an agent","emoji":"😼","blurb":"Brand deals. The cat negotiates better than you."}]},{"id":"laundromat","name":"Spin Cycle Laundromat","emoji":"🧺","price":250000,"payPerDay":22500,"blurb":"Twenty machines, three of them work. The quarters add up.","upgrades":[{"name":"Free Wi-Fi","emoji":"📶","blurb":"People stay. People buy snacks."},{"name":"Wash and fold","emoji":"👕","blurb":"You fold strangers'' socks for money. Lucrative."},{"name":"Laundromat by night","emoji":"🎧","blurb":"A DJ on Fridays. It''s a scene now."}]},{"id":"cafe","name":"Oat Milk Surcharge Café","emoji":"☕","price":1200000,"payPerDay":81600,"blurb":"Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".","upgrades":[{"name":"Latte art","emoji":"🎨","blurb":"Every cup a portrait of the customer. Mostly."},{"name":"Laptop ban (for vibes)","emoji":"💻","blurb":"Fewer screenwriters, more turnover."},{"name":"Second location","emoji":"📍","blurb":"Same café, different neighborhood, same oat milk."}]},{"id":"taco-trucks","name":"Taco Truck Fleet","emoji":"🌮","price":6000000,"payPerDay":300000,"blurb":"Five trucks, one group chat, zero parking tickets paid.","upgrades":[{"name":"Late-night route","emoji":"🌙","blurb":"Outside every club at 2 a.m."},{"name":"Festival permits","emoji":"🎪","blurb":"Every street fair in Queens."},{"name":"A truck in every borough","emoji":"🗽","blurb":"Even Staten Island. Especially Staten Island."}]},{"id":"nightclub","name":"Your Own Nightclub","emoji":"🪩","price":30000000,"payPerDay":1080000,"blurb":"Your name on the door. The bouncer still doesn''t respect you.","upgrades":[{"name":"VIP floor","emoji":"🥂","blurb":"Upstairs, where the expensive bottles live."},{"name":"Celebrity DJ residency","emoji":"🎛️","blurb":"Every Saturday, a famous person presses play."},{"name":"A gold-plated velvet rope","emoji":"✨","blurb":"Completely unnecessary. Wildly profitable."}]},{"id":"apartment-building","name":"Luxury* Apartment Building","emoji":"🏢","price":150000000,"payPerDay":3900000,"blurb":"*Exposed brick. Forty units, one elevator, rent that should be illegal.","upgrades":[{"name":"Rooftop amenity","emoji":"🌇","blurb":"Two lounge chairs and a view. Rent goes up 30%."},{"name":"Doorman with opinions","emoji":"🧑‍✈️","blurb":"He judges every delivery. Tenants love it."},{"name":"Condo conversion","emoji":"🔑","blurb":"Same units, now for sale, at three times the price."}]},{"id":"startup","name":"Disruptive App Startup","emoji":"📱","price":700000000,"payPerDay":12600000,"blurb":"It''s an app for apps. Investors are thrilled.","upgrades":[{"name":"Pivot to AI","emoji":"🤖","blurb":"Same app, new deck, valuation doubles."},{"name":"Celebrity board member","emoji":"🌟","blurb":"They don''t know what the app does. Nobody does."},{"name":"Ring the bell","emoji":"🔔","blurb":"Ready to go public."}]}]},"together":{"multiplier":1.5,"windowMinutes":10,"perDay":5,"minAccountDays":2,"tags":["library","university","club","nightlife"],"ride":{"modes":["subway","taxi"],"expireMinutes":3}},"jobs":{"perPairPerDay":1,"decorator":{"payMin":200,"payMax":20000,"payChoices":[500,1000,2500,5000],"minutes":30,"clout":25,"autoKeepHours":24},"manager":{"cutMin":5,"cutMax":20,"cutChoices":[5,10,15,20]}},"ranks":[{"clout":0,"netWorth":0},{"clout":100,"netWorth":25000},{"clout":500,"netWorth":50000},{"clout":1000,"netWorth":100000},{"clout":2000,"netWorth":250000},{"clout":5000,"netWorth":500000},{"clout":15000,"netWorth":1000000},{"clout":50000,"netWorth":10000000},{"clout":150000,"netWorth":1000000000},{"clout":500000,"netWorth":10000000000}]},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","club":{"vip":"medium"},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["mixer","social","tea","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","club":null,"borough":"queens","actions":[{"id":"speed-meet","kind":"visit","price":25,"pay":0,"energy":12,"mood":5,"confidence":6,"clout":null,"storyUnlock":false,"skill":"charisma"},{"id":"spill","kind":"visit","price":12,"pay":0,"energy":6,"mood":6,"confidence":0,"clout":null,"storyUnlock":false,"skill":"gossip"},{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7112,-73.965],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.715,-73.952],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7188,-73.9622],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":null,"at":[40.7105,-73.9392],"area":"East Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"st-copays","tags":["hospital","civic","astoria"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"checkup","kind":"visit","price":60,"pay":0,"energy":-30,"mood":6,"confidence":0,"clout":null,"storyUnlock":false},{"id":"volunteer","kind":"visit","price":0,"pay":0,"energy":15,"mood":5,"confidence":4,"clout":12,"storyUnlock":false,"skill":"charisma"}]},{"id":"brownstone-sessions","tags":["lounge","nightlife","music_venue"],"story":null,"at":[40.7128,-73.944],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"set","kind":"visit","price":35,"pay":0,"energy":8,"mood":8,"confidence":0,"clout":null,"storyUnlock":false},{"id":"open-mic","kind":"visit","price":0,"pay":0,"energy":18,"mood":3,"confidence":8,"clout":15,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7172,-73.957],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"fifs-furniture","tags":["furniture","shopping","home"],"story":null,"at":[40.7272,-73.9532],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7292,-73.944],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget"],"story":null,"at":[40.725,-73.9565],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["hub","diner","dining_medium","games","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"play","kind":"visit","price":12,"pay":0,"energy":8,"mood":6,"confidence":2,"clout":null,"storyUnlock":false},{"id":"hang","kind":"hangout","price":0,"pay":0,"energy":2,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7205,-73.9595],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife"],"story":null,"at":[40.7085,-73.942],"area":"East Williamsburg","club":{"vip":"medium"},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"the-sticky-floor","tags":["club","nightlife"],"story":null,"at":[40.7058,-73.9372],"area":"East Williamsburg","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":40,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"discount-disco","tags":["club","nightlife"],"story":null,"at":[40.7038,-73.9328],"area":"Bushwick","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"ultraviolet-society","tags":["club","nightlife","exclusive_club"],"story":null,"at":[40.7135,-73.9625],"area":"Williamsburg","club":{"vip":"exclusive","doorClout":2000},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":350,"pay":0,"energy":15,"mood":8,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus"],"story":null,"at":[40.7118,-73.9545],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym"],"story":null,"at":[40.7168,-73.9468],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot"],"story":null,"at":[40.7238,-73.9478],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena"],"story":null,"at":[40.7098,-73.9482],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7138,-73.9585],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"real-clout-fm","tags":["radio","station","astoria"],"story":null,"at":[40.7598,-73.9262],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"sit-in","kind":"visit","price":0,"pay":0,"energy":4,"mood":5,"confidence":2,"clout":6,"storyUnlock":false}]},{"id":"clout-tower","tags":["tv","station","astoria"],"story":null,"at":[40.7585,-73.9195],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"watch","kind":"visit","price":0,"pay":0,"energy":3,"mood":4,"confidence":3,"clout":6,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"two-dollar-night","placeId":"the-sticky-floor","startHour":21,"hours":5,"entry":55,"clout":20,"confidence":5,"mood":8},{"id":"clearance-rack-disco","placeId":"discount-disco","startHour":22,"hours":4,"entry":70,"clout":25,"confidence":5,"mood":8},{"id":"ultraviolet-afterglow","placeId":"ultraviolet-society","startHour":23,"hours":4,"entry":450,"clout":140,"confidence":10,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000},{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500},{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000},{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}],"homeLocations":{"sunnyside_gardens":[40.7472,-73.9182],"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956],"sj_dorm":[40.7208,-73.7972],"qu_dorm":[40.7352,-73.8192]}}'::jsonb, updated_at = now() where key = 'city';

insert into public.game_settings (key, value) values ('campus', '{"campuses":["st-johnsons","queensborough-u"],"courses":["main-character-101","8am-regret-101","napping-301","group-project","dining-hall-econ","subway-studies","intro-to-clout","finance-for-broke"],"coursesPerWeek":3,"quizSize":5,"attend":{"energy":10,"confidence":4,"clout":5},"attendDaysForFull":4,"scholarship":{"gpa":3.5,"cash":300},"peek":{"bonus":1,"caughtChance":0.35},"transferDays":7,"dining":{"student":6,"visitor":12,"energy":-25}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.campus_settings() returns jsonb
language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = 'campus' $$;

-- ---------------------------------------------------------------------------
-- Tables (read only through the functions below)
-- ---------------------------------------------------------------------------
create table if not exists public.campus_enrolments (
  player_id   uuid primary key references public.players (id) on delete cascade,
  campus      text not null check (campus in ('st-johnsons', 'queensborough-u')),
  enrolled_on date not null
);

create table if not exists public.campus_schedule (
  player_id uuid not null references public.players (id) on delete cascade,
  week      date not null check (extract(isodow from week) = 1),
  course_id text not null,
  primary key (player_id, week, course_id)
);

create table if not exists public.campus_attendance (
  player_id uuid not null references public.players (id) on delete cascade,
  course_id text not null,
  day       date not null,
  campus    text not null,
  primary key (player_id, course_id, day)
);
create index if not exists campus_attendance_day_idx on public.campus_attendance (day);

-- The exam questions. week null: the standing bank; a week's own questions replace it that week (written in the Studio).
create table if not exists public.campus_questions (
  id        bigint generated always as identity primary key,
  course_id text not null,
  week      date check (week is null or extract(isodow from week) = 1),
  position  smallint not null check (position between 1 and 10),
  prompt    text not null,
  choices   text[] not null check (array_length(choices, 1) between 2 and 5),
  answer    smallint not null check (answer >= 0)
);
create unique index if not exists campus_questions_slot on public.campus_questions (course_id, coalesce(week, '1970-01-05'::date), position);

create table if not exists public.campus_exams (
  player_id uuid not null references public.players (id) on delete cascade,
  week      date not null check (extract(isodow from week) = 1),
  course_id text not null,
  correct   smallint not null,
  percent   smallint not null,
  grade     text not null check (grade in ('A', 'B', 'C', 'D', 'F')),
  peeked    boolean not null default false,
  caught    boolean not null default false,
  taken_at  timestamptz not null default now(),
  primary key (player_id, week, course_id)
);

alter table public.campus_enrolments enable row level security;
alter table public.campus_schedule enable row level security;
alter table public.campus_attendance enable row level security;
alter table public.campus_questions enable row level security;
alter table public.campus_exams enable row level security;
revoke all on public.campus_enrolments, public.campus_schedule, public.campus_attendance, public.campus_questions, public.campus_exams
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.campus_points(p_grade text) returns int
language sql immutable set search_path = public
as $$ select case p_grade when 'A' then 4 when 'B' then 3 when 'C' then 2 when 'D' then 1 else 0 end $$;

create or replace function public.campus_grade(p_percent int) returns text
language sql immutable set search_path = public
as $$ select case when p_percent >= 90 then 'A' when p_percent >= 80 then 'B' when p_percent >= 70 then 'C' when p_percent >= 60 then 'D' else 'F' end $$;

/** Consecutive days a player went to a course, ending today (or yesterday, if today's class is still ahead). */
create or replace function public.campus_streak(p_player uuid, p_course text) returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  d date := public.ny_today();
  n int := 0;
begin
  if not exists (select 1 from public.campus_attendance where player_id = p_player and course_id = p_course and day = d) then
    d := d - 1;
  end if;
  while exists (select 1 from public.campus_attendance where player_id = p_player and course_id = p_course and day = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

/** The player, ready to act at their campus: ticked, locked, enrolled and standing there (not travelling). */
create or replace function public.campus_here(p_player uuid) returns public.campus_enrolments
language plpgsql security definer set search_path = public
as $$
declare
  me public.players;
  en public.campus_enrolments;
begin
  perform public.tick(p_player);
  select * into me from public.players where id = p_player for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into en from public.campus_enrolments where player_id = p_player;
  if en.player_id is null then raise exception 'not_enrolled' using errcode = '22023'; end if;
  if me.at_place is distinct from en.campus then raise exception 'not_here' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  return en;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enrolment and the week's courses
-- ---------------------------------------------------------------------------
create or replace function public.campus_enrol(p_campus text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  me public.players;
  en public.campus_enrolments;
  today date := public.ny_today();
begin
  if not (s -> 'campuses') ? p_campus then raise exception 'unknown_place' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_campus then raise exception 'not_here' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  select * into en from public.campus_enrolments where player_id = uid;
  if en.campus = p_campus then raise exception 'already_enrolled' using errcode = '22023'; end if;
  if en.player_id is not null and en.enrolled_on > today - (s ->> 'transferDays')::int then
    raise exception 'transfer_wait' using errcode = '22023';
  end if;
  insert into public.campus_enrolments (player_id, campus, enrolled_on) values (uid, p_campus, today)
  on conflict (player_id) do update set campus = excluded.campus, enrolled_on = excluded.enrolled_on;
  return public.campus_state();
end;
$$;

/** This week's courses: exactly coursesPerWeek different ones; changeable until the first class of the week. */
create or replace function public.campus_pick(p_courses text[]) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  wk date := public.ny_week();
  c text;
begin
  if not exists (select 1 from public.campus_enrolments where player_id = uid) then raise exception 'not_enrolled' using errcode = '22023'; end if;
  if coalesce(array_length(p_courses, 1), 0) <> (s ->> 'coursesPerWeek')::int
     or (select count(distinct x) from unnest(p_courses) x) <> (s ->> 'coursesPerWeek')::int then
    raise exception 'pick_courses' using errcode = '22023';
  end if;
  foreach c in array p_courses loop
    if not (s -> 'courses') ? c then raise exception 'unknown_course' using errcode = '22023'; end if;
  end loop;
  if exists (select 1 from public.campus_attendance where player_id = uid and day between wk and wk + 6) then
    raise exception 'schedule_locked' using errcode = '22023';
  end if;
  delete from public.campus_schedule where player_id = uid and week = wk;
  insert into public.campus_schedule (player_id, week, course_id) select uid, wk, x from unnest(p_courses) x;
  return public.campus_state();
end;
$$;

-- ---------------------------------------------------------------------------
-- Going to class: once a day per course
-- ---------------------------------------------------------------------------
create or replace function public.campus_attend(p_course text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  a jsonb := s -> 'attend';
  en public.campus_enrolments := public.campus_here(uid);
  today date := public.ny_today();
  me public.players;
  v_clout int := 0;
begin
  if not exists (select 1 from public.campus_schedule where player_id = uid and week = public.ny_week() and course_id = p_course) then
    raise exception 'not_your_course' using errcode = '22023';
  end if;
  if exists (select 1 from public.campus_attendance where player_id = uid and course_id = p_course and day = today) then
    raise exception 'already_in_class' using errcode = '22023';
  end if;
  select * into me from public.players where id = uid;
  if me.energy < (a ->> 'energy')::int then raise exception 'no_energy' using errcode = '22023'; end if;
  insert into public.campus_attendance (player_id, course_id, day, campus) values (uid, p_course, today, en.campus);
  if public.ledger_once(uid, 'clout', (a ->> 'clout')::int, 'campus_class', p_course || ':' || today) then
    v_clout := (a ->> 'clout')::int;
  end if;
  update public.players
     set energy = greatest(0, energy - (a ->> 'energy')::int),
         confidence = least(100, confidence + (a ->> 'confidence')::int),
         clout = clout + v_clout
   where id = uid;
  perform public.skill_practice(uid, 'smarts', 'class:' || p_course || ':' || today);
  return jsonb_build_object('clout', v_clout, 'confidence', (a ->> 'confidence')::int, 'energy', -(a ->> 'energy')::int,
    'streak', public.campus_streak(uid, p_course));
end;
$$;

-- ---------------------------------------------------------------------------
-- Exams: Friday to Sunday, at your campus, once per course per week
-- ---------------------------------------------------------------------------
create or replace function public.campus_exam_check(p_player uuid, p_course text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.campus_here(p_player);
  if extract(isodow from public.ny_today()) < 5 then raise exception 'exams_closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.campus_schedule where player_id = p_player and week = public.ny_week() and course_id = p_course) then
    raise exception 'not_your_course' using errcode = '22023';
  end if;
  if exists (select 1 from public.campus_exams where player_id = p_player and week = public.ny_week() and course_id = p_course) then
    raise exception 'exam_taken' using errcode = '22023';
  end if;
end;
$$;

/** The week's questions for a course: this week's own set if the Studio wrote one, else the standing bank. */
create or replace function public.campus_exam_set(p_course text) returns setof public.campus_questions
language sql stable security definer set search_path = public
as $$
  select q.* from public.campus_questions q
   where q.course_id = p_course
     and q.week is not distinct from (case when exists (select 1 from public.campus_questions w where w.course_id = p_course and w.week = public.ny_week())
                                           then public.ny_week() end)
   order by q.position
   limit (select (public.campus_settings() ->> 'quizSize')::int)
$$;

/** The questions, without answers. */
create or replace function public.campus_exam(p_course text) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.campus_exam_check(auth.uid(), p_course);
  return coalesce((select jsonb_agg(jsonb_build_object('prompt', q.prompt, 'choices', to_jsonb(q.choices)) order by q.position)
                     from public.campus_exam_set(p_course) q), '[]'::jsonb);
end;
$$;

create or replace function public.campus_exam_submit(p_course text, p_answers int[], p_peek boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  wk date := public.ny_week();
  n int := (s ->> 'quizSize')::int;
  v_correct int;
  v_days int;
  v_percent int;
  v_grade text;
  v_caught boolean := false;
  v_taken int;
  v_week_gpa numeric;
  v_paid int := 0;
begin
  perform public.campus_exam_check(uid, p_course);
  if coalesce(array_length(p_answers, 1), 0) <> n then raise exception 'bad_answers' using errcode = '22023'; end if;
  select count(*) filter (where q.answer = p_answers[q.rn]) into v_correct
    from (select x.answer, row_number() over (order by x.position) rn from public.campus_exam_set(p_course) x) q;
  if coalesce(p_peek, false) then
    v_correct := least(n, v_correct + (s -> 'peek' ->> 'bonus')::int);
    v_caught := random() < (s -> 'peek' ->> 'caughtChance')::numeric;
  end if;
  select count(*) into v_days from public.campus_attendance where player_id = uid and course_id = p_course and day between wk and wk + 6;
  v_percent := round(50 * least(1, v_days::numeric / (s ->> 'attendDaysForFull')::int) + 50 * v_correct::numeric / n);
  v_grade := case when v_caught then 'F' else public.campus_grade(v_percent) end;
  insert into public.campus_exams (player_id, week, course_id, correct, percent, grade, peeked, caught)
  values (uid, wk, p_course, v_correct, v_percent, v_grade, coalesce(p_peek, false), v_caught);

  -- The week's last exam settles the scholarship.
  select count(*), avg(public.campus_points(grade)) into v_taken, v_week_gpa from public.campus_exams where player_id = uid and week = wk;
  if v_taken >= (s ->> 'coursesPerWeek')::int and v_week_gpa >= (s -> 'scholarship' ->> 'gpa')::numeric
     and public.ledger_once(uid, 'cash', (s -> 'scholarship' ->> 'cash')::int, 'scholarship', wk::text) then
    v_paid := (s -> 'scholarship' ->> 'cash')::int;
    update public.players set bank_cash = bank_cash + v_paid where id = uid;
  end if;
  return jsonb_build_object('correct', v_correct, 'percent', v_percent, 'grade', v_grade, 'caught', v_caught,
    'weekGpa', case when v_taken >= (s ->> 'coursesPerWeek')::int then round(v_week_gpa, 2) end, 'scholarship', v_paid);
end;
$$;

-- ---------------------------------------------------------------------------
-- The dining hall: any campus; students eat at the student price at their own campus
-- ---------------------------------------------------------------------------
create or replace function public.campus_eat() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d jsonb := public.campus_settings() -> 'dining';
  me public.players;
  today date := public.ny_today();
  v_price int;
  n int;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not (public.campus_settings() -> 'campuses') ? coalesce(me.at_place, '') then raise exception 'not_here' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  v_price := case when exists (select 1 from public.campus_enrolments where player_id = uid and campus = me.at_place)
                  then (d ->> 'student')::int else (d ->> 'visitor')::int end;
  if me.bank_cash < v_price then raise exception 'cant_afford' using errcode = '22023'; end if;
  select count(*) + 1 into n from public.ledger where player_id = uid and currency = 'cash' and kind = 'dining' and ref like me.at_place || ':' || today || ':%';
  perform public.ledger_once(uid, 'cash', -v_price, 'dining', me.at_place || ':' || today || ':' || n);
  update public.players set bank_cash = bank_cash - v_price, energy = least(100, greatest(0, energy - (d ->> 'energy')::int)) where id = uid;
  return jsonb_build_object('cash', -v_price, 'energy', -(d ->> 'energy')::int);
end;
$$;

-- ---------------------------------------------------------------------------
-- Dorms: homes for enrolled students only (move_home from 0045, plus the dorm rule)
-- ---------------------------------------------------------------------------
create or replace function public.move_home(p_home text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e jsonb := public.economy();
  home jsonb;
  me public.players;
  today date := public.ny_today();
  v_every interval := (public.city() -> 'economy' -> 'bills' ->> 'every')::interval;
  v_rent int;
  v_cost int;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select h into home from jsonb_array_elements(e -> 'homes') h where h ->> 'id' = p_home;
  if home is null then raise exception 'unknown_home' using errcode = '22023'; end if;
  if me.house_sku is not null then raise exception 'own_house' using errcode = '22023'; end if;
  if me.home_id = p_home then raise exception 'already_home' using errcode = '22023'; end if;
  if home ? 'campus' and not exists (select 1 from public.campus_enrolments where player_id = uid and campus = home ->> 'campus') then
    raise exception 'dorm_students_only' using errcode = '22023';
  end if;
  if exists (select 1 from public.bills where player_id = uid and kind = 'rent' and status = 'due') then
    raise exception 'rent_due' using errcode = '22023';
  end if;
  if me.clout < coalesce((home ->> 'moveClout')::int, 0) then raise exception 'home_needs_clout' using errcode = '22023'; end if;
  v_rent := (home ->> 'rent')::int;
  v_cost := v_rent * (1 + coalesce((e -> 'moving' ->> 'brokerWeeks')::int, 1));
  if me.bank_cash < v_cost then raise exception 'cant_afford' using errcode = '22023'; end if;

  update public.players
     set bank_cash = bank_cash - v_cost,
         home_id = p_home,
         next_rent_due = (today + v_every)::date,
         moved_up = moved_up or v_rent > coalesce(public.rent_for(me.home_id), 0)
   where id = uid;
  perform public.ledger_once(uid, 'cash', -v_rent, 'rent', 'move:' || p_home || ':' || today);
  perform public.ledger_once(uid, 'cash', -(v_cost - v_rent), 'broker_fee', 'move:' || p_home || ':' || today);
  return jsonb_build_object('cash', -v_cost);
end;
$$;

/** Eviction's destination: the cheapest home anyone can live in (dorms are for students only). */
create or replace function public.cheapest_home() returns text
language sql stable security definer set search_path = public
as $$ select h ->> 'id' from jsonb_array_elements(public.economy() -> 'homes') h where not h ? 'campus' order by (h ->> 'rent')::int limit 1 $$;

-- ---------------------------------------------------------------------------
-- What the campus screens show
-- ---------------------------------------------------------------------------
create or replace function public.campus_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb := public.campus_settings();
  en public.campus_enrolments;
  wk date := public.ny_week();
  today date := public.ny_today();
  v_courses jsonb;
  v_gpa numeric;
  v_week_gpa numeric;
  v_taken int;
begin
  select * into en from public.campus_enrolments where player_id = uid;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.course_id,
           'attendedToday', exists (select 1 from public.campus_attendance a where a.player_id = uid and a.course_id = c.course_id and a.day = today),
           'daysThisWeek', (select count(*) from public.campus_attendance a where a.player_id = uid and a.course_id = c.course_id and a.day between wk and wk + 6),
           'streak', public.campus_streak(uid, c.course_id),
           'exam', (select jsonb_build_object('grade', x.grade, 'percent', x.percent, 'correct', x.correct, 'caught', x.caught)
                      from public.campus_exams x where x.player_id = uid and x.week = wk and x.course_id = c.course_id))
         order by c.course_id), '[]'::jsonb)
    into v_courses from public.campus_schedule c where c.player_id = uid and c.week = wk;
  select round(avg(public.campus_points(grade)), 2) into v_gpa from public.campus_exams where player_id = uid;
  select count(*), round(avg(public.campus_points(grade)), 2) into v_taken, v_week_gpa from public.campus_exams where player_id = uid and week = wk;
  return jsonb_build_object(
    'campus', en.campus,
    'enrolledOn', en.enrolled_on,
    'transferOn', case when en.player_id is not null then en.enrolled_on + (s ->> 'transferDays')::int end,
    'week', wk,
    'today', today,
    'examsOpen', extract(isodow from today) >= 5,
    'scheduleLocked', exists (select 1 from public.campus_attendance where player_id = uid and day between wk and wk + 6),
    'courses', v_courses,
    'gpa', v_gpa,
    'weekGpa', case when v_taken >= (s ->> 'coursesPerWeek')::int then v_week_gpa end,
    'scholarshipPaid', exists (select 1 from public.ledger where player_id = uid and currency = 'cash' and kind = 'scholarship' and ref = wk::text));
end;
$$;

/** School vs school, this week: students, classes attended and grade points earned. Score = classes + 5 per grade point. */
create or replace function public.campus_leaderboard() returns jsonb
language sql stable security definer set search_path = public
as $$
  with wk as (select public.ny_week() w),
  rows as (
    select c.campus,
           (select count(*) from public.campus_enrolments e where e.campus = c.campus) students,
           (select count(*) from public.campus_attendance a, wk where a.campus = c.campus and a.day between wk.w and wk.w + 6) classes,
           (select coalesce(sum(public.campus_points(x.grade)), 0) from public.campus_exams x join public.campus_enrolments e on e.player_id = x.player_id, wk
             where e.campus = c.campus and x.week = wk.w) points
      from jsonb_array_elements_text(public.campus_settings() -> 'campuses') c(campus)
  )
  select jsonb_build_object('week', (select w from wk), 'campuses',
           coalesce(jsonb_agg(jsonb_build_object('campus', campus, 'students', students, 'classes', classes, 'points', points,
             'score', classes + 5 * points) order by classes + 5 * points desc, campus), '[]'::jsonb))
    from rows
$$;

-- ---------------------------------------------------------------------------
-- The standing exam bank (week null). Weekly sets are written in the Studio.
-- ---------------------------------------------------------------------------
delete from public.campus_questions where week is null;
insert into public.campus_questions (course_id, position, prompt, choices, answer) values
  ('main-character-101', 1, 'You walk into a party. What do you do first?', array['Pause in the doorway for the lighting','Find the snacks','Text your mom you arrived','Leave'], 0),
  ('main-character-101', 2, 'Your best "walking away" angle is:', array['Over the shoulder, slow motion','Running','Backwards, maintaining eye contact','You do not walk away'], 0),
  ('main-character-101', 3, 'A stranger compliments your fit. The correct response:', array['"This old thing?" (it is new)','Tell them the price','Ask for their number','Say nothing and nod like a legend'], 3),
  ('main-character-101', 4, 'Rain starts on your way to class. You:', array['Run for cover','Look up dramatically and keep walking','Order a ride','Cancel class for everyone'], 1),
  ('main-character-101', 5, 'Your inner monologue should be narrated by:', array['A soft-voiced documentary host','Your group chat','A sports commentator','Nobody, you are at peace'], 0),
  ('8am-regret-101', 1, 'The best time to leave for an 8 AM class is:', array['7:15 AM','7:59 AM','8:10 AM, with a coffee','Never'], 1),
  ('8am-regret-101', 2, 'What counts as "attending" an 8 AM?', array['Being physically present','Being spiritually present','Watching the recording at 2x','Being near the building'], 0),
  ('8am-regret-101', 3, 'The professor asks a question at 8:03 AM. You:', array['Answer brilliantly','Make eye contact with the floor','Fake a sneeze','Ask what class this is'], 1),
  ('8am-regret-101', 4, 'How many alarms is a reasonable number?', array['1','3','7, each named after an ex','Alarms are a suggestion'], 2),
  ('8am-regret-101', 5, 'Which item is essential for an 8 AM?', array['Coffee','A pen','Sunglasses, indoors','A pillow'], 0),
  ('napping-301', 1, 'The ideal library nap position is:', array['Head on a textbook, highlighter in hand','Under the table','Fully horizontal on three chairs','Standing'], 0),
  ('napping-301', 2, 'A power nap should last:', array['20 minutes','2 hours','Until a stranger wakes you','The whole semester'], 0),
  ('napping-301', 3, 'Napping on the subway: what is the main risk?', array['Missing your stop','Snoring','Waking up in the Bronx','All of the above'], 3),
  ('napping-301', 4, 'Someone wakes you mid-nap. The correct first words:', array['"I was resting my eyes"','"Where am I"','"Five more minutes"','"Who ordered pizza"'], 0),
  ('napping-301', 5, 'Which surface is officially nap-approved on campus?', array['The quad lawn','The dining hall table','The library beanbag','All of them, if you believe'], 3),
  ('group-project', 1, 'The group chat is silent for three days. This means:', array['Everyone is working hard','Nobody has started','The chat was deleted','You are the group now'], 1),
  ('group-project', 2, 'Who presents the final slide?', array['Whoever did nothing','Whoever did everything','The person with the best voice','Nobody, the projector broke'], 0),
  ('group-project', 3, 'A teammate says "I''ll do the conclusion." When do they send it?', array['A week early','On time','Five minutes before class','They do not send it'], 2),
  ('group-project', 4, 'The best tool for group work is:', array['A shared doc','A shared doc nobody opens','Prayer','A very passive-aggressive email'], 0),
  ('group-project', 5, 'Peer review time. You give the freeloader:', array['A fair score','A fair score and a long stare','Full marks to avoid drama','Their own slide back'], 1),
  ('dining-hall-econ', 1, 'The scarcest resource in the dining hall is:', array['A clean fork','A free table','Vegetables','Patience'], 0),
  ('dining-hall-econ', 2, 'Waffle machine line: 40 minutes. The rational choice is:', array['Wait','Leave','Befriend someone at the front','Make toast and call it a waffle'], 2),
  ('dining-hall-econ', 3, 'Taking six cookies "for later" is an example of:', array['Hoarding','Planning','Economics','All of the above'], 3),
  ('dining-hall-econ', 4, 'Theme night is "Around the World". The world tonight is:', array['Italy','Ketchup','A rumor','Mostly rice'], 1),
  ('dining-hall-econ', 5, 'Which meal plan is the best value?', array['Unlimited','14 meals a week','Your roommate''s','Whatever your parents paid for'], 2),
  ('subway-studies', 1, 'A performer shouts "showtime!" You should:', array['Hold your phone tight and your hat tighter','Join in','Change cars','Clap politely'], 0),
  ('subway-studies', 2, 'The train is delayed "due to train traffic ahead". This means:', array['There is traffic','Nobody knows','The train is resting','Both b and c'], 3),
  ('subway-studies', 3, 'The empty car on a packed train is empty because:', array['Luck','You do not want to know','It is reserved','It is cleaner'], 1),
  ('subway-studies', 4, 'Pole etiquette: how many people per pole?', array['As many hands as fit','One, leaning on it','Two, awkwardly','Zero, ride it like a surfer'], 0),
  ('subway-studies', 5, 'Your stop is next. When do you stand up?', array['When the doors open','One stop early, to make a statement','Now, and block the doors','Never, you live here now'], 0),
  ('intro-to-clout', 1, 'Clout is best defined as:', array['How much strangers care that you exist','Money','Followers','A feeling'], 0),
  ('intro-to-clout', 2, 'The fastest legal way to gain clout:', array['Be seen at the right place','Buy a gold chain','Post at 3 AM','Argue in the comments'], 0),
  ('intro-to-clout', 3, 'You were tagged in a photo where you blinked. You:', array['Untag','Repost it as "candid"','Report it','Move cities'], 1),
  ('intro-to-clout', 4, 'Which is a clout liability?', array['Being early','Being mysterious','Over-explaining','Wearing sunglasses at night'], 2),
  ('intro-to-clout', 5, 'Your ex is at the same party. Clout-optimal move:', array['Have the best night of your life, visibly','Leave','Hide in the bathroom','Ask for a rematch'], 0),
  ('finance-for-broke', 1, 'The first step of any budget is:', array['Knowing how broke you are','A spreadsheet','Ignoring it','A treat to celebrate starting'], 0),
  ('finance-for-broke', 2, 'A "free" event with a C$40 entry is:', array['Free','Not free','Free in spirit','Worth it for the photos'], 1),
  ('finance-for-broke', 3, 'Rent is due Friday. Today is Thursday. You:', array['Pay it now','Wait and see','Ask your roommate to cover it','Move into the library'], 0),
  ('finance-for-broke', 4, 'The cheapest meal on campus is:', array['The dining hall','Free pizza at any club meeting','Your roommate''s yogurt','Air'], 1),
  ('finance-for-broke', 5, 'Compound interest works best when you:', array['Start early','Start never','Spend it on sneakers','Ask the barista about it'], 0);

-- ---------------------------------------------------------------------------
-- Grants (hardening, 0049)
-- ---------------------------------------------------------------------------
revoke all on function public.campus_settings() from public, anon, authenticated;
revoke all on function public.cheapest_home() from public, anon, authenticated;
revoke all on function public.campus_points(text) from public, anon, authenticated;
revoke all on function public.campus_grade(int) from public, anon, authenticated;
revoke all on function public.campus_streak(uuid, text) from public, anon, authenticated;
revoke all on function public.campus_here(uuid) from public, anon, authenticated;
revoke all on function public.campus_exam_check(uuid, text) from public, anon, authenticated;
revoke all on function public.campus_exam_set(text) from public, anon, authenticated;
revoke all on function public.campus_enrol(text) from public, anon;
revoke all on function public.campus_pick(text[]) from public, anon;
revoke all on function public.campus_attend(text) from public, anon;
revoke all on function public.campus_exam(text) from public, anon;
revoke all on function public.campus_exam_submit(text, int[], boolean) from public, anon;
revoke all on function public.campus_eat() from public, anon;
revoke all on function public.campus_state() from public, anon;
revoke all on function public.campus_leaderboard() from public, anon;
revoke all on function public.move_home(text) from public, anon;
grant execute on function public.campus_enrol(text) to authenticated;
grant execute on function public.campus_pick(text[]) to authenticated;
grant execute on function public.campus_attend(text) to authenticated;
grant execute on function public.campus_exam(text) to authenticated;
grant execute on function public.campus_exam_submit(text, int[], boolean) to authenticated;
grant execute on function public.campus_eat() to authenticated;
grant execute on function public.campus_state() to authenticated;
grant execute on function public.campus_leaderboard() to authenticated;
grant execute on function public.move_home(text) to authenticated;
