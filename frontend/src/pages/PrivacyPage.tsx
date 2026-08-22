// The privacy policy, as static text.
//
// Reachable without a session on purpose — it's part of what you agree to by
// registering, so it has to be readable before there's an account.

import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../context/language/i18n";

// the body is deliberately English-only: legal wording isn't something the UI
// dictionary should be paraphrasing into three languages. the notice saying so
// is the one part that is translated
export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Privacy Policy")}>
      <p className="terminal-copy legal-note">
        {t("This text is available in English only.")}
      </p>
      <p className="terminal-copy legal-meta">Last updated: 17 August 2026</p>

      <section className="legal-block">
        <h3>1. Who runs this board</h3>
        <p className="terminal-copy">
          ft_transcendence is a student project built at 42. It is not a
          commercial service. It is operated by us, the students who wrote it,
          and it exists so that we can be graded on it.
        </p>
      </section>

      <section className="legal-block">
        <h3>2. What we store about you</h3>
        <p className="terminal-copy">When you register, we store:</p>
        <ul className="terminal-list">
          <li>
            <span>your display name and email address</span>, as you entered
            them
          </li>
          <li>
            <span>a cryptographic hash of your password</span> — the password
            itself is never written down, and cannot be recovered from the hash
          </li>
          <li>
            <span>your bio and your avatar picture</span>, if you set them. The
            avatar is stored as the image itself, scaled down, and not as a link
            to anywhere else
          </li>
          <li>
            <span>your friend list</span>, meaning the accounts you added
          </li>
        </ul>
        <p className="terminal-copy">
          We also store what you create on the board: discussion threads and
          posts, personal mail you send or receive, and any game files you
          upload. Mail is not end-to-end encrypted, and an administrator with
          database access can read it.
        </p>
      </section>

      <section className="legal-block">
        <h3>3. Signing in with 42 or GitHub</h3>
        <p className="terminal-copy">
          If you sign in through an external provider, we never see your
          password for that provider. We ask each one for the minimum we need to
          identify you:
        </p>
        <ul className="terminal-list">
          <li>
            <span>42 Intra</span> — the <code>public</code> scope, giving us
            your login and email
          </li>
          <li>
            <span>GitHub</span> — <code>read:user user:email</code>
          </li>
        </ul>
        <p className="terminal-copy">
          From the answer we keep your login name, your email address, the name
          of the provider, and the account id that provider uses for you. That
          id is what lets us recognise you on your next sign-in. We do not post
          anything to those accounts, and we do not read anything else from
          them.
        </p>
      </section>

      <section className="legal-block">
        <h3>4. What is kept in your browser</h3>
        <p className="terminal-copy">
          We use no advertising or analytics cookies, and no third-party
          trackers. What the board keeps on your device is:
        </p>
        <ul className="terminal-list">
          <li>
            <span>your session tokens</span>, in sessionStorage, so a page
            reload does not log you out. They are discarded when you close the
            tab, and when you log out
          </li>
          <li>
            <span>your chosen language</span>, in localStorage
          </li>
          <li>
            <span>one short-lived cookie</span> during an external sign-in, used
            only to tie the reply from the provider back to the browser that
            started it
          </li>
        </ul>
      </section>

      <section className="legal-block">
        <h3>5. What we use it for</h3>
        <p className="terminal-copy">
          Only to run the board: to sign you in, to show your profile to other
          members, to deliver your mail, and to display what you post. We do not
          sell it, share it with advertisers, or use it to build a profile of
          you. There is no automated decision-making.
        </p>
      </section>

      <section className="legal-block">
        <h3>6. Who can see it</h3>
        <p className="terminal-copy">
          Your name, avatar, bio and online status are visible to every
          signed-in member. Discussion posts are public to members. Mail is
          visible to its sender and its recipient. Your email address is shown
          on the member list, so treat it as visible to other members. Nothing
          on this board is visible to the open internet without an account.
        </p>
      </section>

      <section className="legal-block">
        <h3>7. How long we keep it</h3>
        <p className="terminal-copy">
          For as long as the account exists, and as long as the project is being
          run and graded. Because this is a student project, the whole database
          may be reset without notice. Do not store anything here that you would
          be sorry to lose.
        </p>
      </section>

      <section className="legal-block">
        <h3>8. Your rights</h3>
        <p className="terminal-copy">
          You can see the data we hold about you on your profile page and in the
          member list. You can correct your bio and avatar there at any time.
          Your display name and email are fixed after registration, so ask an
          administrator to change them. To have your account and its content
          deleted, ask an administrator; we will delete it unless we are
          required to keep it.
        </p>
      </section>

      <section className="legal-block">
        <h3>9. Security</h3>
        <p className="terminal-copy">
          Passwords are hashed with Argon2. Sessions use signed tokens that
          expire, and logging out revokes them.
        </p>
      </section>

      <section className="legal-block">
        <h3>10. Changes</h3>
        <p className="terminal-copy">
          If this policy changes, the date at the top changes with it.
          Continuing to use the board means you accept the current version.
        </p>
      </section>
    </TerminalSection>
  );
}
