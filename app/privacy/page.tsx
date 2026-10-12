import Link from "next/link";

export const metadata = { title: "Privacy Policy · Clout City" };

// DRAFT for early access. Must be reviewed by a lawyer before v1.0 (Milestones v1.0).
export default function Privacy() {
  return (
    <main className="legal">
      <p><Link href="/">‹ Back to Queens</Link></p>
      <h1>Privacy Policy</h1>
      <p className="draft">
        <strong>Draft for early access.</strong> This policy is a plain-language placeholder and is pending
        review by a lawyer before Clout City&apos;s public launch. Placeholders are shown in [brackets].
      </p>
      <p>Last updated: October 12, 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your email address</strong>, to send sign-in links and important account messages.</li>
        <li><strong>Your 18+ confirmation</strong> and when you gave it.</li>
        <li><strong>Your game profile</strong>: your in-game name, starting style and look.</li>
        <li><strong>Invite records</strong>: whose invite link you joined through, and who joined through yours.</li>
        <li><strong>Basic technical data</strong> needed to run the service, such as sign-in session cookies and server logs.</li>
      </ul>

      <h2>What other players see</h2>
      <p>Players who invited you, or whom you invited, can see your in-game name and starting style. Your email is never shown to other players.</p>

      <h2>How we use it</h2>
      <p>To run the game, keep your account secure, credit invites, and improve Clout City. We don&apos;t sell your personal information.</p>

      <h2>Who processes it</h2>
      <p>We use Supabase (accounts and database) and Vercel (hosting) to run the game. [Counsel to confirm processor list, data locations and transfer terms.]</p>

      <h2>Cookies</h2>
      <p>We use cookies to keep you signed in and to remember an invite link you followed. We don&apos;t use advertising cookies.</p>

      <h2>Your choices</h2>
      <p>You can ask us to access, correct or delete your data at [contact email]. Deleting your account removes your profile and invite records.</p>

      <h2>Age</h2>
      <p>Clout City is for adults 18 and older. We don&apos;t knowingly collect data from anyone under 18.</p>

      <h2>Changes</h2>
      <p>We will update this policy as the game adds features (such as purchases and chat) and tell you about material changes.</p>
    </main>
  );
}
