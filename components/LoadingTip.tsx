"use client";

import { useEffect, useState } from "react";
import { LOADING_TIPS } from "@/lib/loadingTips";

export function LoadingTip() {
  // The first tip is fixed so the server and the phone agree; then a random start and a new tip every 3.5 seconds.
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Math.random() * LOADING_TIPS.length));
    const t = setInterval(() => setI((n) => (n + 1) % LOADING_TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);
  return <p className="app-loading-tip" key={i}><b>Lola&apos;s tip</b> {LOADING_TIPS[i]}</p>;
}
