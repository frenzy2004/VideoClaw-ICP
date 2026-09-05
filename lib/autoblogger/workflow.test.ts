import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('persistent autoblogger GitHub Actions boundary', () => {
  it('gates disabled schedules before checkout or paid work and serializes state updates', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    expect(workflow).toContain("cron: '0 16 * * 1'");
    expect(workflow).toMatch(/concurrency:\s+[\s\S]*group:\s*videoclaw-persistent-autoblogger[\s\S]*cancel-in-progress:\s*false/u);
    expect(workflow).toMatch(/permissions:\s+contents:\s*write/u);
    const jobGate = workflow.indexOf("github.event_name == 'workflow_dispatch' || vars.AUTOBLOG_SCHEDULE_ENABLED == 'true'");
    const checkout = workflow.indexOf('actions/checkout@');
    expect(jobGate).toBeGreaterThan(0);
    expect(checkout).toBeGreaterThan(jobGate);
  });

  it('uses frozen pnpm, bounded execution, conditional GitHub App auth, and always uploads artifacts', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    expect(workflow).toContain('timeout-minutes: 45');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toMatch(/actions\/create-github-app-token@[0-9a-f]{40}/u);
    expect(workflow).toContain("env.LANDER_BASE_REF == 'main'");
    expect(workflow).toContain("env.AUTOBLOG_COMMAND == 'run'");
    expect(workflow).toContain('secrets.LANDER_APP_ID');
    expect(workflow).toContain('secrets.LANDER_APP_PRIVATE_KEY');
    expect(workflow).toMatch(/actions\/upload-artifact@[0-9a-f]{40}[\s\S]*if:\s*always\(\)/u);
    expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(workflow).not.toMatch(/LANDER_GITHUB_TOKEN:\s*\$\{\{\s*github\.token/u);
  });

  it('isolates paid keys, private checkout access, and publication auth from installation and QA', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    const [job, ...steps] = workflow.split(/\n      - name: /u);
    expect(job).not.toMatch(/secrets\.|github\.token/u);
    const paid = steps.find((step) => step.startsWith('Prepare research or drafts'))!;
    const publish = steps.find((step) => step.startsWith('Publish prepared drafts'))!;
    expect(paid).toBeTruthy();
    expect(publish).toBeTruthy();
    for (const step of steps) {
      if (step !== paid) expect(step).not.toMatch(/secrets\.(APIFY_TOKEN|OPENAI_API_KEY|SEMRUSH_API_KEY|AHREFS_API_KEY)/u);
      if (step !== publish) expect(step).not.toContain('LANDER_GITHUB_TOKEN:');
      if (/uses: actions\/checkout@/u.test(step)) expect(step).toContain('persist-credentials: false');
    }
    expect(paid).not.toMatch(/lander-app-token|LANDER_GITHUB_TOKEN/u);
    expect(paid).toContain('LANDER_READ_TOKEN: ${{ secrets.LANDER_READ_TOKEN }}');
    expect(publish).not.toContain('LANDER_READ_TOKEN');
    expect(paid).toContain("env.AUTOBLOG_COMMAND != 'research'");
    expect(paid).toContain('--phase prepare');
    expect(publish).toContain('--phase publish');
    expect(publish).toContain('--prepared-dir');
    expect(publish).not.toMatch(/APIFY_TOKEN|OPENAI_API_KEY|SEMRUSH_API_KEY|AHREFS_API_KEY/u);
    const checkout = steps.find((step) => step.startsWith('Check out private lander'))!;
    expect(checkout).toContain('token: ${{ secrets.LANDER_READ_TOKEN }}');
    expect(checkout).not.toContain('github.token');
    expect(workflow.indexOf('Check private lander read access')).toBeLessThan(workflow.indexOf('Prepare research or drafts'));
    expect(workflow).toContain('permission-contents: write');
    expect(workflow).toContain('permission-pull-requests: write');
    const nativeInstall = steps.find((step) => step.startsWith('Install native lander test dependencies'))!;
    const nativeTest = steps.find((step) => step.startsWith('Verify native lander integration'))!;
    expect(nativeInstall).toContain('working-directory: .autoblogger-lander');
    expect(nativeInstall).toContain('run: npm ci');
    expect(nativeTest).toContain('AUTOBLOG_NATIVE_LANDER_PATH: ${{ github.workspace }}/.autoblogger-lander');
    expect(nativeTest).toContain('pnpm test lib/autoblogger/offline-e2e.test.ts');
    expect(steps.indexOf(nativeInstall)).toBeGreaterThan(steps.indexOf(checkout));
    expect(steps.indexOf(nativeTest)).toBeGreaterThan(steps.indexOf(nativeInstall));
    expect(steps.indexOf(nativeTest)).toBeLessThan(steps.indexOf(paid));
    expect(nativeInstall + nativeTest).not.toMatch(/secrets\.|github\.token/u);
  });

  it('pins every action to a full commit and defaults manual proving runs to one draft', async () => {
    const workflow = await readFile('.github/workflows/persistent-autoblogger.yml', 'utf8');
    const actions = [...workflow.matchAll(/uses:\s+(\S+)/gu)].map((match) => match[1]);
    expect(actions.length).toBeGreaterThanOrEqual(5);
    for (const action of actions) expect(action).toMatch(/^[\w/-]+@[0-9a-f]{40}$/u);
    expect(workflow).toMatch(/max_drafts:[\s\S]*?default: '1'/u);
    expect(workflow).toContain("github.event_name == 'schedule' && '3'");
    expect(workflow).toContain('--max-drafts "$AUTOBLOG_MAX_DRAFTS"');
  });
});
