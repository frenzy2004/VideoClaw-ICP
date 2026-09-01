import type { Metadata } from 'next';
import CampaignVideo, { type Transcript } from '../../campaign-video';
import {
  CAMPAIGN_URLS,
  buildBreadcrumbSchema,
  buildFaqSchema,
  campaignRobots,
  isPublicIndexingEnabled,
  type CampaignFaq,
} from '../../campaign-content';

const description =
  'Plan one approved founder story and honest product-proof sequence for investor, customer, recruiting, and partner follow-up after Demo Day.';
const publicIndexing = isPublicIndexingEnabled();

export const metadata: Metadata = {
  title: 'Demo Day Founder Content System | VideoClaw',
  description,
  robots: campaignRobots(),
  ...(publicIndexing ? { alternates: { canonical: CAMPAIGN_URLS.useCase } } : {}),
  openGraph: {
    title: 'Your Demo Day story should keep working after the room clears.',
    description,
    type: 'website',
    locale: 'en_US',
    ...(publicIndexing ? { url: CAMPAIGN_URLS.useCase } : {}),
  },
  twitter: {
    card: 'summary',
    title: 'Your Demo Day story should keep working after the room clears.',
    description,
  },
};

export const useCaseFaqs: CampaignFaq[] = [
  {
    question:
      'Which video should I make for Demo Day: an application video, product demo, pitch recording, or follow-up video?',
    answer:
      'An application video introduces the founding team under a specific program’s rules. A product demo proves one workflow, a Demo Day pitch recording presents the company to the event audience, and a follow-up video answers one viewer’s next question after the event. Confirm the current accelerator requirements before recording; one format does not automatically substitute for another.',
  },
  {
    question: 'Does a Demo Day follow-up video replace the pitch deck?',
    answer:
      'No. The pitch deck supports the investment thesis and diligence; a short video can make the approved founder story and product proof easier to understand and forward. It should direct the viewer to a clear next step rather than attempt to replace diligence.',
  },
  {
    question: 'Who is a good fit for this private pilot?',
    answer:
      'The pilot is designed for a founder with an approved or nearly approved story, a real product or accurately labeled prototype, one cleared proof point, a named final approver, and a public event, launch, or follow-up deadline inside 21 days. It is not pitch coaching, investor-list building, automated outreach, or a promise of fundraising results.',
  },
  {
    question: 'Can I show a prototype in a Demo Day product video?',
    answer:
      'Yes, if the prototype is labeled accurately and a final reviewer confirms that simulated, planned, or unreleased behavior is not presented as production functionality. Use real product footage where possible and keep the distinction visible in narration, captions, and supporting copy.',
  },
  {
    question: 'What must be removed from a product screen recording?',
    answer:
      'Remove customer names, personal information, notifications, credentials, confidential roadmaps, internal URLs, unreleased features, unapproved logos, and any data the company does not have permission to show. Test the final recording and caption file for the same restrictions before approval.',
  },
  {
    question: 'Can I submit a confidential deck or customer data through the readiness check?',
    answer:
      'No. The initial readiness check should collect only public or non-confidential information needed to assess fit. Do not request or upload decks, credentials, customer data, contact lists, or other confidential assets until an approved secure intake process and published handling policy exist.',
  },
];

const viewerJobs = [
  {
    viewer: 'Investor',
    question: 'What should I investigate next?',
    proof: 'Differentiated insight, one product mechanism, cleared evidence, and a concrete diligence next step.',
    action: 'Continue the conversation',
  },
  {
    viewer: 'Customer',
    question: 'Will this fit my workflow?',
    proof: 'One real workflow and an observable result, without overstating implementation or availability.',
    action: 'Request a product demo',
  },
  {
    viewer: 'Future hire',
    question: 'Why is this problem worth working on now?',
    proof: 'The approved mission, technical problem, and team context—without invented hiring urgency.',
    action: 'View open roles',
  },
  {
    viewer: 'Partner or media',
    question: 'Why does this category matter now?',
    proof: 'Timing plus one concrete, supportable company example.',
    action: 'Learn more',
  },
];

const sourceControls = [
  ['01', 'Approved story', 'Problem, product mechanism, cleared proof, why now, and one next action.'],
  ['02', 'Founder source', 'A clean founder take or narration source with public-use approval.'],
  ['03', 'Product proof', 'One real workflow, physical sequence, or accurately labeled prototype.'],
  ['04', 'Cleared evidence', 'One milestone, benchmark, or usage fact with support and permission.'],
  ['05', 'Brand controls', 'Approved company name, product labels, visual identity, and logo use.'],
  ['06', 'Restrictions', 'Confidential material, prohibited wording, PII, credentials, and unreleased behavior.'],
  ['07', 'Deadline and CTA', 'Exact event date, primary viewer, distribution context, and one next action.'],
  ['08', 'Final approver', 'One person authorized to approve story, product, privacy, brand, and CTA.'],
];

const workflow = [
  ['01', 'Qualify the moment', 'Confirm the deadline, primary viewer, real product proof, public-use permission, and final approver.'],
  ['02', 'Build the source record', 'Name the exact founder take, product capture, evidence item, restrictions, and CTA behind each scene.'],
  ['03', 'Lock claims', 'Mark every statement approved, evidence-required, confidential, prohibited, or still under review.'],
  ['04', 'Plan one proof sequence', 'Map founder context → product action → observable evidence → one next step before production work is considered.'],
  ['05', 'Review before reuse', 'Approve story, product behavior, sensitive data, brand, captions, and CTA before any final public handoff.'],
];

export const baseTranscript: Transcript = [
  { time: '00:00–00:07', text: '[Restrained electronic texture] ONE SHOT · 90 SECONDS Demo Day is one moment.' },
  { time: '00:07–00:16', text: '90 seconds. One room. Then the lights come up.' },
  { time: '00:16–00:25', text: '[Whoosh] But the story does not stop there.' },
  { time: '00:25–00:34', text: 'Your traction. Your team. Your proof.' },
  { time: '00:34–00:41', text: 'Make the founder story keep working.' },
  { time: '00:41–00:45', text: '[Resolving tone] Demo Day is one moment. Keep it working.' },
];

export function transcriptFor(audienceLine: string, highlight: string, emphasis: string): Transcript {
  return [
    baseTranscript[0],
    baseTranscript[1],
    baseTranscript[2],
    { ...baseTranscript[3], text: `${audienceLine} [${highlight} highlighted] ${emphasis}.` },
    baseTranscript[4],
    baseTranscript[5],
  ];
}

export const campaignTranscripts = {
  base: baseTranscript,
  investor: transcriptFor('For the investor who wants to see it after the pitch.', 'Traction', 'Your traction'),
  customer: transcriptFor('For the customer deciding whether to try you.', 'Proof', 'Your proof'),
  recruiting: transcriptFor('For the person you want on the team.', 'Team', 'Your team'),
} satisfies Record<string, Transcript>;

const faqSchema = buildFaqSchema(useCaseFaqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'VideoClaw', url: CAMPAIGN_URLS.siteHome },
  { name: 'Demo Day founder content', url: CAMPAIGN_URLS.useCase },
]);
const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${CAMPAIGN_URLS.useCase}#webpage`,
  url: CAMPAIGN_URLS.useCase,
  name: 'Demo Day Founder Content System | VideoClaw',
  description,
  inLanguage: 'en-US',
} as const;

export const useCaseSchemaNodes = [webPageSchema, breadcrumbSchema, faqSchema];

export default function UseCasePage() {
  return (
    <main
      className="campaign-page"
      id="top"
      data-vc-campaign-id="c2-demo-day"
      data-vc-page-id="c2-demo-day-use-case"
      data-vc-page-type="commercial"
    >
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {publicIndexing
        ? useCaseSchemaNodes.map((node) => (
            <script
              key={node['@type'] as string}
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
            />
          ))
        : null}

      <div className="campaign-preview-ribbon">
        {publicIndexing ? 'US DEMO DAY FOUNDER CONTENT SYSTEM' : 'PRIVATE CAMPAIGN PREVIEW · NOINDEX · NOT A LIVE OFFER'}
      </div>
      <header className="campaign-masthead" role="banner">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome} aria-label="VideoClaw home">
          VIDEOCLAW
        </a>
        <nav aria-label="Campaign sections">
          <a href="#proof-system">Proof system</a>
          <a href="#viewer-variants">Viewer variants</a>
          <a href="#controlled-workflow">Workflow</a>
          <a href={CAMPAIGN_URLS.guidePath} data-vc-event="article_click" data-vc-article-id="founder-story-after-demo-day" data-vc-link-id="use-case-guide-nav" data-vc-placement="masthead">Founder guide</a>
        </nav>
        <a
          className="campaign-header-cta"
          href={CAMPAIGN_URLS.alphaDownload}
          data-vc-cta-id="masthead-alpha-access"
          data-vc-event="alpha_download_click"
          data-vc-placement="masthead"
        >
          REQUEST PRIVATE-ALPHA MAC ACCESS ↗
        </a>
      </header>

      <section className="campaign-hero" id="main-content" tabIndex={-1} aria-labelledby="campaign-hero-title">
        <div className="campaign-eyebrow">
          <span>US ACCELERATOR FOUNDERS</span>
          <span>DEADLINE INSIDE 7–21 DAYS</span>
        </div>
        <div className="campaign-hero-grid">
          <div className="campaign-hero-copy">
            <p className="campaign-label">DEMO DAY CONTINUITY · CAMPAIGN 02</p>
            <h1 id="campaign-hero-title">Your Demo Day story should keep working after the room clears.</h1>
            <div className="campaign-answer-block">
              <p>
                You already have the pitch. Use its approved story and one honest product-proof sequence to plan
                forwardable follow-up for investors, customers, future hires, and partners.
              </p>
              <p>
                VideoClaw is a private-alpha Mac app for prompt-based, agentic video content creation. This review
                page starts with the material your team can actually approve and show.
              </p>
            </div>
            <p className="campaign-qualification">
              Best fit when your Demo Day, launch, or showcase is 7–21 days away; the pitch is approved or nearly
              approved; one product sequence and proof point are cleared; and one final approver is named.
            </p>
            <div className="campaign-actions">
              <a
                className="campaign-primary-button"
                href={CAMPAIGN_URLS.alphaDownload}
                data-vc-cta-id="hero-alpha-access"
                data-vc-event="alpha_download_click"
                data-vc-placement="hero"
              >
                REQUEST PRIVATE-ALPHA MAC ACCESS ↗
              </a>
              <a
                className="campaign-text-link"
                href={CAMPAIGN_URLS.sourcePackPath}
                data-vc-article-id="demo-day-source-pack"
                data-vc-event="article_click"
                data-vc-link-id="hero-source-pack"
                data-vc-placement="hero"
              >
                CHECK YOUR SOURCE PACK ↓
              </a>
            </div>
            <p className="campaign-microcopy">
              Private alpha. The access page is for the Mac app; access is not represented as automatic or
              unrestricted.
            </p>
          </div>
          <aside className="campaign-fit-card" aria-label="Campaign qualification">
            <p className="campaign-label">NOT THE JOB</p>
            <p>Pitch coaching, investor lists, automated outreach, or a promise of fundraising results.</p>
            <p className="campaign-label">THE JOB</p>
            <p>One source-controlled story that can answer the next viewer’s question without changing the facts.</p>
          </aside>
        </div>
      </section>

      <section className="campaign-media-lead" aria-labelledby="core-prototype-title">
        <div className="campaign-section-intro compact">
          <p className="campaign-label">ILLUSTRATIVE SEQUENCE · 45 SECONDS</p>
          <h2 id="core-prototype-title">One moment is not the whole content system.</h2>
          <p>
            This abstract animatic tests the campaign story without founder names, logos, product claims,
            testimonials, funding claims, or customer data.
          </p>
        </div>
        <CampaignVideo
          id="demo-day-core-prototype"
          src="/media/demo-day/base-16x9.mp4"
          poster="/media/demo-day/base-poster.jpg"
          captionsSrc="/media/demo-day/base.en.vtt"
          title="Demo Day continuity story — 45-second overview"
          caption="An abstract, claim-free planning sequence showing why the founder story must keep working after the event."
          transcript={campaignTranscripts.base}
          preload="metadata"
        />
      </section>

      <section className="campaign-proof-system" id="proof-system" aria-labelledby="proof-system-title">
        <div className="campaign-section-intro">
          <p className="campaign-label">WHAT MUST BE TRUE BEFORE THE STORY TRAVELS</p>
          <h2 id="proof-system-title">One approved story. One proof sequence. Clear next questions.</h2>
          <p>
            A follow-up works when the founder, product, evidence, and next action say the same thing. The goal is
            not four unrelated videos; it is controlled emphasis for four viewers.
          </p>
        </div>
        <div className="campaign-proof-grid">
          <article><span>01</span><h3>Approved story</h3><p>The customer situation, product mechanism, evidence, why-now statement, and next action are agreed first.</p></article>
          <article><span>02</span><h3>Honest product proof</h3><p>Show one real workflow, physical sequence, or accurately labeled prototype. Never turn aspiration into a production claim.</p></article>
          <article><span>03</span><h3>One final approver</h3><p>One person can approve story, product behavior, privacy, brand, captions, and CTA before public use.</p></article>
        </div>
      </section>

      <section className="campaign-viewer-section" id="viewer-variants" aria-labelledby="viewer-jobs-title">
        <div className="campaign-section-intro">
          <p className="campaign-label">ONE STORY · FOUR VIEWER JOBS</p>
          <h2 id="viewer-jobs-title">Keep the source facts fixed. Change the next question.</h2>
        </div>
        <div className="campaign-viewer-grid">
          {viewerJobs.map((job, index) => (
            <article key={job.viewer}>
              <span>0{index + 1}</span>
              <h3>{job.viewer}</h3>
              <blockquote>“{job.question}”</blockquote>
              <p>{job.proof}</p>
              <strong>{job.action}</strong>
            </article>
          ))}
        </div>
        <div className="campaign-variant-grid" aria-label="Illustrative audience variants">
          <CampaignVideo
            id="demo-day-investor-prototype"
            src="/media/demo-day/investor-16x9.mp4"
            poster="/media/demo-day/investor-poster.jpg"
            captionsSrc="/media/demo-day/investor.en.vtt"
            title="Investor emphasis — traction"
            caption="A typography prototype that changes scene-four emphasis to traction for investor follow-up."
            transcript={campaignTranscripts.investor}
          />
          <CampaignVideo
            id="demo-day-customer-prototype"
            src="/media/demo-day/customer-16x9.mp4"
            poster="/media/demo-day/customer-poster.jpg"
            captionsSrc="/media/demo-day/customer.en.vtt"
            title="Customer emphasis — proof"
            caption="A typography prototype that changes scene-four emphasis to proof for customer follow-up."
            transcript={campaignTranscripts.customer}
          />
          <CampaignVideo
            id="demo-day-recruiting-prototype"
            src="/media/demo-day/recruiting-16x9.mp4"
            poster="/media/demo-day/recruiting-poster.jpg"
            captionsSrc="/media/demo-day/recruiting.en.vtt"
            title="Recruiting emphasis — team"
            caption="A typography prototype that changes scene-four emphasis to the team for recruiting follow-up."
            transcript={campaignTranscripts.recruiting}
          />
        </div>
      </section>

      <section className="campaign-source-section" aria-labelledby="source-controls-title">
        <div className="campaign-section-intro">
          <p className="campaign-label">EIGHT CONTROLS · BEFORE PRODUCTION</p>
          <h2 id="source-controls-title">If one input is vague, the story is not ready to travel.</h2>
          <p>
            This is a readiness-only checklist. It does not submit material, qualify a pilot, upload a deck, or
            start automatic generation.
          </p>
        </div>
        <div className="campaign-source-grid">
          {sourceControls.map(([number, title, copy]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
        <p className="campaign-risk-note">
          Use only public or non-confidential information at this stage. Do not paste confidential decks,
          credentials, customer records, private keys, production access, or investor/contact lists into this page.
        </p>
        <a className="campaign-secondary-button" href={CAMPAIGN_URLS.sourcePackPath} data-vc-event="article_click" data-vc-article-id="demo-day-source-pack" data-vc-link-id="source-controls-check" data-vc-placement="source-controls">
          RUN THE 8-POINT SOURCE-PACK CHECK →
        </a>
      </section>

      <section className="campaign-workflow-section" id="controlled-workflow" aria-labelledby="workflow-title">
        <div className="campaign-section-intro inverse">
          <p className="campaign-label">CONTROL BEFORE REUSE</p>
          <h2 id="workflow-title">Every scene points back to a named source.</h2>
        </div>
        <div className="campaign-workflow-grid">
          {workflow.map(([number, title, copy]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
      </section>

      <section className="campaign-measurement-section" aria-labelledby="measurement-title">
        <div>
          <p className="campaign-label">PILOT MEASUREMENT PROTOCOL</p>
          <h2 id="measurement-title">Measure control before making a performance claim.</h2>
        </div>
        <div className="campaign-measurement-copy">
          <p>
            If the team conducts an approved pilot, record the source material received, claim ledger, proof sequence, review
            rounds, paid-generation cost, human intervention, final approval, and later reuse.
          </p>
          <p>
            This is a measurement protocol—not a customer testimonial, product-performance claim, promised
            turnaround, or proof of fundraising, customer-acquisition, or hiring results.
          </p>
        </div>
      </section>

      <section className="campaign-faq-section" aria-labelledby="campaign-faq-title">
        <div className="campaign-section-intro compact">
          <p className="campaign-label">DIRECT ANSWERS</p>
          <h2 id="campaign-faq-title">Demo Day content questions, answered without hype.</h2>
        </div>
        <div className="campaign-faq-list">
          {useCaseFaqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="campaign-closing" aria-labelledby="campaign-closing-title">
        <p className="campaign-label">YOUR NEXT STEP IS A READINESS DECISION—not a render</p>
        <h2 id="campaign-closing-title">Bring the truth. Then decide how it should travel.</h2>
        <p>
          You need a source pack your team can approve, a proof sequence you can show honestly, and one clear next
          action after the event.
        </p>
        <div className="campaign-actions centered">
          <a className="campaign-primary-button" href={CAMPAIGN_URLS.alphaDownload} data-vc-cta-id="closing-alpha-access" data-vc-event="alpha_download_click" data-vc-placement="closing">
            REQUEST PRIVATE-ALPHA MAC ACCESS ↗
          </a>
          <a className="campaign-text-link" href={CAMPAIGN_URLS.sourcePackPath} data-vc-event="article_click" data-vc-article-id="demo-day-source-pack" data-vc-link-id="closing-source-pack" data-vc-placement="closing">
            RUN THE SOURCE-PACK CHECK ↓
          </a>
        </div>
      </section>

      <footer className="campaign-footer" role="contentinfo">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome}>VIDEOCLAW</a>
        <p>{publicIndexing ? 'US Demo Day founder content system · September 2026' : 'Private campaign preview · US Demo Day continuity · September 2026'}</p>
        <a href="#top">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
