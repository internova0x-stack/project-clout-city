# Voice rules for characters and generated content

Culture pack C1 (owner, Oct 20). These apply to every character line, City News item, Tea card, hunt line and
story beat, whether a person writes it or the weekly content routine drafts it (docs/WEEKLY-CONTENT.md).
They sit on top of the house rules in docs/CAST.md ("Writing for the cast").

## Everyone

- **No phonetic accent spelling.** Write what people say, not how an accent sounds ("coffee", never "cawfee").
  Slang's own spelling is fine ("buggin'", "wildin'", "fuhgeddaboudit").
- **Slang belongs to everyone.** Any character can use any term from `content/culture/slang.json`, whatever
  their background. A profile's `slang` list is what that person reaches for; an empty list is fine.
  Not everyone uses slang (owner, Oct 20).
- **Vary backgrounds within a building type.** Not every bodega owner, cabbie or doctor comes from the same place.
  Astoria leans Greek, Egyptian, Brazilian and Colombian, with many others.
- **No group only in service or villain roles.** Each background shows up as owners, professionals and
  neighbors too (`tests/culture.test.ts` checks the four Astoria groups).
- **Texture, not punchlines.** Communities come through food, festivals, language and named people with real
  personalities. Satirize attitudes, never identities. Police are played for laughs (owner, Oct 30): Moral Choices can land you in holding at the
  114½ Precinct with Sgt. Bev; keep it comic, never menacing or about real policing.
- **Invented names only.** Use `content/culture/parody-names.json` for teams, the transit card, museums,
  trademarked landmarks, celebrity restaurants and brands. Real landmarks and streets are fine.
- **Weather words follow the real calendar.** "Brick" and puffer-jacket jokes only in the cold months
  (about December to February).

## Character lines

- Draw on the person's profile in `content/culture/npcs.json`: their personality, likes, dislikes and slang.
- 240 characters or fewer (the Studio's limit). One idea per line.

## Lola Lowdown

Everything in docs/CAST.md "Voices" still holds (the tea queen, on the player's side, "babe", "darling" or
"sweetie" at most once per line).
- **Less slang (owner, Oct 26): mostly TMZ, a little Shade Room.** She writes like a celebrity-news desk: "BREAKING",
  "developing", "sources tell me", "we're told", "insiders say", "we reached out for comment", "on the record". A
  little Shade Room on top: a 👀, a "chile" or a raised eyebrow now and then, never every line. **At most one slang
  term per message** from the slang dictionary, and none is fine (this replaces C1's "one or two", Oct 20). Don't
  call the player "Roommates": the game has real roommates.
- **Short in onboarding:** three brief sentences, as a rule. The guide's arrival line keeps its four (owner, Oct 20).
- Never a cultural label or a slur for the player.
- Always teases what's next: a shift, a goal, a piece of tea.

The tour and the daily-tasks nudge (`components/game/Tutorial.tsx`) follow the slang rule; `tests/culture.test.ts`
checks it.
