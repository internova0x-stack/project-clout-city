-- 0095: transit and transit news (culture pack C4; owner, Oct 20; docs/culture/README.md), the lotto back in Flushing.
--   * City seed regenerated (lib/city.ts): each neighborhood's train line (travel.subway.lines; homeLines for trips
--     home), the OMG Card passes, showtime dancers, the rideshare (fares and trip times), and Lucky Star Lotto moved
--     to Main Street, Flushing (owner, Oct 21: part of v1.0, so in Queens where everyone can reach it).
--   * News: a 'transit' kind (the Metro Rail Authority's updates) with a transit column {line, from, hours, delay}.
--     A delay adds its seconds to that line's subway trips on its day, from `from` (New York time) for `hours`.
--   * travel(): 'rideshare'; the subway is free with a live OMG Card (players.transit_pass_until); a trip rides the
--     destination's line and waits out any delay on it; about one subway trip in ten has showtime dancers
--     (players.showtime_until), and showtime_watch() pays their clout once a New York day (ledger clout 'showtime').
--   * buy_transit_pass(): a 7- or 30-day OMG Card for C$ (ledger cash 'transit_pass'); it stacks onto a live one.
--     Not a possession: no Net Worth, no resale.
--   * gossip_find(): no listening in at a shut place (owner, Oct 21).

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100,"firstDay":[{"place":"ditmars-deli","action":"bec"},{"place":"ditmars-deli","action":"pet-cat"},{"place":"hell-gate-park","action":"lap"}]},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6,"lines":{"Astoria":"N/W","Long Island City":"N/W","Flushing":"7","Flushing Meadows":"7","Jackson Heights":"7","Sunnyside":"7","Jamaica":"E"},"passes":[{"id":"week","label":"OMG Card · 7-day unlimited","days":7,"price":70},{"id":"month","label":"OMG Card · 30-day unlimited","days":30,"price":250}],"showtime":{"chance":0.1,"clout":3}},"taxi":{"fare":[18,35,60,95]},"rideshare":{"fare":[25,49,84,133]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"rideshare":{"base":4,"perMile":7,"max":50},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":1,"taskClout":15,"restroom":{"clout":25,"mood":6}},"clubs":{"vip":{"medium":{"freeClout":5000,"cover":1500},"exclusive":{"freeClout":15000,"cover":5000}},"vipTimes":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]},"businesses":{"tillDays":2,"upgrade":{"cost":0.6,"pay":0.5,"value":0.5},"hype":{"clout":150000,"max":2},"goPublic":{"clout":50000,"fee":50000000,"times":3},"list":[{"id":"hot-dog-cart","name":"Dirty Water Dogs","emoji":"🌭","price":5000,"payPerDay":750,"blurb":"One cart, one umbrella, a hot dog water recipe older than the city.","upgrades":[{"name":"Second umbrella","emoji":"⛱️","blurb":"Twice the shade, twice the line."},{"name":"Secret menu","emoji":"🤫","blurb":"It''s the same hot dog. It costs more now."},{"name":"Influencer collab","emoji":"🤳","blurb":"A creator ate one on camera. The line goes around the block."}]},{"id":"bodega","name":"Bodega, Cat Included","emoji":"🐈","price":50000,"payPerDay":6000,"blurb":"Open 24 hours. The cat runs it; you just own it.","upgrades":[{"name":"Hot food counter","emoji":"🥪","blurb":"Chopped cheese, all day, every day."},{"name":"Lotto machine","emoji":"🎟️","blurb":"Everybody''s uncle comes in now."},{"name":"The cat gets an agent","emoji":"😼","blurb":"Brand deals. The cat negotiates better than you."}]},{"id":"laundromat","name":"Spin Cycle Laundromat","emoji":"🧺","price":250000,"payPerDay":22500,"blurb":"Twenty machines, three of them work. The quarters add up.","upgrades":[{"name":"Free Wi-Fi","emoji":"📶","blurb":"People stay. People buy snacks."},{"name":"Wash and fold","emoji":"👕","blurb":"You fold strangers'' socks for money. Lucrative."},{"name":"Laundromat by night","emoji":"🎧","blurb":"A DJ on Fridays. It''s a scene now."}]},{"id":"cafe","name":"Oat Milk Surcharge Café","emoji":"☕","price":1200000,"payPerDay":81600,"blurb":"Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".","upgrades":[{"name":"Latte art","emoji":"🎨","blurb":"Every cup a portrait of the customer. Mostly."},{"name":"Laptop ban (for vibes)","emoji":"💻","blurb":"Fewer screenwriters, more turnover."},{"name":"Second location","emoji":"📍","blurb":"Same café, different neighborhood, same oat milk."}]},{"id":"taco-trucks","name":"Taco Truck Fleet","emoji":"🌮","price":6000000,"payPerDay":300000,"blurb":"Five trucks, one group chat, zero parking tickets paid.","upgrades":[{"name":"Late-night route","emoji":"🌙","blurb":"Outside every club at 2 a.m."},{"name":"Festival permits","emoji":"🎪","blurb":"Every street fair in Queens."},{"name":"A truck in every borough","emoji":"🗽","blurb":"Even Staten Island. Especially Staten Island."}]},{"id":"nightclub","name":"Your Own Nightclub","emoji":"🪩","price":30000000,"payPerDay":1080000,"blurb":"Your name on the door. The bouncer still doesn''t respect you.","upgrades":[{"name":"VIP floor","emoji":"🥂","blurb":"Upstairs, where the expensive bottles live."},{"name":"Celebrity DJ residency","emoji":"🎛️","blurb":"Every Saturday, a famous person presses play."},{"name":"A gold-plated velvet rope","emoji":"✨","blurb":"Completely unnecessary. Wildly profitable."}]},{"id":"apartment-building","name":"Luxury* Apartment Building","emoji":"🏢","price":150000000,"payPerDay":3900000,"blurb":"*Exposed brick. Forty units, one elevator, rent that should be illegal.","upgrades":[{"name":"Rooftop amenity","emoji":"🌇","blurb":"Two lounge chairs and a view. Rent goes up 30%."},{"name":"Doorman with opinions","emoji":"🧑‍✈️","blurb":"He judges every delivery. Tenants love it."},{"name":"Condo conversion","emoji":"🔑","blurb":"Same units, now for sale, at three times the price."}]},{"id":"startup","name":"Disruptive App Startup","emoji":"📱","price":700000000,"payPerDay":12600000,"blurb":"It''s an app for apps. Investors are thrilled.","upgrades":[{"name":"Pivot to AI","emoji":"🤖","blurb":"Same app, new deck, valuation doubles."},{"name":"Celebrity board member","emoji":"🌟","blurb":"They don''t know what the app does. Nobody does."},{"name":"Ring the bell","emoji":"🔔","blurb":"Ready to go public."}]}]},"together":{"multiplier":1.5,"windowMinutes":10,"perDay":5,"minAccountDays":2,"tags":["library","university","club","nightlife"],"ride":{"modes":["subway","taxi"],"expireMinutes":3}},"jobs":{"perPairPerDay":1,"decorator":{"payMin":200,"payMax":20000,"payChoices":[500,1000,2500,5000],"minutes":30,"clout":25,"autoKeepHours":24},"manager":{"cutMin":5,"cutMax":20,"cutChoices":[5,10,15,20]}},"ranks":[{"clout":0,"netWorth":0},{"clout":100,"netWorth":25000},{"clout":500,"netWorth":50000},{"clout":1000,"netWorth":100000},{"clout":2000,"netWorth":250000},{"clout":5000,"netWorth":500000},{"clout":15000,"netWorth":1000000},{"clout":50000,"netWorth":10000000},{"clout":150000,"netWorth":1000000000},{"clout":500000,"netWorth":10000000000}]},"homeLines":{"astoria_share":"N/W","astoria_studio":"N/W","jackson_heights_1br":"7","sunnyside_gardens":"7","lic_highrise":"N/W","sj_dorm":"E","qu_dorm":"7"},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","club":{"vip":"medium"},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["mixer","social","tea","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","club":null,"borough":"queens","actions":[{"id":"speed-meet","kind":"visit","price":25,"pay":0,"energy":12,"mood":5,"confidence":6,"clout":null,"storyUnlock":false,"skill":"charisma"},{"id":"spill","kind":"visit","price":12,"pay":0,"energy":6,"mood":6,"confidence":0,"clout":null,"storyUnlock":false,"skill":"gossip"},{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7112,-73.965],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.715,-73.952],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7188,-73.9622],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":null,"at":[40.7105,-73.9392],"area":"East Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","club":null,"borough":"queens","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"st-copays","tags":["hospital","civic","astoria"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"checkup","kind":"visit","price":60,"pay":0,"energy":-30,"mood":6,"confidence":0,"clout":null,"storyUnlock":false},{"id":"volunteer","kind":"visit","price":0,"pay":0,"energy":15,"mood":5,"confidence":4,"clout":12,"storyUnlock":false,"skill":"charisma"}]},{"id":"brownstone-sessions","tags":["lounge","nightlife","music_venue"],"story":null,"at":[40.7128,-73.944],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"set","kind":"visit","price":35,"pay":0,"energy":8,"mood":8,"confidence":0,"clout":null,"storyUnlock":false},{"id":"open-mic","kind":"visit","price":0,"pay":0,"energy":18,"mood":3,"confidence":8,"clout":15,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7172,-73.957],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"fifs-furniture","tags":["furniture","shopping","home"],"story":null,"at":[40.7272,-73.9532],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7292,-73.944],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false},{"id":"quad","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":8,"storyUnlock":false},{"id":"study","kind":"visit","price":0,"pay":0,"energy":12,"mood":0,"confidence":5,"clout":6,"storyUnlock":false,"skill":"smarts"}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","club":null,"borough":"queens","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false},{"id":"quad","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":8,"storyUnlock":false},{"id":"study","kind":"visit","price":0,"pay":0,"energy":12,"mood":0,"confidence":5,"clout":6,"storyUnlock":false,"skill":"smarts"}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria","job_cashier"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"bec","kind":"eat","price":8,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pet-cat","kind":"visit","price":0,"pay":0,"energy":1,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"cashier","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"still-a-dollar-slice","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7712,-73.915],"area":"Astoria","club":null,"borough":"queens","hours":{"open":10,"close":1},"actions":[{"id":"slice","kind":"eat","price":6,"pay":0,"energy":-10,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"combo","kind":"eat","price":13,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"white-sauce-cart","tags":["halal_cart","late_night","dining_budget","astoria"],"story":null,"at":[40.7708,-73.9172],"area":"Astoria","club":null,"borough":"queens","hours":{"open":18,"close":5},"actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boiled-and-beloved","tags":["hot_dog_cart","dining_budget","astoria"],"story":null,"at":[40.7768,-73.9245],"area":"Astoria","club":null,"borough":"queens","hours":{"open":10,"close":20},"actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"feta-compli","tags":["taverna","dining_medium","astoria"],"story":null,"at":[40.7676,-73.9188],"area":"Astoria","club":null,"borough":"queens","hours":{"open":12,"close":23},"actions":[{"id":"eat","kind":"eat","price":40,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"schlep-and-schmear","tags":["jewish_deli","dining_medium","astoria","job_deli"],"story":null,"at":[40.7645,-73.9205],"area":"Astoria","club":null,"borough":"queens","hours":{"open":7,"close":21},"actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"counter","kind":"shift","price":0,"pay":130,"energy":28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget"],"story":null,"at":[40.725,-73.9565],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["hub","diner","dining_medium","games","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","club":{},"borough":"queens","actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"play","kind":"visit","price":12,"pay":0,"energy":8,"mood":6,"confidence":2,"clout":null,"storyUnlock":false},{"id":"hang","kind":"hangout","price":0,"pay":0,"energy":2,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7205,-73.9595],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife"],"story":null,"at":[40.7085,-73.942],"area":"East Williamsburg","club":{"vip":"medium"},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"the-sticky-floor","tags":["club","nightlife"],"story":null,"at":[40.7058,-73.9372],"area":"East Williamsburg","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":40,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"discount-disco","tags":["club","nightlife"],"story":null,"at":[40.7038,-73.9328],"area":"Bushwick","club":{},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"ultraviolet-society","tags":["club","nightlife","exclusive_club"],"story":null,"at":[40.7135,-73.9625],"area":"Williamsburg","club":{"vip":"exclusive","doorClout":2000},"borough":"brooklyn","actions":[{"id":"visit","kind":"visit","price":350,"pay":0,"energy":15,"mood":8,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus"],"story":null,"at":[40.7118,-73.9545],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria","job_dogwalker"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false},{"id":"lap","kind":"visit","price":0,"pay":0,"energy":12,"mood":4,"confidence":3,"clout":null,"storyUnlock":false,"skill":"fitness"},{"id":"picnic","kind":"eat","price":18,"pay":0,"energy":-14,"mood":6,"confidence":0,"clout":null,"storyUnlock":false},{"id":"walk-dogs","kind":"shift","price":0,"pay":110,"energy":20,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym"],"story":null,"at":[40.7168,-73.9468],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot"],"story":null,"at":[40.7238,-73.9478],"area":"Greenpoint","club":null,"borough":"brooklyn","actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena"],"story":null,"at":[40.7098,-73.9482],"area":"Williamsburg","club":null,"borough":"brooklyn","actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8303],"area":"Flushing","club":null,"borough":"queens","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"real-clout-fm","tags":["radio","station","astoria"],"story":null,"at":[40.7598,-73.9262],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"sit-in","kind":"visit","price":0,"pay":0,"energy":4,"mood":5,"confidence":2,"clout":6,"storyUnlock":false}]},{"id":"clout-tower","tags":["tv","station","astoria"],"story":null,"at":[40.7585,-73.9195],"area":"Astoria","club":null,"borough":"queens","actions":[{"id":"watch","kind":"visit","price":0,"pay":0,"energy":3,"mood":4,"confidence":3,"clout":6,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"two-dollar-night","placeId":"the-sticky-floor","startHour":21,"hours":5,"entry":55,"clout":20,"confidence":5,"mood":8},{"id":"clearance-rack-disco","placeId":"discount-disco","startHour":22,"hours":4,"entry":70,"clout":25,"confidence":5,"mood":8},{"id":"ultraviolet-afterglow","placeId":"ultraviolet-society","startHour":23,"hours":4,"entry":450,"clout":140,"confidence":10,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6},{"id":"greek-row-sj","placeId":"st-johnsons","startHour":21,"hours":5,"entry":20,"clout":40,"confidence":6,"mood":10,"days":[2,4,5,6]},{"id":"greek-row-qu","placeId":"queensborough-u","startHour":21,"hours":5,"entry":20,"clout":40,"confidence":6,"mood":10,"days":[2,4,5,6]}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0},{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000},{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500},{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000},{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000},{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"home-neon-five-sign","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-trophy-shelf","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-employee-frame","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"home-streak-lava-lamp","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}],"homeLocations":{"sunnyside_gardens":[40.7472,-73.9182],"astoria_share":[40.7735,-73.9145],"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956],"sj_dorm":[40.7208,-73.7972],"qu_dorm":[40.7352,-73.8192]}}'::jsonb, updated_at = now() where key = 'city';

alter table public.news_items drop constraint if exists news_items_kind_check;
alter table public.news_items add constraint news_items_kind_check check (kind in ('city', 'column', 'hunt', 'transit'));
alter table public.news_items add column if not exists transit jsonb;

alter table public.players add column if not exists transit_pass_until timestamptz;
alter table public.players add column if not exists showtime_until timestamptz;

/** Approved items published by today, newest first (the last 60 days); C4: with a transit update's line and window. */
create or replace function public.news_feed() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'kind', kind, 'headline', headline, 'body', body, 'cast', to_jsonb(cast_ids), 'day', publish_on, 'transit', transit
    )) order by publish_on desc, id), '[]'::jsonb)
    from public.news_items
   where status = 'approved'
     and publish_on <= public.ny_today()
     and publish_on > public.ny_today() - 60
$$;

/** Studio: every item, newest day first (C4: with the transit details). */
create or replace function public.admin_news_list() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'kind', kind, 'headline', headline, 'body', body, 'cast', to_jsonb(cast_ids),
      'day', publish_on, 'status', status, 'transit', transit
    )) order by publish_on desc, id) from public.news_items), '[]'::jsonb);
end;
$$;

-- 0017's admin_news_upsert, storing the transit details too.
create or replace function public.admin_news_upsert(p_items jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  n int := 0;
begin
  perform public.require_story_admin();
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_news' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.news_items (id, kind, headline, body, cast_ids, publish_on, transit)
    values (it ->> 'id', it ->> 'kind', btrim(it ->> 'headline'), btrim(it ->> 'body'),
            coalesce((select array_agg(c) from jsonb_array_elements_text(coalesce(it -> 'cast', '[]'::jsonb)) c), '{}'),
            (it ->> 'day')::date, it -> 'transit')
    on conflict (id) do update
      set kind = excluded.kind, headline = excluded.headline, body = excluded.body,
          cast_ids = excluded.cast_ids, publish_on = excluded.publish_on, transit = excluded.transit, updated_at = now(),
          status = case when news_items.status = 'approved'
                         and (news_items.kind, news_items.headline, news_items.body, news_items.cast_ids, news_items.publish_on)
                           = (excluded.kind, excluded.headline, excluded.body, excluded.cast_ids, excluded.publish_on)
                         and news_items.transit is not distinct from excluded.transit
                        then 'approved' else 'review' end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 0037's content_import_news, storing the transit details too.
create or replace function public.content_import_news(p_items jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  n int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_news' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.news_items (id, kind, headline, body, cast_ids, publish_on, status, transit)
    values (it ->> 'id', it ->> 'kind', btrim(it ->> 'headline'), btrim(it ->> 'body'),
            coalesce((select array_agg(c) from jsonb_array_elements_text(coalesce(it -> 'cast', '[]'::jsonb)) c), '{}'),
            (it ->> 'day')::date, 'approved', it -> 'transit')
    on conflict (id) do update
      set kind = excluded.kind, headline = excluded.headline, body = excluded.body,
          cast_ids = excluded.cast_ids, publish_on = excluded.publish_on, transit = excluded.transit,
          updated_at = case when (news_items.kind, news_items.headline, news_items.body, news_items.cast_ids, news_items.publish_on)
                                 = (excluded.kind, excluded.headline, excluded.body, excluded.cast_ids, excluded.publish_on)
                                 and news_items.transit is not distinct from excluded.transit
                            then news_items.updated_at else now() end,
          status = case when news_items.status = 'paused' then 'paused' else 'approved' end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

/** C4: the seconds a live, approved transit delay adds to this line's trips now (the longest, if several). */
create or replace function public.transit_delay(p_line text) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(max((transit ->> 'delay')::int), 0)
    from public.news_items, (select public.game_now() at time zone 'America/New_York' as ny) c
   where p_line is not null
     and kind = 'transit' and status = 'approved'
     and transit ->> 'line' = p_line and transit ? 'delay'
     and publish_on = c.ny::date
     and c.ny::time >= (transit ->> 'from')::time
     and c.ny < c.ny::date + (transit ->> 'from')::time + make_interval(hours => (transit ->> 'hours')::int)
$$;

-- 0092's travel(), plus the rideshare, the OMG Card, the line's delay and showtime dancers (C4).
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
  v_line text;
  v_delay int := 0;
  v_pass boolean;
  v_showtime boolean := false;
  st jsonb := t -> 'subway' -> 'showtime';
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if dest is not null and (place is null or (place ->> 'story' is not null and not public.arc_started(place ->> 'story'))) then
    raise exception 'unknown_place' using errcode = '22023';
  end if;
  -- #19 (0046): the exclusive club's bouncer checks your clout at the door; 0073: or your name on tonight's list.
  if dest is not null and me.clout < coalesce((place -> 'club' ->> 'doorClout')::int, 0) and not public.pass_tonight(uid, dest)
     and not public.perk_access(uid, 'door') then
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
    when 'subway' then
      -- C4: an OMG Card makes the ride free; the line is the destination's (home: the home's).
      v_pass := me.transit_pass_until is not null and me.transit_pass_until > now();
      v_fare := case when v_pass then 0 else (t -> 'subway' ->> 'fare')::int end;
      v_line := case when dest is null then public.city() -> 'homeLines' ->> me.home_id
                     else t -> 'subway' -> 'lines' ->> (place ->> 'area') end;
      v_delay := public.transit_delay(v_line);
    when 'taxi' then v_fare := (t -> 'taxi' -> 'fare' ->> band)::int;
    when 'rideshare' then v_fare := (t -> 'rideshare' -> 'fare' ->> band)::int;
    when 'car' then
      if me.car_sku is null then raise exception 'no_car' using errcode = '22023'; end if;
    else raise exception 'bad_mode' using errcode = '22023';
  end case;
  v_seconds := public.trip_seconds(p_mode, v_miles) + v_delay;
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_fare then raise exception 'cant_afford' using errcode = '22023'; end if;

  v_arrives := clock_timestamp() + make_interval(secs => v_seconds);
  -- C4: showtime dancers, about one subway ride in ten, while today's clout for watching is still unpaid.
  v_showtime := p_mode = 'subway' and random() < coalesce((st ->> 'chance')::numeric, 0)
            and not exists (select 1 from public.ledger where player_id = uid and currency = 'clout' and kind = 'showtime' and ref = public.ny_today()::text);
  update public.players set at_place = dest, arrives_at = v_arrives,
    bank_cash = bank_cash - v_fare, energy = energy - v_energy,
    showtime_until = case when v_showtime then v_arrives + interval '1 minute' else null end where id = uid;
  if v_fare > 0 then
    perform public.ledger_once(uid, 'cash', -v_fare, 'travel',
      p_mode || ':' || coalesce(dest, 'home') || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  end if;
  return jsonb_build_object('place', coalesce(dest, 'home'), 'mode', p_mode, 'miles', round(v_miles, 2),
                            'cash', -v_fare, 'energy', -v_energy, 'seconds', v_seconds, 'arrivesAt', v_arrives,
                            'line', v_line, 'delay', v_delay, 'showtime', v_showtime);
end;
$$;

/** C4: a 7- or 30-day OMG Card, paid in C$; it stacks onto a live one. Not a possession (no Net Worth, no resale). */
create or replace function public.buy_transit_pass(p_pass text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pass jsonb := (select x from jsonb_array_elements(public.city() -> 'economy' -> 'travel' -> 'subway' -> 'passes') x where x ->> 'id' = p_pass);
  me public.players;
  v_until timestamptz;
begin
  if pass is null then raise exception 'unknown_pass' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.bank_cash < (pass ->> 'price')::int then raise exception 'cant_afford' using errcode = '22023'; end if;
  v_until := greatest(coalesce(me.transit_pass_until, now()), now()) + make_interval(days => (pass ->> 'days')::int);
  update public.players set bank_cash = bank_cash - (pass ->> 'price')::int, transit_pass_until = v_until where id = uid;
  perform public.ledger_once(uid, 'cash', -(pass ->> 'price')::int, 'transit_pass',
    p_pass || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  return jsonb_build_object('pass', p_pass, 'until', v_until, 'cash', -(pass ->> 'price')::int);
end;
$$;

/** C4: watch the showtime dancers on this ride: a little clout, once a New York day. */
create or replace function public.showtime_watch() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_clout int := coalesce((public.city() -> 'economy' -> 'travel' -> 'subway' -> 'showtime' ->> 'clout')::int, 0);
  me public.players;
begin
  select * into me from public.players where id = uid for update;
  if me.id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.showtime_until is null or me.showtime_until < clock_timestamp() then raise exception 'no_showtime' using errcode = '22023'; end if;
  update public.players set showtime_until = null where id = uid;
  if v_clout > 0 and public.ledger_once(uid, 'clout', v_clout, 'showtime', public.ny_today()::text) then
    update public.players set clout = clout + v_clout where id = uid;
    return jsonb_build_object('clout', v_clout);
  end if;
  return jsonb_build_object('clout', 0);
end;
$$;

-- 0049's gossip_find, closed while the place is shut.
create or replace function public.gossip_find(p_place text, p_via text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.players;
  r record;
  v_found jsonb := '[]'::jsonb;
  later jsonb := null;
  finished jsonb := '[]'::jsonb;
  sid text;
  task_cash int;
  b jsonb := public.city() -> 'economy' -> 'gossip' -> 'restroom';
  v_bclout int := 0;
  v_bmood int := 0;
begin
  if p_via not in ('overheard', 'regular', 'restroom') then raise exception 'bad_via' using errcode = '22023'; end if;
  -- #19: the restroom is downstairs at a club or the lounge.
  if p_via = 'restroom' and jsonb_typeof((select p -> 'club' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place)) is distinct from 'object' then
    raise exception 'no_restroom' using errcode = '22023';
  end if;
  select * into me from public.players where id = uid;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'gossip_not_here' using errcode = '22023'; end if;
  -- 0049: the trip has to be over, as for every other place action (0042).
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  -- C4 (owner, Oct 21): nobody to overhear while the place is shut (opening hours, 0093).
  if not public.place_hours_open(p_place) then raise exception 'closed_now' using errcode = '22023'; end if;
  for r in
    select l.story ->> 'id' as story, l.story ->> 'title' as title, p.n - 1 as piece, p.x
      from public.gossip_live() l, jsonb_array_elements(l.story -> 'pieces') with ordinality p(x, n)
     where p.x ->> 'place' = p_place
       -- #19: the restroom hears its own pieces and what's said upstairs.
       and (p.x ->> 'source' = p_via or (p_via = 'restroom' and p.x ->> 'source' = 'overheard'))
       and not exists (select 1 from public.gossip_found f where f.player_id = uid and f.story_id = l.story ->> 'id' and f.piece = p.n - 1)
     order by l.week, l.story ->> 'id', p.n
  loop
    if public.gossip_in_window(r.x -> 'hours') then
      insert into public.gossip_found (player_id, story_id, piece, via) values (uid, r.story, r.piece, p_via) on conflict do nothing;
      -- #19: a restroom piece pays a story's clout and Mood again, on the spot (once, ledger 'gossip_restroom').
      if r.x ->> 'source' = 'restroom'
         and public.ledger_once(uid, 'clout', (b ->> 'clout')::int, 'gossip_restroom', r.story || ':' || r.piece) then
        update public.players set clout = clout + (b ->> 'clout')::int, mood = least(100, mood + (b ->> 'mood')::int) where id = uid;
        v_bclout := v_bclout + (b ->> 'clout')::int;
        v_bmood := v_bmood + (b ->> 'mood')::int;
      end if;
      v_found := v_found || jsonb_build_object('story', r.story, 'title', r.title, 'piece', r.piece, 'text', r.x ->> 'text',
        'count', (select count(*) from public.gossip_found f where f.player_id = uid and f.story_id = r.story));
    elsif later is null then
      later := r.x -> 'hours';
    end if;
  end loop;
  for sid in select distinct x ->> 'story' from jsonb_array_elements(v_found) x loop
    if public.gossip_finish(uid, sid) then finished := finished || to_jsonb(sid); end if;
  end loop;
  -- v0.11: talking to the regular (or listening in) where a gossip task sent you completes it,
  -- whether or not there was anything new to hear (a crewmate may have shared it first).
  task_cash := public.complete_task(uid, p_place, 'gossip-' || p_via);
  return jsonb_build_object('found', v_found, 'later', later, 'finished', finished, 'taskCash', task_cash,
                            'bonus', jsonb_build_object('clout', v_bclout, 'mood', v_bmood));
end;
$$;

-- Hardening (0049): helpers the browser shouldn't call.
revoke all on function public.transit_delay(text) from public, anon, authenticated;
revoke all on function public.buy_transit_pass(text) from public, anon;
grant execute on function public.buy_transit_pass(text) to authenticated;
revoke all on function public.showtime_watch() from public, anon;
grant execute on function public.showtime_watch() to authenticated;
