import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { run, capture, log, LeasError } from './util.js';

/**
 * Credentials resolve from either a local file path or a base64 env var.
 * Same code path runs on your laptop and on a CI worker — only the source differs.
 */
export function materialize({ filePath, base64Env, name }) {
  if (filePath && existsSync(filePath)) return path.resolve(filePath);
  const b64 = base64Env ? process.env[base64Env] : null;
  if (b64) {
    const dir = mkdtempSync(path.join(tmpdir(), 'leas-cred-'));
    const out = path.join(dir, name);
    writeFileSync(out, Buffer.from(b64, 'base64'), { mode: 0o600 });
    return out;
  }
  throw new LeasError(
    `Could not resolve credential "${name}". Provide it as a file (${filePath ?? 'unset path'}) or set ${base64Env}.`
  );
}

/**
 * iOS signing: import the distribution .p12 into a throwaway keychain and
 * install the provisioning profile where xcodebuild looks for it.
 * A dedicated keychain means we never touch the user's login keychain.
 */
export async function setupIosSigning({ certPath, certPassword, profilePath }) {
  const keychain = path.join(tmpdir(), `leas-${crypto.randomUUID()}.keychain-db`);
  const keychainPassword = crypto.randomBytes(16).toString('hex');

  log.step('Preparing iOS signing keychain');
  await run('security', ['create-keychain', '-p', keychainPassword, keychain]);
  await run('security', ['set-keychain-settings', '-lut', '21600', keychain]);
  await run('security', ['unlock-keychain', '-p', keychainPassword, keychain]);
  await run('security', [
    'import', certPath, '-k', keychain, '-P', certPassword ?? '',
    '-T', '/usr/bin/codesign', '-T', '/usr/bin/security', '-f', 'pkcs12',
  ]);
  // Without this, codesign prompts for keychain access and the build hangs in CI.
  await run('security', [
    'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:',
    '-s', '-k', keychainPassword, keychain,
  ]);

  const existing = (await capture('security', ['list-keychains', '-d', 'user']))
    .split('\n').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
  await run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...existing]);

  const profileDir = path.join(homedir(), 'Library/MobileDevice/Provisioning Profiles');
  mkdirSync(profileDir, { recursive: true });
  const uuid = await provisioningProfileUuid(profilePath);
  const installed = path.join(profileDir, `${uuid}.mobileprovision`);
  writeFileSync(installed, readFileSync(profilePath));
  log.ok(`Installed provisioning profile ${uuid}`);

  return {
    keychain,
    profileUuid: uuid,
    profileName: await provisioningProfileField(profilePath, 'Name'),
    teamId: (await provisioningProfileField(profilePath, 'TeamIdentifier')) ?? null,
    cleanup: async () => {
      await run('security', ['delete-keychain', keychain]).catch(() => {});
    },
  };
}

async function decodeProfile(profilePath) {
  // .mobileprovision is a CMS blob wrapping an XML plist.
  return capture('security', ['cms', '-D', '-i', profilePath]);
}

async function provisioningProfileUuid(profilePath) {
  return provisioningProfileField(profilePath, 'UUID');
}

async function provisioningProfileField(profilePath, key) {
  const xml = await decodeProfile(profilePath);
  const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'leas-prof-')), 'p.plist');
  writeFileSync(tmp, xml);
  try {
    const value = await capture('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, tmp]);
    // TeamIdentifier is an array; PlistBuddy prints it multi-line.
    return value.includes('\n') ? value.split('\n')[1]?.trim() ?? value : value;
  } catch {
    return null;
  }
}
