-- v0.13 "Better Together" (owner, Oct 15; docs/08 section 16): things real players do together.
--   * Together bonuses: invite one person (crew, or anyone at the place now) to study or club with you.
--     When both have done that activity within windowMinutes of each other, each gets multiplier × its
--     confidence and clout (the extra half is paid by together_claim, once). At most perDay a day, and
--     only for accounts at least minAccountDays old. city.economy.together (lib/city.ts).
--   * Ride together: two players at the same place go somewhere by subway or taxi, each paying half the
--     fare and arriving together. The other player has expireMinutes to accept.
--   * Jobs: post a job, a real player takes it.
--       Interior decorator: the pay is held by the city (ledger 'job_hold') when it's posted. The decorator
--       gets minutes to rearrange the poster's home; the poster keeps it (pay plus clout to the decorator)
--       or undoes it all (every piece back, the pay refunded). Kept on its own after autoKeepHours.
--       Business manager: collects the poster's tills and keeps their cut (cutMin to cutMax %). Either side
--       can end it.
--     Posters rate finished jobs; player cards show the rating and how often the player was hired.
--     Safety: perPairPerDay jobs between the same two players a day, account age, blocks either way.
--   * action_uses gains used_at, so "within 10 minutes" can be checked.
-- The browser never sends an amount the server pays: pay and cut are what the poster offers, held or
-- taken from what the tills really paid.

do $$
begin
  if to_regprocedure('public.came_back(uuid)') is null then
    raise exception 'Run migration 0049_hardening.sql first: 0050 builds on it.';
  end if;
end $$;

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":2,"taskClout":15,"restroom":{"clout":25,"mood":6}},"clubs":{"vip":{"medium":{"freeClout":5000,"cover":1500},"exclusive":{"freeClout":15000,"cover":5000}},"vipTimes":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]},"businesses":{"tillDays":2,"upgrade":{"cost":0.6,"pay":0.5,"value":0.5},"hype":{"clout":150000,"max":2},"goPublic":{"clout":50000,"fee":50000000,"times":3},"list":[{"id":"hot-dog-cart","name":"Dirty Water Dogs","emoji":"🌭","price":5000,"payPerDay":750,"blurb":"One cart, one umbrella, a hot dog water recipe older than the city.","upgrades":[{"name":"Second umbrella","emoji":"⛱️","blurb":"Twice the shade, twice the line."},{"name":"Secret menu","emoji":"🤫","blurb":"It''s the same hot dog. It costs more now."},{"name":"Influencer collab","emoji":"🤳","blurb":"A creator ate one on camera. The line goes around the block."}]},{"id":"bodega","name":"Bodega, Cat Included","emoji":"🐈","price":50000,"payPerDay":6000,"blurb":"Open 24 hours. The cat runs it; you just own it.","upgrades":[{"name":"Hot food counter","emoji":"🥪","blurb":"Chopped cheese, all day, every day."},{"name":"Lotto machine","emoji":"🎟️","blurb":"Everybody''s uncle comes in now."},{"name":"The cat gets an agent","emoji":"😼","blurb":"Brand deals. The cat negotiates better than you."}]},{"id":"laundromat","name":"Spin Cycle Laundromat","emoji":"🧺","price":250000,"payPerDay":22500,"blurb":"Twenty machines, three of them work. The quarters add up.","upgrades":[{"name":"Free Wi-Fi","emoji":"📶","blurb":"People stay. People buy snacks."},{"name":"Wash and fold","emoji":"👕","blurb":"You fold strangers'' socks for money. Lucrative."},{"name":"Laundromat by night","emoji":"🎧","blurb":"A DJ on Fridays. It''s a scene now."}]},{"id":"cafe","name":"Oat Milk Surcharge Café","emoji":"☕","price":1200000,"payPerDay":81600,"blurb":"Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".","upgrades":[{"name":"Latte art","emoji":"🎨","blurb":"Every cup a portrait of the customer. Mostly."},{"name":"Laptop ban (for vibes)","emoji":"💻","blurb":"Fewer screenwriters, more turnover."},{"name":"Second location","emoji":"📍","blurb":"Same café, different neighborhood, same oat milk."}]},{"id":"taco-trucks","name":"Taco Truck Fleet","emoji":"🌮","price":6000000,"payPerDay":300000,"blurb":"Five trucks, one group chat, zero parking tickets paid.","upgrades":[{"name":"Late-night route","emoji":"🌙","blurb":"Outside every club at 2 a.m."},{"name":"Festival permits","emoji":"🎪","blurb":"Every street fair in Queens."},{"name":"A truck in every borough","emoji":"🗽","blurb":"Even Staten Island. Especially Staten Island."}]},{"id":"nightclub","name":"Your Own Nightclub","emoji":"🪩","price":30000000,"payPerDay":1080000,"blurb":"Your name on the door. The bouncer still doesn''t respect you.","upgrades":[{"name":"VIP floor","emoji":"🥂","blurb":"Upstairs, where the expensive bottles live."},{"name":"Celebrity DJ residency","emoji":"🎛️","blurb":"Every Saturday, a famous person presses play."},{"name":"A gold-plated velvet rope","emoji":"✨","blurb":"Completely unnecessary. Wildly profitable."}]},{"id":"apartment-building","name":"Luxury* Apartment Building","emoji":"🏢","price":150000000,"payPerDay":3900000,"blurb":"*Exposed brick. Forty units, one elevator, rent that should be illegal.","upgrades":[{"name":"Rooftop amenity","emoji":"🌇","blurb":"Two lounge chairs and a view. Rent goes up 30%."},{"name":"Doorman with opinions","emoji":"🧑‍✈️","blurb":"He judges every delivery. Tenants love it."},{"name":"Condo conversion","emoji":"🔑","blurb":"Same units, now for sale, at three times the price."}]},{"id":"startup","name":"Disruptive App Startup","emoji":"📱","price":700000000,"payPerDay":12600000,"blurb":"It''s an app for apps. Investors are thrilled.","upgrades":[{"name":"Pivot to AI","emoji":"🤖","blurb":"Same app, new deck, valuation doubles."},{"name":"Celebrity board member","emoji":"🌟","blurb":"They don''t know what the app does. Nobody does."},{"name":"Ring the bell","emoji":"🔔","blurb":"Ready to go public."}]}]},"together":{"multiplier":1.5,"windowMinutes":10,"perDay":5,"minAccountDays":2,"tags":["library","university","club","nightlife"],"ride":{"modes":["subway","taxi"],"expireMinutes":3}},"jobs":{"perPairPerDay":1,"decorator":{"payMin":200,"payMax":20000,"payChoices":[500,1000,2500,5000],"minutes":30,"clout":25,"autoKeepHours":24},"manager":{"cutMin":5,"cutMax":20,"cutChoices":[5,10,15,20]}},"ranks":[{"clout":0,"netWorth":0},{"clout":100,"netWorth":25000},{"clout":500,"netWorth":50000},{"clout":1000,"netWorth":100000},{"clout":2000,"netWorth":250000},{"clout":5000,"netWorth":500000},{"clout":15000,"netWorth":1000000},{"clout":50000,"netWorth":10000000},{"clout":150000,"netWorth":1000000000},{"clout":500000,"netWorth":10000000000}]},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","club":{"vip":"medium"},"actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","club":null,"actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"area":"Long Island City","club":null,"actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"area":"Astoria","club":null,"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"area":"Long Island City","club":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","club":null,"actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"area":"Astoria","club":null,"actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","club":{},"actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"fifs-furniture","tags":["furniture","shopping","home"],"story":null,"at":[40.7418,-73.9405],"area":"Long Island City","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"area":"Long Island City","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","club":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","club":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"area":"Astoria","club":{"vip":"medium"},"actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"the-sticky-floor","tags":["club","nightlife"],"story":null,"at":[40.7512,-73.8832],"area":"Jackson Heights","club":{},"actions":[{"id":"visit","kind":"visit","price":40,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"discount-disco","tags":["club","nightlife"],"story":null,"at":[40.7577,-73.8336],"area":"Flushing","club":{},"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"ultraviolet-society","tags":["club","nightlife","exclusive_club"],"story":null,"at":[40.7402,-73.9593],"area":"Long Island City","club":{"vip":"exclusive","doorClout":2000},"actions":[{"id":"visit","kind":"visit","price":350,"pay":0,"energy":15,"mood":8,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","club":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","club":null,"actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","club":null,"actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","club":null,"actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"area":"Astoria","club":null,"actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","club":null,"actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"area":"Astoria","club":null,"actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","club":null,"actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"area":"Astoria","club":null,"actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"area":"Astoria","club":null,"actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"area":"Flushing","club":null,"actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"two-dollar-night","placeId":"the-sticky-floor","startHour":21,"hours":5,"entry":55,"clout":20,"confidence":5,"mood":8},{"id":"clearance-rack-disco","placeId":"discount-disco","startHour":22,"hours":4,"entry":70,"clout":25,"confidence":5,"mood":8},{"id":"ultraviolet-afterglow","placeId":"ultraviolet-society","startHour":23,"hours":4,"entry":450,"clout":140,"confidence":10,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000},{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500},{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000},{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}],"homeLocations":{"sunnyside_gardens":[40.7472,-73.9182],"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb where key = 'city';

alter table public.action_uses add column if not exists used_at timestamptz not null default now();

/** Old enough for together bonuses, rides and jobs (internal). */
create function public.together_age_ok(p_player uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select created_at <= now() - make_interval(days => (public.city() -> 'economy' -> 'together' ->> 'minAccountDays')::int)
                     from public.players where id = p_player), false)
$$;
revoke all on function public.together_age_ok(uuid) from public, anon, authenticated;

/** At this place right now: arrived and seen in the last hereMinutes (internal). */
create function public.here_now(p_player uuid, p_place text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select at_place = p_place and coalesce(arrives_at, now()) <= now()
                          and seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)
                     from public.players where id = p_player), false)
$$;
revoke all on function public.here_now(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Together bonuses
-- ---------------------------------------------------------------------------
create table public.together_invites (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.players (id) on delete cascade,
  to_id      uuid not null references public.players (id) on delete cascade,
  place_id   text not null,
  action_id  text not null,
  ny_date    date not null,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done')),
  seen_by    uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  unique (from_id, to_id, place_id, action_id, ny_date)
);
create index together_invites_to_idx on public.together_invites (to_id, ny_date);
alter table public.together_invites enable row level security;

create table public.together_bonuses (
  invite_id  bigint not null references public.together_invites (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  ny_date    date not null,
  clout      int not null,
  clout_base int not null,
  confidence int not null,
  confidence_base int not null,
  primary key (invite_id, player_id)
);
create index together_bonuses_day_idx on public.together_bonuses (player_id, ny_date);
alter table public.together_bonuses enable row level security;

/** Whether an activity can be done together: a visit at a library, university or club. */
create function public.together_action(p_place text, p_action text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.place_action(p_place, p_action) ->> 'kind' = 'visit', false)
     and exists (select 1 from jsonb_array_elements(public.city() -> 'places') p
                  where p ->> 'id' = p_place
                    and (p -> 'tags') ?| array(select jsonb_array_elements_text(public.city() -> 'economy' -> 'together' -> 'tags')))
$$;

create function public.together_invite(p_to uuid, p_place text, p_action text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id bigint;
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  if p_to = uid or not exists (select 1 from public.players where id = p_to and home_id is not null and banned_at is null) then
    raise exception 'unknown_player' using errcode = '22023';
  end if;
  if not public.together_action(p_place, p_action) then raise exception 'not_together' using errcode = '22023'; end if;
  if not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  if not public.may_reach(uid, p_to) then raise exception 'crew_only' using errcode = '42501'; end if;
  -- Crew anywhere, or anyone at the place right now.
  if p_to not in (select id from public.crew_of(uid)) and not public.here_now(p_to, p_place) then
    raise exception 'not_here' using errcode = '22023';
  end if;
  insert into public.together_invites (from_id, to_id, place_id, action_id, ny_date)
  values (uid, p_to, p_place, p_action, public.ny_today())
  on conflict (from_id, to_id, place_id, action_id, ny_date) do nothing
  returning id into v_id;
  if v_id is null then raise exception 'already_invited' using errcode = '22023'; end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.together_respond(p_id bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.together_invites;
begin
  select * into inv from public.together_invites where id = p_id and to_id = uid for update;
  if inv.id is null or inv.ny_date <> public.ny_today() then raise exception 'unknown_invite' using errcode = '22023'; end if;
  if inv.status <> 'pending' then return jsonb_build_object('status', inv.status); end if;
  if p_yes and not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  update public.together_invites set status = case when p_yes then 'accepted' else 'declined' end where id = p_id;
  return jsonb_build_object('status', case when p_yes then 'accepted' else 'declined' end);
end;
$$;

/** One player's share of a together bonus (internal): the extra half of their clout and confidence. */
create function public.together_pay(p_invite public.together_invites, p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t jsonb := public.city() -> 'economy' -> 'together';
  extra numeric := (t ->> 'multiplier')::numeric - 1;
  a jsonb := public.place_action(p_invite.place_id, p_invite.action_id);
  base_clout int;
  base_conf int := coalesce((a ->> 'confidence')::int, 0);
  add_clout int;
  add_conf int;
begin
  if (select count(*) from public.together_bonuses where player_id = p_player and ny_date = p_invite.ny_date) >= (t ->> 'perDay')::int then
    return;
  end if;
  base_clout := coalesce((select amount from public.ledger where player_id = p_player and currency = 'clout' and kind = 'visit'
                            and ref = p_invite.place_id || ':' || p_invite.ny_date), 0);
  add_clout := round(base_clout * extra);
  add_conf := round(base_conf * extra);
  insert into public.together_bonuses (invite_id, player_id, ny_date, clout, clout_base, confidence, confidence_base)
  values (p_invite.id, p_player, p_invite.ny_date, add_clout, base_clout, add_conf, base_conf)
  on conflict do nothing;
  if not found then return; end if;
  update public.players set clout = clout + add_clout, confidence = least(100, confidence + add_conf) where id = p_player;
  if add_clout > 0 then perform public.ledger_once(p_player, 'clout', add_clout, 'together', 'invite:' || p_invite.id); end if;
end;
$$;
revoke all on function public.together_pay(public.together_invites, uuid) from public, anon, authenticated;

/** Either player, after doing the activity: pays both once both did it within the window. */
create function public.together_claim(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.together_invites;
  win int := (public.city() -> 'economy' -> 'together' ->> 'windowMinutes')::int;
  a_at timestamptz;
  b_at timestamptz;
begin
  select * into inv from public.together_invites where id = p_id and uid in (from_id, to_id) for update;
  if inv.id is null then raise exception 'unknown_invite' using errcode = '22023'; end if;
  if inv.status = 'done' then return public.together_result(inv.id, uid); end if;
  if inv.status <> 'accepted' then raise exception 'not_accepted' using errcode = '22023'; end if;
  if not public.together_age_ok(inv.from_id) or not public.together_age_ok(inv.to_id) then raise exception 'too_new' using errcode = '22023'; end if;
  select used_at into a_at from public.action_uses where player_id = inv.from_id and place_id = inv.place_id and action_id = inv.action_id and ny_date = inv.ny_date;
  select used_at into b_at from public.action_uses where player_id = inv.to_id and place_id = inv.place_id and action_id = inv.action_id and ny_date = inv.ny_date;
  if a_at is null or b_at is null then raise exception 'not_yet' using errcode = '22023'; end if;
  if abs(extract(epoch from a_at - b_at)) > win * 60 then raise exception 'too_far_apart' using errcode = '22023'; end if;
  perform public.together_pay(inv, inv.from_id);
  perform public.together_pay(inv, inv.to_id);
  update public.together_invites set status = 'done', done_at = now() where id = p_id;
  return public.together_result(p_id, uid);
end;
$$;

/** What one player got from a together bonus, and how many are left today. */
create function public.together_result(p_id bigint, p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id, 'place', i.place_id, 'action', i.action_id,
    'with', case when i.from_id = p_player then i.to_id else i.from_id end,
    'withName', (select display_name from public.players where id = case when i.from_id = p_player then i.to_id else i.from_id end),
    'clout', coalesce(b.clout, 0), 'cloutBase', coalesce(b.clout_base, 0),
    'confidence', coalesce(b.confidence, 0), 'confidenceBase', coalesce(b.confidence_base, 0),
    'paid', b.player_id is not null,
    'left', greatest(0, (public.city() -> 'economy' -> 'together' ->> 'perDay')::int
                        - (select count(*) from public.together_bonuses x where x.player_id = p_player and x.ny_date = i.ny_date)))
  from public.together_invites i
  left join public.together_bonuses b on b.invite_id = i.id and b.player_id = p_player
  where i.id = p_id
$$;
revoke all on function public.together_result(bigint, uuid) from public, anon, authenticated;

create function public.together_seen(p_id bigint) returns void
language sql security definer set search_path = public
as $$
  update public.together_invites set seen_by = array_append(seen_by, auth.uid())
   where id = p_id and auth.uid() in (from_id, to_id) and not (auth.uid() = any (seen_by))
$$;

-- ---------------------------------------------------------------------------
-- Ride together
-- ---------------------------------------------------------------------------
create table public.ride_offers (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.players (id) on delete cascade,
  to_id      uuid not null references public.players (id) on delete cascade,
  from_place text not null,
  place_id   text not null,
  mode       text not null check (mode in ('subway', 'taxi')),
  fare       int not null,
  seconds    int not null,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'gone')),
  created_at timestamptz not null default now(),
  arrives_at timestamptz
);
create index ride_offers_to_idx on public.ride_offers (to_id, created_at desc);
alter table public.ride_offers enable row level security;

/** Ask someone at your place to ride with you. Nothing is paid until they accept. */
create function public.ride_offer(p_to uuid, p_place text, p_mode text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t jsonb := public.city() -> 'economy' -> 'travel';
  me public.players;
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  v_miles numeric;
  band int;
  v_fare int;
  v_id bigint;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not (public.city() -> 'economy' -> 'together' -> 'ride' -> 'modes') ? p_mode then raise exception 'bad_mode' using errcode = '22023'; end if;
  if place is null or (place ->> 'story' is not null and not public.arc_started(place ->> 'story')) then raise exception 'unknown_place' using errcode = '22023'; end if;
  if p_to = uid or not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  if me.at_place is null or me.at_place = p_place or coalesce(me.arrives_at, now()) > now() then raise exception 'not_here' using errcode = '22023'; end if;
  if not public.here_now(p_to, me.at_place) then raise exception 'not_here' using errcode = '22023'; end if;
  if not public.may_reach(uid, p_to) then raise exception 'crew_only' using errcode = '42501'; end if;
  v_miles := coalesce(public.miles_between(public.travel_point(uid, me.at_place), public.travel_point(uid, p_place)), 0);
  band := case when v_miles < (t -> 'bandsMiles' ->> 0)::numeric then 0
               when v_miles < (t -> 'bandsMiles' ->> 1)::numeric then 1
               when v_miles < (t -> 'bandsMiles' ->> 2)::numeric then 2 else 3 end;
  v_fare := case p_mode when 'subway' then (t -> 'subway' ->> 'fare')::int else (t -> 'taxi' -> 'fare' ->> band)::int end;
  -- One open request at a time.
  update public.ride_offers set status = 'gone' where from_id = uid and status = 'pending';
  insert into public.ride_offers (from_id, to_id, from_place, place_id, mode, fare, seconds)
  values (uid, p_to, me.at_place, p_place, p_mode, v_fare, public.trip_seconds(p_mode, v_miles))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'fare', v_fare, 'each', ceil(v_fare / 2.0)::int);
end;
$$;

/** Accept or decline a ride: on yes both go, each paying half, arriving together. */
create function public.ride_respond(p_id bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.ride_offers;
  each_fare int;
  door bigint;
  v_arrives timestamptz;
  a public.players;
  b public.players;
begin
  select * into r from public.ride_offers where id = p_id and to_id = uid for update;
  if r.id is null then raise exception 'unknown_ride' using errcode = '22023'; end if;
  if r.status <> 'pending' then return jsonb_build_object('status', r.status); end if;
  if r.created_at < now() - make_interval(mins => (public.city() -> 'economy' -> 'together' -> 'ride' ->> 'expireMinutes')::int) then
    update public.ride_offers set status = 'gone' where id = p_id;
    return jsonb_build_object('status', 'gone');
  end if;
  if not p_yes then
    update public.ride_offers set status = 'declined' where id = p_id;
    return jsonb_build_object('status', 'declined');
  end if;
  perform public.tick(r.from_id);
  perform public.tick(uid);
  -- Lock both in id order.
  perform 1 from public.players where id in (r.from_id, uid) order by id for update;
  select * into a from public.players where id = r.from_id;
  select * into b from public.players where id = uid;
  if not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  if a.at_place is distinct from r.from_place or b.at_place is distinct from r.from_place
     or coalesce(a.arrives_at, now()) > now() or coalesce(b.arrives_at, now()) > now() then
    update public.ride_offers set status = 'gone' where id = p_id;
    return jsonb_build_object('status', 'gone');
  end if;
  door := coalesce(((select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = r.place_id) -> 'club' ->> 'doorClout')::bigint, 0);
  if a.clout < door or b.clout < door then raise exception 'door_clout' using errcode = '22023'; end if;
  each_fare := ceil(r.fare / 2.0)::int;
  if b.bank_cash < each_fare then raise exception 'cant_afford' using errcode = '22023'; end if;
  if a.bank_cash < each_fare then raise exception 'they_cant_afford' using errcode = '22023'; end if;
  v_arrives := clock_timestamp() + make_interval(secs => r.seconds);
  update public.players set at_place = r.place_id, arrives_at = v_arrives, bank_cash = bank_cash - each_fare
   where id in (r.from_id, uid);
  perform public.ledger_once(r.from_id, 'cash', -each_fare, 'travel', 'ride:' || r.id);
  perform public.ledger_once(uid, 'cash', -each_fare, 'travel', 'ride:' || r.id);
  update public.ride_offers set status = 'accepted', arrives_at = v_arrives where id = p_id;
  return jsonb_build_object('status', 'accepted', 'place', r.place_id, 'mode', r.mode, 'cash', -each_fare,
                            'seconds', r.seconds, 'arrivesAt', v_arrives);
end;
$$;

/** The requester's view of their ride: still waiting, accepted (with when they arrive), declined or gone. */
create function public.ride_status(p_id bigint) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', r.id, 'status',
           case when r.status = 'pending' and r.created_at < now() - make_interval(mins => (public.city() -> 'economy' -> 'together' -> 'ride' ->> 'expireMinutes')::int)
                then 'gone' else r.status end,
           'place', r.place_id, 'mode', r.mode, 'cash', -ceil(r.fare / 2.0)::int, 'seconds', r.seconds, 'arrivesAt', r.arrives_at)
    from public.ride_offers r where r.id = p_id and r.from_id = auth.uid()
$$;

/** Everything together for the signed-in player: invites to answer, plans made, bonuses to show, rides offered. */
create function public.together_inbox() returns jsonb
language sql stable security definer set search_path = public
as $$
  with me as (select auth.uid() as id, public.ny_today() as today)
  select jsonb_build_object(
    'left', greatest(0, (public.city() -> 'economy' -> 'together' ->> 'perDay')::int
                        - (select count(*) from public.together_bonuses b, me where b.player_id = me.id and b.ny_date = me.today)),
    'canInvite', public.together_age_ok((select id from me)),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'place', i.place_id, 'action', i.action_id, 'status', i.status, 'mine', i.from_id = me.id,
        'with', o.id, 'withName', o.display_name, 'withStyle', o.starting_style,
        'withHere', public.here_now(o.id, i.place_id), 'createdAt', i.created_at) order by i.created_at desc)
      from public.together_invites i cross join me
      join public.players o on o.id = case when i.from_id = me.id then i.to_id else i.from_id end
      where me.id in (i.from_id, i.to_id) and i.ny_date = me.today and i.status in ('pending', 'accepted')
        and not public.is_blocked_pair(i.from_id, i.to_id)), '[]'::jsonb),
    'bonuses', coalesce((select jsonb_agg(public.together_result(i.id, me.id))
      from public.together_invites i cross join me
      where me.id in (i.from_id, i.to_id) and i.status = 'done' and i.ny_date = me.today and not (me.id = any (i.seen_by))), '[]'::jsonb),
    'rides', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'place', r.place_id, 'mode', r.mode, 'each', ceil(r.fare / 2.0)::int, 'seconds', r.seconds,
        'from', o.id, 'fromName', o.display_name, 'fromStyle', o.starting_style, 'createdAt', r.created_at) order by r.created_at desc)
      from public.ride_offers r cross join me
      join public.players o on o.id = r.from_id
      where r.to_id = me.id and r.status = 'pending'
        and r.created_at > now() - make_interval(mins => (public.city() -> 'economy' -> 'together' -> 'ride' ->> 'expireMinutes')::int)
        and not public.is_blocked_pair(r.from_id, r.to_id)), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id            bigint generated always as identity primary key,
  poster        uuid not null references public.players (id) on delete cascade,
  kind          text not null check (kind in ('decorator', 'manager')),
  pay           bigint not null default 0,
  cut           smallint not null default 0,
  note          text check (char_length(note) <= 140),
  status        text not null default 'open' check (status in ('open', 'active', 'done', 'kept', 'undone', 'ended', 'cancelled')),
  worker        uuid references public.players (id) on delete set null,
  created_at    timestamptz not null default now(),
  taken_at      timestamptz,
  finished_at   timestamptz,
  settled_at    timestamptz,
  layout_before jsonb,
  moved         int not null default 0,
  earned        bigint not null default 0,
  stars         smallint check (stars between 1 and 5)
);
create index jobs_open_idx on public.jobs (status, created_at desc);
create index jobs_poster_idx on public.jobs (poster, created_at desc);
create index jobs_worker_idx on public.jobs (worker, created_at desc);
alter table public.jobs enable row level security;

/** A decorator's work counts as done at the deadline; done jobs nobody settled are kept after autoKeepHours (internal). */
create function public.jobs_settle_due(p_player uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  d jsonb := public.city() -> 'economy' -> 'jobs' -> 'decorator';
  j record;
begin
  update public.jobs set status = 'done', finished_at = taken_at + make_interval(mins => (d ->> 'minutes')::int)
   where kind = 'decorator' and status = 'active' and p_player in (poster, worker)
     and taken_at + make_interval(mins => (d ->> 'minutes')::int) < now();
  for j in select id from public.jobs
            where kind = 'decorator' and status = 'done' and p_player in (poster, worker)
              and finished_at + make_interval(hours => (d ->> 'autoKeepHours')::int) < now()
  loop
    perform public.job_keep(j.id, true);
  end loop;
end;
$$;
revoke all on function public.jobs_settle_due(uuid) from public, anon, authenticated;

/** Settles a decorator job (internal): keep pays the decorator; undo restores the home and refunds the poster. */
create function public.job_keep(p_id bigint, p_keep boolean) returns void
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id for update;
  if j.status <> 'done' then return; end if;
  if p_keep and j.worker is not null then
    update public.players set bank_cash = bank_cash + j.pay,
           clout = clout + (public.city() -> 'economy' -> 'jobs' -> 'decorator' ->> 'clout')::int where id = j.worker;
    perform public.ledger_once(j.worker, 'cash', j.pay, 'job_pay', 'job:' || j.id);
    perform public.ledger_once(j.worker, 'clout', (public.city() -> 'economy' -> 'jobs' -> 'decorator' ->> 'clout')::int, 'job_pay', 'job:' || j.id);
    update public.jobs set status = 'kept', settled_at = now(), earned = j.pay where id = p_id;
  else
    update public.players set home_layout = j.layout_before, bank_cash = bank_cash + j.pay where id = j.poster;
    perform public.ledger_once(j.poster, 'cash', j.pay, 'job_refund', 'job:' || j.id);
    update public.jobs set status = 'undone', settled_at = now() where id = p_id;
  end if;
end;
$$;
revoke all on function public.job_keep(bigint, boolean) from public, anon, authenticated;

/** A player's rating as a worker: average stars and how often they were hired. */
create function public.job_rating(p_player uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('hired', count(*), 'rating', round(avg(stars)::numeric, 1), 'rated', count(stars))
    from public.jobs where worker = p_player and taken_at is not null
$$;

create function public.post_job(p_kind text, p_pay bigint, p_cut int, p_note text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.city() -> 'economy' -> 'jobs';
  me public.players;
  v_id bigint;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  if exists (select 1 from public.jobs where poster = uid and kind = p_kind and status in ('open', 'active', 'done')) then
    raise exception 'already_posted' using errcode = '22023';
  end if;
  if p_kind = 'decorator' then
    if p_pay is null or p_pay < (cfg -> 'decorator' ->> 'payMin')::bigint or p_pay > (cfg -> 'decorator' ->> 'payMax')::bigint then
      raise exception 'bad_pay' using errcode = '22023';
    end if;
    if me.bank_cash < p_pay then raise exception 'cant_afford' using errcode = '22023'; end if;
    insert into public.jobs (poster, kind, pay, note) values (uid, 'decorator', p_pay, nullif(trim(p_note), '')) returning id into v_id;
    update public.players set bank_cash = bank_cash - p_pay where id = uid;
    perform public.ledger_once(uid, 'cash', -p_pay, 'job_hold', 'job:' || v_id);
    return jsonb_build_object('id', v_id, 'cash', -p_pay);
  elsif p_kind = 'manager' then
    if p_cut is null or p_cut < (cfg -> 'manager' ->> 'cutMin')::int or p_cut > (cfg -> 'manager' ->> 'cutMax')::int then
      raise exception 'bad_cut' using errcode = '22023';
    end if;
    if not exists (select 1 from public.player_businesses where player_id = uid) then raise exception 'no_business' using errcode = '22023'; end if;
    insert into public.jobs (poster, kind, cut, note) values (uid, 'manager', p_cut, nullif(trim(p_note), '')) returning id into v_id;
    return jsonb_build_object('id', v_id, 'cash', 0);
  end if;
  raise exception 'bad_kind' using errcode = '22023';
end;
$$;

create function public.cancel_job(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id and poster = auth.uid() for update;
  if j.id is null then raise exception 'unknown_job' using errcode = '22023'; end if;
  if j.status <> 'open' then raise exception 'job_taken' using errcode = '22023'; end if;
  update public.jobs set status = 'cancelled', settled_at = now() where id = p_id;
  if j.pay > 0 then
    update public.players set bank_cash = bank_cash + j.pay where id = j.poster;
    perform public.ledger_once(j.poster, 'cash', j.pay, 'job_refund', 'job:' || j.id);
  end if;
  return jsonb_build_object('cash', j.pay);
end;
$$;

create function public.take_job(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs;
  layout jsonb;
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  select * into j from public.jobs where id = p_id for update;
  if j.id is null or j.status <> 'open' then raise exception 'job_taken' using errcode = '22023'; end if;
  if j.poster = uid then raise exception 'own_job' using errcode = '22023'; end if;
  if not public.together_age_ok(uid) then raise exception 'too_new' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, j.poster) then raise exception 'blocked' using errcode = '42501'; end if;
  if (select count(*) from public.jobs x
       where x.taken_at is not null and (x.taken_at at time zone 'America/New_York')::date = public.ny_today()
         and ((x.poster = j.poster and x.worker = uid) or (x.poster = uid and x.worker = j.poster)))
     >= (public.city() -> 'economy' -> 'jobs' ->> 'perPairPerDay')::int then
    raise exception 'pair_limit' using errcode = '22023';
  end if;
  if exists (select 1 from public.jobs where worker = uid and kind = j.kind and status = 'active') then
    raise exception 'already_working' using errcode = '22023';
  end if;
  if j.kind = 'decorator' then
    select home_layout into layout from public.players where id = j.poster;
  end if;
  update public.jobs set status = 'active', worker = uid, taken_at = now(), layout_before = layout where id = p_id;
  return jsonb_build_object('id', p_id, 'kind', j.kind);
end;
$$;

/** For the decorator: the client's home to arrange (their furniture, its layout) and when time is up. */
create function public.job_home(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
  p public.players;
begin
  perform public.jobs_settle_due(auth.uid());
  select * into j from public.jobs where id = p_id and worker = auth.uid() and kind = 'decorator';
  if j.id is null or j.status <> 'active' then raise exception 'job_over' using errcode = '22023'; end if;
  select * into p from public.players where id = j.poster;
  return jsonb_build_object(
    'id', j.id, 'pay', j.pay, 'poster', p.id, 'posterName', p.display_name,
    'homeId', p.home_id, 'houseSku', p.house_sku, 'layout', p.home_layout,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'sku', i.sku) order by i.id)
                         from public.player_items i where i.player_id = p.id and i.category = 'home'), '[]'::jsonb),
    'endsAt', j.taken_at + make_interval(mins => (public.city() -> 'economy' -> 'jobs' -> 'decorator' ->> 'minutes')::int));
end;
$$;

/** The decorator saves the client's layout (checked like save_home_layout). */
create function public.decorate_save(p_id bigint, p_layout jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
  e jsonb;
  n int;
begin
  perform public.jobs_settle_due(auth.uid());
  select * into j from public.jobs where id = p_id and worker = auth.uid() and kind = 'decorator' for update;
  if j.id is null or j.status <> 'active' then raise exception 'job_over' using errcode = '22023'; end if;
  if jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 120 then raise exception 'bad_layout' using errcode = '22023'; end if;
  for e in select value from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'id') <> 'string' or length(e ->> 'id') > 40
       or jsonb_typeof(e -> 'x') <> 'number' or abs((e ->> 'x')::numeric) > 10
       or jsonb_typeof(e -> 'z') <> 'number' or abs((e ->> 'z')::numeric) > 10
       or jsonb_typeof(e -> 'rot') <> 'number' or (e ->> 'rot')::numeric not in (0, 1, 2, 3) then
      raise exception 'bad_layout' using errcode = '22023';
    end if;
  end loop;
  -- Pieces the decorator placed or moved, compared with the layout before the job.
  select count(*) into n from jsonb_array_elements(p_layout) x
   where not exists (select 1 from jsonb_array_elements(coalesce(j.layout_before, '[]'::jsonb)) b where b = x);
  update public.players set home_layout = p_layout where id = j.poster;
  update public.jobs set moved = n where id = p_id;
  return jsonb_build_object('moved', n);
end;
$$;

/** The decorator is done early (otherwise the deadline finishes it). */
create function public.job_finish(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.jobs set status = 'done', finished_at = now()
   where id = p_id and worker = auth.uid() and kind = 'decorator' and status = 'active';
  if not found then raise exception 'job_over' using errcode = '22023'; end if;
  return jsonb_build_object('status', 'done');
end;
$$;

/** The poster keeps the decorating (pays) or undoes it all (refund), with an optional rating. */
create function public.job_settle(p_id bigint, p_keep boolean, p_stars int default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  j public.jobs;
begin
  perform public.jobs_settle_due(auth.uid());
  select * into j from public.jobs where id = p_id and poster = auth.uid() and kind = 'decorator' for update;
  if j.id is null then raise exception 'unknown_job' using errcode = '22023'; end if;
  if j.status <> 'done' then raise exception 'not_done' using errcode = '22023'; end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then raise exception 'bad_stars' using errcode = '22023'; end if;
  perform public.job_keep(p_id, p_keep);
  if p_stars is not null then update public.jobs set stars = p_stars where id = p_id; end if;
  return jsonb_build_object('status', case when p_keep then 'kept' else 'undone' end, 'cash', case when p_keep then 0 else j.pay end);
end;
$$;

/** A rating for a finished job the poster hasn't rated yet. */
create function public.rate_job(p_id bigint, p_stars int) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  update public.jobs set stars = p_stars
   where id = p_id and poster = auth.uid() and stars is null and status in ('kept', 'undone', 'ended');
  if not found then raise exception 'unknown_job' using errcode = '22023'; end if;
end;
$$;

/** The manager empties the client's tills and keeps their cut; the rest stays with the client. */
create function public.manager_collect(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs;
  b record;
  total bigint := 0;
  my_cut bigint;
  stamp bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into j from public.jobs where id = p_id and worker = uid and kind = 'manager' for update;
  if j.id is null or j.status <> 'active' then raise exception 'job_over' using errcode = '22023'; end if;
  if public.is_blocked_pair(uid, j.poster) then raise exception 'blocked' using errcode = '42501'; end if;
  perform 1 from public.players where id in (uid, j.poster) order by id for update;
  for b in select business_id from public.player_businesses where player_id = j.poster order by bought_at loop
    total := total + public.business_collect_one(j.poster, b.business_id);
  end loop;
  my_cut := floor(total * j.cut / 100.0);
  if my_cut > 0 then
    update public.players set bank_cash = bank_cash - my_cut where id = j.poster;
    update public.players set bank_cash = bank_cash + my_cut where id = uid;
    perform public.ledger_once(j.poster, 'cash', -my_cut, 'job_cut', 'job:' || j.id || ':' || stamp);
    perform public.ledger_once(uid, 'cash', my_cut, 'job_cut', 'job:' || j.id || ':' || stamp);
    update public.jobs set earned = earned + my_cut where id = p_id;
  end if;
  return jsonb_build_object('collected', total, 'cash', my_cut);
end;
$$;

/** Either side ends a manager job (the client fires the manager, or the manager quits). */
create function public.end_job(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.jobs set status = 'ended', settled_at = now()
   where id = p_id and kind = 'manager' and status = 'active' and auth.uid() in (poster, worker);
  if not found then raise exception 'unknown_job' using errcode = '22023'; end if;
  return jsonb_build_object('status', 'ended');
end;
$$;

/** The Jobs app: open jobs from others, the jobs you posted and the ones you're working. */
create function public.jobs_board() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d jsonb := public.city() -> 'economy' -> 'jobs' -> 'decorator';
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform public.jobs_settle_due(uid);
  return jsonb_build_object(
    'canWork', public.together_age_ok(uid),
    'open', coalesce((select jsonb_agg(x order by x ->> 'createdAt' desc) from (
        select jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'createdAt', j.created_at,
          'poster', p.id, 'posterName', p.display_name, 'posterStyle', p.starting_style, 'homeId', p.home_id,
          'posterRating', public.job_rating(p.id),
          'businesses', (select count(*) from public.player_businesses b where b.player_id = p.id),
          'perDay', case when j.kind = 'manager'
                    then floor((select coalesce(sum(public.business_pay(b.business_id, b.level)), 0) from public.player_businesses b where b.player_id = p.id) * j.cut / 100.0)::bigint
                    end) as x
          from public.jobs j join public.players p on p.id = j.poster
         where j.status = 'open' and j.poster <> uid and p.banned_at is null and not public.is_blocked_pair(uid, j.poster)
         order by j.created_at desc limit 30) s), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'status', j.status, 'stars', j.stars,
          'moved', j.moved, 'earned', j.earned, 'createdAt', j.created_at, 'takenAt', j.taken_at, 'finishedAt', j.finished_at,
          'endsAt', case when j.kind = 'decorator' and j.taken_at is not null then j.taken_at + make_interval(mins => (d ->> 'minutes')::int) end,
          'keepBy', case when j.status = 'done' then j.finished_at + make_interval(hours => (d ->> 'autoKeepHours')::int) end,
          'worker', w.id, 'workerName', w.display_name, 'workerStyle', w.starting_style,
          'workerRating', case when w.id is not null then public.job_rating(w.id) end) order by j.created_at desc)
        from public.jobs j left join public.players w on w.id = j.worker
       where j.poster = uid and (j.status in ('open', 'active', 'done') or j.settled_at > now() - interval '1 day')), '[]'::jsonb),
    'working', coalesce((select jsonb_agg(jsonb_build_object(
          'id', j.id, 'kind', j.kind, 'pay', j.pay, 'cut', j.cut, 'note', j.note, 'status', j.status, 'earned', j.earned,
          'takenAt', j.taken_at, 'moved', j.moved,
          'endsAt', case when j.kind = 'decorator' then j.taken_at + make_interval(mins => (d ->> 'minutes')::int) end,
          'poster', p.id, 'posterName', p.display_name, 'posterStyle', p.starting_style) order by j.taken_at desc)
        from public.jobs j join public.players p on p.id = j.poster
       where j.worker = uid and (j.status in ('active', 'done') or j.settled_at > now() - interval '1 day')), '[]'::jsonb),
    'rating', public.job_rating(uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- Player cards: the job rating ("⭐ 4.8 · hired 12 times")
-- ---------------------------------------------------------------------------
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
    'rank', 1 + (select count(*) from public.players o
                  where o.banned_at is null
                    and (o.clout > p.clout or (o.clout = p.clout and o.created_at < p.created_at))),
    'recent', public.player_recent(p.id, 5),
    'netWorth', public.net_worth(p.id),
    'bestRank', p.best_rank,
    'jobs', public.job_rating(p.id),
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;
