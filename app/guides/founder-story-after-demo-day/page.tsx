import type { Metadata } from 'next';
import {
  CAMPAIGN_URLS,
  buildBreadcrumbSchema,
  buildFaqSchema,
  campaignRobots,
  isPublicIndexingEnabled,
  type CampaignFaq,
} from '../../campaign-content';

const title = 'Demo Day Video Checklist for Startup Founders | VideoClaw';
const description =
  'Prepare a founder-led Demo Day video with an eight-input source pack, a 72-hour preflight, and a 14-day follow-up sequence.';
const publicIndexing = isPublicIndexingEnabled();

export const metadata: Metadata = {
  title,
  description,
  robots: campaignRobots(),
  ...(publicIndexing ? { alternates: { canonical: CAMPAIGN_URLS.guide } } : {}),
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'en_US',
    ...(publicIndexing ? { url: CAMPAIGN_URLS.guide } : {}),
  },
  twitter: { card: 'summary', title, description },
};

export const guideFaqs: CampaignFaq[] = [
  {
    question: 'Should startup founders make one Demo Day video for every audience?',
    answer:
      'No. One approved source story can support more than one asset, but use a separate version only when the audience has a distinct question, the evidence is permitted, and the CTA is appropriate for that viewer.',
  },
  {
    question: 'What should a Demo Day product demo show?',
    answer:
      'Show one meaningful workflow or physical transformation that the viewer can understand at a readable size. Use stable test data, remove private information, and label prototype or simulated behavior clearly.',
  },
  {
    question: 'How long should a founder Demo Day video be?',
    answer:
      'A 90-second founder, product, and evidence sequence is a useful editorial starting point for a follow-up asset, but the required format and duration come from the specific accelerator or recipient. Do not treat a suggested runtime as a program rule.',
  },
  {
    question: 'Can I record and share my Demo Day pitch?',
    answer:
      'Only where the specific program, venue, speakers, and applicable agreements permit recording, publication, captioning, and reuse. Confirm those rights before distributing footage or a replay.',
  },
  {
    question: 'What proof point belongs in an investor follow-up video?',
    answer:
      'Use one claim you can support and have cleared for the intended audience, such as a scoped customer learning, test result, usage observation, or technical fact. Keep the source, date, scope, methodology, and permission status with the underlying record.',
  },
  {
    question: 'What should I test before Demo Day?',
    answer:
      'Test the demo data, screen hygiene, claims, local backup file, event device, room display, muted playback, mobile legibility, captions where permitted, links, forms, access permissions, expiry dates, rights, and fallback ownership. The goal is not to promise a flawless event; it is to find issues while there is still time to make an approved decision.',
  },
];

const formats = [
  {
    name: 'Accelerator application video',
    viewer: 'Program reviewers',
    job: 'Establish who the founders are and how clearly they communicate.',
    boundary: 'Follow that program’s current instructions instead of generic production advice.',
  },
  {
    name: 'Product demonstration',
    viewer: 'Investors, customers, or technical reviewers',
    job: 'Show one meaningful workflow or physical transformation.',
    boundary: 'Prove one task; do not turn it into a feature tour or expose private data.',
  },
  {
    name: 'Recorded Demo Day pitch',
    viewer: 'Attendees and people who missed the event',
    job: 'Preserve the approved event narrative.',
    boundary: 'Confirm recording, publication, captioning, and reuse rights before distributing it.',
  },
  {
    name: 'Asynchronous follow-up video',
    viewer: 'One investor, customer, recruit, partner, or journalist',
    job: 'Answer one next question and make forwarding easy.',
    boundary: 'Change the context and CTA for the recipient instead of sending one generic cut to everyone.',
  },
];

const sourceInputs = [
  ['Audience and CTA', 'Name one primary viewer and one next action with a real destination and accountable owner.'],
  ['Customer problem', 'State the specific situation in the customer’s language and who experiences it.'],
  ['Product and workflow', 'Write the product statement and identify the one workflow or transformation you can honestly show.'],
  ['Cleared evidence', 'Select one proof point with its source, date, scope, methodology, and permission status.'],
  ['Founder explanation', 'Identify the founder’s plain-language explanation of the problem, insight, and product “aha.”'],
  ['Claim and confidentiality controls', 'List approved wording, prohibited wording, and every private item to exclude.'],
  ['Brand and destination details', 'Gather approved names, pronunciation, logos, visual assets, links, and CTA destination.'],
  ['Owners', 'Name the final approver and the person authorized to make the fallback decision on event day.'],
];

const template = [
  ['0–15 seconds', 'Problem', 'Name the customer situation in plain language. Avoid category jargon and unsupported market claims.'],
  ['15–30 seconds', 'Founder insight', 'Explain what the team learned or believes others miss, and why that matters to the customer.'],
  ['30–60 seconds', 'Product proof', 'Show one readable workflow, decision, or physical transformation. Label prototype, simulated, planned, or unreleased behavior.'],
  ['60–75 seconds', 'Evidence', 'State one approved result, learning, or technical fact with its appropriate scope and timing.'],
  ['75–90 seconds', 'Next step', 'Ask this viewer to take one concrete action tied to the current conversation.'],
];

const preflight = [
  ['Seed the demo account.', 'Use stable test data and remove customer, employee, health, financial, insurance, and other private information.'],
  ['Clean the capture environment.', 'Disable notifications, password-manager overlays, browser autofill, personal tabs, bookmarks, and revealing account switchers.'],
  ['Recheck claims.', 'Compare every on-screen number and spoken metric with the approved source pack; remove anything not cleared for this use.'],
  ['Export a local fallback.', 'Play the local MP4 without the network and confirm the file opens on the event device.'],
  ['Test the actual viewing conditions.', 'Check the event laptop, room display, muted playback, captions where permitted, and mobile legibility.'],
  ['Test the next step.', 'Open every link, form, calendar, access permission, and expiry-sensitive destination used by the CTA.'],
  ['Confirm rights.', 'Verify what the accelerator, venue, speakers, and relevant agreements permit you to record, publish, caption, and reuse.'],
  ['Run the fallback.', 'Confirm the final approver, fallback owner, backup-file location, and decision authority.'],
];

const followUp = [
  ['First 24 hours', 'Short event recap, only where permitted', 'What did I miss, and what is the next conversation?', 'Reply with the relevant diligence question.'],
  ['Days 2–3', 'Product-proof answer', 'Can I see that workflow or technical proof again?', 'Review the relevant evidence or schedule the appropriate expert.'],
  ['Days 4–7', 'Founder clarification', 'What exactly does the product do, and for whom?', 'Reply with the remaining question.'],
  ['Days 7–10', 'Cleared milestone or customer-learning update', 'What has materially changed?', 'Continue diligence or request the next approved step.'],
  ['Days 10–14', 'Forwardable meeting cut', 'What can I share with the right partner?', 'Introduce the relevant decision-maker.'],
];

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${CAMPAIGN_URLS.guide}#webpage`,
  url: CAMPAIGN_URLS.guide,
  name: title,
  description,
  inLanguage: 'en-US',
};
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'VideoClaw', url: CAMPAIGN_URLS.siteHome },
  { name: 'Guides', url: 'https://videoclaw.com/guides' },
  { name: 'Demo Day Video Checklist for Startup Founders', url: CAMPAIGN_URLS.guide },
]);
const faqSchema = buildFaqSchema(guideFaqs);

export const guideSchemaNodes = [webPageSchema, breadcrumbSchema, faqSchema];

export default function GuidePage() {
  return (
    <main
      className="guide-page"
      id="top"
      data-vc-campaign-id="c2-demo-day"
      data-vc-page-id="c2-demo-day-guide"
      data-vc-page-type="article"
    >
      {publicIndexing
        ? guideSchemaNodes.map((node) => (
            <script
              key={node['@type'] as string}
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
            />
          ))
        : null}

      <div className="campaign-preview-ribbon">PRIVATE CAMPAIGN PREVIEW · NOINDEX · EDITORIAL REVIEW</div>
      <header className="guide-masthead">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome} aria-label="VideoClaw home">VIDEOCLAW</a>
        <nav aria-label="Guide navigation">
          <a href={CAMPAIGN_URLS.useCasePath}>Demo Day use case</a>
          <a href="#source-pack">Eight inputs</a>
          <a href="#preflight">72-hour preflight</a>
          <a href="#faqs">FAQs</a>
        </nav>
        <a className="guide-header-link" href={CAMPAIGN_URLS.useCasePath}>SEE THE CAMPAIGN →</a>
      </header>

      <article className="guide-article">
        <header className="guide-hero">
          <p className="guide-breadcrumb"><a href={CAMPAIGN_URLS.siteHome}>VideoClaw</a> / Guides / Demo Day</p>
          <p className="campaign-label">US STARTUP OPERATING GUIDE · REVIEWED 1 SEPTEMBER 2026</p>
          <h1>Demo Day Video Checklist for Startup Founders</h1>
          <div className="guide-direct-answer">
            <p>
              If Demo Day is 7–21 days away, do not ask one video to serve every purpose: lock one approved story,
              capture a clean founder explanation and one real product workflow, then make separate, permitted
              versions for the event and follow-up conversations.
            </p>
            <p>
              In the final 72 hours, verify demo data, remove private information and notifications, test playback
              and links, and name a fallback owner before anything is shown or shared.
            </p>
          </div>
          <p className="guide-boundary">
            Your accelerator’s current instructions control what you may record, publish, caption, and reuse. The
            methods below are practical editorial recommendations—not universal accelerator rules, legal advice,
            compliance guidance, or a promise of fundraising results.
          </p>
        </header>

        <section className="guide-section" aria-labelledby="formats-title">
          <p className="campaign-label">START WITH THE JOB—not the file</p>
          <h2 id="formats-title">The four Demo Day video formats are not interchangeable.</h2>
          <p className="guide-lede">
            Make the smallest approved asset that answers the viewer’s next question. Start with the format your
            program requires; use the distinctions below only after those current requirements are clear.
          </p>
          <div className="guide-format-grid">
            {formats.map((format, index) => (
              <article key={format.name}>
                <span>0{index + 1}</span>
                <h3>{format.name}</h3>
                <dl>
                  <div><dt>Primary viewer</dt><dd>{format.viewer}</dd></div>
                  <div><dt>Job</dt><dd>{format.job}</dd></div>
                  <div><dt>Boundary</dt><dd>{format.boundary}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <aside className="guide-source-note">
            <strong>Check current program rules.</strong>
            <p>
              <a href="https://www.ycombinator.com/video/">YC application-video guidance</a> centers the founders
              speaking to camera. The <a href="https://www.techstars.com/application-preview">Techstars application preview</a>
              separates the team video from the product demo and pitch-deck materials. These official pages can change;
              treat the current program page—not this guide—as authoritative.
            </p>
          </aside>
        </section>

        <section className="guide-section guide-source-pack" id="source-pack" aria-labelledby="source-pack-title">
          <p className="campaign-label">THE EIGHT-INPUT SOURCE PACK</p>
          <h2 id="source-pack-title">Write down what may be said, shown, and linked.</h2>
          <p className="guide-lede">
            This is a local planning and approval checklist—not an upload, intake, production request, or
            automatic-generation request.
          </p>
          <ol className="guide-source-list">
            {sourceInputs.map(([name, copy], index) => (
              <li key={name}><span>0{index + 1}</span><div><strong>{name}</strong><p>{copy}</p></div></li>
            ))}
          </ol>
          <p className="guide-risk-note">
            Use only cleared material. Do not place confidential decks, credentials, customer records, private
            keys, production access, or investor/contact lists into an informal checklist or tool.
          </p>
          <a className="campaign-secondary-button" href={CAMPAIGN_URLS.sourcePackPath} data-vc-event="article_click" data-vc-article-id="demo-day-source-pack" data-vc-link-id="guide-source-pack" data-vc-placement="guide-body">
            CHECK THE INTERACTIVE SOURCE PACK →
          </a>
        </section>

        <section className="guide-section" aria-labelledby="template-title">
          <p className="campaign-label">A CONCISE SOURCE RECORDING</p>
          <h2 id="template-title">A 90-second founder, product, and evidence template.</h2>
          <p className="guide-lede">
            This is an editorial starting point, not a universally correct Demo Day script. Use it only when the
            timing and format fit your program and audience.
          </p>
          <div className="guide-template-grid">
            {template.map(([time, segment, copy]) => (
              <article key={time}><time>{time}</time><h3>{segment}</h3><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className="guide-section guide-preflight" id="preflight" aria-labelledby="preflight-title">
          <p className="campaign-label">T−72 HOURS</p>
          <h2 id="preflight-title">Run the Demo Day video preflight.</h2>
          <p className="guide-lede">
            Run this 72 hours before the event, then repeat the parts that can change on event day. Adapt it to the
            program, venue, company controls, and applicable agreements.
          </p>
          <ol className="guide-preflight-list">
            {preflight.map(([name, copy], index) => (
              <li key={name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{name}</strong><p>{copy}</p></div></li>
            ))}
          </ol>
          <p className="guide-risk-note">
            This checklist can reduce avoidable surprises, but it does not guarantee privacy, compliance, technical
            performance, publication rights, or an event outcome.
          </p>
        </section>

        <section className="guide-section" aria-labelledby="event-day-title">
          <p className="campaign-label">EVENT DAY</p>
          <h2 id="event-day-title">Preserve the source story.</h2>
          <p className="guide-lede">
            Publish only what the program permits. Keep confidential investor discussions and unapproved screens
            out of the content workflow, and do not reuse footage until the relevant rights are confirmed.
          </p>
          <p className="guide-lede">
            Treat recurring questions as editorial signals. If several people ask the same question, record the
            wording and check whether an existing cleared asset already answers it before making another one.
          </p>
        </section>

        <section className="guide-section guide-followup" aria-labelledby="followup-title">
          <p className="campaign-label">EVENT → DAY 14</p>
          <h2 id="followup-title">Route the next question—not a generic content calendar.</h2>
          <p className="guide-lede">
            This sequence organizes follow-up; it is not proven to create meetings or funding. Publish only when
            you have one cleared question, one approved answer, and a working next step.
          </p>
          <div className="guide-table-wrap">
            <table className="guide-followup-table">
              <thead><tr><th>Window</th><th>Asset</th><th>Question answered</th><th>One CTA</th></tr></thead>
              <tbody>
                {followUp.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="guide-section guide-faqs" id="faqs" aria-labelledby="guide-faq-title">
          <p className="campaign-label">SIX DIRECT ANSWERS</p>
          <h2 id="guide-faq-title">Common Demo Day video questions.</h2>
          <div className="guide-faq-list">
            {guideFaqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="guide-handoff" aria-labelledby="handoff-title">
          <p className="campaign-label">A BOUNDED VIDEOCLAW HANDOFF</p>
          <h2 id="handoff-title">Check the source material before relying on a deadline workflow.</h2>
          <p>
            VideoClaw is a private-alpha Mac app for prompt-based, agentic video content creation. Its access flow
            uses a form; access is not represented here as automatic or unrestricted.
          </p>
          <p>
            This guide does not represent pitch-deck or PDF ingestion, investor outreach, CRM, analytics,
            personalization, turnaround, output quality, privacy controls, or fundraising outcomes as product
            capabilities.
          </p>
          <div className="campaign-actions">
            <a className="campaign-primary-button" href={CAMPAIGN_URLS.alphaDownload} data-vc-event="alpha_download_click" data-vc-cta-id="guide-alpha-access" data-vc-placement="guide-handoff">
              REQUEST PRIVATE-ALPHA MAC ACCESS ↗
            </a>
            <a className="campaign-text-link" href={CAMPAIGN_URLS.useCasePath} data-vc-event="article_click" data-vc-article-id="demo-day-use-case" data-vc-link-id="guide-use-case" data-vc-placement="guide-handoff">
              SEE THE DEMO DAY CAMPAIGN →
            </a>
          </div>
        </section>
      </article>

      <footer className="campaign-footer guide-footer">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome}>VIDEOCLAW</a>
        <p>Private editorial preview · US Demo Day content system · September 2026</p>
        <a href="#top">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
