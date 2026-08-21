import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { capture } from './util.js';

/**
 * Build history lives as one JSON file per build under .leas/builds/.
 * Flat files rather than a database because it makes the dashboard's
 * real-time layer trivial: fs.watch on one directory is the whole feed.
 */
export function buildsDir(projectRoot) {
  const dir = path.join(projectRoot, '.leas', 'builds');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function createBuild(projectRoot, { platform, profile, runner }) {
  const now = new Date().toISOString();
  const record = {
    id: `bld_${now.slice(0, 10).replace(/-/g, '')}_${crypto.randomBytes(3).toString('hex')}`,
    platform,
    profile,
    runner,
    status: 'queued',
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    git: await gitContext(projectRoot),
    app: readAppVersion(projectRoot, platform),
    artifact: null,
    submission: { status: 'none', track: null, at: null, error: null },
    error: null,
    cloud: null,
  };
  save(projectRoot, record);
  return record;
}

export function updateBuild(projectRoot, id, patch) {
  const record = { ...read(projectRoot, id), ...patch };
  if (patch.status && ['succeeded', 'failed', 'canceled'].includes(patch.status)) {
    record.finishedAt = record.finishedAt ?? new Date().toISOString();
    const from = record.startedAt ?? record.createdAt;
    record.durationMs = record.durationMs ?? (Date.parse(record.finishedAt) - Date.parse(from));
  }
  if (patch.status === 'running' && !record.startedAt) {
    record.startedAt = new Date().toISOString();
  }
  save(projectRoot, record);
  return record;
}

export function listBuilds(projectRoot, { limit = 500 } = {}) {
  const dir = buildsDir(projectRoot);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(path.join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

/** Aggregates the dashboard's stat tiles read from. */
export function summarize(builds) {
  const finished = builds.filter((b) => ['succeeded', 'failed'].includes(b.status));
  const succeeded = finished.filter((b) => b.status === 'succeeded');
  const durations = succeeded.map((b) => b.durationMs).filter(Boolean).sort((a, b) => a - b);
  const weekAgo = Date.now() - 7 * 864e5;

  return {
    total: builds.length,
    inFlight: builds.filter((b) => ['queued', 'running'].includes(b.status)).length,
    successRate: finished.length ? succeeded.length / finished.length : null,
    medianDurationMs: durations.length ? durations[Math.floor(durations.length / 2)] : null,
    last7Days: builds.filter((b) => Date.parse(b.createdAt) >= weekAgo).length,
    byPlatform: count(builds, (b) => b.platform),
    byProfile: count(builds, (b) => b.profile),
    byStatus: count(builds, (b) => b.status),
    submitted: builds.filter((b) => b.submission?.status === 'submitted').length,
    daily: daily(builds, 14),
  };
}

/** Builds per day for the last n days, split by status — the chart's series. */
function daily(builds, days) {
  const out = [];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const start = midnight.getTime() - i * 864e5;
    const on = builds.filter((b) => {
      const t = Date.parse(b.createdAt);
      return t >= start && t < start + 864e5;
    });
    out.push({
      date: new Date(start).toISOString().slice(0, 10),
      succeeded: on.filter((b) => b.status === 'succeeded').length,
      failed: on.filter((b) => b.status === 'failed').length,
      active: on.filter((b) => ['queued', 'running'].includes(b.status)).length,
      canceled: on.filter((b) => b.status === 'canceled').length,
      total: on.length,
    });
  }
  return out;
}

function count(items, key) {
  return items.reduce((acc, item) => {
    const k = key(item) ?? 'unknown';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function save(projectRoot, record) {
  writeFileSync(path.join(buildsDir(projectRoot), `${record.id}.json`),
    JSON.stringify(record, null, 2) + '\n');
}

function read(projectRoot, id) {
  return JSON.parse(readFileSync(path.join(buildsDir(projectRoot), `${id}.json`), 'utf8'));
}

async function gitContext(projectRoot) {
  const git = async (args, fallback = null) =>
    capture('git', args, { cwd: projectRoot }).catch(() => fallback);
  const [branch, commit, message, status] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['rev-parse', '--short', 'HEAD']),
    git(['log', '-1', '--pretty=%s']),
    git(['status', '--porcelain'], ''),
  ]);
  return { branch, commit, message, dirty: Boolean(status) };
}

function readAppVersion(projectRoot, platform) {
  const file = path.join(projectRoot, 'app.json');
  if (!existsSync(file)) return { version: null, buildNumber: null };
  try {
    const expo = (JSON.parse(readFileSync(file, 'utf8')).expo) ?? {};
    return {
      version: expo.version ?? null,
      buildNumber: platform === 'ios'
        ? expo.ios?.buildNumber ?? null
        : expo.android?.versionCode != null ? String(expo.android.versionCode) : null,
    };
  } catch {
    return { version: null, buildNumber: null };
  }
}
