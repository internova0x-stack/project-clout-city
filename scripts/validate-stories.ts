// Validates every story in content/stories. Usage: npm run validate:stories
import { loadArcs } from "../lib/storyContent.ts";
import { validateArcs } from "../lib/storyValidation.ts";

const arcs = loadArcs();
const errors = validateArcs(arcs);
for (const a of arcs) console.log(`${a.status === "active" ? "✓" : "·"} ${a.id} (${a.type}, ${a.beats.length} beats${a.start_at ? `, starts ${a.start_at}` : ", not scheduled"})`);
if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\nAll stories valid.");
