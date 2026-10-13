import Link from "next/link";

export const metadata = { title: "Terms of Service · Clout City" };

// DRAFT for early access. Must be reviewed by a lawyer before v1.0 (Milestones v1.0).
export default function Terms() {
  return (
    <main className="legal">
      <p><Link href="/">‹ Back to Queens</Link></p>
      <h1>Terms of Service</h1>
      <p className="draft">
        <strong>Draft for early access.</strong> These terms are a plain-language placeholder and are pending
        review by a lawyer before Clout City&apos;s public launch. Placeholders are shown in [brackets].
      </p>
      <p>Last updated: October 12, 2026</p>

      <h2>1. Who we are</h2>
      <p>Clout City NYC (&quot;Clout City&quot;, &quot;we&quot;, &quot;us&quot;) is a browser game operated by [Company legal name], [address]. Contact: [contact email].</p>

      <h2>2. You must be 18 or older</h2>
      <p>Clout City is for adults only. By creating an account you confirm you are at least 18 years old. We close accounts we believe belong to someone under 18.</p>

      <h2>3. Early access</h2>
      <p>The game is in early access. Features may change, be paused or be removed, and things may break. We will try to keep your account, name, character and crew as the game grows, but early access is provided &quot;as is&quot;.</p>

      <h2>4. Your account</h2>
      <p>You sign in with a link or code sent to your email. Keep access to that email secure; anyone who can read it can sign in as you. One account per person.</p>

      <h2>5. Names and behavior</h2>
      <p>Your in-game name must not impersonate a real person, include hate speech, harassment, sexual content or someone else&apos;s personal information. We may rename or remove names and accounts that break these rules.</p>

      <h2>6. It&apos;s a game</h2>
      <p>Clout City is satire. All characters, businesses and brands in the game are fictional, and any resemblance to real people or companies is unintended. In-game money (&quot;virtual cash&quot;) has no real-world value and can never be bought, sold or exchanged for real money.</p>

      <h2>7. Invites</h2>
      <p>You may share your invite link with people you know. Don&apos;t spam, and don&apos;t post it where it isn&apos;t welcome. Invite rewards, when they launch, are paid only for genuine new players.</p>

      <h2>8. Ending your account</h2>
      <p>You can ask us to delete your account at any time at [contact email]. We may suspend or close accounts that break these terms.</p>

      <h2>9. Liability</h2>
      <p>[To be completed by counsel: disclaimers, limitation of liability, governing law and dispute resolution.]</p>

      <h2>10. Changes</h2>
      <p>We will update these terms as the game grows and tell you about material changes in the game or by email.</p>
    </main>
  );
}
