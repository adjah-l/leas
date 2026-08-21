import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { LeasError } from './util.js';

const DEFAULTS = {
  ios: { configuration: 'Release', exportMethod: 'app-store', simulator: false },
  android: { buildType: 'app-bundle', gradleCommand: null },
};

/**
 * leas.json mirrors eas.json's shape on purpose, so an existing Expo project
 * can be pointed at leas with a rename and near-zero edits.
 */
export function loadConfig(projectRoot) {
  const file = path.join(projectRoot, 'leas.json');
  if (!existsSync(file)) {
    throw new LeasError(`No leas.json found in ${projectRoot}. Run \`leas init\` to create one.`);
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new LeasError(`leas.json is not valid JSON: ${e.message}`);
  }
}

export function buildProfile(config, profileName, platform) {
  const profile = config.build?.[profileName];
  if (!profile) {
    const known = Object.keys(config.build ?? {}).join(', ') || '(none)';
    throw new LeasError(`Unknown build profile "${profileName}". Defined profiles: ${known}`);
  }
  // Profiles may `extends` another profile, same as eas.json.
  const base = profile.extends ? buildProfile(config, profile.extends, platform) : {};
  const shared = { ...base };
  delete shared.extends;
  return {
    ...DEFAULTS[platform],
    ...shared,
    ...stripPlatformKeys(profile),
    ...(profile[platform] ?? {}),
  };
}

export function submitProfile(config, profileName, platform) {
  const profile = config.submit?.[profileName]?.[platform];
  if (!profile) {
    throw new LeasError(`No submit.${profileName}.${platform} section in leas.json.`);
  }
  return profile;
}

function stripPlatformKeys(profile) {
  const { ios, android, extends: _e, ...rest } = profile;
  return rest;
}

/** Read the app's name/slug/version from app.json / app.config.js output. */
export function readAppJson(projectRoot) {
  for (const name of ['app.json', 'app.config.json']) {
    const file = path.join(projectRoot, name);
    if (existsSync(file)) {
      const json = JSON.parse(readFileSync(file, 'utf8'));
      return json.expo ?? json;
    }
  }
  return {};
}
