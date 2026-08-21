import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LeasError } from './util.js';

/**
 * Update storage, laid out so the manifest server can answer a request with
 * directory reads alone:
 *
 *   .leas/updates/<updateId>/          the untouched `expo export` output
 *                           update.json  leas metadata (channel, runtime, git)
 *   .leas/updates/pointers/<channel>__<runtimeVersion>.json
 *                                      an explicit pin — how rollback works
 */
export function updatesRoot(projectRoot) {
  const dir = path.join(projectRoot, '.leas', 'updates');
  mkdirSync(path.join(dir, 'pointers'), { recursive: true });
  return dir;
}

export const base64url = (buf) => buf.toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const sha256 = (buf, enc = 'hex') =>
  enc === 'buffer'
    ? crypto.createHash('sha256').update(buf).digest()
    : crypto.createHash('sha256').update(buf).digest(enc);
export const md5hex = (buf) => crypto.createHash('md5').update(buf).digest('hex');

/** The protocol wants a UUID; Expo derives it from the metadata hash so it is stable. */
export function uuidFromSha256Hex(hex) {
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

export function listUpdates(projectRoot, filter = {}) {
  const root = updatesRoot(projectRoot);
  return readdirSync(root)
    .filter((f) => f !== 'pointers')
    .map((id) => {
      const file = path.join(root, id, 'update.json');
      if (!existsSync(file)) return null;
      try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
    })
    .filter(Boolean)
    .filter((u) => (!filter.channel || channelsOf(u).includes(filter.channel)))
    .filter((u) => (!filter.runtimeVersion || u.runtimeVersion === filter.runtimeVersion))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** An update can be served on several channels once it has been promoted. */
export const channelsOf = (u) => u.channels ?? (u.channel ? [u.channel] : []);

export function readUpdate(projectRoot, updateId) {
  const file = path.join(updatesRoot(projectRoot), updateId, 'update.json');
  if (!existsSync(file)) throw new LeasError(`No update ${updateId}.`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeUpdate(projectRoot, record) {
  writeFileSync(path.join(updatesRoot(projectRoot), record.id, 'update.json'),
    JSON.stringify(record, null, 2) + '\n');
  return record;
}

export function updateDir(projectRoot, updateId) {
  return path.join(updatesRoot(projectRoot), updateId);
}

/* ---------- channel pointers ---------- */

const pointerFile = (projectRoot, channel, runtimeVersion) =>
  path.join(updatesRoot(projectRoot), 'pointers', `${channel}__${runtimeVersion}.json`);

export function setPointer(projectRoot, channel, runtimeVersion, pointer) {
  writeFileSync(pointerFile(projectRoot, channel, runtimeVersion),
    JSON.stringify({ channel, runtimeVersion, ...pointer,
      setAt: new Date().toISOString() }, null, 2) + '\n');
}

export function readPointer(projectRoot, channel, runtimeVersion) {
  const file = pointerFile(projectRoot, channel, runtimeVersion);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export function clearPointer(projectRoot, channel, runtimeVersion) {
  const file = pointerFile(projectRoot, channel, runtimeVersion);
  if (existsSync(file)) writeFileSync(file, JSON.stringify({ cleared: true }, null, 2) + '\n');
}

/**
 * What a device on this channel and runtime should be served.
 * An explicit pointer always wins — that is what makes a rollback immediate.
 */
export function resolveChannel(projectRoot, channel, runtimeVersion) {
  const pointer = readPointer(projectRoot, channel, runtimeVersion);
  if (pointer?.rollBackToEmbedded) {
    return { kind: 'rollback', commitTime: pointer.rollBackToEmbedded.commitTime };
  }
  if (pointer?.updateId) {
    return { kind: 'update', update: readUpdate(projectRoot, pointer.updateId) };
  }
  const newest = listUpdates(projectRoot, { channel, runtimeVersion })[0];
  return newest ? { kind: 'update', update: newest } : { kind: 'none' };
}

/* ---------- runtime version ---------- */

/**
 * The compatibility key. A device only accepts updates whose runtimeVersion
 * matches the one baked into the binary it is running — which is why a native
 * change needs a new build, not an update.
 */
export function resolveRuntimeVersion(appConfig, platform) {
  const raw = appConfig[platform]?.runtimeVersion ?? appConfig.runtimeVersion;
  if (!raw) {
    throw new LeasError(
      'No runtimeVersion in your app config. Add `"runtimeVersion": "1.0.0"` (or a policy) ' +
      'under `expo` in app.json — updates cannot be targeted without it.');
  }
  if (typeof raw === 'string') return raw;
  switch (raw.policy) {
    case 'appVersion':
      return required(appConfig.version, 'expo.version');
    case 'nativeVersion':
      return `${required(appConfig.version, 'expo.version')}(${platform === 'ios'
        ? required(appConfig.ios?.buildNumber, 'expo.ios.buildNumber')
        : required(appConfig.android?.versionCode, 'expo.android.versionCode')})`;
    case 'sdkVersion':
      return required(appConfig.sdkVersion, 'expo.sdkVersion');
    case 'fingerprint':
      throw new LeasError(
        'runtimeVersion policy "fingerprint" needs @expo/fingerprint to compute. ' +
        'Run `npx expo-updates fingerprint:generate` and set the value explicitly, ' +
        'or switch to the "appVersion" policy.');
    default:
      throw new LeasError(`Unknown runtimeVersion policy "${raw.policy}".`);
  }
}

function required(value, name) {
  if (value == null) throw new LeasError(`runtimeVersion policy needs ${name} to be set.`);
  return String(value);
}

/* ---------- assets ---------- */

const MIME = {
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
  svg:'image/svg+xml', bmp:'image/bmp', ico:'image/x-icon', avif:'image/avif',
  ttf:'font/ttf', otf:'font/otf', woff:'font/woff', woff2:'font/woff2',
  mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm',
  mp3:'audio/mpeg', wav:'audio/wav', m4a:'audio/mp4', aac:'audio/aac',
  json:'application/json', js:'application/javascript', hbc:'application/javascript',
  txt:'text/plain', html:'text/html', xml:'text/xml', pdf:'application/pdf',
  zip:'application/zip', lottie:'application/json',
};
export const mimeFor = (ext) => MIME[String(ext ?? '').replace(/^\./, '').toLowerCase()]
  ?? 'application/octet-stream';

/** Asset descriptor in the shape the protocol requires. */
export function assetMetadata({ dir, filePath, ext, isLaunchAsset, baseUrl, updateId }) {
  const abs = safeJoin(dir, filePath);
  const bytes = readFileSync(abs);
  return {
    hash: base64url(sha256(bytes, 'buffer')),
    key: md5hex(bytes),
    fileExtension: `.${isLaunchAsset ? 'bundle' : String(ext).replace(/^\./, '')}`,
    contentType: isLaunchAsset ? 'application/javascript' : mimeFor(ext),
    url: `${baseUrl}/api/assets?updateId=${encodeURIComponent(updateId)}` +
         `&asset=${encodeURIComponent(filePath)}`,
  };
}

/** Refuse any path that escapes the update directory. */
export function safeJoin(dir, relative) {
  const resolved = path.resolve(dir, relative);
  const base = path.resolve(dir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new LeasError(`Refusing to read outside the update directory: ${relative}`);
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new LeasError(`No such asset: ${relative}`);
  }
  return resolved;
}
