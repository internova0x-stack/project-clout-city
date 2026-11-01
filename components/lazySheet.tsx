"use client";

import { Suspense, lazy, useState, type ComponentType } from "react";

// Speed on cheap phones (owner, Nov 1): a sheet that opens only on a tap is downloaded the first time it opens, not
// with the game. Until then it renders nothing; after that it stays mounted so its closing animation plays as before.
// `prefetchSheets()` fetches them all once the game has been idle for a while, so a tap later is instant.

const loaders: (() => Promise<unknown>)[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazySheet<P extends object>(load: () => Promise<ComponentType<P>>, isOpen: (p: P) => boolean = (p) => !!(p as any).open): ComponentType<P> {
  let once: Promise<ComponentType<P>> | null = null;
  const get = () => (once ??= load());
  loaders.push(get);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Inner = lazy(async () => ({ default: (await get()) as ComponentType<any> }));
  function LazySheet(props: P) {
    const open = isOpen(props);
    const [seen, setSeen] = useState(open);
    if (open && !seen) setSeen(true);
    if (!seen && !open) return null;
    return (
      <Suspense fallback={null}>
        <Inner {...props} />
      </Suspense>
    );
  }
  return LazySheet;
}

let prefetched = false;
/** Downloads every lazy sheet in the background, one at a time, while the browser is idle. */
export function prefetchSheets() {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;
  const idle = (fn: () => void) => ("requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 200));
  const next = (i: number) => {
    if (i >= loaders.length) return;
    idle(() => { loaders[i]().catch(() => {}).finally(() => next(i + 1)); });
  };
  next(0);
}
