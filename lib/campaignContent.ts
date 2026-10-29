// Campaign Mode's content (content/campaign/*.json), for the server's actions and the preview's in-memory campaign.
// Import it only there: the files hold the hidden odds, so a player's bundle never carries them.

import CANDIDATES from "../content/campaign/candidates.json";
import CITY from "../content/campaign/city.json";
import INBOX from "../content/campaign/inbox.json";
import SITUATIONS from "../content/campaign/situations.json";
import DEBATE from "../content/campaign/debate.json";
import LINES from "../content/campaign/lines.json";
import { buildContent, type CampaignContent } from "./campaign";

export const CAMPAIGN_CONTENT: CampaignContent = buildContent({
  candidates: CANDIDATES as never,
  city: CITY as never,
  inbox: INBOX as never,
  situations: SITUATIONS as never,
  debate: DEBATE as never,
  lines: LINES as never,
});
