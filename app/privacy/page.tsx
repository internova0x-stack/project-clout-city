import Link from "next/link";

export const metadata = { title: "Privacy Policy · Clout City" };

// Privacy Policy (owner, Oct 27): written from what the game stores and sends (lib/, supabase/migrations/), the
// consent banner (PostHog), Delete my account (migration 0124) and the gap analysis (GDPR/UK GDPR,
// ePrivacy, US state privacy laws, COPPA). Company details and retention from the owner (Oct 27); counsel should review.
export default function Privacy() {
  return (
    <main className="legal">
      <p><Link href="/">‹ Back to Queens</Link></p>
      <h1>Privacy Policy</h1>
      <p>Effective: October 27, 2026</p>
      <p>
        This policy explains what Internova Technologies Inc (&quot;Clout City&quot;, &quot;we&quot;, &quot;us&quot;)
        collects when you play Clout City NYC, why, who we share it with, and the choices and rights you have. We are the
        controller of your personal data. Contact: <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a>, 431 Woodcrest Dr SE, Washington, DC 20032.
      </p>

      <h2>1. The short version</h2>
      <ul>
        <li>We collect what we need to run the game: your email, your character and how you play.</li>
        <li>Other players see your in-game name, look and game activity, never your email.</li>
        <li>Analytics and session replays only run if you tap Accept; what you type and your chats are never recorded.</li>
        <li>We don&apos;t sell your data or use it for targeted advertising.</li>
        <li>You can delete your account and everything in it, any time, in Settings.</li>
      </ul>

      <h2>2. What we collect</h2>
      <p><strong>Account</strong></p>
      <ul>
        <li>Your email address and sign-in method (email link or code, or Google), and sign-in session cookies.</li>
        <li>That you passed our age check, and when. We ask for your date of birth at sign-up but don&apos;t store it. If it shows you&apos;re under 18, sign-up closes on that device (a cookie and browser storage remember it for a year).</li>
        <li>The invite link or creator link or code you joined through, if any.</li>
      </ul>
      <p><strong>Your character and play</strong></p>
      <ul>
        <li>Your in-game name, look, style, traits and &quot;what kind of New Yorker&quot; you picked.</li>
        <li>Game progress: virtual cash and clout (with a record of every change), items, home and furniture, places you visit in the game, tasks, goals, skills, rank, businesses, campus, hunts, gossip, lotto cards, badges, story choices, and the choices you make on situation cards with your Integrity (private: never shown to other players).</li>
        <li>Social features: your crew, crushes and dates, relationships, sublets, home visits and together plans.</li>
      </ul>
      <p><strong>What you send or post</strong></p>
      <ul>
        <li>Chats with other players (direct, party and home-visit chat), with reactions and when they were sent.</li>
        <li>Letters to the Mayor (our feedback inbox), with where you were in the game and your device type, so we can fix bugs.</li>
        <li>Real Clout FM shoutouts and Clout TV photos, with the Instagram handle you add to them.</li>
        <li>Notes on Jobs and sublet listings, and reports you make about other players.</li>
      </ul>
      <p><strong>Purchases</strong></p>
      <ul>
        <li>What you bought, the amount, currency, status, and your Stripe customer and payment ids. Stripe handles your card; we never see or store card details.</li>
      </ul>
      <p><strong>Device and technical</strong></p>
      <ul>
        <li>Push notifications (if you turn them on): your browser&apos;s push address and keys, and your time zone, so we don&apos;t notify you at night.</li>
        <li>Server logs from our hosting, which include IP addresses, browser and request details, kept for security and troubleshooting.</li>
        <li>Settings stored on your device, such as low graphics, music and whether you&apos;ve seen the tour.</li>
      </ul>
      <p><strong>Analytics (only if you accept)</strong></p>
      <ul>
        <li>Pages and screens you open, buttons you tap, and game moments such as signing up, finishing a task, paying rent, buying something or sending a message (that one was sent, never what it said). This is linked to a random account number, not your email or name.</li>
        <li>Session replays: a recording of how the game screen changed (taps, scrolling, screens). Everything you type is masked on your device before it&apos;s sent, and so are chats, Mayor letters, shoutouts and notes.</li>
      </ul>
      <p>We don&apos;t collect your precise location; places on the map are places in the game.</p>

      <h2>3. Why we use it, and on what legal basis</h2>
      <ul>
        <li><strong>To run the game and your account</strong> (performing our contract with you): sign-in, saving progress, multiplayer features, chats, purchases and support.</li>
        <li><strong>To keep players safe and the game fair</strong> (our legitimate interests, and legal obligations): moderation, reports, bans, fraud and cheat prevention, security.</li>
        <li><strong>To improve the game</strong> (your consent for analytics and session replays; our legitimate interests for basic server logs and Mayor letters).</li>
        <li><strong>To send push notifications</strong> (your consent, given in your browser; turn them off in Settings any time).</li>
        <li><strong>To keep purchase records</strong> (legal obligation: tax and accounting).</li>
      </ul>
      <p>We don&apos;t make decisions about you based solely on automated processing that have legal or similarly significant effects.</p>

      <h2>4. What other players see</h2>
      <ul>
        <li>Your in-game name, look, style, rank, badges, crew, player card, and that you&apos;re at a place in the game.</li>
        <li>&quot;Dating @name&quot; on your card if you&apos;re in a relationship (you can hide it), and your sublet listings and ratings.</li>
        <li>Your chats with them, and party or home-visit chat with the people there.</li>
        <li>Shoutouts and Clout TV photos after our team picks them, and your name in leaderboards and Lola&apos;s &quot;Spotted at&quot; lines (opt out in Settings).</li>
        <li>Never your email, purchases, Mayor letters or reports.</li>
      </ul>

      <h2>5. Who we share it with</h2>
      <p>We share personal data only with providers that help run Clout City, under contracts that limit their use of it:</p>
      <ul>
        <li><strong>Supabase</strong>: accounts, sign-in, database and file storage.</li>
        <li><strong>Vercel</strong>: hosting and delivery of the website.</li>
        <li><strong>Stripe</strong>: payments, subscriptions, receipts and fraud prevention.</li>
        <li><strong>PostHog</strong>: analytics and session replays, only if you accept.</li>
        <li><strong>Our email delivery provider</strong>: sending sign-in links and codes.</li>
        <li><strong>Your browser&apos;s push service</strong> (for example Apple, Google or Mozilla): delivering notifications you turned on.</li>
      </ul>
      <p>
        Creators whose link or code you used see only counts (sign-ups, purchases, their commission), never who you are.
        We may disclose data if the law requires it, to protect people&apos;s safety, or as part of a sale or merger of our
        business (and we&apos;d tell you). We don&apos;t sell personal data or share it for cross-context behavioral
        advertising.
      </p>

      <h2>6. Cookies and similar technology</h2>
      <ul>
        <li><strong>Necessary:</strong> sign-in session cookies; a cookie that remembers an invite or creator link you followed (30 days) or your 18+ confirmation during Google sign-in (1 hour); settings stored on your device.</li>
        <li><strong>Analytics (optional):</strong> PostHog&apos;s cookie and browser storage with a random ID, only after you tap Accept on the banner. Tap Reject, or turn off Settings → Analytics and session replay, and none are set or sent. Logging out starts a new, unlinked ID.</li>
      </ul>
      <p>We don&apos;t use advertising cookies.</p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li><strong>Your account and game data:</strong> while your account exists. When you delete your account, it&apos;s deleted right away from the game&apos;s database, along with your Clout TV photos.</li>
        <li><strong>Backups:</strong> deleted data can remain in encrypted backups for up to 30 days before they&apos;re overwritten.</li>
        <li><strong>Purchase records:</strong> Stripe keeps payment records as long as tax and accounting law requires (typically 7 years). Creator commission records are kept without any link to you.</li>
        <li><strong>Analytics:</strong> up to 12 months. <strong>Session replays:</strong> up to 90 days. Both are deleted when you delete your account.</li>
        <li><strong>Server logs:</strong> up to 30 days.</li>
        <li>We keep only a count of deleted accounts (when, and whether they&apos;d made a purchase), never who.</li>
      </ul>

      <h2>8. Your choices and rights</h2>
      <ul>
        <li><strong>Delete:</strong> Phone → Settings → Delete my account, any time. It&apos;s immediate and permanent.</li>
        <li><strong>Analytics:</strong> accept or reject on the banner, and change it any time in Settings.</li>
        <li><strong>Notifications, gossip mentions, who can message you:</strong> in Settings.</li>
        <li><strong>Access, a copy, correction, restriction or objection:</strong> email <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> from the address on your account. We answer within one month (EU/UK) or 45 days (US states), and may need to confirm it&apos;s you.</li>
        <li><strong>EU, UK and EEA:</strong> you also have the right to data portability, to withdraw consent at any time (without affecting earlier processing), and to complain to your data protection authority.</li>
        <li><strong>US state privacy laws</strong> (such as California): you have the right to know, access, correct and delete your personal information, and not to be discriminated against for using these rights. We don&apos;t sell or share personal information for targeted advertising, so there&apos;s nothing to opt out of. An authorized agent may ask for you with your permission.</li>
      </ul>

      <h2>9. Children</h2>
      <p>
        Clout City is for adults 18 and older. We don&apos;t knowingly collect personal data from anyone under 18, and we
        never knowingly collect data from children under 13. If you believe a minor has an account, tell us at <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> and
        we&apos;ll delete it.
      </p>

      <h2>10. International transfers</h2>
      <p>
        We and our providers process data in the United States and other countries. When personal data from the EU, UK or
        EEA is transferred, we rely on appropriate safeguards such as the European Commission&apos;s Standard Contractual
        Clauses and the UK addendum.
      </p>

      <h2>11. Security</h2>
      <p>
        Data travels over encrypted connections. Each player can only reach their own data, private photos stay in
        private storage until they&apos;re picked, and payments are handled by Stripe. No system is perfectly secure; if a
        breach affects your data, we&apos;ll tell you and the authorities as the law requires.
      </p>

      <h2>12. Changes</h2>
      <p>
        We&apos;ll update this policy as the game changes. For material changes we&apos;ll tell you in the game or by email
        before they take effect.
      </p>

      <h2>13. Contact</h2>
      <p>
        Internova Technologies Inc, 431 Woodcrest Dr SE, Washington, DC 20032. Email: <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a>.
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </main>
  );
}
