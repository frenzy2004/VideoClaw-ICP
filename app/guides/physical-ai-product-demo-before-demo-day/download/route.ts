import { physicalAiGuide } from '../../../campaign-2-pilot-data';

const filename = 'videoclaw-physical-ai-demo-day-preflight.md';

function checklist(items: readonly { label?: string; state?: string; copy?: string; requirement?: string }[]) {
  return items.map((item) => {
    const label = item.label ?? (item.state ? `${item.state.charAt(0).toUpperCase()}${item.state.slice(1)}` : 'Control');
    const detail = item.requirement ?? item.copy;
    return `- [ ] ${label} — ${detail}`;
  }).join('\n');
}

export function physicalAiGuideMarkdown() {
  return [
    '# Physical-AI Demo Day Preflight',
    '',
    physicalAiGuide.directAnswer,
    '',
    '## Five-step story structure',
    ...physicalAiGuide.storyStructure.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Source-pack checklist',
    checklist(physicalAiGuide.sourcePackFields),
    '',
    '## Claim-control checklist',
    checklist(physicalAiGuide.claimLedger),
    '',
    '## Demo controls',
    ...physicalAiGuide.controls.map((control) => `- ${control}`),
    '',
    '## Investor and customer review matrix',
    '| Audience | Question |',
    '| --- | --- |',
    ...physicalAiGuide.audienceVariants.map((variant) => `| ${variant.audience} | ${variant.question} |`),
    '',
    '## 48-hour clock',
    ...physicalAiGuide.activationClock.filter((item) => item.window === '48 hours').map((item) => `- ${item.window}: ${item.action}`),
    '',
    '## 14-day sequence',
    ...physicalAiGuide.activationClock.filter((item) => item.window === '14 days').map((item) => `- ${item.window}: ${item.action}`),
    '',
    '## Approval boundary',
    'AI can organize approved inputs; a named human owner approves claims, labels, rights, privacy, and release.',
    '',
    '## Measurement',
    '| Metric | Evidence | Owner |',
    '| --- | --- | --- |',
    ...physicalAiGuide.measurementDefinitions.map((definition) => `| ${definition.metric} | ${definition.evidence} | ${definition.owner} |`),
    '',
    '## Limitations',
    ...physicalAiGuide.limitations.map((limitation) => `- ${limitation}`),
    '',
    '## Dated sources',
    ...physicalAiGuide.datedSources.map((source) => `- ${source.label} (checked ${source.checkedAt}): ${source.url}`),
    '',
    '## Change log',
    ...physicalAiGuide.changeLog.map((entry) => `- ${entry.date}: ${entry.change}`),
    '',
  ].join('\n');
}

export function GET() {
  return new Response(physicalAiGuideMarkdown(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
