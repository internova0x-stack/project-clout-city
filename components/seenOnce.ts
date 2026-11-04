// "Once per event per device" for celebrations that a poll or a reopened sheet would otherwise show again (owner, Nov 4:
// gifts, Market deals, asset handovers, Pablo's extras, leaving holding). Each scope keeps the last keys it showed in
// local storage (`cc-seen:<scope>`); private mode or blocked storage falls back to this tab's memory.

const MAX = 120;
const memory = new Map<string, string[]>();

function read(scope: string): string[] {
  try {
    const raw = localStorage.getItem(`cc-seen:${scope}`);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* none */ }
  return memory.get(scope) ?? [];
}

/** True the first time this device sees `key` in `scope` (and remembers it); false ever after. */
export function firstTime(scope: string, key: string): boolean {
  const list = read(scope);
  if (list.includes(key)) return false;
  const next = [...list, key].slice(-MAX);
  memory.set(scope, next);
  try { localStorage.setItem(`cc-seen:${scope}`, JSON.stringify(next)); } catch { /* private mode */ }
  return true;
}

/** Recent enough to celebrate (an old deal seen for the first time on a new device stays quiet). */
export const recent = (at: string | null | undefined, days: number, now = Date.now()) =>
  !!at && now - Date.parse(at) <= days * 86_400_000;
