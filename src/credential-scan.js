import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { capture, LeasError } from './util.js';
import { buildProfile } from './config.js';
import { materialize } from './credentials.js';

/**
 * Reading what is actually inside your signing material.
 *
 * Everything here reads local files and returns metadata — an identity string,
 * an expiry date, a public certificate fingerprint. It never returns key
 * material or a password, which is what makes the result safe to send to a
 * dashboard. `leas doctor` uses it to judge, `leas creds` to report.
 */

export const WARN_DAYS = 30;

/** Resolve a credential the same way a build will — file first, then env. */
export function resolveCredential(projectRoot, filePath, base64Env, name) {
  const abs = filePath ? path.resolve(projectRoot, filePath) : null;
  return materialize({ filePath: abs, base64Env, name });
}

/* ---------------------------------- iOS ----------------------------------- */

export async function readDistributionCertificate({ projectRoot, build }) {
  const p12 = resolveCredential(projectRoot, build.distributionCertificatePath, 'LEAS_IOS_DIST_CERT_BASE64', 'dist.p12');
  const password = build.distributionCertificatePassword ?? process.env.LEAS_IOS_DIST_CERT_PASSWORD ?? '';
  let pem;
  try {
    pem = await capture('openssl', ['pkcs12', '-in', p12, '-clcerts', '-nokeys', '-passin', `pass:${password}`]);
  } catch {
    // OpenSSL 3 refuses the older ciphers Keychain still exports with.
    pem = await capture('openssl', ['pkcs12', '-in', p12, '-clcerts', '-nokeys', '-legacy', '-passin', `pass:${password}`]);
  }
  const cert = new crypto.X509Certificate(pem);
  return {
    identity: /CN=([^,\n]+)/.exec(cert.subject)?.[1]?.trim() ?? cert.subject,
    expires: new Date(cert.validTo),
    fingerprint: cert.fingerprint.replace(/:/g, '').toUpperCase(),
  };
}

export async function readProvisioningProfile({ projectRoot, build }) {
  const file = resolveCredential(projectRoot, build.provisioningProfilePath, 'LEAS_IOS_PROVISIONING_PROFILE_BASE64', 'profile.mobileprovision');
  return parseProfile(await decodeProfile(file));
}

/**
 * A .mobileprovision is a CMS blob wrapping an XML plist. `security cms` is the
 * macOS way; openssl reads the same structure anywhere, which is what lets a
 * scheduled expiry check run on a cheap Linux runner instead of a rented Mac.
 */
export async function decodeProfile(file) {
  try {
    return await capture('security', ['cms', '-D', '-i', file]);
  } catch {
    // -noverify: we are reading the payload, not trusting Apple's signature.
    return capture('openssl', ['smime', '-inform', 'DER', '-verify', '-noverify', '-in', file]);
  }
}

/** The decoded .mobileprovision plist, read for the handful of keys that matter. */
export function parseProfile(xml) {
  const str = (key) => new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(xml)?.[1] ?? null;
  const certBlock = /<key>DeveloperCertificates<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(xml)?.[1] ?? '';
  const certFingerprints = [...certBlock.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((m) => {
    const der = Buffer.from(m[1].replace(/\s/g, ''), 'base64');
    return new crypto.X509Certificate(der).fingerprint.replace(/:/g, '').toUpperCase();
  });
  return {
    name: str('Name'),
    uuid: str('UUID'),
    applicationIdentifier: str('application-identifier'),
    expires: new Date(/<key>ExpirationDate<\/key>\s*<date>([^<]*)<\/date>/.exec(xml)?.[1] ?? NaN),
    hasDevices: /<key>ProvisionedDevices<\/key>/.test(xml),
    certFingerprints,
  };
}

/* -------------------------------- Android --------------------------------- */

/** Thrown when a keystore is present but we hold no password to open it. */
export class NeedsPassword extends LeasError {}

export async function readAndroidKeystore({ projectRoot, build }) {
  const file = resolveCredential(projectRoot, build.keystorePath, 'LEAS_ANDROID_KEYSTORE_BASE64', 'upload.keystore');
  const password = build.keystorePassword ?? process.env.LEAS_ANDROID_KEYSTORE_PASSWORD;
  const wanted = build.keyAlias ?? process.env.LEAS_ANDROID_KEY_ALIAS ?? null;
  if (!password) throw new NeedsPassword('no password available to read it');

  const out = await capture('keytool', ['-list', '-v', '-keystore', file, '-storepass', password]);
  // -list -v prints one block per alias; read the block belonging to ours.
  const blocks = out.split(/^Alias name:\s*/m).slice(1);
  const entries = blocks.map((b) => ({
    alias: b.split('\n')[0].trim(),
    expires: parseKeytoolDate(/until: (.+)/.exec(b)?.[1]),
  }));
  const aliases = entries.map((e) => e.alias);
  const entry = wanted ? entries.find((e) => e.alias === wanted) : entries[0];
  return { alias: entry?.alias ?? null, wanted, aliases, expires: entry?.expires ?? null };
}

/** keytool prints "Mon Jan 06 11:00:00 EST 2054"; the zone abbreviation is the
 *  part Date cannot be trusted with, and day granularity does not need it. */
function parseKeytoolDate(text) {
  if (!text) return null;
  const stripped = text.trim().replace(/\s[A-Z]{2,5}\s(\d{4})$/, ' $1');
  for (const candidate of [stripped, text.trim()]) {
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/* --------------------------------- status --------------------------------- */

export function expiryStatus(date, warnDays = WARN_DAYS) {
  if (!date || Number.isNaN(date.getTime())) return { status: 'unknown', daysLeft: null };
  const daysLeft = Math.floor((date.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= warnDays) return { status: 'expiring', daysLeft };
  return { status: 'ok', daysLeft };
}

/* ---------------------------------- scan ---------------------------------- */

/**
 * Every credential that can expire, as plain metadata.
 *
 * The returned records carry no secret: an identity string, a date, and a
 * truncated public fingerprint. That is deliberate — these records are what
 * `leas sync` sends to a dashboard, so nothing here may be sensitive.
 */
export async function scanCredentials({ projectRoot, config, profileName, platforms, warnDays = WARN_DAYS }) {
  const records = [];
  const push = (base, expires, extra = {}) =>
    records.push({ ...base, ...expiryStatus(expires, warnDays), profile: profileName,
      expires: expires && !Number.isNaN(expires?.getTime?.()) ? expires.toISOString() : null, ...extra });

  for (const platform of platforms) {
    let build;
    try { build = buildProfile(config, profileName, platform); } catch { continue; }

    if (platform === 'ios') {
      await collect(records, { id: 'ios-distribution-certificate', platform, kind: 'Distribution certificate', profile: profileName }, async () => {
        const cert = await readDistributionCertificate({ projectRoot, build });
        push({ id: 'ios-distribution-certificate', platform, kind: 'Distribution certificate', identity: cert.identity },
          cert.expires, { fingerprint: cert.fingerprint.slice(0, 16) });
      });

      await collect(records, { id: 'ios-provisioning-profile', platform, kind: 'Provisioning profile', profile: profileName }, async () => {
        const p = await readProvisioningProfile({ projectRoot, build });
        const appId = p.applicationIdentifier?.replace(/^[A-Z0-9]+\./, '') ?? null;
        push({ id: 'ios-provisioning-profile', platform, kind: 'Provisioning profile', identity: p.name },
          p.expires, { appId });
      });
    }

    if (platform === 'android') {
      await collect(records, { id: 'android-upload-keystore', platform, kind: 'Upload keystore', profile: profileName }, async () => {
        const k = await readAndroidKeystore({ projectRoot, build });
        push({ id: 'android-upload-keystore', platform, kind: 'Upload keystore', identity: k.alias ? `alias ${k.alias}` : null },
          k.expires);
      });
    }
  }

  // Soonest first: the whole point is to see what is about to break.
  const rank = { expired: 0, expiring: 1, ok: 2, unknown: 3 };
  return records.sort((a, b) =>
    (rank[a.status] - rank[b.status]) || ((a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)));
}

/** A credential we cannot read is a record too — silence would look like health. */
async function collect(records, base, fn) {
  const before = records.length;
  try {
    await fn();
  } catch (e) {
    if (records.length > before) return;
    records.push({
      ...base, identity: null, expires: null, daysLeft: null,
      status: 'unknown', note: e instanceof NeedsPassword ? e.message : shorten(e.message),
    });
  }
}

function shorten(message) {
  const first = String(message).split('\n')[0];
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
}
