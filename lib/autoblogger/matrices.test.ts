import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { intakeCampaignMatrices, intakeMatrixCandidates } from './matrices';

const wideTable = `
| article_id | funnel stage | search intent | primary keyword | secondary keywords | title | human-readable slug |
| --- | --- | --- | --- | --- | --- | --- |
| vc-c2-001 | top | informational | Demo Day video plan | startup Demo Day video plan; Demo Day media assets | Demo Day Video Plan | demo-day-video-plan |
`;

const fieldTable = `
### vc-c1-001
| field | value |
| --- | --- |
| \`article_id\` | \`vc-c1-001\` |
| \`funnel_stage\` | \`top\` |
| \`search_intent\` | \`informational\` |
| \`primary_keyword\` | \`Startup Funding Plan\` |
| \`secondary_keywords\` | \`funding plan\`; \`startup media\` |
| \`title\` | Funding Plan |
| \`slug\` | \`funding-plan\` |
`;

const labeledSection = `
### vc-c4-001
- **Intent angle:** Direct answer
- **Funnel stage:** middle
- **Search intent:** informational — direct answer
- **Primary keyword:** Video repurposing workflow
- **Secondary keywords:** B2B content repurposing process; source to campaign workflow
- **Title:** What Is a Video Repurposing Workflow?
- **Slug:** what-is-video-repurposing-workflow
`;

describe('matrix intake', () => {
  it('ingests each current matrix layout without requiring fifty candidates', () => {
    expect(intakeMatrixCandidates(wideTable, 'accelerator-demo-day-founder')).toMatchObject([
      {
        articleId: 'vc-c2-001',
        primaryKeyword: 'Demo Day video plan',
        secondaryKeywords: ['startup Demo Day video plan', 'Demo Day media assets'],
        intent: 'informational',
      },
    ]);
    expect(intakeMatrixCandidates(fieldTable, 'newly-funded-founder')[0]).toMatchObject({
      articleId: 'vc-c1-001',
      slug: 'funding-plan',
    });
    expect(intakeMatrixCandidates(labeledSection, 'gtm-content-repurposing-buyer')[0]).toMatchObject({
      articleId: 'vc-c4-001',
      funnelStage: 'middle',
      intent: 'informational',
    });
  });

  it('rejects normalization collisions across incremental matrix input', () => {
    const result = intakeCampaignMatrices([
      { campaignId: 'accelerator-demo-day-founder', markdown: wideTable },
      {
        campaignId: 'video-production-comparison',
        markdown: wideTable.replaceAll('vc-c2-001', 'vc-c3-001').replaceAll('Demo Day video plan', 'Démo-Day: Video Plan'),
      },
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.rejections).toEqual([
      expect.objectContaining({ reason: 'duplicate_keyword' }),
    ]);
  });

  it('intakes every checked-in campaign matrix without imposing a fixed portfolio size', () => {
    const matrices = [
      ['newly-funded-founder', 'newly-funded-founder-article-matrix.md'],
      ['accelerator-demo-day-founder', 'accelerator-demo-day-founder-article-matrix.md'],
      ['video-production-comparison', 'video-production-comparison-article-matrix.md'],
      ['gtm-content-repurposing-buyer', 'gtm-content-repurposing-buyer-article-matrix.md'],
      ['portfolio-media-platform', 'portfolio-media-platform-article-matrix.md'],
    ] as const;
    const result = intakeCampaignMatrices(matrices.map(([campaignId, filename]) => ({
      campaignId,
      markdown: readFileSync(join(process.cwd(), 'docs/research/campaigns', filename), 'utf8'),
    })));

    expect(new Set(result.candidates.map(({ campaignId }) => campaignId))).toEqual(new Set(matrices.map(([campaignId]) => campaignId)));
    expect(result.candidates.length).toBeGreaterThan(matrices.length);
    expect(result.rejections).toEqual([]);
  });
});
