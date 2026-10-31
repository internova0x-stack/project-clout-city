// Moral Choices' cards (content/choices/*.json), for the server's actions and the preview's in-memory city. Import it
// only there: the files hold every outcome, its odds and what comes back later, so a player's bundle never carries them.

import BUSINESS from "../content/choices/business.json";
import CLIMB from "../content/choices/climb.json";
import DATING from "../content/choices/dating.json";
import GIGS from "../content/choices/gigs.json";
import HOME from "../content/choices/home.json";
import LIFE from "../content/choices/life.json";
import MONEY from "../content/choices/money.json";
import NIGHTLIFE from "../content/choices/nightlife.json";
import SCHOOL from "../content/choices/school.json";
import TRANSIT from "../content/choices/transit.json";
import WORK from "../content/choices/work.json";
import type { ChoiceCard } from "./choices";

export const CHOICE_CARDS: ChoiceCard[] = [
  ...LIFE, ...TRANSIT, ...GIGS, ...WORK, ...SCHOOL, ...BUSINESS, ...HOME, ...NIGHTLIFE, ...DATING, ...MONEY, ...CLIMB,
] as ChoiceCard[];
