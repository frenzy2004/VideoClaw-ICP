'use client';

import { useEffect, useRef, useState } from 'react';
import { emitCampaignEvent } from './campaign-analytics';

const checks = [
  ['story', 'Approved story', 'Problem, product mechanism, proof, why now, and next action are agreed.'],
  ['founder', 'Founder or narration source', 'A clean 30–90 second take exists and public-use consent is recorded.'],
  ['product', 'Product proof', 'One screen workflow, physical action, or labeled prototype can be shown honestly.'],
  ['evidence', 'Cleared evidence', 'One result, milestone, benchmark, or usage fact has support and permission.'],
  ['restrictions', 'Claims and restrictions', 'Prohibited wording, confidential material, and evidence-required claims are marked.'],
  ['rights', 'Rights and data', 'Logos, footage, likeness, music, and screen data are permitted for the intended use.'],
  ['deadline', 'Deadline, audience, and CTA', 'The exact publish date, primary viewer, and one next action are named.'],
  ['approver', 'Final approver', 'One person has authority to approve story, product, privacy, and final output.'],
] as const;

type CheckKey = (typeof checks)[number][0];

export default function SourcePackCheck() {
  const [selected, setSelected] = useState<Record<CheckKey, boolean>>(() => Object.fromEntries(checks.map(([key]) => [key, false])) as Record<CheckKey, boolean>);
  const [copied, setCopied] = useState(false);
  const completionSent = useRef(false);
  const completed = Object.values(selected).filter(Boolean).length;
  const missing = checks.filter(([key]) => !selected[key]);
  const ready = completed === checks.length;

  useEffect(() => {
    if (completed !== checks.length || completionSent.current) return;
    completionSent.current = true;
    emitCampaignEvent({
      event: 'source_pack_complete',
      pagePath: window.location.pathname,
      timestamp: new Date().toISOString(),
      context: {
        source_pack_id: 'demo-day-source-pack',
        source_type: 'mixed',
        items_total: checks.length,
        items_completed: checks.length,
      },
    });
  }, [completed]);

  function toggle(key: CheckKey) {
    setSelected((current) => ({ ...current, [key]: !current[key] }));
  }

  async function copyChecklist() {
    const lines = checks.map(([, label]) => `- [ ] ${label}`).join('\n');
    try {
      await navigator.clipboard.writeText(`VideoClaw Demo Day source pack\n\n${lines}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="section diagnostic-section"
      id="source-pack"
      aria-labelledby="source-title"
      data-vc-source-pack-id="demo-day-source-pack"
      data-vc-source-type="mixed"
      data-vc-items-total="8"
    >
      <div className="section-heading diagnostic-heading">
        <div><p className="card-label">LOCAL SOURCE-PACK DIAGNOSTIC</p><h2 id="source-title">Is your source pack ready for an internal decision?</h2></div>
        <div className="score" aria-live="polite" aria-atomic="true"><strong>{completed}/{checks.length}</strong><span>CONTROLS CHECKED</span></div>
      </div>
      <p className="diagnostic-disclosure">
        This is a local checkbox-only readiness aid. Nothing is uploaded, transmitted, stored, reviewed, or sent
        for generation. Do not enter or share confidential material here.
      </p>
      <div className="check-grid">
        {checks.map(([key, label, helper], index) => (
          <label className={`check-card ${selected[key] ? 'checked' : ''}`} key={key}>
            <input type="checkbox" checked={selected[key]} onChange={() => toggle(key)} />
            <span className="check-number">0{index + 1}</span><span className="fake-check" aria-hidden="true">{selected[key] ? '✓' : ''}</span><strong>{label}</strong><small>{helper}</small>
          </label>
        ))}
      </div>
      <div className={`readiness ${ready ? 'ready' : ''}`}>
        <div><p className="card-label">READINESS RESULT</p><h3>{ready ? 'Eight controls checked—now make an internal go/no-go decision.' : `Partial pack · ${missing.length} control${missing.length === 1 ? '' : 's'} unresolved.`}</h3><p>{ready ? 'Completing this checklist does not submit a request, trigger a review, qualify a pilot, or start generation.' : `Resolve next: ${missing.slice(0, 3).map(([, label]) => label).join(', ')}${missing.length > 3 ? ', and the remaining controls' : ''}.`}</p></div>
        <button type="button" onClick={copyChecklist}>{copied ? 'COPIED ✓' : 'COPY THE 8-POINT CHECKLIST'}</button>
      </div>
    </section>
  );
}
