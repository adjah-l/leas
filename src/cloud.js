import { mkdirSync } from 'node:fs';
import { run, capture, log, LeasError, requireBinary } from './util.js';

/**
 * Cloud builds run the exact same engine as local builds — the only difference
 * is which machine executes it. GitHub Actions is the default fleet because it
 * rents Apple hardware (macos-latest) by the minute, which is the one thing you
 * cannot legally virtualize yourself.
 */
export async function cloudBuild({ platform, profile, submit, outDir, ref, onDispatch }) {
  requireBinary('gh', 'Install the GitHub CLI: brew install gh');
  const workflow = platform === 'ios' ? 'leas-ios.yml' : 'leas-android.yml';
  const branch = ref ?? (await capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']));

  const before = await latestRunId(workflow);
  log.step(`Dispatching ${workflow} on ${branch}`);
  await run('gh', ['workflow', 'run', workflow, '--ref', branch,
    '-f', `profile=${profile}`, '-f', `submit=${submit ? 'true' : 'false'}`]);

  const runId = await waitForNewRun(workflow, before);
  const url = await runUrl(runId);
  log.info(`Run ${runId}: ${url}`);
  onDispatch?.({ runId, url });

  log.step('Streaming build logs');
  await run('gh', ['run', 'watch', runId, '--exit-status']);

  mkdirSync(outDir, { recursive: true });
  log.step('Downloading artifacts');
  await run('gh', ['run', 'download', runId, '-D', outDir]);
  log.ok(`Artifacts in ${outDir}`);
  return { runId, url };
}

async function latestRunId(workflow) {
  const out = await capture('gh', ['run', 'list', '--workflow', workflow, '-L', '1', '--json', 'databaseId']);
  return JSON.parse(out)[0]?.databaseId ?? null;
}

async function waitForNewRun(workflow, previousId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = await latestRunId(workflow);
    if (id && id !== previousId) return String(id);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new LeasError('Dispatched the workflow but no new run appeared within 2 minutes.');
}

async function runUrl(runId) {
  const out = await capture('gh', ['run', 'view', runId, '--json', 'url']);
  return JSON.parse(out).url;
}
