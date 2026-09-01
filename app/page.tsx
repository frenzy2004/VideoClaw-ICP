import SourcePackCheck from './source-pack-check';
import { CAMPAIGN_URLS } from './campaign-content';

const proofPoints = [
  ['01', 'One approved story', 'The same facts anchor every cut, caption, and call to action.'],
  ['02', 'One real proof sequence', 'Show a screen workflow, physical action, or honestly labeled prototype.'],
  ['03', 'Four viewer jobs', 'Change sequence and emphasis for investors, customers, recruits, and partners.'],
];

const viewerJobs = [
  { viewer: 'Investor', question: 'What should I investigate next?', proof: 'Insight, mechanism, evidence, timing', action: 'Continue the conversation' },
  { viewer: 'Customer', question: 'Will this solve my situation?', proof: 'Workflow, result, implementation reality', action: 'Request a product demo' },
  { viewer: 'Recruit', question: 'Why is this hard and worth joining?', proof: 'Mission, technical problem, team', action: 'View an open role' },
  { viewer: 'Partner / media', question: 'Why is this category changing now?', proof: 'Timing plus one concrete company example', action: 'Learn more' },
];

const workflow = [
  ['01', 'Qualify', 'Confirm the deadline, audience, real product proof, permissions, and approver.'],
  ['02', 'Lock claims', 'Mark every statement approved, evidence-required, confidential, or prohibited.'],
  ['03', 'Plan the proof', 'Map founder → product action → observable result → one next step.'],
  ['04', 'Review and reuse', 'Approve story, screen, privacy, brand, and CTA before any final handoff.'],
];

const pilotConcepts = [
  {
    code: 'PILOT 01 · PHYSICAL AI', name: 'Physical-world evidence',
    premise: 'Can a physical-AI product become clear in one founder-to-observation-to-record sequence?',
    sequence: 'Founder → physical setup → observable action → software record → flagged change',
    control: 'Clear people, identifiers, locations, and evidence wording before use.',
  },
  {
    code: 'PILOT 02 · INDUSTRIAL SOFTWARE', name: 'Industrial planning',
    premise: 'Can a technical planning workflow stay precise without collapsing into vague AI copy?',
    sequence: 'Founder → requirements → modeled options → validation boundary → recommendation',
    control: 'Label prototype state; never imply production deployment without evidence.',
  },
  {
    code: 'PILOT 03 · REGULATED WORKFLOW', name: 'Regulated operations',
    premise: 'Can a regulated B2B workflow be legible using synthetic or explicitly approved data?',
    sequence: 'Founder → controlled intake → coordinated workflow → human review → next operational step',
    control: 'Remove customer data and avoid unsupported autonomy or compliance claims.',
  },
];

const faqs = [
  {
    question: 'What is the difference between an application video, product demo, Demo Day pitch, and follow-up video?',
    answer: 'An application video introduces the founders under a program’s rules. A product demo proves one workflow. A Demo Day pitch presents the company to the event audience. A follow-up video is a short, forwardable asset built around one viewer’s next question. Always confirm the current program requirements.',
  },
  { question: 'Does this replace the pitch deck?', answer: 'No. The deck supports the investment thesis and diligence. The video makes the founder and product easier to understand and forward.' },
  { question: 'Can a prototype be shown?', answer: 'Yes, when it is labeled accurately and the final reviewer confirms that simulated or planned behavior is not presented as production functionality.' },
  { question: 'What should be removed from a screen recording?', answer: 'Remove customer names, personal information, notifications, credentials, confidential roadmaps, internal URLs, unreleased features, unapproved logos, and any data you do not have permission to show.' },
  { question: 'How fast is delivery?', answer: 'The pilot measures turnaround from source acceptance to approval. Final timing depends on source quality, product complexity, review speed, and the current VideoClaw workflow; no same-day promise is made here.' },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="review-ribbon">PRIVATE REVIEW PROTOTYPE · NOT A LIVE OFFER</div>

      <header className="masthead" role="banner">
        <a className="wordmark" href="https://videoclaw.com/" aria-label="VideoClaw home">VIDEOCLAW</a>
        <nav aria-label="Campaign pages and sections">
          <a href={CAMPAIGN_URLS.useCasePath} data-vc-event="article_click" data-vc-article-id="demo-day-founder-content" data-vc-link-id="home-use-case-nav" data-vc-placement="masthead">USE CASE</a>
          <a href={CAMPAIGN_URLS.guidePath} data-vc-event="article_click" data-vc-article-id="founder-story-after-demo-day" data-vc-link-id="home-guide-nav" data-vc-placement="masthead">FOUNDER STORY GUIDE</a>
          <a href="#source-pack">Source pack</a>
          <a href="#workflow">Workflow</a>
        </nav>
        <a className="header-cta" href={CAMPAIGN_URLS.alphaDownload} data-vc-event="alpha_download_click" data-vc-cta-id="masthead-alpha-access" data-vc-placement="masthead">REQUEST PRIVATE-ALPHA MAC ACCESS ↗</a>
      </header>

      <main
        id="top"
        data-vc-campaign-id="c2-demo-day"
        data-vc-page-id="c2-demo-day-prototype"
        data-vc-page-type="commercial"
      >
      <section className="hero" id="main-content" tabIndex={-1} aria-labelledby="hero-title">
        <div className="hero-kicker"><span>FOR US ACCELERATOR FOUNDERS</span><span>DEADLINE INSIDE 7–21 DAYS</span></div>
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="edition">DEMO DAY CONTINUITY · PILOT 01</p>
            <h1 id="hero-title">Demo Day is one moment. Make the founder story keep working.</h1>
            <p className="hero-deck">Turn one approved story and one clean product recording into a forwardable founder-led demo plus investor, customer, and recruiting variants—without changing the underlying claims.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#source-pack" data-vc-event="article_click" data-vc-article-id="demo-day-source-pack" data-vc-link-id="home-source-pack-hero" data-vc-placement="hero">CHECK YOUR SOURCE PACK</a>
              <a className="text-link" href="#workflow">SEE THE CONTROLLED WORKFLOW ↓</a>
            </div>
          </div>
          <aside className="deadline-card" aria-label="Pilot qualification">
            <p className="card-label">YOU ARE READY TO TEST IF</p>
            <ul><li>Your pitch is approved or nearly approved.</li><li>Your product can be shown honestly.</li><li>One proof point is cleared for public use.</li><li>A launch, showcase, or Demo Day is imminent.</li><li>One person has final approval authority.</li></ul>
            <p className="not-for">Not pitch coaching. Not investor lists. Not automated outreach. Not a promise of fundraising results.</p>
          </aside>
        </div>
      </section>

      <section className="proof-strip" aria-label="The output system">
        {proofPoints.map(([number, title, copy]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></article>)}
      </section>

      <section className="section viewer-section" aria-labelledby="viewer-title">
        <div className="section-heading"><p className="card-label">ONE STORY · FOUR VIEWER JOBS</p><h2 id="viewer-title">Do not make four unrelated videos.</h2><p>Use the same approved facts and source material. Change only the sequence, proof emphasis, length, and next action for each viewer.</p></div>
        <div className="viewer-grid">
          {viewerJobs.map((job, index) => (
            <article className="viewer-card" key={job.viewer}><p className="index">0{index + 1}</p><h3>{job.viewer}</h3><p className="viewer-question">“{job.question}”</p><dl><div><dt>Prove</dt><dd>{job.proof}</dd></div><div><dt>Next step</dt><dd>{job.action}</dd></div></dl></article>
          ))}
        </div>
      </section>

      <SourcePackCheck />

      <section className="section workflow-section" id="workflow" aria-labelledby="workflow-title">
        <div className="section-heading inverse-heading"><p className="card-label">CONTROL BEFORE GENERATION</p><h2 id="workflow-title">Every scene points back to an approved source.</h2><p>The pilot records human intervention, paid-generation cost, revisions, and approval. No final asset is handed off until claims, product behavior, sensitive data, brand, and CTA pass review.</p></div>
        <div className="workflow-grid">{workflow.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="section timing-section" aria-labelledby="timing-title">
        <div className="section-heading"><p className="card-label">DEADLINE OPERATING SYSTEM</p><h2 id="timing-title">Build for the 72 hours before—and the 14 days after.</h2></div>
        <div className="timing-grid">
          <article><p className="timing-tag">T−72 HOURS</p><h3>Preflight the truth.</h3><ol><li>Freeze the approved story and claim ledger.</li><li>Record one clean product-proof sequence.</li><li>Approve the storyboard before paid generation.</li><li>Check muted, mobile, backup, caption, and CTA playback.</li></ol></article>
          <article className="green-card"><p className="timing-tag">EVENT → DAY 14</p><h3>Route the next question.</h3><ol><li>Use the core founder demo as the forwardable source.</li><li>Send the investor cut for diligence continuation.</li><li>Use the customer cut around one real workflow.</li><li>Record reuse and qualified actions—not vanity views alone.</li></ol></article>
        </div>
      </section>

      <section className="section pilot-section" id="pilot-lab" aria-labelledby="pilot-title">
        <div className="section-heading"><p className="card-label">PRIVATE PILOT LAB · THREE DIFFERENT PROOF PROBLEMS</p><h2 id="pilot-title">The first tests are deliberately not lookalikes.</h2><p>These are qualification hypotheses, not endorsements or enrolled customers. Each concept tests a different source, privacy, and explanation constraint using the same operating protocol.</p></div>
        <div className="pilot-grid">
          {pilotConcepts.map((pilot) => <article key={pilot.name}><p className="pilot-code">{pilot.code}</p><h3>{pilot.name}</h3><p className="pilot-premise">{pilot.premise}</p><div className="pilot-detail"><span>PROOF SEQUENCE</span><p>{pilot.sequence}</p></div><div className="pilot-detail"><span>HARD CONTROL</span><p>{pilot.control}</p></div></article>)}
        </div>
      </section>

      <section className="section faq-section" aria-labelledby="faq-title">
        <div className="section-heading"><p className="card-label">DIRECT ANSWERS</p><h2 id="faq-title">Demo Day video questions, answered without hype.</h2></div>
        <div className="faq-list">{faqs.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <p className="card-label">THE NEXT STEP IS A READINESS CHECK—not a render</p><h2 id="closing-title">Bring the truth. Then make it forwardable.</h2><p>A usable pilot starts with an approved story, clean founder or narration source, honest product proof, cleared evidence, deadline, CTA, restrictions, and a named approver.</p>
        <div className="hero-actions centered-actions"><a className="primary-button" href="#source-pack" data-vc-event="article_click" data-vc-article-id="demo-day-source-pack" data-vc-link-id="home-source-pack-closing" data-vc-placement="closing">RUN THE SOURCE-PACK CHECK</a><a className="text-link" href={CAMPAIGN_URLS.alphaDownload} data-vc-event="alpha_download_click" data-vc-cta-id="closing-alpha-access" data-vc-placement="closing">REQUEST PRIVATE-ALPHA MAC ACCESS ↗</a></div>
      </section>

      </main>
      <footer role="contentinfo"><a className="wordmark" href="https://videoclaw.com/">VIDEOCLAW</a><p>Private campaign prototype · US Demo Day continuity pilot · September 2026</p><a href="#top">BACK TO TOP ↑</a></footer>
    </>
  );
}
