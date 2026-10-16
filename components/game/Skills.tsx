"use client";

import { MAX_LEVEL, RUST_LINE, SKILLS, levelProgress, type SkillState } from "@/lib/skills";

/** The profile's Skills tab (owner, Oct 16): each skill's level as ten segments, with how to train it. */
export function SkillsList({ skills }: { skills: SkillState[] }) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  return (
    <div className="stack-12">
      <div className="skills-grid">
        {SKILLS.map((def) => {
          const s = byId.get(def.id) ?? { id: def.id, level: 0, best: 0, practice: 0, rusty: false };
          const part = s.level < MAX_LEVEL && !s.rusty ? levelProgress(s.practice) : 0;
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
            </div>
          );
        })}
      </div>
      <p className="meta" style={{ margin: 0 }}>{RUST_LINE}</p>
    </div>
  );
}
