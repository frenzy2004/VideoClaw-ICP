import type { Metadata } from 'next';
import CampaignVideo from '../../campaign-video';
import { campaignTranscripts } from '../../campaign-transcripts';
import {
  DREAM_PILOT_PATH,
  dreamPilot,
  privateRobots,
} from '../../campaign-2-pilot-data';
import { CAMPAIGN_URLS } from '../../campaign-content';

export const metadata: Metadata = {
  title: 'Private Physical-AI Qualification Dossier | VideoClaw',
  description: 'A private, source-controlled qualification dossier for a non-affiliated physical-AI Demo Day review.',
  robots: privateRobots(),
};

const genericVideoCaption =
  'VideoClaw campaign-method illustration only. This is not Dream footage, a Dream product demonstration, or evidence of Dream participation.';

export default function DreamDemoDayDossierPage() {
  const prohibitedClaims = dreamPilot.claimLedger.filter((claim) => claim.state === 'prohibited');
  const selectionRationaleSource = dreamPilot.publicFacts[0];

  return (
    <div className="dream-dossier" data-vc-page-path={DREAM_PILOT_PATH}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <p className="dream-ribbon">{dreamPilot.notice}</p>

      <header className="dream-masthead">
        <a className="wordmark" href={CAMPAIGN_URLS.siteHome} aria-label="VideoClaw home">VIDEOCLAW</a>
        <nav aria-label="Dossier sections">
          <a href="#evidence">Evidence</a>
          <a href="#controls">Controls</a>
          <a href="#decision">Decision</a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="dream-hero" aria-labelledby="dossier-title">
          <p className="dream-label">PRIVATE REVIEW · PHYSICAL-AI DEMO DAY</p>
          <h1 id="dossier-title">A source-controlled qualification review before production.</h1>
          <p>{dreamPilot.campaignJob}</p>
        </section>

        <section className="dream-section dream-context" id="evidence" aria-labelledby="selection-rationale-title">
          <div>
            <p className="dream-label">PUBLIC CONTEXT, NOT PARTICIPATION</p>
            <h2 id="selection-rationale-title">Selection rationale</h2>
          </div>
          <ul>
            {dreamPilot.selectionRationale.map((rationale, index) => (
              <li key={rationale}>
                {rationale}
                {index === 0 ? <><a href={selectionRationaleSource.sourceUrl}>Dream public company profile</a> <span>Checked {selectionRationaleSource.checkedAt}</span></> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="dream-section dream-facts" aria-labelledby="public-facts-title">
          <div>
            <p className="dream-label">DATED PUBLIC SOURCES</p>
            <h2 id="public-facts-title">Qualification facts and boundaries</h2>
          </div>
          <div className="dream-fact-grid">
            {dreamPilot.publicFacts.map((fact) => (
              <article key={fact.label}>
                <h3>{fact.label}</h3>
                <p>{fact.copy}</p>
                <p><a href={fact.sourceUrl}>Dream public company profile</a> <span>Checked {fact.checkedAt}</span></p>
                <dl>
                  <div><dt>Safe use</dt><dd>{fact.safeUse}</dd></div>
                  <div><dt>Not supported</dt><dd>{fact.notSupported}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="dream-section dream-exclusions" aria-labelledby="exclusions-title">
          <div>
            <p className="dream-label">NON-NEGOTIABLE BOUNDARIES</p>
            <h2 id="exclusions-title">Exclusions</h2>
          </div>
          <ul>{dreamPilot.exclusions.map((exclusion) => <li key={exclusion}>{exclusion}</li>)}</ul>
        </section>

        <section className="dream-video-section" aria-labelledby="method-illustration-title">
          <div>
            <p className="dream-label">GENERIC VIDEOCLAW BASE MASTER</p>
            <h2 id="method-illustration-title">Campaign method, kept separate from the account.</h2>
          </div>
          <CampaignVideo
            id="dream-dossier-generic-method"
            src="/media/demo-day/base-16x9.mp4"
            poster="/media/demo-day/base-poster.jpg"
            captionsSrc="/media/demo-day/base.en.vtt"
            title="VideoClaw campaign-method overview — generic illustration"
            caption={genericVideoCaption}
            transcript={campaignTranscripts.base}
            preload="metadata"
          />
        </section>

        <section className="dream-section dream-gate" id="controls" aria-labelledby="qualification-gate-title">
          <div>
            <p className="dream-label">PRODUCTION CONTROL</p>
            <h2 id="qualification-gate-title">Qualification gate</h2>
          </div>
          <p>{dreamPilot.qualificationGate}</p>
        </section>

        <section className="dream-section" aria-labelledby="storyboard-title">
          <div>
            <p className="dream-label">SEQUENCE BEFORE CAPTURE</p>
            <h2 id="storyboard-title">Seven-beat storyboard</h2>
          </div>
          <ol className="dream-storyboard">
            {dreamPilot.storyboard.map((beat, index) => (
              <li key={beat.id}><span>0{index + 1}</span><h3>{beat.title}</h3><p>{beat.purpose}</p></li>
            ))}
          </ol>
        </section>

        <section className="dream-section dream-table-section" aria-labelledby="source-pack-title">
          <div>
            <p className="dream-label">INPUT REQUIREMENTS</p>
            <h2 id="source-pack-title">Source-pack matrix</h2>
          </div>
          <div className="dream-table-wrap" tabIndex={0}>
            <table className="dream-source-pack">
              <thead><tr><th>Control</th><th>Requirement</th></tr></thead>
              <tbody>{dreamPilot.sourcePackFields.map((field) => <tr key={field.id}><th scope="row">{field.label}</th><td>{field.requirement}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="dream-section dream-table-section" aria-labelledby="claim-ledger-title">
          <div>
            <p className="dream-label">COPY CONTROL</p>
            <h2 id="claim-ledger-title">Claim ledger</h2>
          </div>
          <div className="dream-table-wrap" tabIndex={0}>
            <table className="dream-claim-ledger">
              <thead><tr><th>State</th><th>Claim</th><th>Condition</th></tr></thead>
              <tbody>{dreamPilot.claimLedger.map((claim) => <tr key={claim.copy}><td>{claim.state}</td><td>{claim.copy}</td><td>{'condition' in claim ? claim.condition : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="dream-section dream-prohibited" aria-labelledby="prohibited-title">
          <div>
            <p className="dream-label">DO NOT IMPLY</p>
            <h2 id="prohibited-title">Prohibited implications</h2>
          </div>
          <ul>{prohibitedClaims.map((claim) => <li key={claim.copy}>{claim.copy}</li>)}</ul>
        </section>

        <section className="dream-section" aria-labelledby="audience-variants-title">
          <div>
            <p className="dream-label">FIXED FACTS · DIFFERENT QUESTIONS</p>
            <h2 id="audience-variants-title">Audience variants</h2>
          </div>
          <div className="dream-variant-grid">
            {dreamPilot.variants.map((variant) => <article key={variant.audience}><h3>{variant.audience}</h3><p>{variant.emphasis}</p></article>)}
          </div>
        </section>

        <section className="dream-section dream-panel" aria-label="Research and answer panels">
          <details open>
            <summary><span>Research queries</span></summary>
            <ul>{dreamPilot.searchTerms.map((term) => <li key={term}>{term}</li>)}</ul>
          </details>
          <details>
            <summary><span>Answer prompts</span></summary>
            <ol>{dreamPilot.answerPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol>
          </details>
        </section>

        <section className="dream-section dream-table-section" aria-labelledby="measurement-title">
          <div>
            <p className="dream-label">CONTROL MEASUREMENT</p>
            <h2 id="measurement-title">Measurement table</h2>
          </div>
          <div className="dream-table-wrap" tabIndex={0}>
            <table className="dream-measurement">
              <thead><tr><th>Metric</th><th>Evidence</th><th>Owner</th></tr></thead>
              <tbody>{dreamPilot.measurementDefinitions.map((definition) => <tr key={definition.metric}><th scope="row">{definition.metric}</th><td>{definition.evidence}</td><td>{definition.owner}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="dream-decision" id="decision" aria-labelledby="authorization-decision-title">
          <p className="dream-label">NO PRODUCTION AUTHORIZATION YET</p>
          <h2 id="authorization-decision-title">Production authorization decision</h2>
          <p>{dreamPilot.authorizationDecision}</p>
        </section>
      </main>
    </div>
  );
}
