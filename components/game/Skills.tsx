"use client";

import { MAX_LEVEL, RUST_LINE, SKILLS, levelProgress, perkReward, perkStatus, perksFor, type PerksState, type SkillPerk, type SkillState } from "@/lib/skills";
import { formatCash } from "@/lib/economy";
import { formatCountdown, useGameNow } from "../city/Common";

/** Skill perks (migration 0092): what the Skills tab and the Gigs app need to act on a perk. */
export interface PerkHandlers {
  state: PerksState;
  clockOffsetSeconds: number;
  busy: string | null;
  onTake: (perkId: string) => void;
  onCollect: (perkId: string) => void;
  onRsvp: (perkId: string) => void;
}

/** The profile's Skills tab (owner, Oct 16): each skill's level as ten segments, with how to train it, and (owner,
    Oct 19) what it gets you at levels 3, 6 and 9: paid gigs, invites and club access. */
export function SkillsList({ skills, perks }: { skills: SkillState[]; perks?: PerkHandlers }) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const now = useGameNow(perks?.clockOffsetSeconds ?? 0);
  return (
    <div className="stack-12">
      <p className="meta skills-intro" style={{ margin: 0 }}>
        Skills open doors. At levels 3, 6 and 9 each one unlocks a paid gig, an invite or club access. A rusty skill counts at its
        level now.
      </p>
      <div className="skills-grid">
        {SKILLS.map((def) => {
          const s = byId.get(def.id) ?? { id: def.id, level: 0, best: 0, practice: 0, rusty: false };
          const part = s.level < MAX_LEVEL && !s.rusty ? levelProgress(s.practice) : 0;
          // Without migration 0092 the perks still show, unlocked by the level the profile knows.
          const state: PerksState = perks?.state ?? { levels: Object.fromEntries(skills.map((x) => [x.id, x.level])) as PerksState["levels"], gigs: [], invites: [] };
          return (
            <div key={def.id} className="skill-row">
              <div className="skill-head">
                <span className="skill-name"><span aria-hidden="true">{def.emoji}</span> {def.name}</span>
                <span className="skill-level">Level {s.level}</span>
              </div>
              <div className="skill-bar" role="meter" aria-label={`${def.name} level`} aria-valuemin={0} aria-valuemax={MAX_LEVEL} aria-valuenow={s.level}>
                {Array.from({ length: MAX_LEVEL }, (_, i) => (
                  <span key={i} className={i < s.level ? "on" : i < s.best ? "best" : ""}>
                    {i === s.level && part > 0 && <i style={{ width: `${Math.round(part * 100)}%` }} />}
                  </span>
                ))}
              </div>
              <span className="skill-how">
                {def.how}
                {s.rusty && s.best > s.level && <b className="skill-rust"> · 🧊 Rusty (best {s.best})</b>}
              </span>
              <ul className="skill-perks" aria-label={`What ${def.name} gets you`}>
                {perksFor(def.id).map((p) => (
                  <PerkRow key={p.id} perk={p} state={state} now={now} handlers={perks} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="meta" style={{ margin: 0 }}>{RUST_LINE}</p>
    </div>
  );
}

function PerkRow({ perk, state, now, handlers }: { perk: SkillPerk; state: PerksState; now: number; handlers?: PerkHandlers }) {
  const status = perkStatus(perk, state, now);
  const open = status !== "locked";
  return (
    <li className={open ? "open" : ""}>
      <span className="skill-perk-lv">{open ? "✓" : `Lv ${perk.level}`}</span>
      <span aria-hidden="true">{perk.emoji}</span>
      <span className="skill-perk-name">{perk.name}<small>{perkReward(perk)}</small></span>
      {handlers && <PerkAction perk={perk} state={state} now={now} handlers={handlers} />}
    </li>
  );
}

/** The button or status for one perk (shared with the Gigs app). Nothing for a locked perk. */
export function PerkAction({ perk, state, now, handlers }: { perk: SkillPerk; state: PerksState; now: number; handlers: PerkHandlers }) {
  const status = perkStatus(perk, state, now);
  const key = `perk:${perk.id}`;
  const busy = handlers.busy !== null;
  const mine = handlers.busy === key;
  switch (status) {
    case "take":
      // One gig at a time: a skill gig on the clock keeps the others waiting (the server checks board gigs too).
      return <button className="btn btn-taxi btn-xs" disabled={busy || state.gigs.some((g) => !g.collected_at)} onClick={() => handlers.onTake(perk.id)}>{mine ? "…" : "Take it"}</button>;
    case "collect":
      return <button className="btn btn-taxi btn-xs" disabled={busy} onClick={() => handlers.onCollect(perk.id)}>{mine ? "…" : `Collect ${formatCash(perk.pay ?? 0)}`}</button>;
    case "rsvp":
      return <button className="btn btn-green btn-xs" disabled={busy} onClick={() => handlers.onRsvp(perk.id)}>{mine ? "…" : "RSVP"}</button>;
    case "working": {
      const g = state.gigs.find((x) => x.perk === perk.id)!;
      return <span className="skill-perk-state">⏱ {formatCountdown(new Date(g.ready_at!).getTime() - now)}</span>;
    }
    case "done": return <span className="skill-perk-state">Done this week</span>;
    case "went": return <span className="skill-perk-state">You went</span>;
    case "on": return <span className="skill-perk-state">On</span>;
    default: return null;
  }
}
