import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { provisioningProfileField } from './credentials.js';
import { LeasError } from './util.js';

export async function configureTargetSigning({ projectRoot, container, profiles, signing }) {
  const xcode = createRequire(path.join(projectRoot, 'package.json'))('xcode');
  const nativeDir = path.dirname(container[1]);
  const projectDir = container[0] === '-project' ? container[1]
    : path.join(nativeDir, readdirSync(nativeDir).find(name => name.endsWith('.xcodeproj')) ?? '');
  const projectFile = path.join(projectDir, 'project.pbxproj');
  const original = readFileSync(projectFile, 'utf8');
  const project = xcode.project(projectFile);
  project.parseSync();
  const names = {};
  const installDir = path.join(homedir(), 'Library/MobileDevice/Provisioning Profiles');
  mkdirSync(installDir, { recursive: true });
  for (const [bundleId, file] of Object.entries(profiles)) {
    const full = path.resolve(projectRoot, file);
    const uuid = await provisioningProfileField(full, 'UUID');
    const name = await provisioningProfileField(full, 'Name');
    if (!uuid || !name) throw new LeasError(`Invalid provisioning profile for ${bundleId}`);
    writeFileSync(path.join(installDir, `${uuid}.mobileprovision`), readFileSync(full));
    names[bundleId] = name;
  }
  let matched = 0;
  const objects = project.hash.project.objects;
  for (const target of Object.values(objects.PBXNativeTarget)) {
    if (!target || typeof target !== 'object') continue;
    const list = objects.XCConfigurationList[target.buildConfigurationList];
    for (const ref of list?.buildConfigurations ?? []) {
      const settings = objects.XCBuildConfiguration[ref.value]?.buildSettings;
      if (!settings) continue;
      const bundleId = String(settings.PRODUCT_BUNDLE_IDENTIFIER ?? '').replace(/^"|"$/g, '');
      const name = names[bundleId];
      if (!name) throw new LeasError(`Missing provisioning profile for native target ${bundleId || target.name}`);
      settings.CODE_SIGN_STYLE = 'Manual';
      settings.DEVELOPMENT_TEAM = signing.teamId;
      settings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
      settings.PROVISIONING_PROFILE_SPECIFIER = JSON.stringify(name);
      delete settings.PROVISIONING_PROFILE;
      matched++;
    }
  }
  if (!matched) throw new LeasError('No native targets matched provisioning profiles.');
  writeFileSync(projectFile, project.writeSync());
  return { names, restore: () => writeFileSync(projectFile, original) };
}
