-- v0.12 "Ownership" (owner, Oct 15; docs/08 section 15): businesses that make money, net worth that
-- counts them, and player ranks with real money milestones ("so billionaire means billionaire").
--   * Businesses: the eight in game_settings city.economy.businesses (lib/city.ts), bought in order,
--     upgraded three times each. Pay piles up by the hour in the till and stops after tillDays;
--     collect_tills() empties every till. Worth = price × (1 + value per upgrade) × hype (clout) and ×3
--     once the startup goes public. The browser never sends an amount.
--   * net_worth(player): cash + things + businesses at their worth; used by player cards and presence.
--   * Ranks: city.economy.ranks (lib/ranks.ts); players.best_rank keeps the highest reached, for "Best: …".
--   * place_presence lists each person's net worth too, so the Everyone here list can show ranks.

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":2,"taskClout":15,"restroom":{"clout":25,"mood":6}},"clubs":{"vip":{"medium":{"freeClout":5000,"cover":1500},"exclusive":{"freeClout":15000,"cover":5000}},"vipTimes":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]},"businesses":{"tillDays":2,"upgrade":{"cost":0.6,"pay":0.5,"value":0.5},"hype":{"clout":150000,"max":2},"goPublic":{"clout":50000,"fee":50000000,"times":3},"list":[{"id":"hot-dog-cart","name":"Dirty Water Dogs","emoji":"🌭","price":5000,"payPerDay":750,"blurb":"One cart, one umbrella, a hot dog water recipe older than the city.","upgrades":[{"name":"Second umbrella","emoji":"⛱️","blurb":"Twice the shade, twice the line."},{"name":"Secret menu","emoji":"🤫","blurb":"It''s the same hot dog. It costs more now."},{"name":"Influencer collab","emoji":"🤳","blurb":"A creator ate one on camera. The line goes around the block."}]},{"id":"bodega","name":"Bodega, Cat Included","emoji":"🐈","price":50000,"payPerDay":6000,"blurb":"Open 24 hours. The cat runs it; you just own it.","upgrades":[{"name":"Hot food counter","emoji":"🥪","blurb":"Chopped cheese, all day, every day."},{"name":"Lotto machine","emoji":"🎟️","blurb":"Everybody''s uncle comes in now."},{"name":"The cat gets an agent","emoji":"😼","blurb":"Brand deals. The cat negotiates better than you."}]},{"id":"laundromat","name":"Spin Cycle Laundromat","emoji":"🧺","price":250000,"payPerDay":22500,"blurb":"Twenty machines, three of them work. The quarters add up.","upgrades":[{"name":"Free Wi-Fi","emoji":"📶","blurb":"People stay. People buy snacks."},{"name":"Wash and fold","emoji":"👕","blurb":"You fold strangers'' socks for money. Lucrative."},{"name":"Laundromat by night","emoji":"🎧","blurb":"A DJ on Fridays. It''s a scene now."}]},{"id":"cafe","name":"Oat Milk Surcharge Café","emoji":"☕","price":1200000,"payPerDay":81600,"blurb":"Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".","upgrades":[{"name":"Latte art","emoji":"🎨","blurb":"Every cup a portrait of the customer. Mostly."},{"name":"Laptop ban (for vibes)","emoji":"💻","blurb":"Fewer screenwriters, more turnover."},{"name":"Second location","emoji":"📍","blurb":"Same café, different neighborhood, same oat milk."}]},{"id":"taco-trucks","name":"Taco Truck Fleet","emoji":"🌮","price":6000000,"payPerDay":300000,"blurb":"Five trucks, one group chat, zero parking tickets paid.","upgrades":[{"name":"Late-night route","emoji":"🌙","blurb":"Outside every club at 2 a.m."},{"name":"Festival permits","emoji":"🎪","blurb":"Every street fair in Queens."},{"name":"A truck in every borough","emoji":"🗽","blurb":"Even Staten Island. Especially Staten Island."}]},{"id":"nightclub","name":"Your Own Nightclub","emoji":"🪩","price":30000000,"payPerDay":1080000,"blurb":"Your name on the door. The bouncer still doesn''t respect you.","upgrades":[{"name":"VIP floor","emoji":"🥂","blurb":"Upstairs, where the expensive bottles live."},{"name":"Celebrity DJ residency","emoji":"🎛️","blurb":"Every Saturday, a famous person presses play."},{"name":"A gold-plated velvet rope","emoji":"✨","blurb":"Completely unnecessary. Wildly profitable."}]},{"id":"apartment-building","name":"Luxury* Apartment Building","emoji":"🏢","price":150000000,"payPerDay":3900000,"blurb":"*Exposed brick. Forty units, one elevator, rent that should be illegal.","upgrades":[{"name":"Rooftop amenity","emoji":"🌇","blurb":"Two lounge chairs and a view. Rent goes up 30%."},{"name":"Doorman with opinions","emoji":"🧑‍✈️","blurb":"He judges every delivery. Tenants love it."},{"name":"Condo conversion","emoji":"🔑","blurb":"Same units, now for sale, at three times the price."}]},{"id":"startup","name":"Disruptive App Startup","emoji":"📱","price":700000000,"payPerDay":12600000,"blurb":"It''s an app for apps. Investors are thrilled.","upgrades":[{"name":"Pivot to AI","emoji":"🤖","blurb":"Same app, new deck, valuation doubles."},{"name":"Celebrity board member","emoji":"🌟","blurb":"They don''t know what the app does. Nobody does."},{"name":"Ring the bell","emoji":"🔔","blurb":"Ready to go public."}]}]},"ranks":[{"clout":0,"netWorth":0},{"clout":100,"netWorth":25000},{"clout":500,"netWorth":50000},{"clout":1000,"netWorth":100000},{"clout":2000,"netWorth":250000},{"clout":5000,"netWorth":500000},{"clout":15000,"netWorth":1000000},{"clout":50000,"netWorth":10000000},{"clout":150000,"netWorth":1000000000},{"clout":500000,"netWorth":10000000000}]},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","club":{"vip":"medium"},"actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","club":null,"actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"area":"Long Island City","club":null,"actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"area":"Astoria","club":null,"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"area":"Long Island City","club":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","club":null,"actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"area":"Astoria","club":null,"actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","club":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","club":{},"actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"fifs-furniture","tags":["furniture","shopping","home"],"story":null,"at":[40.7418,-73.9405],"area":"Long Island City","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"area":"Long Island City","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","club":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","club":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"area":"Astoria","club":null,"actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","club":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"area":"Astoria","club":{"vip":"medium"},"actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"the-sticky-floor","tags":["club","nightlife"],"story":null,"at":[40.7512,-73.8832],"area":"Jackson Heights","club":{},"actions":[{"id":"visit","kind":"visit","price":40,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"discount-disco","tags":["club","nightlife"],"story":null,"at":[40.7577,-73.8336],"area":"Flushing","club":{},"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"ultraviolet-society","tags":["club","nightlife","exclusive_club"],"story":null,"at":[40.7402,-73.9593],"area":"Long Island City","club":{"vip":"exclusive","doorClout":2000},"actions":[{"id":"visit","kind":"visit","price":350,"pay":0,"energy":15,"mood":8,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","club":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","club":null,"actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","club":null,"actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","club":null,"actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"area":"Astoria","club":null,"actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","club":null,"actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","club":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"area":"Astoria","club":null,"actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","club":null,"actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"area":"Astoria","club":null,"actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"area":"Astoria","club":null,"actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"area":"Flushing","club":null,"actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"two-dollar-night","placeId":"the-sticky-floor","startHour":21,"hours":5,"entry":55,"clout":20,"confidence":5,"mood":8},{"id":"clearance-rack-disco","placeId":"discount-disco","startHour":22,"hours":4,"entry":70,"clout":25,"confidence":5,"mood":8},{"id":"ultraviolet-afterglow","placeId":"ultraviolet-society","startHour":23,"hours":4,"entry":450,"clout":140,"confidence":10,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000},{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500},{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000},{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}],"homeLocations":{"sunnyside_gardens":[40.7472,-73.9182],"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb where key = 'city';

create table public.player_businesses (
  player_id    uuid not null references public.players (id) on delete cascade,
  business_id  text not null,
  level        smallint not null default 0 check (level between 0 and 3),
  went_public  boolean not null default false,
  bought_at    timestamptz not null,
  collected_at timestamptz not null,
  primary key (player_id, business_id)
);
alter table public.player_businesses enable row level security;

alter table public.players add column if not exists best_rank smallint not null default 1;

-- ---------------------------------------------------------------------------
-- Worth
-- ---------------------------------------------------------------------------
create function public.business_def(p_id text) returns jsonb
language sql stable security definer set search_path = public
as $$ select b from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') b where b ->> 'id' = p_id $$;

/** ×1 with no clout up to hype.max at hype.clout: fame brings customers (lib/businesses.ts hype). */
create function public.business_hype(p_clout bigint) returns numeric
language sql stable security definer set search_path = public
as $$
  select 1 + ((h ->> 'max')::numeric - 1) * least(1, greatest(0, p_clout)::numeric / (h ->> 'clout')::numeric)
    from (select public.city() -> 'economy' -> 'businesses' -> 'hype' as h) x
$$;

/** What one owned business is worth (lib/businesses.ts businessValue). */
create function public.business_worth(p_id text, p_level int, p_public boolean, p_clout bigint) returns bigint
language sql stable security definer set search_path = public
as $$
  select round((public.business_def(p_id) ->> 'price')::numeric
               * (1 + (e -> 'upgrade' ->> 'value')::numeric * p_level)
               * public.business_hype(p_clout)
               * case when p_public then (e -> 'goPublic' ->> 'times')::numeric else 1 end)::bigint
    from (select public.city() -> 'economy' -> 'businesses' as e) x
$$;

/** Pay a day at this level (lib/businesses.ts payPerDay). */
create function public.business_pay(p_id text, p_level int) returns bigint
language sql stable security definer set search_path = public
as $$
  select round((public.business_def(p_id) ->> 'payPerDay')::numeric
               * (1 + (public.city() -> 'economy' -> 'businesses' -> 'upgrade' ->> 'pay')::numeric * p_level))::bigint
$$;

/** Cash, things at their value and businesses at their worth. */
create function public.net_worth(p_player uuid) returns bigint
language sql stable security definer set search_path = public
as $$
  select p.bank_cash
         + coalesce((select sum(i.value) from public.player_items i where i.player_id = p.id), 0)
         + coalesce((select sum(public.business_worth(b.business_id, b.level, b.went_public, p.clout))
                       from public.player_businesses b where b.player_id = p.id), 0)
    from public.players p where p.id = p_player
$$;

/** The rank (1 to 10) for this clout or net worth, whichever is higher (lib/ranks.ts rankFor). */
create function public.rank_level(p_clout bigint, p_worth bigint) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(max(r.n), 1)::int
    from jsonb_array_elements(public.city() -> 'economy' -> 'ranks') with ordinality r(x, n)
   where p_clout >= (r.x ->> 'clout')::bigint or p_worth >= (r.x ->> 'netWorth')::bigint
$$;

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
/** Empties one till (internal): pay by the hour since the last collection, up to tillDays. */
create function public.business_collect_one(p_player uuid, p_id text) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  biz public.player_businesses;
  now_at timestamptz := public.game_now();
  hours numeric;
  amount bigint;
begin
  select * into biz from public.player_businesses where player_id = p_player and business_id = p_id for update;
  if biz.player_id is null then return 0; end if;
  hours := least(greatest(0, extract(epoch from (now_at - biz.collected_at)) / 3600),
                 (public.city() -> 'economy' -> 'businesses' ->> 'tillDays')::numeric * 24);
  amount := floor(public.business_pay(p_id, biz.level) * hours / 24);
  if amount <= 0 then return 0; end if;
  update public.player_businesses set collected_at = now_at where player_id = p_player and business_id = p_id;
  update public.players set bank_cash = bank_cash + amount where id = p_player;
  perform public.ledger_once(p_player, 'cash', amount, 'business_till', p_id || ':' || floor(extract(epoch from now_at))::bigint);
  return amount;
end;
$$;

/** What you own, the server's clock (tills count from it), your net worth and your best rank. */
create function public.business_state() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  worth bigint;
  best int;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  worth := public.net_worth(uid);
  best := greatest(me.best_rank, public.rank_level(me.clout, worth));
  if best > me.best_rank then update public.players set best_rank = best where id = uid; end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(jsonb_build_object('id', b.business_id, 'level', b.level, 'public', b.went_public, 'collectedAt', b.collected_at)
                                       order by b.bought_at)
                         from public.player_businesses b where b.player_id = uid), '[]'::jsonb),
    'now', public.game_now(),
    'netWorth', worth,
    'bestRank', best);
end;
$$;

/** Buys the next business (they unlock in order). */
create function public.buy_business(p_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  def jsonb := public.business_def(p_id);
  pos int;
  me public.players;
  price bigint;
begin
  if def is null then raise exception 'unknown_business' using errcode = '22023'; end if;
  select n into pos from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n) where l.x ->> 'id' = p_id;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if exists (select 1 from public.player_businesses where player_id = uid and business_id = p_id) then
    raise exception 'already_owned' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(public.city() -> 'economy' -> 'businesses' -> 'list') with ordinality l(x, n)
              where l.n < pos and not exists (select 1 from public.player_businesses b where b.player_id = uid and b.business_id = l.x ->> 'id')) then
    raise exception 'business_locked' using errcode = '22023';
  end if;
  price := (def ->> 'price')::bigint;
  if me.bank_cash < price then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.player_businesses (player_id, business_id, bought_at, collected_at) values (uid, p_id, public.game_now(), public.game_now());
  update public.players set bank_cash = bank_cash - price where id = uid;
  perform public.ledger_once(uid, 'cash', -price, 'business_buy', p_id);
  return jsonb_build_object('cash', -price);
end;
$$;

/** The next upgrade: empties the till at the old pay first, then pays the upgrade. */
create function public.upgrade_business(p_id text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  def jsonb := public.business_def(p_id);
  me public.players;
  biz public.player_businesses;
  cost bigint;
  till bigint;
begin
  if def is null then raise exception 'unknown_business' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into biz from public.player_businesses where player_id = uid and business_id = p_id for update;
  if biz.player_id is null then raise exception 'not_owned' using errcode = '22023'; end if;
  if biz.level >= 3 then raise exception 'max_level' using errcode = '22023'; end if;
  cost := round((def ->> 'price')::numeric * (public.city() -> 'economy' -> 'businesses' -> 'upgrade' ->> 'cost')::numeric)::bigint;
  till := public.business_collect_one(uid, p_id);
  if me.bank_cash + till < cost then raise exception 'cant_afford' using errcode = '22023'; end if;
  update public.player_businesses set level = level + 1 where player_id = uid and business_id = p_id;
  update public.players set bank_cash = bank_cash - cost where id = uid;
  perform public.ledger_once(uid, 'cash', -cost, 'business_upgrade', p_id || ':' || (biz.level + 1));
  return jsonb_build_object('cash', till - cost, 'level', biz.level + 1, 'till', till);
end;
$$;

/** Empties every till. */
create function public.collect_tills() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b record;
  amount bigint;
  total bigint := 0;
  paid jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.players where id = uid and home_id is not null) then raise exception 'no_player' using errcode = '28000'; end if;
  perform 1 from public.players where id = uid for update;
  for b in select business_id from public.player_businesses where player_id = uid order by bought_at loop
    amount := public.business_collect_one(uid, b.business_id);
    if amount > 0 then
      total := total + amount;
      paid := paid || jsonb_build_object('id', b.business_id, 'cash', amount);
    end if;
  end loop;
  return jsonb_build_object('cash', total, 'paid', paid);
end;
$$;

/** The startup goes public: fully upgraded, enough clout, the fee paid; its worth triples. */
create function public.go_public() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e jsonb := public.city() -> 'economy' -> 'businesses';
  last_id text := (e -> 'list' -> (jsonb_array_length(e -> 'list') - 1)) ->> 'id';
  me public.players;
  biz public.player_businesses;
  fee bigint := (e -> 'goPublic' ->> 'fee')::bigint;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  select * into biz from public.player_businesses where player_id = uid and business_id = last_id for update;
  if biz.player_id is null or biz.level < 3 then raise exception 'not_ready' using errcode = '22023'; end if;
  if biz.went_public then raise exception 'already_public' using errcode = '22023'; end if;
  if me.clout < (e -> 'goPublic' ->> 'clout')::bigint then raise exception 'need_clout' using errcode = '22023'; end if;
  if me.bank_cash < fee then raise exception 'cant_afford' using errcode = '22023'; end if;
  update public.player_businesses set went_public = true where player_id = uid and business_id = last_id;
  update public.players set bank_cash = bank_cash - fee where id = uid;
  perform public.ledger_once(uid, 'cash', -fee, 'business_public', last_id);
  return jsonb_build_object('cash', -fee);
end;
$$;

-- ---------------------------------------------------------------------------
-- Net worth everywhere
-- ---------------------------------------------------------------------------
-- 0047's player_card with net worth counting businesses, and their best rank.
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
    'herePlace', (select p.at_place from public.players me where me.id = auth.uid() and me.at_place is not null and me.at_place = p.at_place
                    and p.seen_at > now() - make_interval(mins => (public.game_settings_value('chat') ->> 'hereMinutes')::int)),
    'canMessage', p.id <> auth.uid() and public.may_reach(auth.uid(), p.id),
    'crew', p.id in (select id from public.crew_of(auth.uid())))
  from public.players p where p.id = p_player and p.banned_at is null and p.home_id is not null;
$$;

-- 0047's place_presence, plus each person's net worth (for their rank in the Everyone here list).
create or replace function public.place_presence(p_place text, p_floor int default 1) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.game_settings_value('chat');
  fresh timestamptz := now() - make_interval(mins => (cfg ->> 'hereMinutes')::int);
  me public.players;
begin
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place or me.arrives_at > clock_timestamp() then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb);
  end if;
  update public.players set seen_at = now(), at_floor = greatest(0, least(9, coalesce(p_floor, 1))) where id = uid;
  return (
    with here as (
      select p.*, p.id in (select id from public.crew_of(uid)) as crew
        from public.players p
       where p.at_place = p_place and p.id <> uid and p.seen_at > fresh and p.banned_at is null and p.home_id is not null
         and (p.arrives_at is null or p.arrives_at <= clock_timestamp())
         and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = p.id) or (b.blocker = p.id and b.blocked = uid))
    )
    select jsonb_build_object(
      'count', (select count(*) from here),
      'people', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.display_name, 'style', h.starting_style, 'look', h.look,
                                                              'crew', h.crew, 'floor', h.at_floor, 'clout', h.clout, 'netWorth', public.net_worth(h.id))
                                           order by h.crew desc, h.seen_at desc)
                          from (select * from here order by crew desc, seen_at desc limit (cfg ->> 'hereMax')::int) h), '[]'::jsonb)));
end;
$$;

revoke all on function public.business_collect_one(uuid, text) from public, anon, authenticated;
revoke all on function public.business_def(text) from public, anon;
revoke all on function public.business_hype(bigint) from public, anon;
revoke all on function public.business_worth(text, int, boolean, bigint) from public, anon;
revoke all on function public.business_pay(text, int) from public, anon;
revoke all on function public.net_worth(uuid) from public, anon, authenticated;
revoke all on function public.rank_level(bigint, bigint) from public, anon;
revoke all on function public.business_state() from public, anon;
grant execute on function public.business_state() to authenticated;
revoke all on function public.buy_business(text) from public, anon;
grant execute on function public.buy_business(text) to authenticated;
revoke all on function public.upgrade_business(text) from public, anon;
grant execute on function public.upgrade_business(text) to authenticated;
revoke all on function public.collect_tills() from public, anon;
grant execute on function public.collect_tills() to authenticated;
revoke all on function public.go_public() from public, anon;
grant execute on function public.go_public() to authenticated;
