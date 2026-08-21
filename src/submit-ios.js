import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { run, log, LeasError, requireBinary } from './util.js';
import { materialize } from './credentials.js';

const ASC = 'https://api.appstoreconnect.apple.com';

export async function submitIos({ artifactPath, profile }) {
  requireBinary('xcrun', 'Install Xcode command line tools.');
  const keyId = process.env.LEAS_ASC_KEY_ID ?? profile.ascApiKeyId;
  const issuerId = process.env.LEAS_ASC_ISSUER_ID ?? profile.ascApiIssuerId;
  if (!keyId || !issuerId) throw new LeasError('Submit needs ascApiKeyId and ascApiIssuerId (or LEAS_ASC_KEY_ID / LEAS_ASC_ISSUER_ID).');

  const p8 = materialize({
    filePath: profile.ascApiKeyPath,
    base64Env: 'LEAS_ASC_API_KEY_BASE64',
    name: `AuthKey_${keyId}.p8`,
  });

  // altool looks for the key in this exact location by convention.
  const keyDir = path.join(homedir(), '.appstoreconnect/private_keys');
  mkdirSync(keyDir, { recursive: true });
  const installedKey = path.join(keyDir, `AuthKey_${keyId}.p8`);
  copyFileSync(p8, installedKey);

  log.step('Validating with App Store Connect');
  await run('xcrun', ['altool', '--validate-app', '-f', artifactPath, '-t', 'ios',
    '--apiKey', keyId, '--apiIssuer', issuerId]);

  log.step('Uploading to App Store Connect');
  await run('xcrun', ['altool', '--upload-app', '-f', artifactPath, '-t', 'ios',
    '--apiKey', keyId, '--apiIssuer', issuerId]);

  log.ok('Uploaded. Apple is now processing the build (usually 5–20 minutes).');

  if (profile.waitForProcessing) {
    const token = ascToken({ keyId, issuerId, privateKey: readFileSync(installedKey, 'utf8') });
    await waitForBuild({ token, appId: profile.ascAppId, version: profile.buildVersion });
  }
  return { uploaded: true };
}

/** App Store Connect JWT: ES256, max 20 minute lifetime. */
export function ascToken({ keyId, issuerId, privateKey }) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 19 * 60, aud: 'appstoreconnect-v1' };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${b64(header)}.${b64(payload)}`;
  // ASC requires the raw R||S signature form, not the DER form Node emits by default.
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: crypto.createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${sig.toString('base64url')}`;
}

async function waitForBuild({ token, appId, version, timeoutMs = 45 * 60 * 1000 }) {
  if (!appId) return log.warn('waitForProcessing set but ascAppId is missing; skipping.');
  log.step('Waiting for App Store Connect to finish processing');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = new URL(`${ASC}/v1/builds`);
    url.searchParams.set('filter[app]', appId);
    url.searchParams.set('limit', '5');
    url.searchParams.set('sort', '-uploadedDate');
    if (version) url.searchParams.set('filter[version]', version);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new LeasError(`ASC API ${res.status}: ${await res.text()}`);
    const { data } = await res.json();
    const state = data?.[0]?.attributes?.processingState;
    log.dim(`processingState=${state ?? 'unknown'}`);
    if (state === 'VALID') return log.ok('Build processed and ready for TestFlight / review.');
    if (state === 'FAILED' || state === 'INVALID') throw new LeasError(`Build processing ${state}.`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new LeasError('Timed out waiting for App Store Connect processing.');
}
