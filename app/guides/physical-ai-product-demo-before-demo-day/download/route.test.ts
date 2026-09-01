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
    expect(markdown).toContain('- [ ] Conditional — Describe a prototype when its status is visible to the audience. A human owner approves the label.');
    expect(markdown).toContain('## 48-hour clock');
    expect(markdown.match(/^- (?:48|24|2) hours? before:/gm)).toHaveLength(3);
    expect(markdown).toContain('## 14-day sequence');
    expect(markdown.match(/^- Day (?:1|7|14):/gm)).toHaveLength(3);
    expect(markdown.indexOf('- 48 hours before:')).toBeLessThan(markdown.indexOf('- 24 hours before:'));
    expect(markdown.indexOf('- 24 hours before:')).toBeLessThan(markdown.indexOf('- 2 hours before:'));
    expect(markdown.indexOf('- Day 1:')).toBeLessThan(markdown.indexOf('- Day 7:'));
    expect(markdown.indexOf('- Day 7:')).toBeLessThan(markdown.indexOf('- Day 14:'));
    expect(markdown).toContain('## Review prompts');
    expect(markdown).toContain('- What must the audience see to understand the founder decision?');
    expect(markdown).toContain('- Which approved record verifies the physical action?');
    expect(markdown).toContain('- What should happen after the demonstration?');
    expect(markdown).toContain('## Measurement');
    expect(markdown).toContain('https://www.nist.gov/itl/ai-risk-management-framework');
    expect(markdown).toContain('FTC Advertising and Marketing Basics');
    expect(markdown).toContain('https://www.ftc.gov/business-guidance/advertising-marketing/advertising-marketing-basics');
    expect(markdown).not.toContain('https://www.ftc.gov/business-guidance/blog/2023/02/keep-your-ai-claims-check');
    expect(markdown).not.toMatch(/dream/i);
  });
});
