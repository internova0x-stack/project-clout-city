-- The Shop Manager, stage 1 (owner, Oct 21; docs/shop-manager.md): the Shop's catalog moves into the database.
--   * shop_catalog: one row per item, with its status (draft, pending_review, scheduled, live, retired, deleted), tab,
--     slot, presentation, words, price, clout, tier, stars, style lines, template and wearable flag, real-money price and
--     edition size, processed images and the import it came from. Every item on sale today is seeded as live, in the
--     Shop's order, with the game's own shop entry kept in `city`.
--   * shop_audit: every import, edit, status change and price change, with who, when, before and after.
--   * The game keeps reading the Shop the way it always has (city() -> 'shop', shop_item()): a trigger on game_settings
--     rebuilds that list from the catalog whenever 'city' is written, and any catalog change rewrites it. So a city seed
--     written by a later migration can never undo the Studio's edits.
--   * A purchase (player_items 'bought') is refused for an item that isn't on sale ('not_for_sale': retired, or scheduled
--     and its time hasn't come) or can't be worn yet ('not_wearable_yet').
--   * shop_catalog_public() is what players' Shop shows; admin_shop_* are the Studio's (story admins only).
--   * Storage: the public 'shop' bucket (the 256 px and 768 px WebP images) and the private 'shop-masters' bucket (the
--     original PNGs, never sent to players). Uploads come from the server with the service role.
--   * The faux chinchilla coat goes to $16.99 (owner, Oct 21).
-- Safe to run more than once.

create table if not exists public.shop_catalog (
  sku             text primary key check (sku ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  position        int not null default 100000,
  status          text not null default 'draft' check (status in ('draft', 'pending_review', 'scheduled', 'live', 'retired', 'deleted')),
  go_live_at      timestamptz,
  tab             text not null check (tab in ('fashion', 'accessories', 'home', 'cars', 'houses', 'luxury', 'makeup')),
  slot            text,
  presentation    text not null default 'all' check (presentation in ('all', 'f', 'm')),
  name            text not null,
  description     text not null default '',
  emoji           text not null default '🛍️',
  price           int not null default 0 check (price >= 0),
  clout           int not null default 0 check (clout >= 0),
  tier            text check (tier in ('budget', 'mid', 'luxury')),
  stars           int not null default 1 check (stars between 1 and 4),
  style_lines     text[] not null default '{}',
  template        text,
  wearable        boolean not null default true,
  real_cash       boolean not null default false,
  price_usd_cents int check (price_usd_cents > 0),
  edition_size    int check (edition_size > 0),
  images          jsonb,
  image_status    text not null default 'none' check (image_status in ('none', 'ready', 'failed')),
  image_error     text,
  source_image    text,
  transparent     boolean not null default false,
  collection      text,
  note            text,
  origin          text not null default 'import' check (origin in ('code', 'import')),
  file            text,
  extra           jsonb not null default '{}',
  city            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid
);
alter table public.shop_catalog enable row level security;
revoke all on public.shop_catalog from anon, authenticated;

create table if not exists public.shop_audit (
  id      bigint generated always as identity primary key,
  sku     text not null,
  action  text not null,
  actor   uuid,
  before  jsonb,
  after   jsonb,
  note    text,
  at      timestamptz not null default now()
);
create index if not exists shop_audit_sku_idx on public.shop_audit (sku, at desc);
alter table public.shop_audit enable row level security;
revoke all on public.shop_audit from anon, authenticated;

-- Every item on sale today (scripts/gen-shop-seed.ts), live, as it is.
insert into public.shop_catalog (sku, position, status, tab, slot, presentation, name, description, emoji, price, clout, stars, real_cash,
                                 wearable, origin, extra, city, reviewed_at)
select x.sku, x.position, 'live', x.tab, x.slot, x.presentation, x.name, x.description, x.emoji, x.price, x.clout, x.stars, x.real_cash,
       true, 'code', x.extra, x.city, now()
  from jsonb_to_recordset('[{"sku":"fit-satin-bomber","position":0,"tab":"fashion","slot":"top","presentation":"all","name":"Satin bomber jacket","description":"Shiny enough to be seen from Jersey.","emoji":"🧥","price":395,"clout":25,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-leather-blazer","position":1,"tab":"fashion","slot":"top","presentation":"all","name":"Leather blazer","description":"Says \"I have a publicist.\" You don''t. Yet.","emoji":"🧥","price":925,"clout":45,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-varsity-tee","position":2,"tab":"fashion","slot":"top","presentation":"all","name":"Vintage varsity tee","description":"From a college you didn''t attend. Iconic.","emoji":"👕","price":145,"clout":10,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-wide-trousers","position":3,"tab":"fashion","slot":"bottom","presentation":"all","name":"Wide-leg trousers","description":"Extra fabric, extra confidence.","emoji":"👖","price":310,"clout":18,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-mini-skirt","position":4,"tab":"fashion","slot":"bottom","presentation":"all","name":"Pleated mini skirt","description":"Brunch-approved. Weather-ignored.","emoji":"👗","price":265,"clout":16,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-chunky-sneakers","position":5,"tab":"fashion","slot":"shoes","presentation":"all","name":"Chunky dad sneakers","description":"Ugly on purpose. Expensive on purpose.","emoji":"👟","price":460,"clout":28,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"forever-our-bird-hoodie","position":6,"tab":"fashion","slot":"top","presentation":"all","name":"\"Forever Our Bird\" hoodie","description":"Loretta''s grief merch, C$185, \"for healing.\" Limited time, unlimited questions.","emoji":"🕊️","price":185,"clout":12,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false,"cloutReq":0}},{"sku":"col-faux-chinchilla","position":7,"tab":"fashion","slot":"top","presentation":"all","name":"Faux chinchilla coat","description":"No chinchillas were harmed. Several egos were.","emoji":"🧥","price":0,"clout":80,"stars":4,"real_cash":true,"extra":{},"city":{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true,"cloutReq":0}},{"sku":"col-holo-boots","position":8,"tab":"fashion","slot":"shoes","presentation":"f","name":"Holographic platform boots","description":"Six inches taller and visible from space.","emoji":"👢","price":0,"clout":70,"stars":4,"real_cash":true,"extra":{},"city":{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true,"cloutReq":0}},{"sku":"set-site-crew","position":9,"tab":"fashion","slot":"outfit","presentation":"all","name":"Site crew hi-vis","description":"Hard hat, hi-vis, zero construction experience.","emoji":"🦺","price":240,"clout":14,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"set-site-crew","category":"fashion","price":240,"clout":14,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"set-st-marks-punk","position":10,"tab":"fashion","slot":"outfit","presentation":"all","name":"St. Marks punk","description":"Ripped on purpose. Angry on schedule.","emoji":"🎸","price":380,"clout":22,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"set-st-marks-punk","category":"fashion","price":380,"clout":22,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"set-gala-night","position":11,"tab":"fashion","slot":"outfit","presentation":"all","name":"Gala night","description":"For galas you were not technically invited to.","emoji":"🥂","price":1200,"clout":55,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"set-gala-night","category":"fashion","price":1200,"clout":55,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"set-ranch-hand","position":12,"tab":"fashion","slot":"outfit","presentation":"all","name":"Ranch hand overalls","description":"The nearest ranch is a salad place in Astoria.","emoji":"🤠","price":290,"clout":16,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"set-ranch-hand","category":"fashion","price":290,"clout":16,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"set-rockaway-beach","position":13,"tab":"fashion","slot":"outfit","presentation":"all","name":"Rockaway beach set","description":"Two trains and a bus to the beach. Worth it.","emoji":"🩳","price":160,"clout":10,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"set-rockaway-beach","category":"fashion","price":160,"clout":10,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"set-adventurer","position":14,"tab":"fashion","slot":"outfit","presentation":"all","name":"Adventurer","description":"Has explored every corner of Queens. Most of them twice.","emoji":"🧭","price":600,"clout":30,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"set-adventurer","category":"fashion","price":600,"clout":30,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":1000}},{"sku":"set-tactical","position":15,"tab":"fashion","slot":"outfit","presentation":"all","name":"Tactical gear","description":"Ready for anything, mostly brunch.","emoji":"🪖","price":1100,"clout":45,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"set-tactical","category":"fashion","price":1100,"clout":45,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":2500}},{"sku":"set-witch","position":16,"tab":"fashion","slot":"outfit","presentation":"all","name":"Witch of Ditmars","description":"Hexes on request. Tarot on Thursdays.","emoji":"🧙","price":1800,"clout":60,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"set-witch","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000}},{"sku":"set-ranger","position":17,"tab":"fashion","slot":"outfit","presentation":"all","name":"Hooded ranger","description":"Mysterious. Also cold.","emoji":"🏹","price":1800,"clout":60,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"set-ranger","category":"fashion","price":1800,"clout":60,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":5000}},{"sku":"set-spacefarer","position":18,"tab":"fashion","slot":"outfit","presentation":"all","name":"Spacefarer","description":"First Queens resident in orbit, according to their bio.","emoji":"🚀","price":4200,"clout":110,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"set-spacefarer","category":"fashion","price":4200,"clout":110,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":10000}},{"sku":"set-royalty","position":19,"tab":"fashion","slot":"outfit","presentation":"all","name":"Royalty","description":"Crown included. Kingdom sold separately.","emoji":"👑","price":9500,"clout":200,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"set-royalty","category":"fashion","price":9500,"clout":200,"rentPerWeek":0,"slot":"outfit","storyOnly":false,"collector":false,"cloutReq":25000}},{"sku":"fit-meteors-cap","position":20,"tab":"fashion","slot":"accessory","presentation":"all","name":"Flushing Meteors cap","description":"Blue and orange. Worn backwards in the bleachers, forwards at job interviews.","emoji":"🧢","price":45,"clout":6,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"fit-meteors-cap","category":"fashion","price":45,"clout":6,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-meteors-jersey","position":21,"tab":"fashion","slot":"top","presentation":"all","name":"Flushing Meteors home jersey","description":"Pinstripes are for the Bronx. This is for believers.","emoji":"⚾","price":120,"clout":10,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"fit-meteors-jersey","category":"fashion","price":120,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"fit-bucket-hat","position":22,"tab":"fashion","slot":"accessory","presentation":"all","name":"Bucket hat","description":"Hides bad hair days and good ideas.","emoji":"👒","price":120,"clout":8,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-sofa-orange","position":23,"tab":"home","slot":"living","presentation":"all","name":"Three-seat sofa","description":"Seats three. Holds one person and their laundry.","emoji":"🛋️","price":480,"clout":14,"stars":3,"real_cash":false,"extra":{"line":"sofa"},"city":{"sku":"home-sofa-orange","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-sofa-blue","position":24,"tab":"home","slot":"living","presentation":"all","name":"Three-seat sofa","description":"Seats three. Holds one person and their laundry.","emoji":"🛋️","price":480,"clout":14,"stars":3,"real_cash":false,"extra":{"line":"sofa"},"city":{"sku":"home-sofa-blue","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-sofa-green","position":25,"tab":"home","slot":"living","presentation":"all","name":"Three-seat sofa","description":"Seats three. Holds one person and their laundry.","emoji":"🛋️","price":480,"clout":14,"stars":3,"real_cash":false,"extra":{"line":"sofa"},"city":{"sku":"home-sofa-green","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-sofa-cream","position":26,"tab":"home","slot":"living","presentation":"all","name":"Three-seat sofa","description":"Seats three. Holds one person and their laundry.","emoji":"🛋️","price":480,"clout":14,"stars":3,"real_cash":false,"extra":{"line":"sofa"},"city":{"sku":"home-sofa-cream","category":"home","price":480,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-armchair-green","position":27,"tab":"home","slot":"living","presentation":"all","name":"Reading armchair","description":"For reading. Or for the clothes chair.","emoji":"💺","price":220,"clout":8,"stars":2,"real_cash":false,"extra":{"line":"armchair"},"city":{"sku":"home-armchair-green","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-armchair-berry","position":28,"tab":"home","slot":"living","presentation":"all","name":"Reading armchair","description":"For reading. Or for the clothes chair.","emoji":"💺","price":220,"clout":8,"stars":2,"real_cash":false,"extra":{"line":"armchair"},"city":{"sku":"home-armchair-berry","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-armchair-mustard","position":29,"tab":"home","slot":"living","presentation":"all","name":"Reading armchair","description":"For reading. Or for the clothes chair.","emoji":"💺","price":220,"clout":8,"stars":2,"real_cash":false,"extra":{"line":"armchair"},"city":{"sku":"home-armchair-mustard","category":"home","price":220,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-coffee-table","position":30,"tab":"home","slot":"living","presentation":"all","name":"Coffee table","description":"Holds coffee, remotes and unopened mail.","emoji":"🫖","price":140,"clout":5,"stars":2,"real_cash":false,"extra":{"line":"coffee-table"},"city":{"sku":"home-coffee-table","category":"home","price":140,"clout":5,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-tv","position":31,"tab":"home","slot":"living","presentation":"all","name":"Big TV","description":"Larger than your ambitions. For now.","emoji":"📺","price":650,"clout":12,"stars":3,"real_cash":false,"extra":{"line":"tv"},"city":{"sku":"home-tv","category":"home","price":650,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-rug-pink","position":32,"tab":"home","slot":"living","presentation":"all","name":"Area rug","description":"Ties the room together. Allegedly.","emoji":"🧶","price":120,"clout":4,"stars":2,"real_cash":false,"extra":{"line":"rug"},"city":{"sku":"home-rug-pink","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-rug-sand","position":33,"tab":"home","slot":"living","presentation":"all","name":"Area rug","description":"Ties the room together. Allegedly.","emoji":"🧶","price":120,"clout":4,"stars":2,"real_cash":false,"extra":{"line":"rug"},"city":{"sku":"home-rug-sand","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-rug-violet","position":34,"tab":"home","slot":"living","presentation":"all","name":"Area rug","description":"Ties the room together. Allegedly.","emoji":"🧶","price":120,"clout":4,"stars":2,"real_cash":false,"extra":{"line":"rug"},"city":{"sku":"home-rug-violet","category":"home","price":120,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-floor-lamp","position":35,"tab":"home","slot":"living","presentation":"all","name":"Floor lamp","description":"Mood lighting for a mood you''re working on.","emoji":"💡","price":90,"clout":3,"stars":1,"real_cash":false,"extra":{"line":"floor-lamp"},"city":{"sku":"home-floor-lamp","category":"home","price":90,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-bookshelf","position":36,"tab":"home","slot":"living","presentation":"all","name":"Bookshelf","description":"Books you''ll read, books you''ll display.","emoji":"📚","price":210,"clout":7,"stars":2,"real_cash":false,"extra":{"line":"bookshelf"},"city":{"sku":"home-bookshelf","category":"home","price":210,"clout":7,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-bed-blue","position":37,"tab":"home","slot":"bedroom","presentation":"all","name":"Platform bed","description":"Off the floor at last. Your back says thank you.","emoji":"🛏️","price":900,"clout":20,"stars":3,"real_cash":false,"extra":{"line":"bed"},"city":{"sku":"home-bed-blue","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-bed-pink","position":38,"tab":"home","slot":"bedroom","presentation":"all","name":"Platform bed","description":"Off the floor at last. Your back says thank you.","emoji":"🛏️","price":900,"clout":20,"stars":3,"real_cash":false,"extra":{"line":"bed"},"city":{"sku":"home-bed-pink","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-bed-black","position":39,"tab":"home","slot":"bedroom","presentation":"all","name":"Platform bed","description":"Off the floor at last. Your back says thank you.","emoji":"🛏️","price":900,"clout":20,"stars":3,"real_cash":false,"extra":{"line":"bed"},"city":{"sku":"home-bed-black","category":"home","price":900,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-nightstand","position":40,"tab":"home","slot":"bedroom","presentation":"all","name":"Nightstand with lamp","description":"Somewhere to put the phone you won''t stop checking.","emoji":"🛏️","price":110,"clout":4,"stars":2,"real_cash":false,"extra":{"line":"nightstand"},"city":{"sku":"home-nightstand","category":"home","price":110,"clout":4,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-desk","position":41,"tab":"home","slot":"bedroom","presentation":"all","name":"Work desk","description":"Where side hustles become main hustles.","emoji":"🖥️","price":260,"clout":8,"stars":2,"real_cash":false,"extra":{"line":"desk"},"city":{"sku":"home-desk","category":"home","price":260,"clout":8,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-dining-table","position":42,"tab":"home","slot":"dining","presentation":"all","name":"Dining table","description":"Seats four. Mostly holds takeout.","emoji":"🍽️","price":340,"clout":10,"stars":2,"real_cash":false,"extra":{"line":"dining-table"},"city":{"sku":"home-dining-table","category":"home","price":340,"clout":10,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-chair-oak","position":43,"tab":"home","slot":"dining","presentation":"all","name":"Dining chair","description":"Matches nothing, on purpose.","emoji":"🪑","price":75,"clout":2,"stars":1,"real_cash":false,"extra":{"line":"chair"},"city":{"sku":"home-chair-oak","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-chair-black","position":44,"tab":"home","slot":"dining","presentation":"all","name":"Dining chair","description":"Matches nothing, on purpose.","emoji":"🪑","price":75,"clout":2,"stars":1,"real_cash":false,"extra":{"line":"chair"},"city":{"sku":"home-chair-black","category":"home","price":75,"clout":2,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-island","position":45,"tab":"home","slot":"dining","presentation":"all","name":"Kitchen island","description":"Stools included. Dinner parties not.","emoji":"🏝️","price":1400,"clout":30,"stars":4,"real_cash":false,"extra":{"line":"island"},"city":{"sku":"home-island","category":"home","price":1400,"clout":30,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-plant","position":46,"tab":"home","slot":"decor","presentation":"all","name":"Monstera","description":"Thrives on neglect. Relatable.","emoji":"🪴","price":45,"clout":3,"stars":1,"real_cash":false,"extra":{"line":"plant"},"city":{"sku":"home-plant","category":"home","price":45,"clout":3,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-piano","position":47,"tab":"home","slot":"decor","presentation":"all","name":"Upright piano","description":"You''ll learn. Eventually. It looks great either way.","emoji":"🎹","price":6000,"clout":90,"stars":4,"real_cash":false,"extra":{"line":"piano"},"city":{"sku":"home-piano","category":"home","price":6000,"clout":90,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"home-neon-five-sign","position":48,"tab":"home","slot":"decor","presentation":"all","name":"Neon \"5/5\" sign","description":"Five tasks, every day, for a week. Glows like you have your life together.","emoji":"🔆","price":0,"clout":0,"stars":3,"real_cash":false,"extra":{"line":"neon-five-sign"},"city":{"sku":"home-neon-five-sign","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true}},{"sku":"home-trophy-shelf","position":49,"tab":"home","slot":"decor","presentation":"all","name":"Trophy shelf","description":"Trophies for showing up. Participation has never looked this good.","emoji":"🏆","price":0,"clout":0,"stars":3,"real_cash":false,"extra":{"line":"trophy-shelf"},"city":{"sku":"home-trophy-shelf","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true}},{"sku":"home-employee-frame","position":50,"tab":"home","slot":"decor","presentation":"all","name":"Framed \"Employee of the Month\"","description":"You don''t have an employer. The frame doesn''t need to know.","emoji":"🖼️","price":0,"clout":0,"stars":3,"real_cash":false,"extra":{"line":"employee-frame"},"city":{"sku":"home-employee-frame","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true}},{"sku":"home-streak-lava-lamp","position":51,"tab":"home","slot":"decor","presentation":"all","name":"Streak lava lamp","description":"Bubbles up every time you don''t break the streak. Do not shake.","emoji":"🌋","price":0,"clout":0,"stars":4,"real_cash":false,"extra":{"line":"streak-lava-lamp"},"city":{"sku":"home-streak-lava-lamp","category":"home","price":0,"clout":0,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0,"reward":true}},{"sku":"car-hatchback","position":52,"tab":"cars","slot":"car","presentation":"all","name":"Pre-loved hatchback","description":"Previously loved. Heavily. It still gets you to the club.","emoji":"🚗","price":21000,"clout":120,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"car-luxury-sedan","position":53,"tab":"cars","slot":"car","presentation":"all","name":"Luxury sedan","description":"Rent this luxury sedan. Might be fake life, but it''s oh so worth it when you pull up to the club.","emoji":"🚘","price":78000,"clout":300,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"car-electric-coupe","position":54,"tab":"cars","slot":"car","presentation":"all","name":"Electric coupe","description":"Silent, fast and smug. Like a startup founder.","emoji":"🏎️","price":117000,"clout":420,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"house-astoria-townhouse","position":55,"tab":"houses","slot":"plot","presentation":"all","name":"Astoria townhouse","description":"A stoop of your own. Neighbors will judge your plants.","emoji":"🏡","price":270000,"clout":900,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"house-hunters-point-duplex","position":56,"tab":"houses","slot":"plot","presentation":"all","name":"Hunters Point duplex penthouse","description":"Two floors, a terrace and a hot tub with a view of everyone who doubted you.","emoji":"🏙️","price":2400000,"clout":4200,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"house-hunters-point-duplex","category":"houses","price":2400000,"clout":4200,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"house-lic-penthouse","position":57,"tab":"houses","slot":"plot","presentation":"all","name":"LIC penthouse","description":"Floor-to-ceiling windows, so the city can watch you thrive.","emoji":"🌆","price":975000,"clout":2400,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"lux-gold-chain","position":58,"tab":"luxury","slot":null,"presentation":"all","name":"Chunky gold-tone chain","description":"Not gold. Nobody needs to know.","emoji":"⛓️","price":2250,"clout":70,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"lux-diamond-studs","position":59,"tab":"luxury","slot":null,"presentation":"all","name":"Diamond-ish studs","description":"They sparkle. That''s the whole personality.","emoji":"💎","price":6000,"clout":140,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"lux-designer-watch","position":60,"tab":"luxury","slot":null,"presentation":"all","name":"Designer watch","description":"Tells the time and tells everyone you''re doing fine.","emoji":"⌚","price":17000,"clout":260,"stars":4,"real_cash":false,"extra":{},"city":{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"mu-glow-kit","position":61,"tab":"makeup","slot":null,"presentation":"all","name":"Glass-skin glow kit","description":"Look like you sleep eight hours. You don''t.","emoji":"✨","price":165,"clout":12,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"mu-lip-set","position":62,"tab":"makeup","slot":null,"presentation":"all","name":"Lip set in 12 shades of \"nude\"","description":"Twelve shades. You''ll wear one. Forever.","emoji":"💄","price":210,"clout":14,"stars":3,"real_cash":false,"extra":{},"city":{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}},{"sku":"mu-lash-bar","position":63,"tab":"makeup","slot":null,"presentation":"all","name":"Lash bar appointment","description":"Blink and you''ll fan the person next to you.","emoji":"👁️","price":350,"clout":20,"stars":2,"real_cash":false,"extra":{},"city":{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false,"cloutReq":0}}]'::jsonb)
    as x(sku text, position int, tab text, slot text, presentation text, name text, description text, emoji text, price int, clout int,
         stars int, real_cash boolean, extra jsonb, city jsonb)
on conflict (sku) do nothing;

-- The faux chinchilla coat: $16.99 (owner, Oct 21). Without a Stripe Price id, Checkout charges price_cents.
update public.store_products set price_cents = 1699, stripe_price_id = null, updated_at = now()
 where sku = 'col-faux-chinchilla' and price_cents <> 1699;
update public.shop_catalog c set price_usd_cents = p.price_cents
  from public.store_products p where p.sku = c.sku and c.real_cash and c.price_usd_cents is distinct from p.price_cents;

-- ---------------------------------------------------------------------------
-- The game's Shop list, rebuilt from the catalog
-- ---------------------------------------------------------------------------
create or replace function public.shop_city_entries() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('sku', c.sku, 'rentPerWeek', 0, 'slot', c.slot, 'storyOnly', false, 'cloutReq', 0)
           || c.city
           || jsonb_build_object('category', c.tab, 'price', c.price, 'clout', c.clout, 'collector', c.real_cash, 'status', c.status,
                                 'wearable', c.wearable)
           order by c.position, c.sku), '[]'::jsonb)
    from public.shop_catalog c
   where c.status in ('scheduled', 'live', 'retired')
$$;

create or replace function public.shop_city_overlay() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.key = 'city' and jsonb_typeof(new.value) = 'object' then
    new.value := jsonb_set(new.value, '{shop}', public.shop_city_entries());
  end if;
  return new;
end;
$$;
drop trigger if exists game_settings_shop on public.game_settings;
create trigger game_settings_shop before insert or update on public.game_settings
  for each row execute function public.shop_city_overlay();

create or replace function public.shop_catalog_changed() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.game_settings set updated_at = now() where key = 'city';
  return null;
end;
$$;
drop trigger if exists shop_catalog_city on public.shop_catalog;
create trigger shop_catalog_city after insert or update or delete on public.shop_catalog
  for each statement execute function public.shop_catalog_changed();

update public.game_settings set updated_at = now() where key = 'city';

-- ---------------------------------------------------------------------------
-- Buying: only what's on sale and can be worn
-- ---------------------------------------------------------------------------
create or replace function public.shop_on_sale(p_sku text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select c.status = 'live' or (c.status = 'scheduled' and c.go_live_at <= now())
                     from public.shop_catalog c where c.sku = p_sku), true)
$$;

create or replace function public.shop_buy_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c public.shop_catalog;
begin
  if new.acquired <> 'bought' then return new; end if;
  select * into c from public.shop_catalog where sku = new.sku;
  if c.sku is null then return new; end if;
  if not public.shop_on_sale(new.sku) then raise exception 'not_for_sale' using errcode = '22023'; end if;
  if not c.wearable then raise exception 'not_wearable_yet' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists player_items_shop_guard on public.player_items;
create trigger player_items_shop_guard before insert on public.player_items
  for each row execute function public.shop_buy_guard();

-- ---------------------------------------------------------------------------
-- What players' Shop shows
-- ---------------------------------------------------------------------------
create or replace function public.shop_row(c public.shop_catalog) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'sku', c.sku, 'status', c.status, 'goLiveAt', c.go_live_at, 'tab', c.tab, 'slot', c.slot, 'presentation', c.presentation,
    'name', c.name, 'description', c.description, 'emoji', c.emoji, 'price', c.price, 'clout', c.clout, 'tier', c.tier, 'stars', c.stars,
    'styleLines', to_jsonb(c.style_lines), 'template', c.template, 'wearable', c.wearable, 'realCash', c.real_cash,
    'priceUsdCents', c.price_usd_cents, 'editionSize', c.edition_size, 'images', c.images, 'collection', c.collection,
    'position', c.position)
$$;

create or replace function public.shop_catalog_public() returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public.shop_row(c) || jsonb_build_object('status', case when public.shop_on_sale(c.sku) then 'live' else c.status end)
                            order by c.position, c.sku), '[]'::jsonb)
    from public.shop_catalog c
   where c.status in ('live', 'retired') or (c.status = 'scheduled' and c.go_live_at <= now())
$$;

-- ---------------------------------------------------------------------------
-- The Studio (story admins)
-- ---------------------------------------------------------------------------
create or replace function public.shop_admin_row(c public.shop_catalog) returns jsonb
language sql stable security definer set search_path = public
as $$
  select public.shop_row(c) || jsonb_build_object(
    'imageStatus', c.image_status, 'imageError', c.image_error, 'sourceImage', c.source_image, 'transparent', c.transparent,
    'note', c.note, 'origin', c.origin, 'file', c.file, 'extra', c.extra,
    'sold', exists (select 1 from public.player_items i where i.sku = c.sku)
         or exists (select 1 from public.purchases p where p.sku = c.sku and p.status in ('paid', 'refunded')),
    'updatedAt', c.updated_at)
$$;

create or replace function public.shop_log(p_sku text, p_action text, p_before jsonb, p_after jsonb, p_note text default null) returns void
language sql security definer set search_path = public
as $$ insert into public.shop_audit (sku, action, actor, before, after, note) values (p_sku, p_action, auth.uid(), p_before, p_after, p_note) $$;

/** Every item but deleted ones; a scheduled item whose time has come goes live here. */
create or replace function public.admin_shop_list() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.shop_catalog;
begin
  perform public.require_story_admin();
  for r in select * from public.shop_catalog where status = 'scheduled' and go_live_at <= now() loop
    update public.shop_catalog set status = 'live', updated_at = now() where sku = r.sku;
    perform public.shop_log(r.sku, 'went_live', jsonb_build_object('status', 'scheduled'), jsonb_build_object('status', 'live'));
  end loop;
  return coalesce((select jsonb_agg(public.shop_admin_row(c) order by c.position, c.sku) from public.shop_catalog c where c.status <> 'deleted'), '[]'::jsonb);
end;
$$;

/**
 * Bulk import (section 2): new ids become drafts; items still in draft or review are updated (and go back to draft when
 * their picture changed); scheduled, live and retired items are never touched ('kept'). Never deletes.
 */
create or replace function public.admin_shop_import(p_items jsonb, p_file text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  it jsonb;
  cur public.shop_catalog;
  added text[] := '{}';
  updated text[] := '{}';
  kept text[] := '{}';
  same text[] := '{}';
  v_pos int := coalesce((select max(position) from public.shop_catalog), 0);
begin
  perform public.require_story_admin();
  for it in select * from jsonb_array_elements(p_items) loop
    select * into cur from public.shop_catalog where sku = it ->> 'sku';
    if cur.sku is null then
      v_pos := v_pos + 1;
      insert into public.shop_catalog (sku, position, status, tab, slot, presentation, name, description, emoji, price, clout, tier, stars, style_lines,
             template, wearable, real_cash, price_usd_cents, edition_size, source_image, transparent, collection, origin, file, extra)
      values (it ->> 'sku', v_pos, 'draft', it ->> 'tab', it ->> 'slot', coalesce(it ->> 'presentation', 'all'), it ->> 'name',
              coalesce(it ->> 'description', ''), coalesce(it ->> 'emoji', '🛍️'), coalesce((it ->> 'price')::int, 0), coalesce((it ->> 'clout')::int, 0),
              it ->> 'tier', coalesce((it ->> 'stars')::int, 1), coalesce(array(select jsonb_array_elements_text(it -> 'styleLines')), '{}'),
              it ->> 'template', coalesce((it ->> 'wearable')::boolean, false), coalesce((it ->> 'realCash')::boolean, false),
              (it ->> 'priceUsdCents')::int, (it ->> 'editionSize')::int, it ->> 'sourceImage', coalesce((it ->> 'transparent')::boolean, false),
              it ->> 'collection', 'import', p_file, coalesce(it -> 'extra', '{}'));
      added := added || (it ->> 'sku');
      perform public.shop_log(it ->> 'sku', 'import', null, it, p_file);
    elsif cur.status in ('draft', 'pending_review') then
      if public.shop_admin_row(cur) @> (it - 'extra' - 'sourceImage' - 'transparent' - 'file') and cur.source_image is not distinct from it ->> 'sourceImage' then
        same := same || cur.sku;
        continue;
      end if;
      update public.shop_catalog set
        tab = it ->> 'tab', slot = it ->> 'slot', presentation = coalesce(it ->> 'presentation', presentation), name = it ->> 'name',
        description = coalesce(it ->> 'description', description), emoji = coalesce(it ->> 'emoji', emoji),
        price = coalesce((it ->> 'price')::int, price), clout = coalesce((it ->> 'clout')::int, clout), tier = it ->> 'tier',
        stars = coalesce((it ->> 'stars')::int, stars), style_lines = coalesce(array(select jsonb_array_elements_text(it -> 'styleLines')), style_lines),
        template = it ->> 'template', real_cash = coalesce((it ->> 'realCash')::boolean, real_cash),
        price_usd_cents = (it ->> 'priceUsdCents')::int, edition_size = (it ->> 'editionSize')::int, collection = it ->> 'collection',
        file = p_file, extra = coalesce(it -> 'extra', extra),
        source_image = it ->> 'sourceImage', transparent = coalesce((it ->> 'transparent')::boolean, transparent),
        images = case when source_image is distinct from it ->> 'sourceImage' then null else images end,
        image_status = case when source_image is distinct from it ->> 'sourceImage' then 'none' else image_status end,
        status = case when source_image is distinct from it ->> 'sourceImage' then 'draft' else status end,
        updated_at = now()
       where sku = cur.sku;
      updated := updated || cur.sku;
      perform public.shop_log(cur.sku, 'import_update', public.shop_admin_row(cur), it, p_file);
    else
      kept := kept || cur.sku;
    end if;
  end loop;
  return jsonb_build_object('added', to_jsonb(added), 'updated', to_jsonb(updated), 'kept', to_jsonb(kept), 'unchanged', to_jsonb(same));
end;
$$;

/** live-shop-images.json: a picture for items on sale, matched by exact name (prices and the rest stay). Returns the skus. */
create or replace function public.admin_shop_image_source(p_name text, p_source text, p_transparent boolean, p_file text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  hits text[];
begin
  perform public.require_story_admin();
  select coalesce(array_agg(sku order by position), '{}') into hits from public.shop_catalog where name = p_name and status <> 'deleted';
  update public.shop_catalog set source_image = p_source, transparent = p_transparent, file = coalesce(file, p_file),
         image_status = case when source_image is distinct from p_source then 'none' else image_status end,
         updated_at = now()
   where sku = any(hits) and source_image is distinct from p_source;
  return to_jsonb(hits);
end;
$$;

/** The server's image processing result: ready (both sizes) or failed with the reason. A ready draft moves to review. */
create or replace function public.admin_shop_set_image(p_sku text, p_images jsonb, p_error text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur public.shop_catalog;
begin
  perform public.require_story_admin();
  select * into cur from public.shop_catalog where sku = p_sku;
  if cur.sku is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  update public.shop_catalog set
    images = case when p_error is null then p_images else images end,
    image_status = case when p_error is null then 'ready' else 'failed' end,
    image_error = p_error,
    status = case when p_error is null and status = 'draft' then 'pending_review' else status end,
    updated_at = now()
   where sku = p_sku;
  perform public.shop_log(p_sku, case when p_error is null then 'image' else 'image_failed' end, cur.images, p_images, p_error);
end;
$$;

/**
 * Status actions (section 1): approve (live now, or scheduled for p_at), send_back (draft, with a note), retire, restore,
 * delete (only if never sold). The Studio checks readiness before it calls approve.
 */
create or replace function public.admin_shop_action(p_sku text, p_action text, p_at timestamptz default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cur public.shop_catalog;
  v_to text;
  v_sold boolean;
begin
  perform public.require_story_admin();
  select * into cur from public.shop_catalog where sku = p_sku for update;
  if cur.sku is null or cur.status = 'deleted' then raise exception 'unknown_item' using errcode = '22023'; end if;
  v_sold := (public.shop_admin_row(cur) ->> 'sold')::boolean;
  v_to := case p_action
    when 'approve' then case when p_at is not null and p_at > now() then 'scheduled' else 'live' end
    when 'send_back' then 'draft'
    when 'unschedule' then 'pending_review'
    when 'retire' then 'retired'
    when 'restore' then 'live'
    when 'delete' then 'deleted'
  end;
  if v_to is null then raise exception 'unknown_action' using errcode = '22023'; end if;
  if not (
       (cur.status = 'draft' and v_to in ('deleted')) or
       (cur.status = 'pending_review' and v_to in ('scheduled', 'live', 'draft', 'deleted')) or
       (cur.status = 'scheduled' and v_to in ('live', 'pending_review', 'scheduled')) or
       (cur.status = 'live' and v_to in ('retired', 'deleted')) or
       (cur.status = 'retired' and v_to in ('live', 'deleted'))) then
    raise exception 'not_allowed' using errcode = '22023';
  end if;
  if v_to = 'deleted' and v_sold then raise exception 'sold_retire_instead' using errcode = '22023'; end if;
  if p_action = 'send_back' and coalesce(btrim(p_note), '') = '' then raise exception 'note_needed' using errcode = '22023'; end if;
  if v_to in ('live', 'scheduled') and cur.image_status <> 'ready' and not (cur.origin = 'code' and cur.source_image is null) then
    raise exception 'image_not_ready' using errcode = '22023';
  end if;
  update public.shop_catalog set status = v_to,
         go_live_at = case when v_to = 'scheduled' then p_at when v_to = 'live' then coalesce(go_live_at, now()) else go_live_at end,
         note = case when p_action = 'send_back' then p_note else note end,
         reviewed_at = case when p_action in ('approve', 'send_back') then now() else reviewed_at end,
         reviewed_by = case when p_action in ('approve', 'send_back') then auth.uid() else reviewed_by end,
         updated_at = now()
   where sku = p_sku;
  perform public.shop_log(p_sku, p_action, jsonb_build_object('status', cur.status, 'goLiveAt', cur.go_live_at),
                          jsonb_build_object('status', v_to, 'goLiveAt', p_at), p_note);
  return jsonb_build_object('status', v_to);
end;
$$;

/**
 * Edit (section 1): the editable fields only. A real-money price change switches the item to the new price for the next
 * checkout (store_products.price_cents, and the old Stripe Price id is dropped); past buyers are never touched.
 */
create or replace function public.admin_shop_edit(p_sku text, p_fields jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur public.shop_catalog;
begin
  perform public.require_story_admin();
  select * into cur from public.shop_catalog where sku = p_sku for update;
  if cur.sku is null or cur.status = 'deleted' then raise exception 'unknown_item' using errcode = '22023'; end if;
  update public.shop_catalog set
    name = coalesce(p_fields ->> 'name', name),
    description = coalesce(p_fields ->> 'description', description),
    emoji = coalesce(p_fields ->> 'emoji', emoji),
    price = coalesce((p_fields ->> 'price')::int, price),
    clout = coalesce((p_fields ->> 'clout')::int, clout),
    tier = case when p_fields ? 'tier' then p_fields ->> 'tier' else tier end,
    stars = coalesce((p_fields ->> 'stars')::int, stars),
    style_lines = case when p_fields ? 'styleLines' then array(select jsonb_array_elements_text(p_fields -> 'styleLines')) else style_lines end,
    slot = case when p_fields ? 'slot' then p_fields ->> 'slot' else slot end,
    tab = coalesce(p_fields ->> 'tab', tab),
    presentation = coalesce(p_fields ->> 'presentation', presentation),
    price_usd_cents = case when p_fields ? 'priceUsdCents' then (p_fields ->> 'priceUsdCents')::int else price_usd_cents end,
    edition_size = case when p_fields ? 'editionSize' then (p_fields ->> 'editionSize')::int else edition_size end,
    updated_at = now()
   where sku = p_sku;
  if p_fields ? 'priceUsdCents' and cur.real_cash and (p_fields ->> 'priceUsdCents')::int is distinct from cur.price_usd_cents then
    update public.store_products set price_cents = (p_fields ->> 'priceUsdCents')::int, stripe_price_id = null, updated_at = now() where sku = p_sku;
  end if;
  perform public.shop_log(p_sku, 'edit', public.shop_admin_row(cur), p_fields);
end;
$$;

/** A drop's Lola Lowdown News item, on the New York day it goes live (one per drop time). */
create or replace function public.admin_shop_drop_news(p_skus text[], p_at timestamptz) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_names text;
  v_id text := 'shop-drop-' || to_char(p_at at time zone 'America/New_York', 'YYYY-MM-DD-HH24MI');
  v_count int;
begin
  perform public.require_story_admin();
  select string_agg(name, ', ' order by position), count(*) into v_names, v_count from public.shop_catalog where sku = any(p_skus);
  if v_count = 0 then raise exception 'unknown_item' using errcode = '22023'; end if;
  insert into public.news_items (id, kind, headline, body, cast_ids, publish_on, status)
  values (v_id, 'city',
          left(case when v_count = 1 then 'New in the Shop: ' || v_names else v_count || ' new pieces drop in the Shop today' end, 110),
          left('Babe, the Shop just got a drop: ' || v_names || '. From ' || to_char(p_at at time zone 'America/New_York', 'FMHH12:MI AM')
               || ', New York time. Get there before your group chat does. Lola Lowdown', 600),
          '{lola}', (p_at at time zone 'America/New_York')::date, 'approved')
  on conflict (id) do update set headline = excluded.headline, body = excluded.body, updated_at = now();
  return v_id;
end;
$$;

create or replace function public.admin_shop_audit(p_sku text) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'at', a.at, 'before', a.before, 'after', a.after, 'note', a.note,
                                                       'actor', a.actor) order by a.at desc, a.id desc)
                     from public.shop_audit a where a.sku = p_sku), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: public card and detail images; private masters
-- ---------------------------------------------------------------------------
do $storage$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('shop', 'shop', true, 2097152, array['image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('shop-masters', 'shop-masters', false, 20971520, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
exception when others then
  raise warning 'Shop Manager: could not create the shop buckets here (%). Create them in Storage (docs/SETUP.md).', sqlerrm;
end
$storage$;

-- Hardening (0049): helpers aren't for the browser; the player read is for signed-in players; the rest need an admin.
revoke all on function public.shop_city_entries() from public, anon, authenticated;
revoke all on function public.shop_city_overlay() from public, anon, authenticated;
revoke all on function public.shop_catalog_changed() from public, anon, authenticated;
revoke all on function public.shop_buy_guard() from public, anon, authenticated;
revoke all on function public.shop_on_sale(text) from public, anon, authenticated;
revoke all on function public.shop_row(public.shop_catalog) from public, anon, authenticated;
revoke all on function public.shop_admin_row(public.shop_catalog) from public, anon, authenticated;
revoke all on function public.shop_log(text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.shop_catalog_public() from public, anon;
grant execute on function public.shop_catalog_public() to authenticated;
revoke all on function public.admin_shop_list() from public, anon;
revoke all on function public.admin_shop_import(jsonb, text) from public, anon;
revoke all on function public.admin_shop_image_source(text, text, boolean, text) from public, anon;
revoke all on function public.admin_shop_set_image(text, jsonb, text) from public, anon;
revoke all on function public.admin_shop_action(text, text, timestamptz, text) from public, anon;
revoke all on function public.admin_shop_edit(text, jsonb) from public, anon;
revoke all on function public.admin_shop_drop_news(text[], timestamptz) from public, anon;
revoke all on function public.admin_shop_audit(text) from public, anon;
grant execute on function public.admin_shop_list() to authenticated;
grant execute on function public.admin_shop_import(jsonb, text) to authenticated;
grant execute on function public.admin_shop_image_source(text, text, boolean, text) to authenticated;
grant execute on function public.admin_shop_set_image(text, jsonb, text) to authenticated;
grant execute on function public.admin_shop_action(text, text, timestamptz, text) to authenticated;
grant execute on function public.admin_shop_edit(text, jsonb) to authenticated;
grant execute on function public.admin_shop_drop_news(text[], timestamptz) to authenticated;
grant execute on function public.admin_shop_audit(text) to authenticated;
