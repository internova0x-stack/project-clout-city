# Clout City: Shop Manager

A section of the Story Studio (the admin dashboard) for managing the Shop without code changes: importing items,
reviewing and approving them, scheduling drops, editing, retiring and deleting. Sections 1 and the rules are the
owner's (Oct 21); sections 2 to 5 were written from the owner's decisions of Oct 21 and approved before building.

## Related files

- `content/shop/*.json`: the catalog files to import (`live-shop-images.json`, `shop-batch-01.json`,
  `shop-batches-02-05.json`, `shop-batches-06-07.json`, `clout-couture.json`). Each has notes explaining its rules.
- `docs/fashion-style-lines.md`: style lines, garment templates and the Shop art style.
- `docs/08-new-features-spec.md` section 23 (the avatar and Shop upgrade, added with stage 1). Where this file goes
  into more detail, this file wins.

## Rules for every part of this build

1. Nothing goes live without the owner's approval in the Studio. (One exception, decided Oct 21: the items already on
   sale when the Shop Manager arrives are brought in as `live`, since players already own and buy them.)
2. Stripe stays in test mode until launch.
3. Players' owned items are never removed by an admin action except a refund.
4. Each build stage (section 5) is its own pull request with a preview link.

## 1. Item lifecycle and actions

### Statuses

| Status | Meaning | Visible to players |
| --- | --- | --- |
| `draft` | Imported or added, not yet reviewed | No |
| `pending_review` | Image processed; waiting for approval | No |
| `scheduled` | Approved with a future go-live time | Not until that time |
| `live` | On sale | Yes |
| `retired` | No longer sold; owners keep it | Only to owners (wardrobe, Net Worth screen, profile) |
| `deleted` | Removed completely | No |

Allowed moves: draft → pending_review → scheduled or live; scheduled → live (automatically at its time) or back to
pending_review; live → retired; retired → live (restore); draft or pending_review → deleted; live or retired → deleted
only if the item has never been sold.

### Actions

| Action | What it does | Safeguard |
| --- | --- | --- |
| Approve | Moves an item to `live` now or `scheduled` for a chosen time | Shows the processed Shop card exactly as players see it, in light and dark mode, plus the readiness checks (section 4) |
| Send back | Returns an item to `draft` with a note | The note is kept on the item |
| Edit | Name, description, price, clout, tier, stars, style lines, slot, tab, presentation, image | Every change is written to the audit log; edits to a live real-money price follow section 3 |
| Schedule a drop | Sets one go-live time for one item or a selected group | Creates a matching Lola Lowdown News item for the same time (it follows the News rules) |
| Retire | Stops sales immediately | Owners keep the item; this is the default way to remove anything that has been sold |
| Delete | Removes the item entirely | Blocked if the item has ever been sold; the button explains why and offers Retire instead |
| Restore | Moves a retired item back to `live` | Allowed for every item, real-money limited editions included (owner, Oct 21: "Editions can be brought back"); a restored edition continues its numbering |
| Bulk import | Loads a catalog JSON file as drafts (section 2) | Nothing from an import is ever live without approval |
| Bulk approve | Approves a selected group | Only items whose readiness checks all pass can be selected |

The list view filters by status, tab, style line, tier, presentation, real money and readiness, and searches by name.

## 2. Import

**Where.** Studio → Shop → **Import**. Catalog files merged into `content/shop/` show a **Load** button (like the
Calendar's hunt and news files); a file can also be chosen from the computer or pasted.

**What happens to each item.**

1. **Checked** against the rules below. An item that fails stays out, with the reason listed; the rest load.
2. **Matched.** A new `id` becomes a new `draft`. In `live-shop-images.json` each entry is matched to an item already
   in the Shop by its exact `liveName`, and only its image changes (prices, clout and everything else stay as they
   are in the game). A name with no match is listed as "not found" and nothing changes.
3. **Image processed** (in the game's server, not the browser):
   - downloaded from `sourceImage`;
   - when `transparent` is false, the flat cream background and the floor shadow are removed with a color key, the
     same way on every item;
   - trimmed and centered, resized to 256 px (cards) and 768 px (detail), converted to WebP at about 80% quality;
   - the two WebPs go to the public `shop` storage bucket; the master PNG goes to the private `shop-masters` bucket and
     is never sent to players.

   When the image is done the item moves to `pending_review`. If the download or processing fails, it stays `draft`
   with the reason and a **Retry image** button.
4. **Re-importing** the same file updates items still in `draft` or `pending_review` (an approved item that changed
   goes back to review). It never changes a `scheduled`, `live` or `retired` item: those show "changed in the file"
   and are edited with **Edit**. An import never deletes anything.

**Field rules (applied on import and on Edit).**

| Field | Rule |
| --- | --- |
| `id` | Lowercase letters, numbers and dashes; unique across the Shop |
| `name`, `description` | 3 to 60 and 10 to 500 characters; no real brand names (`content/culture/parody-names.json`); the word filter applies |
| Tab | Fashion, Accessories, Home, Cars, Houses, Luxury or Makeup. The files' `accessories` category maps to **Accessories** for hats, shades, scarves, chokers and bags, and to **Luxury** for jewelry and watches (necklaces, earrings, chains, pearls, watches). Clout Couture's map pieces (yacht, jet, plaza statue) go in **Luxury** (no Map tab, owner Oct 21) |
| Slot | Fashion: top, bottom, one-piece, shoes. Accessories and Luxury: head, face, ears, neck, wrist, hand. A one-piece fills top and bottom: putting one on takes off the top and bottom, and putting on a top or bottom takes off the one-piece |
| Presentation | Female only or Male and Female (owner, Oct 21). Default on import: dresses and gowns, skirts, heels, the sports bra, halter, bodysuit and crop tops, Mary Janes, slingbacks, ballet flats, platform sandals, clutches and mini bags are **Female only**; everything else is **Male and Female**. Editable per item |
| Style lines | One or more of: streetwear, gothic, nerdy-preppy, sporty, business-casual, fashionista, luxury, avant-garde, wasteland-luxe |
| Tier, stars | budget, mid or luxury; 1 to 4 stars |
| Price (C$) | A whole number above 0 |
| Clout | Set by the game's live curve, not the file (owner, Oct 21): clout ≈ 0.6 × price^0.62, rounded, which matches the clothing, jewelry and watches already on sale (a C$395 bomber gives 25, a C$17,000 watch 260). Cars, houses and home pieces follow their own tabs' existing values. Diminishing returns on repeat purchases stay as they are. Editable, with a warning more than 20% off the curve |
| Real money | `priceUsd` creates the item's `store_products` row in Stripe test mode (section 3) |
| Template | The garment template or rigid accessory it needs to be worn (`hoodie`, `rigid:hat` and so on) |

## 3. Real-money items (Clout Couture and collector pieces)

- **Prices live in `store_products`** (and Stripe), never in code. Stripe stays in test mode until launch.
- **Changing a live real-money price** creates a new Stripe Price and switches the item to it for the next checkout.
  Checkouts already open finish at the old price; past buyers are never charged or refunded for a change. A lower
  price than the current drop's needs a confirm, since later drops are priced the same or higher.
- **The faux chinchilla coat** stays a real-cash collector piece at **$16.99** (owner, Oct 21; it was $4.99).
- **Numbered editions.** Each real-money piece has an edition size per drop. Each buyer gets the next number, shown on
  the item and the owner's profile ("No. 0042"). When a drop sells out the item shows "Sold out" until the next
  drop; a new drop **continues the numbering** (the first drop is 0001 to 0100, the second 0101 to 0200), and a sold-out
  edition can be brought back (owner, Oct 21). Limits are real: the server stops selling at the drop's size.
- **Refunds** take the item back (as today) and free a Waterfront Mansion plot; an edition number is never reissued.
- **Status, not advantage.** Clout equals the most expensive C$ item in the same tab; Net Worth value is 1.5 × that item
  (the existing rule) and counts on the Net Worth leaderboard. Not sellable for C$, not tradable, not giftable.
- **Every purchase over $50** shows the confirmation sheet first. Owning any piece earns the **Clout Couture** badge;
  each new drop gets a Lola Lowdown News item.
- **Names in public** (the yacht's hull, the jet's banner, the mansion's gate) go through the word filter and can be
  reset from the Studio.
- **Stripe Radar** fraud screening is switched on in the Stripe dashboard before launch (an owner setting, not code).

## 4. Readiness checks

The review card shows each check as ✅ or ⚠️ with the reason. **Approve** needs every check except the last two to pass.

1. **Image:** both sizes processed; the card renders in light and dark mode.
2. **Words:** name and description within their lengths, no real brand names, nothing caught by the word filter.
3. **Placement:** tab, slot, style lines and presentation set, and valid for the tab.
4. **Price:** a C$ price above 0, or, for real money, a test-mode Stripe price and an edition size.
5. **No duplicate:** no other item with the same name.
6. **Clout:** set, with a warning (not a block) when it's more than 20% off the live curve.
7. **Wearable or placeable** (shown, not a block): clothing and accessories say "Wearable" or "Locked: needs the
   long_coat template"; home pieces say whether their 3D piece exists. **A locked item can be approved: it shows in the
   Shop with a 🔒 "Coming soon to your wardrobe" note and can't be bought until its template or piece exists**
   (owner, Oct 21: "Let the clothes show but be locked if they aren't wearable"). It unlocks by itself when its
   template ships.

Every action (import, edit, approve, schedule, retire, restore, delete, price change) is written to the audit log with
who, when, and the values before and after.

## 5. Build stages

Each stage is its own pull request with a preview link (the owner's order, Oct 21).

| Stage | What ships | Done when |
| --- | --- | --- |
| 1. Shop Manager and images | The Shop catalog moves into the database (items on sale today come in as `live`); the Studio's **Shop** tab with every section above; image processing to Supabase Storage; images replace the emoji on the live items (fashion, home, cars, houses, luxury and makeup); the Accessories tab; the Clout Couture row at the top of Luxury; style chips in Fashion; locked items; the chinchilla at $16.99; the batch files imported as drafts for review | The owner imports a batch file, approves an item and sees it in the Shop with its image |
| 2. New base bodies | The bald base bodies (owner to supply), recolored for skin tone, with the game's hair, headwear and coverings on top; the four body types; files cut to about 0.5 MB each; a **low-graphics mode** (on by itself on weak phones, plus a Settings switch). Behind a preview switch only the owner sees | The bodies walk, sit and wave in the preview at every body type, on a low-end phone |
| 3. The hoodie | The first garment template, made from the body's own surface so it bends with every pose and body type, in both presentations | A hoodie looks right walking, sitting and lying down on all eight body types |
| 4. The rest of the wardrobe | The remaining garment templates, then rigid accessories (hats, glasses, earrings, necklaces, bags, watches); each item unlocks as its template passes. New templates for every item players already own (the 22 clothing pieces and 11 outfit sets). The style mechanics: "Complete your look", the venue-match Confidence boost, the Full look badge and style daily tasks (a budget piece counts the same as a luxury one). **The new bodies switch on for everyone** once everything players own has a template | Every owned item renders on the new bodies; the switch is on |
| 5. Clout Couture | Non-wearables first (the Cloud Nine Sofa, the Self-Portrait Statue, the Velocity Veloce), then the wearables (suit, heels, shades, watch, crown, 24k Glow). The yacht, jet and plaza statue need map placement and 3D models and come after. The Waterfront Mansion and Billionaire's Row come later (owner, Oct 21) | A test-mode purchase of each piece grants it, numbers it and a refund takes it back |

**Stage 2 as built (Oct 21):** the owner's bald masters live in `assets/avatars/` (never served); `node
scripts/build-base-avatars.mjs` makes the game's copies in `public/avatars/body/` (`m.glb`, `f.glb` about 0.53 MB, 12k
triangles, 1024 px skin; `m-low.glb`, `f-low.glb` about 0.35 MB, 6k triangles, 512 px). `components/avatar/baseAvatar.ts`
recolors the skin, paints the outfit colors on the body's own underwear (until stage 3's templates), sizes the game's hair
and headwear to the head, makes the idle from the walk, and drives the game's sit, lie down and dance poses (the owner
approved them in `/preview/moves`, Oct 21). Low graphics (`lib/graphics.ts`): the low files, no shadows, no antialiasing
and 1x pixels in rooms, the avatar viewer and the map; on by itself only on clearly weak phones (2 GB or 2 cores),
otherwise Settings → Low graphics. The new bodies are a per-device switch in Studio → Shop (`?bodies=new` for one visit).

**Stage 3 as built (Oct 21):** garment templates are made by `scripts/garments.mjs` (run by
`scripts/build-base-avatars.mjs`) from the bald masters' own surface in the bind pose: a keep function marks the
garment (the hoodie: hem at the top of the legs, cuffs at the wrists, a collar around the neck measured from its shape,
under the chin), the cut is clipped exactly on its edges, smoothed into fabric and pushed 1.2 cm (sleeves) to 1.7 cm
(body) off the skin, and keeps the body's skin weights, so it bends with every pose, animation and body type. The hood
(rolled down, bunched at the back) and drawstrings are added as parts. Details are drawn by the game's shader from
`_PAT` (ribbed hem and cuffs, the kangaroo pocket, the hood a shade off, drawstrings in the outfit's accent, a darker
inside). Files: `public/avatars/garments/hoodie-m.glb`, `hoodie-f.glb` (about 0.12 MB) and `-low` versions. Each body
vertex carries `_COVER` bits, so skin under a worn garment isn't drawn (no poke-through). The game wears a template when
the outfit's top has one (`GARMENT_TEMPLATES` in lib/avatarCatalog.ts); `/preview/moves?outfit=hoodie` shows it on all
eight body types. Shop items that need the hoodie template stay locked until stage 4 unlocks items as the new bodies
switch on.

**Polish after the owner's review (Oct 21: "The avatars and outfits look a little botched"):** the game's old cartoon
hair sat on the new heads like a helmet, so every hairstyle is now grown from each body's own scalp by
`scripts/hair.mjs` (into `public/avatars/hair/<m|f>[-low].glb`, one mesh per style and one for its lengths): a hairline at
the forehead, temples and nape, the ears left bare, thickness by style (more at the crown; curls bumpy), and lengths
(long hair to the shoulder blades, a ponytail, a bun, two braids, locs) that drape off the body. Full coverings hide it;
under a cap or hat only the lengths show. The hoodie's rib bands only follow the hem and cuffs (tiny gaps in the master
had drawn ovals), its details are drawn from the finished surface (straight pocket lines), its skin weights are
softened and it hugs the shoulder joints. The baked basics are calmer (half the texture's shading) and the shins' baked
socks take the shoe color (no dark band above the shoes). `/preview/moves?outfit=hair` shows every hairstyle.

**New bodies and animations (Oct 21, assets/avatar-animations.json version 2):** the bodies are now the owner's bald,
barefoot ones in a flat grey base layer, with 6 clips each (idle, run, sit, sleep, dance, wave; the male dance is Hip Hop
Dance 1, the female All Night Dance). `npm run avatars:fetch` downloads them into `assets/avatars/sources/` (git ignores
it: never commit or ship the raw files) and `npm run avatars:build` makes everything in `public/avatars/` from them:
the bodies (about 0.53 MB, low 0.33 MB), every garment template and hairstyle, and one animation file per body
(`m-anims.glb`, `f-anims.glb`, about 0.35 MB: the walk and every clip). The clips were rigged on their own, so their
bind poses and bone lengths differ a little from the body's; `scripts/retarget.mjs` moves each one over in world space
(each bone's turn from its own bind pose, put on the body's), keeping the body's bone lengths and scaling the hips'
movement, and refuses a clip whose bones are named or joined differently (none were). The earlier fixes hold: padded
texture islands, matte materials (roughness 0.9, metalness 0), the base layer never recolored (only the skin tone and
the brows), and body types never scale or turn the head or neck: `lib/bodyTypes.ts` works out how each vertex of the
body and its clothes moves to be wider (the torso from the spine, arms and legs from their bones) and the shader adds it
before skinning; height scales the whole figure. Barefoot bodies wear sneakers unless the outfit has boots; a whole Shop
outfit wears its pieces until stage 4's sets. Where each clip plays (owner, Oct 21: "go"): standing is the idle; sitting on a seat, sofa,
bench or in class is the sit clip and lying in a bed the sleep clip, both put on the seat or mattress by `poseSit` and
`poseLie` (`AvatarParts.pose`); dance floors play the dance clip; a tap on a regular or a player is a hello (they wave,
and you wave back if you're standing); a walk longer than 5 m in a room is a jog (the run clip, twice the speed). The
female sit was made for a high stool and put her shins through seats, so she sits with the male clip
(`BORROW` in scripts/build-base-avatars.mjs).  Whole Shop outfits (Oct 21, "go"): each of the 11 sets is the game's own templates in its colors with its
own details and hat (`SET_LOOKS` in lib/avatarCatalog.ts), no longer a character from the old pack: two new templates
(`gown`, a skirt to the ankle whose front follows the thighs down to the knees and the shins below them, so it drapes
when sitting; `overalls`, worn over the top), details by `GARMENT_DETAILS` (hi-vis bands, ripped knees, dress shoes, a
quilted suit, a plain robe) and hats built in the head's space like the caps (components/avatar/setHats.ts: hard hat,
cowboy, explorer, helmet, witch, hood, space helmet, crown). A faith or culture covering always stays; the hat steps
aside. `/preview/moves?outfit=sets` shows all 11 on both bodies. Shop accessories (Oct 21, "go"): the 22 catalog accessories (hats, the balaclava, glasses, earrings, necklaces, the
choker and scarf, bags, the watch) have shapes and colors in `lib/accessories.ts`; components/avatar/accessories.ts draws
head pieces in the head's space and makes neck, hand and wrist pieces for each body's measurements (`measureBody` in
baseAvatar: neck base, chest, hip, wrist; bags in the right hand at the idle pose), pinned to a bone. A Shop hat steps
aside for a faith or culture covering and beats an outfit's hat; Shop glasses replace the Look's. They stay locked
(wearable false) until the switch-on migration, which also lets save_look take the accessories category.
`/preview/moves?outfit=accessories&pick=a,b` previews them. Shop catalog clothes (Oct 21, "go"): all 62 catalog tops, bottoms, dresses and shoes are worn as templates in their
colors (`lib/catalogWear.ts`): new shapes for a long coat's tails (`coattail`, over the trousers, open at the front),
a `midi` skirt and `kneeboots`; fabric patterns drawn on each garment's own surface in meters (denim, knit, cable, rib,
waffle, tartan, gingham, pinstripe, herringbone, patchwork, panels, contrast sleeves, corset lacing, fishnet, holes,
fur, cargo pockets, ruffles, sandal straps, glowing soles) and finishes (leather, satin, patent, velvet, suede). A dress
fills the top and the bottom. Approximations: shoes keep a flat foot (no heel height), platforms and cropped lengths
are drawn on the template's shape. Cover bits are whole numbers in a float now (more than 16 templates).
`/preview/moves?outfit=catalog&pick=a,b` previews them; Your Look wears them with the switch-on. Switch-on (Oct 21, "go"): migration 0101 unlocks the 84 catalog pieces with shapes (the content files say wearable too,
so a later import keeps them unlocked; the owner still approves each in the Studio), files wearable accessories as
fashion, and makes a dress a top and a bottom (`wear_slots`). Your Look shows Dresses, Shop hats under Hats and a tab per
accessory slot once one is owned; the Shop's Try it on and Wear work for catalog pieces. The new bodies are the default
(lib/graphics.ts); Studio → Shop's switch takes one device back to the old ones. New clips must be made on these bodies
(same 24 bones); add them to the JSON file and rebuild.
