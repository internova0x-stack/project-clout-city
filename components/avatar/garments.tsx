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

/** #18 (owner, Oct 14): shoes and headwear drawn in their own colors, so tiles match the avatar. */
export const SHOE: ReactNode = <><path d="M6 34 Q6 22 16 22 L26 24 Q34 30 46 31 Q56 33 56 40 L56 44 L6 44 Z" stroke="rgba(30,26,40,.55)" strokeWidth="1.6" /><path d="M6 46 H56" stroke="rgba(30,26,40,.55)" strokeWidth="3" /><path d="M24 26 L30 30 M28 24 L34 28" stroke="rgba(30,26,40,.45)" strokeWidth="1.6" /></>;
export const HAT: Record<string, ReactNode> = {
  cap: <><path d="M14 34 Q14 14 32 14 Q48 14 48 34 Z" /><path d="M44 32 Q56 33 58 38 L44 38 Z" /></>,
  fedora: <><ellipse cx="30" cy="38" rx="27" ry="6" /><path d="M16 37 Q16 14 30 14 Q44 14 44 37 Z" /><path d="M16 31 H44" stroke="#fff" strokeWidth="2.4" opacity=".55" /></>,
  bucket: <><path d="M18 18 Q30 12 42 18 L46 34 H14 Z" /><path d="M8 34 H52 L48 40 H12 Z" /></>,
  durag: <><path d="M14 36 Q14 12 30 12 Q46 12 46 36 Z" /><path d="M42 30 Q52 40 50 50 L44 48 Q46 40 40 34 Z" /></>,
  hijab: <path d="M30 8 Q50 8 50 30 L54 52 H6 L10 30 Q10 8 30 8 Z M30 18 Q20 18 20 30 Q20 40 30 40 Q40 40 40 30 Q40 18 30 18 Z" fillRule="evenodd" />,
  turban: <><path d="M12 36 Q10 12 30 10 Q50 12 48 36 Z" /><path d="M16 22 Q30 32 44 20 M14 30 Q30 38 46 28" stroke="#fff" strokeWidth="2" fill="none" opacity=".5" /></>,
  headwrap: <><path d="M12 36 Q12 14 30 14 Q48 14 48 36 Z" /><path d="M26 14 Q30 2 38 8 Q34 12 30 16 Z" /></>,
  kippah: <path d="M14 36 Q16 22 30 22 Q44 22 46 36 Z" />,
};
