import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('Physical-AI Demo Day Markdown download', () => {
  it('downloads the complete generic preflight as Markdown', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="videoclaw-physical-ai-demo-day-preflight.md"',
    );
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const markdown = await response.text();
    expect(markdown).toContain('## Source-pack checklist');
    expect(markdown).toContain('- [ ] Rights and permissions — Record the owner, permitted use, scope, and expiry for every asset.');
    expect(markdown).toContain('## Claim-control checklist');
    expect(markdown).toContain('- [ ] Approved — State only what the approved evidence demonstrates.');
    expect(markdown).toContain('## 48-hour clock');
    expect(markdown).toContain('Freeze the story, source pack, and claim ledger before capture.');
    expect(markdown).toContain('## 14-day sequence');
    expect(markdown).toContain('Run review, revise approved evidence, and prepare the Demo Day cut.');
    expect(markdown).toContain('## Measurement');
    expect(markdown).toContain('https://www.nist.gov/itl/ai-risk-management-framework');
    expect(markdown).toContain('https://www.ftc.gov/business-guidance/blog/2023/02/keep-your-ai-claims-check');
    expect(markdown).not.toMatch(/dream/i);
  });
});
