import {
  existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync,
} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { run, capture, log, LeasError } from './util.js';
import {
  updatesRoot, updateDir, sha256, uuidFromSha256Hex, resolveRuntimeVersion,
  listUpdates, readUpdate, setPointer, writeUpdate,
} from './update-store.js';

/**
 * Publish: export the JS bundle and assets, then file the result under an id
 * derived from the export's own metadata — so republishing identical code
 * produces the same update id, exactly as EAS does.
 */
export async function publishUpdate({ projectRoot, channel, message, platform = 'all' }) {
  const dist = path.join(projectRoot, '.leas', 'export');
  rmSync(dist, { recursive: true, force: true });

  log.step(`Exporting JS bundle (${platform})`);
  await run('npx', ['expo', 'export', '--platform', platform, '--output-dir', dist],
    { cwd: projectRoot });

  const metadataPath = path.join(dist, 'metadata.json');
  if (!existsSync(metadataPath)) {
    throw new LeasError('expo export produced no metadata.json — is this an Expo project?');
  }
  const metadataBuffer = readFileSync(metadataPath);
  const metadata = JSON.parse(metadataBuffer.toString('utf8'));

  // The public Expo config travels with the update; expo-updates surfaces it as
  // Constants.expoConfig on the device.
  const expoConfigPath = path.join(dist, 'expoConfig.json');
  if (!existsSync(expoConfigPath)) {
    log.dim('export had no expoConfig.json — generating it');
    const cfg = await capture('npx', ['expo', 'config', '--json', '--type', 'public'],
      { cwd: projectRoot });
    writeFileSync(expoConfigPath, cfg);
  }
  const appConfig = JSON.parse(readFileSync(expoConfigPath, 'utf8'));

  const platforms = Object.keys(metadata.fileMetadata ?? {});
  if (!platforms.length) throw new LeasError('export contained no platform bundles.');

  // One runtimeVersion per update: if the two platforms disagree, they are not
  // the same update and must be published separately.
  const runtimeVersions = [...new Set(platforms.map((p) => resolveRuntimeVersion(appConfig, p)))];
  if (runtimeVersions.length > 1) {
    throw new LeasError(
      `iOS and Android resolve to different runtime versions (${runtimeVersions.join(', ')}). ` +
      'Publish each platform separately with --platform ios / --platform android.');
  }
  const runtimeVersion = runtimeVersions[0];

  const id = uuidFromSha256Hex(sha256(metadataBuffer));
  const dir = updateDir(projectRoot, id);
  if (existsSync(path.join(dir, 'update.json'))) {
    log.warn(`Identical bundle already published as ${id} — republishing to "${channel}".`);
  }
  mkdirSync(updatesRoot(projectRoot), { recursive: true });
  rmSync(dir, { recursive: true, force: true });
  cpSync(dist, dir, { recursive: true });

  const record = writeUpdate(projectRoot, {
    id,
    channel,
    channels: [channel],
    runtimeVersion,
    platforms,
    message: message ?? (await lastCommitMessage(projectRoot)) ?? 'No message',
    createdAt: new Date().toISOString(),
    git: await gitContext(projectRoot),
    bytes: dirSize(dir),
    assetCount: platforms.reduce((n, p) => n + (metadata.fileMetadata[p].assets?.length ?? 0), 0),
  });

  // Publishing supersedes any pin left behind by an earlier rollback.
  setPointer(projectRoot, channel, runtimeVersion, { updateId: id, reason: 'publish' });

  log.ok(`Published ${id}`);
  log.info(`channel ${channel} · runtime ${runtimeVersion} · ${platforms.join(', ')}`);
  log.info(`${record.assetCount} assets · ${(record.bytes / 1e6).toFixed(1)} MB`);
  return record;
}

/** Point a channel at an already-published update. */
export function rollbackUpdate({ projectRoot, channel, runtimeVersion, to, embedded }) {
  if (embedded) {
    setPointer(projectRoot, channel, runtimeVersion, {
      rollBackToEmbedded: { commitTime: new Date().toISOString() },
      reason: 'rollback to embedded',
    });
    log.ok(`Channel "${channel}" (runtime ${runtimeVersion}) now rolls devices back to the built-in bundle.`);
    return { kind: 'embedded' };
  }

  const history = listUpdates(projectRoot, { channel, runtimeVersion });
  if (!history.length) throw new LeasError(`No updates on channel "${channel}" for runtime ${runtimeVersion}.`);

  const target = to ? readUpdate(projectRoot, to) : history[1];
  if (!target) {
    throw new LeasError(
      `Only one update exists on "${channel}". Use --embedded to send devices back to the bundle ` +
      'shipped inside the binary.');
  }
  setPointer(projectRoot, channel, runtimeVersion, { updateId: target.id, reason: 'rollback' });
  log.ok(`Channel "${channel}" now serves ${target.id}`);
  log.info(`"${target.message}" · published ${target.createdAt}`);
  return { kind: 'update', update: target };
}

/** Move a tested update from one channel to another without re-exporting. */
export function promoteUpdate({ projectRoot, from, to, runtimeVersion }) {
  const source = listUpdates(projectRoot, { channel: from, runtimeVersion })[0];
  if (!source) throw new LeasError(`Nothing on channel "${from}" for runtime ${runtimeVersion}.`);

  // Promotion adds a channel rather than moving the update off the one it was
  // tested on — the same bundle is now live on both.
  const promoted = writeUpdate(projectRoot, {
    ...source,
    channels: [...new Set([...(source.channels ?? [source.channel]), to])],
    promotedFrom: from,
    promotedAt: new Date().toISOString(),
  });
  setPointer(projectRoot, to, runtimeVersion, { updateId: promoted.id, reason: `promote from ${from}` });
  log.ok(`Promoted ${promoted.id} from "${from}" to "${to}"`);
  log.info(`"${promoted.message}"`);
  return promoted;
}

/** RSA keypair for code signing. The public half becomes the client certificate. */
export function generateKeys({ projectRoot }) {
  const dir = path.join(projectRoot, 'credentials', 'updates');
  mkdirSync(dir, { recursive: true });
  const priv = path.join(dir, 'private-key.pem');
  if (existsSync(priv)) {
    throw new LeasError(`${priv} already exists. Delete it first if you really mean to replace it.`);
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(priv, privateKey.export({ type: 'pkcs1', format: 'pem' }), { mode: 0o600 });
  writeFileSync(path.join(dir, 'public-key.pem'), publicKey.export({ type: 'pkcs1', format: 'pem' }));
  log.ok(`Wrote ${priv} and public-key.pem`);
  log.warn('The device needs an X.509 certificate, not the raw public key. Generate one with:');
  log.dim('npx @expo/code-signing-certificates generate-certificate \\');
  log.dim('  --key-input-directory credentials/updates --certificate-output-directory credentials/updates');
  log.dim('then set expo.updates.codeSigningCertificate in app.json');
  return { privateKeyPath: priv };
}

/* ---------- helpers ---------- */

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

async function lastCommitMessage(projectRoot) {
  return capture('git', ['log', '-1', '--pretty=%s'], { cwd: projectRoot }).catch(() => null);
}

async function gitContext(projectRoot) {
  const git = (args) => capture('git', args, { cwd: projectRoot }).catch(() => null);
  const [branch, commit] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['rev-parse', '--short', 'HEAD']),
  ]);
  return { branch, commit };
}
