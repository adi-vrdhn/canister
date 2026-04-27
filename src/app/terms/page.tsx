import Link from "next/link";

const effectiveDate = "April 27, 2026";

const sections = [
  {
    title: "1. Acceptance of these terms",
    body: [
      "By accessing or using Canisterr, you agree to these Terms and Conditions and to any additional rules or policies we publish from time to time.",
      "If you do not agree, do not use the service.",
    ],
  },
  {
    title: "2. Who can use Canisterr",
    body: [
      "You must be able to form a legally binding contract under the laws that apply to you.",
      "You are responsible for keeping your account information accurate and for maintaining the security of your login credentials.",
    ],
  },
  {
    title: "3. Your account",
    body: [
      "You are responsible for all activity that happens under your account.",
      "You may not create accounts using false information, impersonate another person, or use someone else’s account without permission.",
    ],
  },
  {
    title: "4. User content",
    body: [
      "You may post logs, comments, lists, follow requests, messages, tags, and other content through the service.",
      "You retain ownership of the content you create, but you grant Canisterr a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, distribute, and process that content as needed to operate and improve the service.",
    ],
  },
  {
    title: "5. What you agree not to do",
    items: [
      "Use the service in a way that breaks the law or violates another person’s rights.",
      "Post hateful, harassing, abusive, threatening, sexually explicit, or otherwise harmful content.",
      "Attempt to scrape, reverse engineer, attack, disrupt, or overload the service.",
      "Upload malware or anything designed to harm users, devices, or data.",
      "Use automation or bots in a way that interferes with normal use.",
    ],
  },
  {
    title: "6. Social features",
    body: [
      "Canisterr includes follows, lists, posts, comments, shares, and notifications. Those features are designed to help people discover and discuss film and television.",
      "You are responsible for how you use those features, including who you follow, what you share, and the visibility settings you choose.",
    ],
  },
  {
    title: "7. Third-party services",
    body: [
      "Canisterr may rely on third-party services for media metadata, authentication, analytics, notifications, or storage.",
      "Those services are governed by their own terms and privacy practices.",
    ],
  },
  {
    title: "8. Service changes and availability",
    body: [
      "We may update, change, suspend, or discontinue any part of the service at any time.",
      "We do not guarantee that the service will always be available, uninterrupted, secure, or error free.",
    ],
  },
  {
    title: "9. Termination",
    body: [
      "We may suspend or terminate access to the service if we believe you have violated these terms, created risk, or misused the platform.",
      "You may stop using the service at any time.",
    ],
  },
  {
    title: "10. Disclaimers and liability",
    body: [
      "The service is provided on an \"as is\" and \"as available\" basis.",
      "To the fullest extent allowed by law, Canisterr is not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, revenue, goodwill, or reputation arising from your use of the service.",
    ],
  },
  {
    title: "11. Changes to these terms",
    body: [
      "We may update these terms from time to time. When we do, we will revise the effective date above and/or provide additional notice when appropriate.",
      "Continued use of Canisterr after a change becomes effective means you accept the updated terms.",
    ],
  },
];

export default function TermsPage() {
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
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#ffb36b]/80">Terms of Service</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Canisterr Terms and Conditions</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
              Effective {effectiveDate}. These terms explain the rules for using Canisterr, including our social
              features, user content, and account responsibilities.
            </p>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/70">
              Canisterr is a movie and TV social platform. We keep these terms practical and readable, but you should
              still review them carefully. If you need help understanding anything here, contact{" "}
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
              <h2 className="text-xl font-black text-[#f5f0de]">Contact</h2>
              <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">
                Questions about these terms, account issues, or abuse reports can be sent to{" "}
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
