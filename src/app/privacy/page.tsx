import Link from "next/link";

const effectiveDate = "April 27, 2026";

const sections = [
  {
    title: "1. Information we collect",
    items: [
      "Account details such as your username, display name, email address, and profile image.",
      "Content you create, including logs, posts, comments, lists, reactions, follows, messages, and shared items.",
      "Device and usage data such as browser type, pages visited, timestamps, and basic diagnostics.",
      "Technical data used to deliver notifications, prevent abuse, and keep the app working reliably.",
    ],
  },
  {
    title: "2. How we use information",
    items: [
      "Create and manage your account.",
      "Show your profile, logs, lists, posts, followers, and related social activity.",
      "Send notifications and emails you opt into.",
      "Improve performance, diagnose issues, and protect the service from abuse.",
      "Respond to support requests and account issues.",
    ],
  },
  {
    title: "3. How information is shared",
    body: [
      "We do not sell your personal information.",
      "We may share limited information with service providers that help us run Canisterr, such as hosting, authentication, analytics, and notifications.",
      "Content you choose to make public can be visible to other users or the public depending on your settings.",
    ],
  },
  {
    title: "4. Public and private content",
    body: [
      "Canisterr lets you control the visibility of your profile, lists, logs, and activity. If you mark something public, it may be visible to other users or shared through the app.",
      "If you post or send content through social features, other users may be able to see, save, screenshot, or share that content outside the service.",
    ],
  },
  {
    title: "5. Cookies and similar technologies",
    body: [
      "We may use cookies, local storage, and similar technologies to keep you signed in, remember preferences, support notifications, and improve the experience.",
      "You can control cookies through your browser settings, but some features may not work properly if you disable them.",
    ],
  },
  {
    title: "6. Retention",
    body: [
      "We keep information for as long as necessary to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements.",
      "If you delete content or close your account, some records may remain in backups or logs for a limited period, subject to applicable law.",
    ],
  },
  {
    title: "7. Security",
    body: [
      "We use reasonable safeguards to help protect your data, but no system is completely secure.",
      "You should use a strong password and keep your account credentials private.",
    ],
  },
  {
    title: "8. Your choices and rights",
    items: [
      "Update your profile, privacy settings, and notification settings in the app.",
      "Delete comments, posts, lists, and other content where the product allows it.",
      "Deactivate or delete your account from account settings.",
      "Contact us if you want help with a privacy question or request.",
    ],
  },
  {
    title: "9. Children’s privacy",
    body: [
      "Canisterr is not intended for children under 13, and you should not use the service if you are below the minimum age required in your jurisdiction.",
      "If you believe a child has provided personal information to us, contact us so we can review and take appropriate action.",
    ],
  },
  {
    title: "10. International users",
    body: [
      "If you use Canisterr from outside the United States, your information may be transferred to and processed in other countries where our service providers operate.",
    ],
  },
  {
    title: "11. Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. When we do, we will change the effective date above and may provide additional notice where required.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#090909] px-4 py-8 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 transition hover:text-[#ffb36b]"
        >
          Back to settings
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#ffb36b]/80">Privacy Policy</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Canisterr Privacy Policy</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
              Effective {effectiveDate}. This policy explains what we collect, how we use it, and the choices you have
              when using Canisterr.
            </p>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/70">
              If you need help with your privacy rights or want to ask a question about this policy, contact{" "}
              <a href="mailto:support@canisterr.com" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                support@canisterr.com
              </a>
              .
            </div>

            {sections.map((section) => (
              <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <h2 className="text-xl font-black tracking-tight text-[#f5f0de]">{section.title}</h2>
                {"body" in section && section.body ? (
                  <div className="mt-4 space-y-4 text-sm leading-7 text-white/68 sm:text-base">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {"items" in section && section.items ? (
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-white/68 sm:text-base">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#ff7a1a]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section className="rounded-3xl border border-white/10 bg-[#ff7a1a]/10 p-5 sm:p-6">
              <h2 className="text-xl font-black text-[#f5f0de]">Contact us</h2>
              <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">
                For privacy questions, data requests, or account-related privacy concerns, email{" "}
                <a href="mailto:support@canisterr.com" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                  support@canisterr.com
                </a>
                .
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
