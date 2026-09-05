import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('persistent autoblogger GitHub Actions boundary', () => {
  it('gates disabled schedules before checkout or paid work and serializes state updates', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    expect(workflow).toContain("cron: '0 16 * * 1'");
    expect(workflow).toMatch(/concurrency:\s+[\s\S]*group:\s*videoclaw-persistent-autoblogger[\s\S]*cancel-in-progress:\s*false/u);
    expect(workflow).toMatch(/permissions:\s+[\s\S]*contents:\s*write[\s\S]*pull-requests:\s*read/u);
    const jobGate = workflow.indexOf("github.event_name == 'workflow_dispatch' || vars.AUTOBLOG_SCHEDULE_ENABLED == 'true'");
    const checkout = workflow.indexOf('actions/checkout@');
    expect(jobGate).toBeGreaterThan(0);
    expect(checkout).toBeGreaterThan(jobGate);
  });

  it('uses frozen pnpm, bounded execution, conditional GitHub App auth, and always uploads artifacts', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    expect(workflow).toContain('timeout-minutes: 45');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('actions/create-github-app-token@v3');
    expect(workflow).toContain("env.LANDER_BASE_REF == 'main'");
    expect(workflow).toContain("env.AUTOBLOG_COMMAND == 'run'");
    expect(workflow).toContain('secrets.LANDER_APP_ID');
    expect(workflow).toContain('secrets.LANDER_APP_PRIVATE_KEY');
    expect(workflow).toMatch(/actions\/upload-artifact@v4[\s\S]*if:\s*always\(\)/u);
    expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(workflow).not.toMatch(/LANDER_GITHUB_TOKEN:\s*\$\{\{\s*github\.token/u);
  });
});
