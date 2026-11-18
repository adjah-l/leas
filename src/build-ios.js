import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { run, capture, log, LeasError, requireBinary } from './util.js';
import { materialize, setupIosSigning } from './credentials.js';

export async function buildIos({ projectRoot, profile, outDir }) {
  requireBinary('xcodebuild', 'Install Xcode and run `xcode-select --install`.');
  const container = iosContainer(projectRoot, profile);
  const scheme = profile.scheme ?? (await defaultScheme(container));
  const automatic = profile.signingStyle === 'automatic';
  if (automatic && !profile.simulator && !profile.teamId) {
    throw new LeasError('Automatic signing requires ios.teamId.');
  }
  if (profile.signingStyle && !['automatic', 'manual'].includes(profile.signingStyle)) {
    throw new LeasError('ios.signingStyle must be automatic or manual.');
  }
  const configuration = profile.configuration ?? 'Release';
  mkdirSync(outDir, { recursive: true });

  const archivePath = path.join(outDir, `${scheme}.xcarchive`);
  const exportPath = path.join(outDir, 'export');

  let signing = null;
  if (!profile.simulator && !automatic) {
    const certPath = materialize({
      filePath: profile.distributionCertificatePath,
      base64Env: 'LEAS_IOS_DIST_CERT_BASE64',
      name: 'dist.p12',
    });
    const profilePath = materialize({
      filePath: profile.provisioningProfilePath,
      base64Env: 'LEAS_IOS_PROVISIONING_PROFILE_BASE64',
      name: 'profile.mobileprovision',
    });
    signing = await setupIosSigning({
      certPath,
      certPassword: process.env.LEAS_IOS_DIST_CERT_PASSWORD ?? profile.distributionCertificatePassword,
      profilePath,
    });
  }

  try {
    log.step(`Archiving ${scheme} (${configuration})`);
    const archiveArgs = [
      ...container,
      '-scheme', scheme,
      '-configuration', configuration,
      '-archivePath', archivePath,
      '-destination', profile.simulator ? 'generic/platform=iOS Simulator' : 'generic/platform=iOS',
      'archive',
      'COMPILER_INDEX_STORE_ENABLE=NO',
    ];
    if (profile.buildNumber != null) archiveArgs.push(`CURRENT_PROJECT_VERSION=${profile.buildNumber}`);
    if (profile.derivedDataPath) archiveArgs.push('-derivedDataPath', path.resolve(projectRoot, profile.derivedDataPath));
    if (profile.clonedSourcePackagesDirPath) archiveArgs.push('-clonedSourcePackagesDirPath', path.resolve(projectRoot, profile.clonedSourcePackagesDirPath));
    if (automatic && !profile.simulator) {
      archiveArgs.push('CODE_SIGN_STYLE=Automatic', `DEVELOPMENT_TEAM=${profile.teamId}`, '-allowProvisioningUpdates');
    } else if (signing) {
      archiveArgs.push(
        'CODE_SIGN_STYLE=Manual',
        `DEVELOPMENT_TEAM=${signing.teamId}`,
        `PROVISIONING_PROFILE_SPECIFIER=${signing.profileName}`,
        `OTHER_CODE_SIGN_FLAGS=--keychain ${signing.keychain}`,
      );
    } else {
      archiveArgs.push('CODE_SIGNING_ALLOWED=NO');
    }
    await run('xcodebuild', archiveArgs, { cwd: projectRoot });

    if (profile.simulator) {
      log.ok(`Simulator archive at ${archivePath}`);
      return { artifactPath: archivePath };
    }

    log.step('Exporting signed .ipa');
    const plistPath = path.join(outDir, 'ExportOptions.plist');
    writeFileSync(plistPath, exportOptionsPlist({
      method: profile.exportMethod ?? 'app-store',
      teamId: automatic ? profile.teamId : signing.teamId,
      bundleId: automatic ? null : await bundleIdentifier(archivePath),
      profileName: signing?.profileName,
      automatic,
      uploadSymbols: profile.uploadDebugSymbols !== false,
    }));

    await run('xcodebuild', [
      '-exportArchive',
      '-archivePath', archivePath,
      '-exportPath', exportPath,
      '-exportOptionsPlist', plistPath,
      '-allowProvisioningUpdates',
    ], { cwd: projectRoot });

    const ipa = readdirSync(exportPath).find((f) => f.endsWith('.ipa'));
    if (!ipa) throw new LeasError('Export succeeded but no .ipa was produced.');
    const artifactPath = path.join(exportPath, ipa);
    log.ok(`Built ${artifactPath}`);
    return { artifactPath };
  } finally {
    await signing?.cleanup();
  }
}

function findWorkspace(iosDir) {
  const ws = readdirSync(iosDir).find((f) => f.endsWith('.xcworkspace'));
  if (!ws) throw new LeasError('No .xcworkspace in ios/. Run `pod install` (leas prebuild does this).');
  return path.join(iosDir, ws);
}

async function defaultScheme(container) {
  const json = JSON.parse(await capture('xcodebuild', ['-list', '-json', ...container]));
  const schemes = json.workspace?.schemes ?? json.project?.schemes ?? [];
  const pick = schemes.find((s) => !/Tests?$/.test(s)) ?? schemes[0];
  if (!pick) throw new LeasError('No schemes found in workspace.');
  return pick;
}

async function bundleIdentifier(archivePath) {
  const plist = path.join(archivePath, 'Info.plist');
  return capture('/usr/libexec/PlistBuddy', [
    '-c', 'Print :ApplicationProperties:CFBundleIdentifier', plist,
  ]);
}

export function exportOptionsPlist({ method, teamId, bundleId, profileName, uploadSymbols, automatic = false }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>${xml(method)}</string>
  <key>teamID</key><string>${xml(teamId)}</string>
  <key>signingStyle</key><string>${automatic ? 'automatic' : 'manual'}</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>stripSwiftSymbols</key><true/>
  <key>uploadSymbols</key><${uploadSymbols ? 'true' : 'false'}/>
  ${automatic ? '' : `<key>provisioningProfiles</key>
  <dict><key>${xml(bundleId)}</key><string>${xml(profileName)}</string></dict>`}
</dict>
</plist>
`;
}

/** Explicit native projects skip Expo generation and CocoaPods installation. */
export function iosContainer(projectRoot, profile) {
  if (profile.projectPath && profile.workspacePath) {
    throw new LeasError('Set either ios.projectPath or ios.workspacePath.');
  }
  if (profile.projectPath || profile.workspacePath) {
    const workspace = Boolean(profile.workspacePath);
    const file = path.resolve(projectRoot, profile.workspacePath ?? profile.projectPath);
    const suffix = workspace ? '.xcworkspace' : '.xcodeproj';
    if (!file.endsWith(suffix) || !existsSync(file)) {
      throw new LeasError(`Missing ${suffix}: ${file}`);
    }
    return [workspace ? '-workspace' : '-project', file];
  }
  const iosDir = path.join(projectRoot, 'ios');
  if (!existsSync(iosDir)) throw new LeasError('No ios/ directory. Set ios.projectPath for a native Xcode project, or run `leas prebuild`.');
  return ['-workspace', findWorkspace(iosDir)];
}

function xml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
