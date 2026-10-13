import type { ReactNode } from "react";
import type { BottomKind, TopKind } from "@/lib/styles";

/** Flat garment shapes (60×56 viewBox) for tiles in the creator and Your Look. Fill sets the color. */
export const GARMENT: Record<TopKind | BottomKind, ReactNode> = {
  puffer: <><path d="M14 10 L24 6 L36 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 Z" /><path d="M18 20 H42 M18 30 H42 M18 40 H42" stroke="#fff" strokeWidth="2.4" fill="none" opacity=".55" /></>,
  hoodie: <><path d="M22 6 Q30 0 38 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 L14 10 Z" /><path d="M24 7 Q30 16 36 7" stroke="#fff" strokeWidth="2.2" fill="none" opacity=".6" /></>,
  zip: <><path d="M14 10 L24 6 L36 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 Z" /><path d="M30 8 V50" stroke="#fff" strokeWidth="2" opacity=".7" /></>,
  cardigan: <><path d="M14 10 L24 6 L30 14 L36 6 L46 10 L52 36 L44 38 L42 22 L42 50 L18 50 L18 22 L16 38 L8 36 Z" /><circle cx="30" cy="24" r="1.6" fill="#fff" opacity=".7" /><circle cx="30" cy="34" r="1.6" fill="#fff" opacity=".7" /></>,
  vest: <><path d="M20 6 L30 22 L40 6 L44 12 L42 50 L18 50 L16 12 Z" /></>,
  crop: <><path d="M16 12 L24 8 L36 8 L44 12 L48 26 L42 27 L41 20 L41 32 L19 32 L19 20 L18 27 L12 26 Z" /></>,
  blazer: <><path d="M14 10 L24 6 L30 26 L36 6 L46 10 L52 36 L44 38 L42 22 L42 50 L18 50 L18 22 L16 38 L8 36 Z" /><path d="M24 6 L30 26 L36 6" stroke="#fff" strokeWidth="2" fill="none" opacity=".5" /></>,
  tee: <><path d="M14 10 L24 6 L36 6 L46 10 L52 20 L44 24 L42 20 L42 50 L18 50 L18 20 L16 24 L8 20 Z" /></>,
  pants: <path d="M18 4 H42 L44 52 H33 L30 18 L27 52 H16 Z" />,
  shorts: <path d="M18 10 H42 L45 38 H33 L30 22 L27 38 H15 Z" />,
  skirt: <path d="M21 10 H39 L48 44 H12 Z" />,
  leggings: <path d="M20 4 H40 L39 52 H32 L30 16 L28 52 H21 Z" />,
};
