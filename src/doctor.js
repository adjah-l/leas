import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { capture, log, LeasError } from './util.js';
import { loadConfig, buildProfile, submitProfile, readAppJson } from './config.js';
import {
  readDistributionCertificate, readProvisioningProfile, readAndroidKeystore,
  resolveCredential, expiryStatus, NeedsPassword,
} from './credential-scan.js';
import { ascToken } from './submit-ios.js';
import { googleAccessToken } from './submit-android.js';

const ASC = 'https://api.appstoreconnect.apple.com';
const PLAY = 'https://androidpublisher.googleapis.com';

/**
 * `leas doctor` answers one question: will the next build and submit work?
 *
 * Every check here exists because it is a failure someone has already spent an
 * afternoon on — an expired profile, a certificate that does not match it, a
 * bundle identifier that drifted, an API key that was never granted a role.
 * Finding those in two seconds is worth far more than finding them forty
 * minutes into a cloud build.
 */
export async function doctor({ projectRoot, platforms, profileName, offline = false, json = false }) {
  const r = new Report();

  const config = await checkProject(r, projectRoot, platforms, profileName);
  if (config) {
    for (const platform of platforms) {
      if (platform === 'ios') await checkIos(r, { projectRoot, config, profileName, offline });
      if (platform === 'android') await checkAndroid(r, { projectRoot, config, profileName, offline });
    }
    await checkFleet(r, { projectRoot, config, platforms, profileName });
  }

  if (json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ...r.summary(), checks: r.checks }, null, 2));
  } else {
    r.print();
  }
  return r.summary();
}

/* --------------------------------- report --------------------------------- */

class Report {
  checks = [];
  add(group, name, status, detail, fix) {
    this.checks.push({ group, name, status, detail: detail ?? null, fix: fix ?? null });
  }
  ok(g, n, d) { this.add(g, n, 'ok', d); }
  warn(g, n, d, f) { this.add(g, n, 'warn', d, f); }
  fail(g, n, d, f) { this.add(g, n, 'fail', d, f); }
  skip(g, n, d) { this.add(g, n, 'skip', d); }

  /** Run a check, turning any throw into a failure rather than killing the run. */
  async probe(group, name, fn, fix) {
    try {
      const out = await fn();
      if (out === undefined) return;
      if (typeof out === 'string') return this.ok(group, name, out);
      this.add(group, name, out.status, out.detail, out.status === 'ok' ? out.fix : (out.fix ?? fix));
    } catch (e) {
      this.fail(group, name, e instanceof LeasError ? e.message : (e.message ?? String(e)), fix);
    }
  }

  summary() {
    const count = (s) => this.checks.filter((c) => c.status === s).length;
    return { ok: count('ok'), warn: count('warn'), fail: count('fail'), skipped: count('skip'), healthy: count('fail') === 0 };
  }

  print() {
    const mark = { ok: '\x1b[32m✓\x1b[0m', warn: '\x1b[33m!\x1b[0m', fail: '\x1b[31m✗\x1b[0m', skip: '\x1b[2m·\x1b[0m' };
    let group = null;
    for (const c of this.checks) {
      if (c.group !== group) { group = c.group; log.step(group); }
      const detail = c.detail ? `  \x1b[2m${c.detail}\x1b[0m` : '';
      console.log(`  ${mark[c.status]} ${c.name}${detail}`);
      if (c.fix) console.log(`      \x1b[36m→ ${c.fix}\x1b[0m`);
    }
    const s = this.summary();
    console.log('');
    if (s.healthy && !s.warn) log.ok(`All ${s.ok} checks passed. Ready to build.`);
    else if (s.healthy) log.warn(`${s.ok} passed, ${s.warn} warning${s.warn === 1 ? '' : 's'}. Nothing blocking.`);
    else log.err(`${s.fail} check${s.fail === 1 ? '' : 's'} failed. The next build would fail too.`);
  }
}

/* -------------------------------- project --------------------------------- */

async function checkProject(r, projectRoot, platforms, profileName) {
  const G = 'Project';
  let config;
  try {
    config = loadConfig(projectRoot);
    r.ok(G, 'leas.json', 'parses');
  } catch (e) {
    r.fail(G, 'leas.json', e.message, 'Run `leas init`, or generate one at /setup on your leas site.');
    return null;
  }

  const app = readAppJson(projectRoot);
  if (!Object.keys(app).length) {
    r.warn(G, 'app.json', 'not found — cannot cross-check identifiers');
  } else {
    r.ok(G, 'app.json', `${app.name ?? 'unnamed'}${app.version ? ` v${app.version}` : ''}`);
  }

  for (const platform of platforms) {
    r.probe(G, `build.${profileName}.${platform}`, () => {
      const p = buildProfile(config, profileName, platform);
      const key = platform === 'ios' ? p.exportMethod : p.buildType;
      return `${key}`;
    });
  }

  // Identifier drift is the single most common cause of a signing failure, and
  // it is invisible until xcodebuild refuses forty minutes in.
  const iosId = app.ios?.bundleIdentifier;
  const androidId = app.android?.package;
  for (const platform of platforms) {
    let sub;
    try { sub = submitProfile(config, profileName, platform); } catch { continue; }
    if (platform === 'android' && androidId && sub.packageName && sub.packageName !== androidId) {
      r.fail(G, 'Android identifier', `app.json says ${androidId}, leas.json says ${sub.packageName}`,
        'Make submit.' + profileName + '.android.packageName match app.json.');
    } else if (platform === 'android' && sub.packageName) {
      r.ok(G, 'Android identifier', sub.packageName);
    }
    if (platform === 'ios' && iosId) r.ok(G, 'iOS identifier', iosId);
  }

  return config;
}

/* ---------------------------------- iOS ----------------------------------- */

async function checkIos(r, { projectRoot, config, profileName, offline }) {
  const G = 'iOS';
  const build = buildProfile(config, profileName, 'ios');
  let submit = null;
  try { submit = submitProfile(config, profileName, 'ios'); } catch { /* build-only setup */ }
  const app = readAppJson(projectRoot);

  if (process.platform !== 'darwin') {
    r.fail(G, 'Host', `${process.platform} — iOS builds need macOS`,
      'Build with --cloud, or run on a Mac. Apple\'s EULA allows no third option.');
  } else {
    await r.probe(G, 'Xcode', async () => {
      const v = await capture('xcodebuild', ['-version']);
      return v.split('\n')[0];
    }, 'Install Xcode and run: xcode-select --install');
  }

  // --- distribution certificate ---
  let certFingerprint = null;
  await r.probe(G, 'Distribution certificate', async () => {
    const cert = await readDistributionCertificate({ projectRoot, build });
    certFingerprint = cert.fingerprint;
    return expiry(cert.identity, cert.expires);
  }, 'Export the Apple Distribution certificate from Keychain Access as a .p12, or set LEAS_IOS_DIST_CERT_PASSWORD.');

  // --- provisioning profile ---
  await r.probe(G, 'Provisioning profile', async () => {
    const p = await readProvisioningProfile({ projectRoot, build });

    // The profile is the source of truth for what this build is allowed to be.
    const appId = p.applicationIdentifier?.replace(/^[A-Z0-9]+\./, '');
    const wanted = app.ios?.bundleIdentifier;
    if (wanted && appId && appId !== wanted && appId !== '*') {
      return {
        status: 'fail',
        detail: `profile is for ${appId}, app.json says ${wanted}`,
        fix: 'Issue a profile for the right App ID at developer.apple.com/account/resources/profiles',
      };
    }
    if (build.exportMethod === 'app-store' && p.hasDevices) {
      return {
        status: 'warn',
        detail: `"${p.name}" provisions specific devices — that is an ad-hoc profile, not App Store`,
        fix: 'Create an App Store distribution profile for this App ID.',
      };
    }

    // A certificate the profile does not list cannot sign against it.
    if (certFingerprint && p.certFingerprints.length && !p.certFingerprints.includes(certFingerprint)) {
      return {
        status: 'fail',
        detail: `"${p.name}" does not list your distribution certificate`,
        fix: 'Regenerate the profile after selecting the certificate you actually hold.',
      };
    }
    return expiry(`"${p.name}"${appId ? ` · ${appId}` : ''}`, p.expires);
  }, 'Download an App Store provisioning profile for this bundle identifier.');

  // --- App Store Connect API key ---
  if (!submit) return r.skip(G, 'App Store Connect', `no submit.${profileName}.ios block — build only`);

  const keyId = process.env.LEAS_ASC_KEY_ID ?? submit.ascApiKeyId;
  const issuerId = process.env.LEAS_ASC_ISSUER_ID ?? submit.ascApiIssuerId;
  let privateKey = null;

  await r.probe(G, 'API key', async () => {
    if (!keyId || !issuerId) {
      return { status: 'fail', detail: 'ascApiKeyId or ascApiIssuerId is not set', fix: 'Fill both in leas.json, or set LEAS_ASC_KEY_ID and LEAS_ASC_ISSUER_ID.' };
    }
    const p8 = resolveCredential(projectRoot, submit.ascApiKeyPath, 'LEAS_ASC_API_KEY_BASE64', `AuthKey_${keyId}.p8`);
    privateKey = readFileSync(p8, 'utf8');
    crypto.createPrivateKey(privateKey); // throws if it is not a usable EC key
    return `${keyId} · issuer ${issuerId.slice(0, 8)}…`;
  }, 'The .p8 downloads exactly once. If it is lost, revoke the key and generate a new one.');

  if (offline) return r.skip(G, 'App Store Connect API', 'skipped (--offline)');
  if (!privateKey) return;

  await r.probe(G, 'App Store Connect API', async () => {
    const token = ascToken({ keyId, issuerId, privateKey });
    const res = await fetch(`${ASC}/v1/apps?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      return { status: 'fail', detail: 'Apple rejected the key (401)', fix: 'Check the issuer ID, and that the key has not been revoked.' };
    }
    if (res.status === 403) {
      return { status: 'fail', detail: 'key authenticated but has no access (403)', fix: 'Give the key the App Manager role in Users and Access → Integrations.' };
    }
    if (!res.ok) return { status: 'warn', detail: `unexpected ${res.status} from Apple` };

    // Authenticating is not the same as being able to see this app.
    if (submit.ascAppId) {
      const one = await fetch(`${ASC}/v1/apps/${submit.ascAppId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (one.status === 404) {
        return { status: 'fail', detail: `no app with ID ${submit.ascAppId}`, fix: 'Create the app record in App Store Connect, then copy its numeric Apple ID.' };
      }
      if (one.ok) {
        const name = (await one.json()).data?.attributes?.name;
        return `authenticated · ${name ?? submit.ascAppId}`;
      }
    }
    return 'authenticated';
  });
}

/* -------------------------------- Android --------------------------------- */

async function checkAndroid(r, { projectRoot, config, profileName, offline }) {
  const G = 'Android';
  const build = buildProfile(config, profileName, 'android');
  let submit = null;
  try { submit = submitProfile(config, profileName, 'android'); } catch { /* build-only setup */ }

  await r.probe(G, 'JDK', async () => {
    // java prints its banner on stderr and exits 0, so stdout alone is empty.
    const out = await capture('sh', ['-c', 'java -version 2>&1']).catch(() => '');
    if (!out || /Unable to locate a Java Runtime|not found/i.test(out)) {
      return { status: 'fail', detail: 'no java on PATH' };
    }
    const v = /version "?(\d+)/.exec(out)?.[1];
    if (v && Number(v) !== 17) {
      return { status: 'warn', detail: `Java ${v} — the Expo template expects 17`, fix: 'Install Temurin 17 and set JAVA_HOME to it.' };
    }
    return `Java ${v ?? 'present'}`;
  }, 'Install a JDK 17 (Temurin is the one the runners use).');

  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk) r.warn(G, 'Android SDK', 'ANDROID_HOME is not set', 'Local Android builds need the SDK. Cloud builds bring their own.');
  else if (!existsSync(sdk)) r.fail(G, 'Android SDK', `ANDROID_HOME points at ${sdk}, which does not exist`);
  else r.ok(G, 'Android SDK', sdk);

  await r.probe(G, 'Upload keystore', async () => {
    let k;
    try {
      k = await readAndroidKeystore({ projectRoot, build });
    } catch (e) {
      if (e instanceof NeedsPassword) {
        return { status: 'warn', detail: 'present, but no password available to inspect it', fix: 'Set LEAS_ANDROID_KEYSTORE_PASSWORD to verify the alias and expiry.' };
      }
      throw e;
    }
    if (k.wanted && !k.aliases.includes(k.wanted)) {
      return { status: 'fail', detail: `no alias "${k.wanted}" — keystore holds ${k.aliases.join(', ') || 'nothing'}`, fix: 'Set keyAlias in leas.json to one of the aliases above.' };
    }
    return expiry(`alias ${k.alias}`, k.expires);
  }, 'Generate one with: keytool -genkeypair -v -keystore <path> -alias upload -keyalg RSA -keysize 2048 -validity 10000');

  if (!submit) return r.skip(G, 'Google Play', `no submit.${profileName}.android block — build only`);

  let sa = null;
  await r.probe(G, 'Play service account', async () => {
    const file = resolve(projectRoot, submit.serviceAccountKeyPath, 'LEAS_PLAY_SERVICE_ACCOUNT_BASE64', 'play-service-account.json');
    sa = JSON.parse(readFileSync(file, 'utf8'));
    if (!sa.client_email || !sa.private_key) {
      sa = null;
      return { status: 'fail', detail: 'JSON is missing client_email or private_key', fix: 'Download a fresh key for the service account from Google Cloud.' };
    }
    try {
      // Catch a corrupted key here, where the message can say so plainly,
      // rather than as a raw OpenSSL decoder error during token exchange.
      crypto.createPrivateKey(sa.private_key);
    } catch {
      sa = null;
      return { status: 'fail', detail: 'private_key in the JSON is not a usable key', fix: 'Download a fresh key for the service account from Google Cloud.' };
    }
    return sa.client_email;
  }, 'Create a service account in Google Cloud and download its JSON key.');

  if (offline) return r.skip(G, 'Play Developer API', 'skipped (--offline)');
  if (!sa) return;

  await r.probe(G, 'Play Developer API', async () => {
    const token = await googleAccessToken(sa);
    // Opening and immediately abandoning an edit is the only way to prove the
    // account was actually granted release permission on this app. It leaves
    // nothing behind.
    const url = `${PLAY}/androidpublisher/v3/applications/${submit.packageName}/edits`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return { status: 'fail', detail: 'Google rejected the service account (401)' };
    if (res.status === 403) {
      return { status: 'fail', detail: 'authenticated, but not permitted on this app (403)',
        fix: `Invite ${sa.client_email} in Play Console → Users and permissions and grant "Release apps to testing tracks".` };
    }
    if (res.status === 404) {
      return { status: 'fail', detail: `Play has no app ${submit.packageName}`,
        fix: 'Upload the first .aab through the Play Console by hand — the API cannot create the app.' };
    }
    if (!res.ok) return { status: 'warn', detail: `unexpected ${res.status} from Google` };
    const edit = await res.json();
    await fetch(`${url}/${edit.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    return `can release to ${submit.track ?? 'internal'}`;
  });
}

/* --------------------------------- fleet ---------------------------------- */

async function checkFleet(r, { projectRoot, config, platforms, profileName }) {
  const G = 'Fleet';
  const wanted = platforms.map((p) => `.github/workflows/leas-${p}.yml`);
  const present = wanted.filter((w) => existsSync(path.join(projectRoot, w)));
  if (!present.length) return r.skip(G, 'Workflows', 'none found — local builds only');
  r.ok(G, 'Workflows', present.map((p) => path.basename(p)).join(', '));

  const repo = await gitRepo(projectRoot);
  if (!repo) return r.warn(G, 'Repository', 'no github.com remote found', 'Cloud builds dispatch to the origin remote.');
  r.ok(G, 'Repository', repo);

  const authed = await capture('gh', ['auth', 'status']).then(() => true).catch(() => false);
  if (!authed) return r.warn(G, 'GitHub CLI', 'not installed or not logged in', 'Install https://cli.github.com then run: gh auth login');
  r.ok(G, 'GitHub CLI', 'authenticated');

  await r.probe(G, 'Repository secrets', async () => {
    const out = await capture('gh', ['secret', 'list', '--repo', repo]);
    const have = new Set(out.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
    const need = requiredSecrets(config, platforms, profileName);
    const gaps = need.filter((n) => !have.has(n));
    if (gaps.length) {
      return { status: 'fail', detail: `missing ${gaps.join(', ')}`, fix: 'Run ./leas-secrets.sh from the setup wizard, or set each with: gh secret set NAME' };
    }
    return `all ${need.length} present`;
  }, 'Cloud builds cannot sign without these.');
}

function requiredSecrets(config, platforms, profileName) {
  const need = [];
  for (const platform of platforms) {
    let submits = true;
    try { submitProfile(config, profileName, platform); } catch { submits = false; }
    if (platform === 'ios') {
      need.push('LEAS_IOS_DIST_CERT_BASE64', 'LEAS_IOS_DIST_CERT_PASSWORD', 'LEAS_IOS_PROVISIONING_PROFILE_BASE64');
      if (submits) need.push('LEAS_ASC_API_KEY_BASE64', 'LEAS_ASC_KEY_ID', 'LEAS_ASC_ISSUER_ID');
    } else {
      need.push('LEAS_ANDROID_KEYSTORE_BASE64', 'LEAS_ANDROID_KEYSTORE_PASSWORD', 'LEAS_ANDROID_KEY_ALIAS', 'LEAS_ANDROID_KEY_PASSWORD');
      if (submits) need.push('LEAS_PLAY_SERVICE_ACCOUNT_BASE64');
    }
  }
  return need;
}

async function gitRepo(projectRoot) {
  const url = await capture('git', ['-C', projectRoot, 'remote', 'get-url', 'origin']).catch(() => null);
  return url ? /github\.com[:/]([^/]+\/[^/.]+)/.exec(url)?.[1] ?? null : null;
}

/* --------------------------------- helpers -------------------------------- */

/** Certificates and profiles expire on the morning you need to ship a hotfix. */
function expiry(label, date) {
  const { status, daysLeft } = expiryStatus(date);
  if (status === 'unknown') return { status: 'ok', detail: label };
  const on = date.toISOString().slice(0, 10);
  if (status === 'expired') return { status: 'fail', detail: `${label} — expired ${on}`, fix: 'Renew it before the next build.' };
  if (status === 'expiring') return { status: 'warn', detail: `${label} — expires ${on}, in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` };
  return { status: 'ok', detail: `${label} — valid until ${on}` };
}

