#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { log, run, LeasError } from './util.js';
import { loadConfig, buildProfile, submitProfile, readAppJson } from './config.js';
import { buildIos } from './build-ios.js';
import { buildAndroid } from './build-android.js';
import { submitIos } from './submit-ios.js';
import { submitAndroid } from './submit-android.js';
import { cloudBuild } from './cloud.js';
import { createBuild, updateBuild } from './store.js';
import { startDashboard, snapshot } from './dashboard.js';
import { publishUpdate, rollbackUpdate, promoteUpdate, generateKeys } from './update-publish.js';
import { startUpdateServer } from './update-server.js';
import { doctor } from './doctor.js';
import { creds } from './creds.js';
import { scanCredentials } from './credential-scan.js';
import { listUpdates, resolveRuntimeVersion, readPointer, channelsOf } from './update-store.js';

const USAGE = `
leas — self-hosted build & submit for Expo / React Native

  leas build    --platform ios|android|all [--profile production] [--local|--cloud] [--auto-submit]
  leas submit   --platform ios|android|all [--profile production] [--path <artifact>]
  leas prebuild [--platform ios|android|all] [--clean]
  leas dashboard [--port 4180] [--no-open]
  leas sync      [--site https://your-site.vercel.app] [--token <t>]
  leas doctor   [--platform ios|android|all] [--profile production] [--offline] [--json]
  leas creds    [--platform ios|android|all] [--days 30] [--check] [--json]

  leas update            --channel production [--message "..."] [--platform all]
  leas update:list       [--channel production] [--runtime 1.4.0]
  leas update:rollback   --channel production [--to <updateId> | --embedded]
  leas update:promote    --from preview --to production
  leas update:serve      [--port 4190] [--url https://updates.example.com]
  leas update:keys

  leas init

Flags
  --profile <name>   profile from leas.json (default: production)
  --local            run the build on this machine (default on macOS for ios)
  --cloud            dispatch the build to your GitHub Actions fleet
  --auto-submit      submit the artifact as soon as the build succeeds
  --path <file>      submit an existing .ipa / .aab instead of building
  --port <n>         server port (dashboard 4180, updates 4190)
  --channel <name>   update channel (default production)
  --message <text>   what this update changes
  --url <base>       public base URL the devices will reach the update server on
  --offline          skip the checks that call Apple and Google
  --days <n>         how far ahead leas creds warns (default 30)
  --check            exit non-zero if anything expires within --days
  --json             machine-readable output
  --site <url>       your hosted leas site (or set LEAS_SITE_URL)
  --token <t>        sync token for that site (or set LEAS_SYNC_TOKEN)
  -v, --version      print the installed leas version
  -h, --help         show this help
`;

const options = {
  platform: { type: 'string', short: 'p' },
  profile: { type: 'string', default: 'production' },
  local: { type: 'boolean', default: false },
  cloud: { type: 'boolean', default: false },
  'auto-submit': { type: 'boolean', default: false },
  path: { type: 'string' },
  clean: { type: 'boolean', default: false },
  ref: { type: 'string' },
  port: { type: 'string', default: '4180' },
  'no-open': { type: 'boolean', default: false },
  channel: { type: 'string', default: 'production' },
  message: { type: 'string' },
  url: { type: 'string' },
  runtime: { type: 'string' },
  to: { type: 'string' },
  from: { type: 'string' },
  embedded: { type: 'boolean', default: false },
  key: { type: 'string' },
  site: { type: 'string' },
  token: { type: 'string' },
  offline: { type: 'boolean', default: false },
  days: { type: 'string', default: '30' },
  check: { type: 'boolean', default: false },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
};

const { values: flags, positionals } = parseArgs({ options, allowPositionals: true });
const command = positionals[0];
const projectRoot = process.cwd();

main().catch((e) => {
  log.err(e instanceof LeasError ? e.message : (e.stack ?? String(e)));
  process.exit(1);
});

async function main() {
  if (flags.version) return console.log(packageVersion());
  if (flags.help || !command) return console.log(USAGE);
  switch (command) {
    case 'build': return cmdBuild();
    case 'submit': return cmdSubmit();
    case 'prebuild': return cmdPrebuild(platforms());
    case 'dashboard': return startDashboard({
      projectRoot, port: Number(flags.port), open: !flags['no-open'],
    });
    case 'update': return cmdUpdate();
    case 'update:list': return cmdUpdateList();
    case 'update:rollback': return cmdUpdateRollback();
    case 'update:promote': return cmdUpdatePromote();
    case 'update:serve': return startUpdateServer({
      projectRoot, port: Number(flags.port === '4180' ? '4190' : flags.port),
      baseUrl: flags.url,
      privateKeyPath: flags.key ?? path.join(projectRoot, 'credentials/updates/private-key.pem'),
    });
    case 'update:keys': return generateKeys({ projectRoot });
    case 'sync': return cmdSync();
    case 'doctor': return cmdDoctor();
    case 'creds': return cmdCreds();
    case 'init': return cmdInit();
    default: throw new LeasError(`Unknown command "${command}".\n${USAGE}`);
  }
}

/** The installed package's own version, read from its package.json. */
function packageVersion() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
}

function platforms() {
  const p = flags.platform ?? 'all';
  if (p === 'all') return ['ios', 'android'];
  if (p !== 'ios' && p !== 'android') throw new LeasError(`--platform must be ios, android, or all.`);
  return [p];
}

/** Local is the default; --cloud opts into the remote fleet. */
function isCloud() {
  if (flags.cloud && flags.local) throw new LeasError('Pass either --local or --cloud, not both.');
  return flags.cloud;
}

async function cmdBuild() {
  const config = loadConfig(projectRoot);
  for (const platform of platforms()) {
    const outDir = path.join(projectRoot, '.leas', 'build', platform);

    if (isCloud()) {
      const record = await createBuild(projectRoot, {
        platform, profile: flags.profile, runner: 'cloud',
      });
      try {
        const { runId, url } = await cloudBuild({
          platform, profile: flags.profile, submit: flags['auto-submit'], outDir, ref: flags.ref,
          onDispatch: (cloud) => updateBuild(projectRoot, record.id, { status: 'running', cloud }),
        });
        updateBuild(projectRoot, record.id, {
          status: 'succeeded',
          cloud: { runId, url },
          submission: flags['auto-submit']
            ? { status: 'submitted', track: null, at: new Date().toISOString(), error: null }
            : record.submission,
        });
      } catch (e) {
        updateBuild(projectRoot, record.id, { status: 'failed', error: e.message });
        throw e;
      }
      continue;
    }

    if (platform === 'ios' && process.platform !== 'darwin') {
      throw new LeasError('Local iOS builds require macOS. Use --cloud to build on a rented Mac.');
    }

    const profile = buildProfile(config, flags.profile, platform);
    const record = await createBuild(projectRoot, {
      platform, profile: flags.profile, runner: 'local',
    });
    let artifactPath;
    try {
      updateBuild(projectRoot, record.id, { status: 'running' });
      await cmdPrebuild([platform], { quiet: true });
      ({ artifactPath } = platform === 'ios'
        ? await buildIos({ projectRoot, profile, outDir })
        : await buildAndroid({ projectRoot, profile, outDir }));
      updateBuild(projectRoot, record.id, {
        status: 'succeeded',
        artifact: {
          path: artifactPath,
          bytes: statSync(artifactPath).size,
          kind: path.extname(artifactPath).slice(1),
        },
      });
    } catch (e) {
      updateBuild(projectRoot, record.id, { status: 'failed', error: e.message });
      throw e;
    }

    if (flags['auto-submit']) await doSubmit(config, platform, artifactPath, record.id);
  }
}

async function cmdSubmit() {
  const config = loadConfig(projectRoot);
  for (const platform of platforms()) {
    const artifactPath = flags.path ?? latestArtifact(platform);
    await doSubmit(config, platform, artifactPath);
  }
}

async function doSubmit(config, platform, artifactPath, buildId = null) {
  if (!artifactPath || !existsSync(artifactPath)) {
    throw new LeasError(`No artifact to submit for ${platform}. Pass --path <file>.`);
  }
  const profile = submitProfile(config, flags.profile, platform);
  const track = platform === 'ios' ? 'TestFlight' : (profile.track ?? 'internal');
  log.step(`Submitting ${path.basename(artifactPath)} to ${platform === 'ios' ? 'App Store Connect' : 'Google Play'}`);
  const mark = (patch) => buildId && updateBuild(projectRoot, buildId, { submission: patch });

  mark({ status: 'pending', track, at: new Date().toISOString(), error: null });
  try {
    const result = platform === 'ios'
      ? await submitIos({ artifactPath, profile })
      : await submitAndroid({ artifactPath, profile });
    mark({ status: 'submitted', track, at: new Date().toISOString(), error: null });
    return result;
  } catch (e) {
    mark({ status: 'failed', track, at: new Date().toISOString(), error: e.message });
    throw e;
  }
}

function latestArtifact(platform) {
  const dir = path.join(projectRoot, '.leas', 'build', platform);
  const exts = platform === 'ios' ? ['.ipa'] : ['.aab', '.apk'];
  if (!existsSync(dir)) return null;
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (exts.some((x) => e.name.endsWith(x))) files.push(full);
    }
  })(dir);
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;
}

async function cmdPrebuild(list, { quiet = false } = {}) {
  const app = readAppJson(projectRoot);
  const isExpo = Boolean(app.name || app.slug);
  for (const platform of list) {
    const nativeDir = path.join(projectRoot, platform);
    if (existsSync(nativeDir) && !flags.clean) {
      if (!quiet) log.dim(`${platform}/ already exists — skipping prebuild (use --clean to regenerate)`);
    } else if (isExpo) {
      log.step(`expo prebuild (${platform})`);
      await run('npx', ['expo', 'prebuild', '--platform', platform, ...(flags.clean ? ['--clean'] : []), '--no-install'],
        { cwd: projectRoot });
    } else if (!existsSync(nativeDir)) {
      throw new LeasError(`No ${platform}/ directory and no Expo config to generate one from.`);
    }
    if (platform === 'ios' && process.platform === 'darwin') {
      log.step('pod install');
      await run('npx', ['pod-install'], { cwd: projectRoot });
    }
  }
}

async function cmdUpdate() {
  return publishUpdate({
    projectRoot,
    channel: flags.channel,
    message: flags.message,
    platform: flags.platform ?? 'all',
  });
}

function currentRuntimeVersion() {
  if (flags.runtime) return flags.runtime;
  const platform = flags.platform === 'android' ? 'android' : 'ios';
  return resolveRuntimeVersion(readAppJson(projectRoot), platform);
}

function cmdUpdateList() {
  const updates = listUpdates(projectRoot, {
    channel: flags.channel === 'all' ? null : flags.channel,
    runtimeVersion: flags.runtime,
  });
  if (!updates.length) {
    log.warn(`No updates published to "${flags.channel}".`);
    return;
  }
  for (const u of updates) {
    const pin = readPointer(projectRoot, flags.channel, u.runtimeVersion);
    const live = pin?.updateId === u.id ? '  <- serving now' : '';
    log.info(`${u.id}${live}`);
    log.dim(`  ${channelsOf(u).join(', ')} · runtime ${u.runtimeVersion} · ${u.platforms.join('+')} · ` +
      `${u.assetCount} assets · ${(u.bytes / 1e6).toFixed(1)} MB`);
    log.dim(`  "${u.message}" · ${u.git?.commit ?? 'no commit'} · ${u.createdAt}`);
  }
}

function cmdUpdateRollback() {
  return rollbackUpdate({
    projectRoot,
    channel: flags.channel,
    runtimeVersion: currentRuntimeVersion(),
    to: flags.to,
    embedded: flags.embedded,
  });
}

function cmdUpdatePromote() {
  if (!flags.from || !flags.to) throw new LeasError('update:promote needs --from and --to.');
  return promoteUpdate({
    projectRoot, from: flags.from, to: flags.to, runtimeVersion: currentRuntimeVersion(),
  });
}

/** Push local build and update history to the hosted dashboard. */
async function cmdSync() {
  const site = (flags.site ?? process.env.LEAS_SITE_URL ?? '').replace(/\/$/, '');
  const token = flags.token ?? process.env.LEAS_SYNC_TOKEN;
  if (!site) throw new LeasError('Pass --site https://your-site.vercel.app (or set LEAS_SITE_URL).');
  if (!token) throw new LeasError('Pass --token (or set LEAS_SYNC_TOKEN). It must match the site.');

  const body = snapshot(projectRoot);

  // Credential records are metadata only — an identity string, a date, and a
  // public fingerprint. Nothing secret leaves the machine, which is what makes
  // an expiry watch something a hosted dashboard is allowed to do at all.
  body.credentials = await scanCredentials({
    projectRoot, config: loadConfig(projectRoot), profileName: flags.profile,
    platforms: platforms(), warnDays: Number(flags.days),
  }).catch(() => []);

  const attention = body.credentials.filter((c) => c.status === 'expired' || c.status === 'expiring').length;
  log.step(`Pushing ${body.builds.length} builds, ${body.updates.length} updates, and ${body.credentials.length} credentials to ${site}`);
  if (attention) log.warn(`${attention} credential${attention === 1 ? '' : 's'} need attention — run: leas creds`);

  const res = await fetch(`${site}/api/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new LeasError(`Sync failed (${res.status}): ${text.slice(0, 300)}`);
  }
  log.ok(`Synced. ${site}/dashboard is now showing this history.`);
  return JSON.parse(text);
}

async function cmdDoctor() {
  const { healthy } = await doctor({
    projectRoot, platforms: platforms(), profileName: flags.profile,
    offline: flags.offline, json: flags.json,
  });
  // A non-zero exit makes this usable as a CI gate, not just a human report.
  if (!healthy) process.exit(1);
}

async function cmdCreds() {
  const { needsAttention } = await creds({
    projectRoot, platforms: platforms(), profileName: flags.profile,
    warnDays: Number(flags.days), json: flags.json,
  });
  // --check makes this a scheduled job that speaks by failing.
  if (flags.check && needsAttention) process.exit(1);
}

function cmdInit() {
  const file = path.join(projectRoot, 'leas.json');
  if (existsSync(file)) throw new LeasError('leas.json already exists.');
  const app = readAppJson(projectRoot);
  writeFileSync(file, JSON.stringify({
    cli: { version: '>=1.0.0' },
    build: {
      development: { developmentClient: true, ios: { exportMethod: 'development' }, android: { buildType: 'apk' } },
      preview: { extends: 'production', ios: { exportMethod: 'ad-hoc' }, android: { buildType: 'apk' } },
      production: {
        ios: { configuration: 'Release', exportMethod: 'app-store' },
        android: { buildType: 'app-bundle' },
      },
    },
    submit: {
      production: {
        ios: { ascAppId: '', ascApiKeyId: '', ascApiIssuerId: '', waitForProcessing: true },
        android: { packageName: app.android?.package ?? '', track: 'internal' },
      },
    },
  }, null, 2) + '\n');
  log.ok('Created leas.json');
}
