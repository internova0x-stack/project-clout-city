import Link from "next/link";

export const metadata = { title: "Terms of Service · Clout City" };

// Terms of Service (owner, Oct 27): written from what the game does (purchases, VIP, player content, Clout TV,
// the lotto, creators, Delete my account) and the gap analysis (FTC / California auto-renewal, EU consumer rights,
// DMCA). Company details from the owner (Oct 27); counsel should review before v1.0.
export default function Terms() {
  return (
    <main className="legal">
      <p><Link href="/">‹ Back to Queens</Link></p>
      <h1>Terms of Service</h1>
      <p>Effective: October 27, 2026</p>
      <p>
        These terms are an agreement between you and Internova Technologies Inc (&quot;Clout City&quot;, &quot;we&quot;,
        &quot;us&quot;) about Clout City NYC, the browser game at this website. By creating an account or playing, you
        agree to them and to our <Link href="/privacy">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t
        use Clout City.
      </p>

      <h2>1. Who can play</h2>
      <ul>
        <li><strong>18 or older only.</strong> Clout City is for adults. We close accounts we believe belong to someone under 18.</li>
        <li><strong>One account per person.</strong> Don&apos;t share, sell or transfer your account.</li>
        <li>You must be allowed to use services like this where you live.</li>
      </ul>

      <h2>2. Your account</h2>
      <p>
        You sign in with a link or code sent to your email, or with Google. Keep your email secure: anyone who can read it
        can sign in as you. You&apos;re responsible for what happens on your account. Tell us at <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> if you
        think someone else is using it.
      </p>

      <h2>3. It&apos;s a game, and it&apos;s satire</h2>
      <p>
        Clout City is a comedy about New York. Its characters, celebrities, businesses, brands and news are fictional;
        any resemblance to real people or companies is unintended. Nothing in the game is advice of any kind.
      </p>
      <p>
        The game is in early access: features may change, pause or end, and things may break. We work to keep your
        account, name, character and crew as the game grows, but we can&apos;t promise any feature, balance or item
        stays the same.
      </p>

      <h2>4. Virtual cash and items (C$)</h2>
      <ul>
        <li>In-game money (&quot;C$&quot; or &quot;virtual cash&quot;), clout, items, homes, businesses and other in-game things have <strong>no real-world value</strong>.</li>
        <li>C$ can&apos;t be bought with real money, sold, traded for real money or anything of value, or transferred outside the game.</li>
        <li><strong>Between players:</strong> you can give another player a Shop item you buy with C$, and pay or be paid C$ for jobs on the
          in-game Jobs board. You can&apos;t send C$ directly. Items bought with real money (VIP, Clout Couture and other real-money
          items) can never be given or traded. These exchanges have limits (account age, rank, a weekly cap), a city fee on job pay
          that goes to no one, and a waiting period before a gift can be sold back or passed on. Every exchange is logged and shown
          to both players, and we may pause an account&apos;s trading, or reverse an exchange, if it looks like abuse or real-money trading.</li>
        <li><strong>Selling a business or a house:</strong> when we switch it on, you can sell a business or a house you own in the game to
          another player for C$, within a range around the game&apos;s appraisal. The buyer&apos;s C$ is held for 24 hours, during which either of
          you can cancel; then the asset changes hands and a 10% city fee is taken from the seller. Rentals, public companies and anything
          bought with real money can&apos;t be sold. There are limits on how often you can sell and how soon you can resell, and we may reverse
          a sale within 7 days if it looks like theft, abuse or real-money trading.</li>
        <li>They&apos;re a limited licence to use in the game, not property you own. We may change how they work, including prices, rewards and rent, to keep the game fair and fun.</li>
        <li><strong>Lucky Star Lotto</strong> and other games of chance in Clout City use virtual cash only. Real money never touches them, and their prizes are virtual only.</li>
      </ul>

      <h2>5. Real-money purchases</h2>
      <p>
        Some extras cost real money: VIP, &quot;Chat forever&quot;, side stories, tickets to exclusive in-game events,
        collector items, postcards and Clout Couture pieces. Prices are shown before you pay, in the game and at
        checkout, including any tax that applies. Payments are processed by Stripe; we never see or store your card. In the
        Steam version, purchases go through Steam&apos;s checkout instead, and Steam&apos;s own refund policy applies to them.
      </p>
      <ul>
        <li><strong>What you get:</strong> a licence to use the item or feature in Clout City for as long as your account exists and the game runs. Clout Couture pieces are numbered limited editions; a number is never reissued.</li>
        <li><strong>Delivery:</strong> digital purchases are delivered to your account right after payment (it can take a minute).</li>
        <li><strong>Refunds:</strong> purchases are final except where the law gives you a right to a refund, or where we choose to give one (for example, if something you bought didn&apos;t arrive or didn&apos;t work). Ask at <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a>. If a payment is refunded, the item or time it paid for is removed.</li>
        <li><strong>Chargebacks:</strong> if you dispute a payment with your bank, we may remove what it paid for while the dispute is open, and close the account if it&apos;s found to be fraudulent.</li>
        <li><strong>EU and UK players:</strong> you normally have 14 days to withdraw from an online purchase. Because digital content is delivered immediately, that right ends once delivery starts, if you agreed to immediate delivery and acknowledged losing the right. This doesn&apos;t affect your legal rights if an item is faulty.</li>
      </ul>

      <h2>6. VIP subscriptions (automatic renewal)</h2>
      <ul>
        <li><strong>VIP monthly</strong> ($4.99 a month) and <strong>VIP yearly</strong> ($39.99 a year) <strong>renew automatically</strong> at the price shown, charged to your payment method at the start of each period, until you cancel. Prices may change; we&apos;ll tell you before a new price applies to your next renewal, and you can cancel before it does.</li>
        <li><strong>How to cancel:</strong> any time, in the game: Phone → Settings → Membership &amp; purchases → Manage billing. Cancelling stops the next renewal; VIP stays on until the end of the period you&apos;ve paid for. We don&apos;t refund the rest of a period, except where the law requires it.</li>
        <li>If a renewal payment fails, VIP may pause until the payment goes through.</li>
        <li><strong>&quot;Chat forever&quot;</strong> is a single payment and never renews.</li>
        <li>Deleting your account cancels any VIP plan immediately.</li>
      </ul>

      <h2>7. What you post</h2>
      <p>
        Your name and look, chats, party and home-visit chat, letters to the Mayor, Real Clout FM shoutouts, Clout TV
        photos, notes on jobs and sublets, and anything else you put into the game are your content. You keep ownership
        of it. You give us a worldwide, non-exclusive, royalty-free licence to store, show and use it to run and promote
        Clout City: for example, a picked shoutout is read on air, a picked photo appears on the Big Screen, and your name
        may appear in leaderboards, in Lola&apos;s &quot;Spotted at&quot; lines and in Lola&apos;s Blotter (a scandal from a choice, or a
        big win such as a campaign win; you can opt out of those in Settings).
        The licence ends when you delete the content or your account, except for copies already shown or kept in backups
        for a short time.
      </p>
      <p>You promise your content:</p>
      <ul>
        <li>is yours to share, and doesn&apos;t infringe anyone&apos;s copyright, trademark or privacy (Clout TV photos must be of you);</li>
        <li>has no hate speech, harassment, threats, sexual content, content involving minors, or anyone&apos;s personal information;</li>
        <li>doesn&apos;t impersonate a real person or brand, spam, or advertise.</li>
      </ul>
      <p>
        Shoutouts and Clout TV photos are reviewed by our team before they&apos;re shown. You can report or block other
        players in the game. We may remove content, rename players and suspend or close accounts that break these terms.
      </p>

      <h2>8. Copyright complaints</h2>
      <p>
        If you believe something in Clout City infringes your copyright, send a notice to our designated agent: Copyright
        Agent, Internova Technologies Inc, 431 Woodcrest Dr SE, Washington, DC 20032, <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> (subject line &quot;DMCA notice&quot;). Include: your signature; the work you say is infringed; what in Clout City infringes
        it and where; your contact details; a statement that you believe in good faith the use isn&apos;t authorized;
        and a statement, under penalty of perjury, that your notice is accurate and you&apos;re the owner or authorized to
        act for them. We remove infringing material promptly. If your content was removed and you believe that was a
        mistake, you can send a counter-notice with the details the law requires. We close the accounts of repeat
        infringers.
      </p>

      <h2>9. Playing fair</h2>
      <p>Don&apos;t:</p>
      <ul>
        <li>use bots, scripts, macros or modified clients, or automate play;</li>
        <li>exploit bugs (tell us instead at <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> or in the Mayor app);</li>
        <li>make extra accounts to farm invite, creator or Starter Week rewards;</li>
        <li>buy, sell or trade accounts, items or virtual cash for anything of real value;</li>
        <li>harass, threaten or scam other players, or try to get their personal information;</li>
        <li>overload, attack, reverse-engineer or scrape the service.</li>
      </ul>

      <h2>10. Invites and creators</h2>
      <p>
        You may share your invite link with people you know; don&apos;t spam it. Invite rewards are paid only for real new
        players. If you joined through a creator&apos;s link or code, that creator may earn a commission on your purchases;
        they only ever see counts, never who you are. Creators in our creator program have their own agreement with us.
      </p>

      <h2>11. Ending your account</h2>
      <ul>
        <li><strong>You:</strong> delete your account any time in Phone → Settings → Delete my account. It&apos;s immediate and permanent: your character, progress, chats, photos and purchases go with it, and any VIP plan is cancelled. (&quot;Start over&quot; on the welcome screen resets your character instead and keeps your account and purchases.)</li>
        <li><strong>Us:</strong> we may suspend or close accounts that break these terms or the law, or that put other players or the game at risk. If we close an account for breaking these terms, purchases aren&apos;t refunded, except where the law requires.</li>
        <li><strong>If Clout City shuts down,</strong> we&apos;ll give at least 30 days&apos; notice in the game and stop selling real-money items and new VIP periods.</li>
      </ul>

      <h2>12. Disclaimers</h2>
      <p>
        Clout City is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we make no
        promises that it will be uninterrupted, error-free or keep any feature or item. Nothing in these terms limits
        rights you have under consumer law that can&apos;t be excluded.
      </p>

      <h2>13. Limits on liability</h2>
      <p>
        To the extent the law allows, we&apos;re not liable for indirect, incidental, special or consequential losses, or
        loss of data, profits or virtual items, and our total liability to you is limited to the greater of what you paid
        us in the 12 months before the claim and US$50. Some places don&apos;t allow these limits, so they may not apply to
        you.
      </p>

      <h2>14. Disputes and governing law</h2>
      <p>
        These terms are governed by the laws of the District of Columbia, USA, without regard to conflict-of-law rules. Before filing a
        claim, contact us at <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a> so we can try to resolve it informally within 60 days. If we can&apos;t, claims go to the
        courts located in Washington, DC, and you and we agree to their jurisdiction; either of us may instead bring a claim in
        small-claims court where you live if it qualifies. If you live in the EU or UK, you can also bring
        proceedings in your home country, and your local consumer protections still apply.
      </p>

      <h2>15. Changes to these terms</h2>
      <p>
        We may update these terms as the game grows. For material changes we&apos;ll tell you in the game or by email at
        least 14 days before they take effect. If you keep playing after that, the new terms apply; if you don&apos;t agree,
        you can delete your account.
      </p>

      <h2>16. Contact</h2>
      <p>Internova Technologies Inc, 431 Woodcrest Dr SE, Washington, DC 20032. Email: <a href="mailto:hello@cloutcity.app">hello@cloutcity.app</a>. In the game, the Phone&apos;s Mayor app reaches our team too.</p>
    </main>
  );
}
