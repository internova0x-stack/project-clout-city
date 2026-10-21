# Clout City: Fashion Style Lines

The owner's fashion plan (Oct 21), saved from "Clout City: Fashion Style Lines". The Shop Manager
(`docs/shop-manager.md`) applies it; where that file goes into more detail, it wins.

Each fashion style becomes a **style line**: a tag on items, alongside the price tier. Every fashion item has a
category, a tier and one or more style lines.

## The style lines

Eight lines: the seven core styles, plus **Streetwear**, essential for a New York game and matching the Bodega Drip
starting style. Each starting style maps to a line, so players arrive with a look and can grow into others. A ninth
tag, **Wasteland Luxe** (the distressed-luxury look of shop batch 4), sits under Luxury and Avant-garde.

| Style line | Starting style | Key pieces | Palette and materials | Where it shines |
| --- | --- | --- | --- | --- |
| Streetwear | Bodega Drip | Hoodies, puffers, cargos, fresh sneakers, caps | Bold blocks, nylon, fleece | Bodega, park, the block |
| Gothic | Night Owl Goth | Long coats, platform boots, mesh, corset tops, silver chains | Black, oxblood, leather, lace | Club, late-night spots |
| Nerdy / Preppy | Arcade Nerd | Cardigans, polos, pleated skirts, chinos, loafers, round glasses | Navy, plaid, cable knit | Library, arcade, campus |
| Sporty | Pilates Princess | Track jackets, matching sets, leggings, joggers, runners | Pastels and neons, technical fabrics | Gym, park, smoothie bar |
| Business Casual | Midtown Finance, Startup Founder | Blazers, button-downs, trousers, quarter-zips, loafers | Greys, camel, crisp cotton | Office tower, rooftop lunch |
| Fashionista | Influencer Soft Glam | Crop tops, wide-leg trousers, mini bags, heels, statement sunglasses | Soft glam neutrals, satin | Rooftop restaurant, events |
| Luxury | Grown into, not a starting style | Cashmere coats, tailored sets, fur-look pieces, fine watches | Cream, black, gold accents | Lounge, exclusive events |
| Avant-garde | Thrift Store Icon | Sculptural jackets, asymmetric cuts, oversized layers, unusual shoes | Clashing textures, raw edges | The art space, gallery nights |

- Thrift Store Icon maps to Avant-garde because both are about unexpected combinations. Vintage thrift pieces can also
  be budget items in any line.
- **Luxury works two ways:** it's a style line (quiet luxury, old money), and the top price tier exists in every line.
  A luxury goth coat is Gothic at the luxury tier.
- Style lines are for everyone; each item still fits one presentation or both (owner, Oct 21: clothes are gender
  based; the defaults are in `docs/shop-manager.md` section 2).

## Making styles matter in play (stage 4)

| Mechanic | How it works |
| --- | --- |
| Venue match | Wearing at least 2 pieces of a style that fits a venue (Gothic at the club, Sporty at the gym) gives a small Confidence boost there, once a day |
| Full look | 3 or more pieces from one line shows "Full Goth look" (and so on) on the profile, and earns a badge the first time |
| Style tasks | Some daily tasks ask for a look, e.g. "Wear a full Business Casual look to the office tower" |
| Fairness | A budget piece counts exactly as much as a luxury or collector piece toward these bonuses, so real money never buys an advantage |

These arrive in stage 4, once each line has at least 3 wearable pieces. Stage 1 ships the style chips in the Shop's
Fashion tab.

## Templates and launch catalog

**Garment templates.** Each template is made once per presentation and adjusts to all four body types. Templates are
shared across lines, so styles come mostly from textures and colors. About 22 templates cover every line; the shared
ones come first.

| Template | Used by |
| --- | --- |
| Hoodie, puffer, cargo, sneakers, cap | Streetwear, Sporty |
| Long coat | Gothic, Luxury, Business Casual |
| Blazer, trousers, loafers | Business Casual, Nerdy / Preppy, Luxury |
| Cardigan, polo, pleated skirt | Nerdy / Preppy |
| Track jacket, leggings, joggers | Sporty |
| Corset top, platform boots, mesh layer | Gothic, Avant-garde |
| Crop top, wide-leg trousers, heels | Fashionista |
| Oversized sculptural jacket | Avant-garde |

**Launch fashion catalog:** about 40 items, so every line has something at each price: per line, 2 budget, 2 mid and
1 luxury. Collector pieces in 3 or 4 lines (Gothic, Fashionista, Luxury and Avant-garde suit them best). Weekly drops:
2 to 3 new pieces per line.

## Shop art style

**Chosen style:** low-poly, flat-shaded 3D product shots, matching the blocky avatar and the low-poly landmarks. Every
Shop image follows the same template, with the approved sample (the magenta satin bomber) as the style reference:

> Game shop item icon: [item, colors and materials] as a low-poly, flat-shaded 3D model with crisp facets, isometric
> three-quarter view, soft warm lighting, plain cream background with a faint floor shadow. Clean, minimal video game
> asset style. Single item only, centered, no person, no mannequin, no logos, no text, no brand names.

**Processing:** remove the background, resize to 256 px (cards) and 768 px (detail view), and convert to WebP at about
80% quality. Players never download the full-size masters. (`lib/shopImages.ts` does this when the Studio imports a
catalog file.)

## Shop and Higgsfield workflow

- **In the Shop:** style chips in the Fashion tab (All, Streetwear, Gothic, Nerdy / Preppy, Sporty, Business Casual,
  Fashionista, Luxury, Avant-garde); a "Complete your look" row suggesting pieces that finish an outfit the player has
  started (stage 4).
- **In Higgsfield:** one moodboard reference per line, so each line has a consistent feel while every product shot
  keeps the same studio style; a prompt template per line covering palette, materials and silhouettes, always ending
  with "no logos, no text, no brand names." For Luxury especially: no recognizable monograms or signature patterns from
  real fashion houses.
- **Invented fashion houses** add flavor and tie into the cast: **Vale Sartorio**, the avant-garde designer behind
  runway drops, and **Duke Ledger**, whose personal watchmaker made the Ledger Tourbillon (docs/CAST.md).
