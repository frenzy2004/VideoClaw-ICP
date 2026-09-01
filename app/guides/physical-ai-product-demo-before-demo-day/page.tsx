import type { Metadata } from 'next';
import {
  PHYSICAL_AI_GUIDE_PATH,
  physicalAiGuide,
  privateRobots,
} from '../../campaign-2-pilot-data';
import { CAMPAIGN_URLS } from '../../campaign-content';

export const metadata: Metadata = {
  title: 'Physical-AI Product Demo Preflight | VideoClaw',
  description: 'A private, source-controlled Demo Day preflight for physical-AI product demonstrations.',
  robots: privateRobots(),
};

export default function PhysicalAiDemoDayGuidePage() {
  const fortyEightHourClock = physicalAiGuide.activationClock.filter((item) => item.window === '48 hours');
  const fourteenDaySequence = physicalAiGuide.activationClock.filter((item) => item.window === '14 days');

  return (
    <div className="physical-ai-guide" data-vc-page-path={PHYSICAL_AI_GUIDE_PATH}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <p className="physical-ai-guide-ribbon">PRIVATE REVIEW GUIDE · NOINDEX</p>
      <header className="physical-ai-guide-masthead">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome} aria-label="VideoClaw home">VIDEOCLAW</a>
        <nav aria-label="Guide sections">
          <a href="#story">Story</a>
          <a href="#controls">Controls</a>
          <a href="#review">Review</a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="physical-ai-guide-hero" aria-labelledby="physical-ai-guide-title">
          <p className="physical-ai-guide-label">PHYSICAL-AI DEMO DAY PREFLIGHT</p>
          <h1 id="physical-ai-guide-title">Physical-AI product demo before Demo Day</h1>
          <section className="physical-ai-direct-answer" aria-label="Direct answer">
            <p>{physicalAiGuide.directAnswer}</p>
          </section>
          <a
            className="physical-ai-download"
            href={`${PHYSICAL_AI_GUIDE_PATH}/download`}
            data-vc-event="article_click"
            data-vc-article-id="physical-ai-demo-day-guide"
            data-vc-link-id="physical-ai-guide-download"
            data-vc-placement="guide-body"
          >
            Download the Markdown preflight
          </a>
        </section>

        <section className="physical-ai-guide-section physical-ai-story" id="story" aria-labelledby="story-title">
          <div>
            <p className="physical-ai-guide-label">ONE LEGIBLE CHAIN OF PROOF</p>
            <h2 id="story-title">Founder-to-evidence story</h2>
          </div>
          <ol className="physical-ai-story-list" aria-label="Five-step story structure">
            {physicalAiGuide.storyStructure.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}</li>)}
          </ol>
        </section>

        <section className="physical-ai-guide-section physical-ai-controls" id="controls" aria-labelledby="controls-title">
          <div>
            <p className="physical-ai-guide-label">CONTROL BEFORE CAPTURE</p>
            <h2 id="controls-title">Show only what has been reviewed</h2>
          </div>
          <ul className="physical-ai-control-list" aria-label="Demo controls">
            {physicalAiGuide.controls.map((control) => <li key={control}>{control}</li>)}
          </ul>
        </section>

        <section className="physical-ai-guide-section physical-ai-table-section" aria-labelledby="variants-title">
          <div>
            <p className="physical-ai-guide-label">SAME EVIDENCE · DIFFERENT QUESTION</p>
            <h2 id="variants-title">Audience variants</h2>
          </div>
          <div className="physical-ai-table-wrap" tabIndex={0}>
            <table aria-label="Investor and customer review matrix">
              <thead><tr><th>Audience</th><th>Question</th></tr></thead>
              <tbody>{physicalAiGuide.audienceVariants.map((variant) => <tr key={variant.audience}><th scope="row">{variant.audience}</th><td>{variant.question}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="physical-ai-guide-section physical-ai-clock" aria-labelledby="clock-title">
          <div>
            <p className="physical-ai-guide-label">ACTIVATION CLOCK</p>
            <h2 id="clock-title">Review while the evidence is still close to the capture</h2>
          </div>
          <div className="physical-ai-clock-grid">
            <article><h3>48-hour clock</h3><ol>{fortyEightHourClock.map((item) => <li key={item.window}><time>{item.window}</time><p>{item.action}</p></li>)}</ol></article>
            <article><h3>14-day sequence</h3><ol>{fourteenDaySequence.map((item) => <li key={item.window}><time>{item.window}</time><p>{item.action}</p></li>)}</ol></article>
          </div>
        </section>

        <section className="physical-ai-guide-section physical-ai-template-section" aria-labelledby="templates-title">
          <div>
            <p className="physical-ai-guide-label">VISIBLE WORKING TEMPLATES</p>
            <h2 id="templates-title">Source evidence and claim control</h2>
          </div>
          <div className="physical-ai-template-grid">
            <article>
              <h3>Source-pack template</h3>
              <dl>{physicalAiGuide.sourcePackFields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{field.requirement}</dd></div>)}</dl>
            </article>
            <article>
              <h3>Claim-ledger template</h3>
              <dl>{physicalAiGuide.claimLedger.map((claim) => <div key={claim.copy}><dt>{claim.state}</dt><dd>{claim.copy}{'condition' in claim ? ` ${claim.condition}` : ''}</dd></div>)}</dl>
            </article>
          </div>
        </section>

        <section className="physical-ai-guide-section physical-ai-review" id="review" aria-labelledby="approval-title">
          <div>
            <p className="physical-ai-guide-label">APPROVAL BOUNDARY</p>
            <h2 id="approval-title">AI supports the review; people own the release.</h2>
          </div>
          <p>{physicalAiGuide.approvalBoundary}</p>
          <div className="physical-ai-prompt-list" aria-label="Review prompts">
            {physicalAiGuide.answerPrompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
          </div>
        </section>

        <section className="physical-ai-guide-section physical-ai-table-section" aria-labelledby="measurement-title">
          <div>
            <p className="physical-ai-guide-label">EVIDENCE OF CONTROL</p>
            <h2 id="measurement-title">Measurement</h2>
          </div>
          <div className="physical-ai-table-wrap" tabIndex={0}>
            <table>
              <thead><tr><th>Metric</th><th>Evidence</th><th>Owner</th></tr></thead>
              <tbody>{physicalAiGuide.measurementDefinitions.map((definition) => <tr key={definition.metric}><th scope="row">{definition.metric}</th><td>{definition.evidence}</td><td>{definition.owner}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="physical-ai-guide-section physical-ai-limitations" aria-labelledby="limitations-title">
          <div>
            <p className="physical-ai-guide-label">WHAT THIS DOES NOT PROVE</p>
            <h2 id="limitations-title">Limitations</h2>
          </div>
          <ul>{physicalAiGuide.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </section>

        <section className="physical-ai-guide-section physical-ai-sources" aria-labelledby="sources-title">
          <div>
            <p className="physical-ai-guide-label">REVIEWED REFERENCES</p>
            <h2 id="sources-title">Dated sources</h2>
          </div>
          <ul>{physicalAiGuide.datedSources.map((source) => <li key={source.url}><a href={source.url}>{source.label}</a><time>Checked {source.checkedAt}</time></li>)}</ul>
        </section>

        <section className="physical-ai-guide-section physical-ai-change-log" aria-labelledby="change-log-title">
          <div>
            <p className="physical-ai-guide-label">TEMPLATE HISTORY</p>
            <h2 id="change-log-title">Change log</h2>
          </div>
          <ol>{physicalAiGuide.changeLog.map((entry) => <li key={entry.date}><time>{entry.date}</time><span>{entry.change}</span></li>)}</ol>
        </section>
      </main>
    </div>
  );
}
