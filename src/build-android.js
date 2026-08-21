import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { run, log, LeasError } from './util.js';
import { materialize } from './credentials.js';

export async function buildAndroid({ projectRoot, profile, outDir }) {
  const androidDir = path.join(projectRoot, 'android');
  if (!existsSync(androidDir)) throw new LeasError('No android/ directory. Run `leas prebuild` first.');

  const isBundle = (profile.buildType ?? 'app-bundle') === 'app-bundle';
  const task = profile.gradleCommand ?? (isBundle ? ':app:bundleRelease' : ':app:assembleRelease');
  mkdirSync(outDir, { recursive: true });

  log.step(`Gradle ${task}`);
  await run('./gradlew', [task, '--no-daemon', ...(profile.gradleArgs ?? [])], { cwd: androidDir });

  const built = findNewestArtifact(path.join(androidDir, 'app/build/outputs'), isBundle ? '.aab' : '.apk');
  const artifactPath = path.join(outDir, path.basename(built));
  copyFileSync(built, artifactPath);

  // The Expo/RN template signs release builds with the debug keystore, so we
  // always re-sign with the real upload key. This keeps build.gradle untouched.
  if (!profile.skipSigning) {
    const keystore = materialize({
      filePath: profile.keystorePath,
      base64Env: 'LEAS_ANDROID_KEYSTORE_BASE64',
      name: 'upload.keystore',
    });
    const creds = {
      storePassword: process.env.LEAS_ANDROID_KEYSTORE_PASSWORD ?? profile.keystorePassword,
      keyAlias: process.env.LEAS_ANDROID_KEY_ALIAS ?? profile.keyAlias,
      keyPassword: process.env.LEAS_ANDROID_KEY_PASSWORD ?? profile.keyPassword ?? process.env.LEAS_ANDROID_KEYSTORE_PASSWORD,
    };
    if (!creds.storePassword || !creds.keyAlias) {
      throw new LeasError('Android signing needs LEAS_ANDROID_KEYSTORE_PASSWORD and LEAS_ANDROID_KEY_ALIAS.');
    }
    if (isBundle) await signAab(artifactPath, keystore, creds);
    else await signApk(artifactPath, keystore, creds);
  }

  log.ok(`Built ${artifactPath}`);
  return { artifactPath };
}

async function signAab(aabPath, keystore, { storePassword, keyAlias, keyPassword }) {
  log.step('Signing .aab with upload key');
  // Drop the template's debug signature before applying ours.
  await run('zip', ['-q', '-d', aabPath, 'META-INF/*.RSA', 'META-INF/*.SF', 'META-INF/*.DSA'])
    .catch(() => log.dim('no existing signature to strip'));
  await run('jarsigner', [
    '-keystore', keystore,
    '-storepass', storePassword,
    '-keypass', keyPassword,
    '-sigalg', 'SHA256withRSA',
    '-digestalg', 'SHA-256',
    aabPath, keyAlias,
  ]);
}

async function signApk(apkPath, keystore, { storePassword, keyAlias, keyPassword }) {
  log.step('Signing .apk with upload key');
  const apksigner = findApksigner();
  // apksigner replaces any existing signature, so no stripping needed.
  await run(apksigner, [
    'sign',
    '--ks', keystore,
    '--ks-pass', `pass:${storePassword}`,
    '--ks-key-alias', keyAlias,
    '--key-pass', `pass:${keyPassword}`,
    apkPath,
  ]);
}

function findApksigner() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new LeasError('ANDROID_HOME is not set; cannot locate apksigner.');
  const buildTools = path.join(sdk, 'build-tools');
  const versions = readdirSync(buildTools).sort().reverse();
  for (const v of versions) {
    const candidate = path.join(buildTools, v, 'apksigner');
    if (existsSync(candidate)) return candidate;
  }
  throw new LeasError(`No apksigner found under ${buildTools}.`);
}

function findNewestArtifact(dir, ext) {
  const found = [];
  (function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(ext)) found.push(full);
    }
  })(dir);
  if (!found.length) throw new LeasError(`Gradle produced no ${ext} under ${dir}.`);
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}
