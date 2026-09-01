'use client';

import { useEffect, useState } from 'react';

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
  const completed = Object.values(selected).filter(Boolean).length;
  const missing = checks.filter(([key]) => !selected[key]);
  const ready = completed === checks.length;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('videoclaw:conversion', { detail: 'demo_day_page_view' }));
  }, []);

  function toggle(key: CheckKey) {
    const firstAction = completed === 0;
    setSelected((current) => ({ ...current, [key]: !current[key] }));
    if (firstAction) window.dispatchEvent(new CustomEvent('videoclaw:conversion', { detail: 'source_pack_start' }));
  }

  async function copyChecklist() {
    const lines = checks.map(([, label]) => `- [ ] ${label}`).join('\n');
    try {
      await navigator.clipboard.writeText(`VideoClaw Demo Day source pack\n\n${lines}`);
      setCopied(true);
      window.dispatchEvent(new CustomEvent('videoclaw:conversion', { detail: 'source_checklist_copy' }));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="section diagnostic-section" id="source-pack" aria-labelledby="source-title">
      <div className="section-heading diagnostic-heading">
        <div><p className="card-label">INTERACTIVE SOURCE-PACK DIAGNOSTIC</p><h2 id="source-title">Can your story enter production safely?</h2></div>
        <div className="score" aria-live="polite"><strong>{completed}/{checks.length}</strong><span>{ready ? 'READY FOR HUMAN REVIEW' : 'REQUIREMENTS CONFIRMED'}</span></div>
      </div>
      <div className="check-grid">
        {checks.map(([key, label, helper], index) => (
          <label className={`check-card ${selected[key] ? 'checked' : ''}`} key={key}>
            <input type="checkbox" checked={selected[key]} onChange={() => toggle(key)} />
            <span className="check-number">0{index + 1}</span><span className="fake-check" aria-hidden="true">{selected[key] ? '✓' : ''}</span><strong>{label}</strong><small>{helper}</small>
          </label>
        ))}
      </div>
      <div className={`readiness ${ready ? 'ready' : ''}`} aria-live="polite">
        <div><p className="card-label">READINESS RESULT</p><h3>{ready ? 'Complete enough for source review—not automatic generation.' : `Partial pack · ${missing.length} control${missing.length === 1 ? '' : 's'} unresolved.`}</h3><p>{ready ? 'A human still needs to inspect the files, claim evidence, privacy restrictions, and current VideoClaw capability before setting a paid-generation cap.' : `Resolve next: ${missing.slice(0, 3).map(([, label]) => label).join(', ')}${missing.length > 3 ? ', and the remaining controls' : ''}.`}</p></div>
        <button type="button" onClick={copyChecklist}>{copied ? 'COPIED ✓' : 'COPY THE 8-POINT CHECKLIST'}</button>
      </div>
    </section>
  );
}
