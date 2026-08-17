import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../context/language/i18n";

// Guest-readable for the same reason as the privacy policy: these are the
// terms you agree to by registering, so they have to be readable before you do.
export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Terms of Service")}>
      <p className="terminal-copy legal-note">
        {t("This text is available in English only.")}
      </p>
      <p className="terminal-copy legal-meta">Last updated: 17 August 2026</p>

      <section className="legal-block">
        <h3>1. What this is</h3>
        <p className="terminal-copy">
          ft_transcendence is a bulletin board and game server written as a
          student project at 42. These terms cover your use of it. By
          registering, signing in, or posting, you accept them. If you do not,
          do not use the board.
        </p>
      </section>

      <section className="legal-block">
        <h3>2. Your account</h3>
        <p className="terminal-copy">
          You are responsible for what happens under your account, we do not take
		  any responsibility should you decide to share your account or password.
		  Do not register a display name that impersonates someone else.
		  Your display name and email are fixed once the account exists.
        </p>
      </section>

      <section className="legal-block">
        <h3>3. How to behave</h3>
        <p className="terminal-copy">Do not:</p>
        <ul className="terminal-list">
          <li>harass, threaten, or abuse other members</li>
          <li>
            post content that is illegal, hateful, or explicit in any way, or that
            you have no right to publish
          </li>
          <li>impersonate another member, or an administrator</li>
          <li>
            attack the service such as but not limited to scraping, brute-forcing accounts,
            flooding the board, or trying to reach data that is not yours
          </li>
          <li>
            work around the language filter, or any other moderation, on purpose
          </li>
        </ul>
        <p className="terminal-copy">
          Posts pass through an automatic swear filter. It is crude and it will
          both miss things and catch innocent ones; it is not a substitute for
          behaving.
        </p>
      </section>

      <section className="legal-block">
        <h3>4. What you post</h3>
        <p className="terminal-copy">
          Your posts, mail, bio and avatar stay yours. By putting them on the
          board you allow us to store and display them to other members, which is
          the only way the board can work. You are responsible for having the
          right to post what you post including your avatar. We may remove
          content that breaks these terms, without warning.
        </p>
      </section>

      <section className="legal-block">
        <h3>5. Avatars</h3>
        <p className="terminal-copy">
          Avatars must be PNG or JPEG files with a size of no more than 500KB.
    	  They are automatically scaled down when needed once you upload them.
           Keep them appropriate for a shared board, and do not upload an image
		   you do not have the right to use.
        </p>
      </section>

      <section className="legal-block">
        <h3>6. Uploaded games</h3>
        <p className="terminal-copy">
          Games are Lua files, and they run in a sandbox in the browser of
          whoever plays them. Do not upload anything designed to break out of
          that sandbox, to hang the page, or to attack the people who run it.
          Uploading a game means other members may play it. Games that are
          malicious, or that break these terms, get removed.
        </p>
      </section>

      <section className="legal-block">
        <h3>7. Other members are not vetted</h3>
        <p className="terminal-copy">
          Anyone can register. We do not check who members are, and we do not
          endorse what they post or upload. Treat mail and game files from
          strangers with the same suspicion you would anywhere else.
        </p>
      </section>

      <section className="legal-block">
        <h3>8. No warranty, and no guarantee it stays up</h3>
        <p className="terminal-copy">
          The board is provided as-is. It is coursework: it may be offline, it
          may lose data, and the whole database may be reset without notice.
          There is no backup you can ask us to restore from, and no service level
          of any kind. Keep your own copy of anything that matters to you. To the
          extent the law allows, the people who wrote this are not liable for any
          loss arising from your use of it.
        </p>
      </section>

      <section className="legal-block">
        <h3>9. Suspension</h3>
        <p className="terminal-copy">
          We can suspend or delete an account that breaks these terms, or that is
          being used to harm the board or its members. You can stop using the
          board at any time, and ask an administrator to delete your account.
        </p>
      </section>

      <section className="legal-block">
        <h3>10. Changes</h3>
        <p className="terminal-copy">
          These terms can change; the date at the top says when they last did.
          Continuing to use the board means you accept the current version.
        </p>
      </section>

      <section className="legal-block">
        <h3>11. Privacy</h3>
        <p className="terminal-copy">
          What we store about you, and what we do with it, is set out separately.
          Type <code>privacy</code> to read it.
        </p>
      </section>
    </TerminalSection>
  );
}
