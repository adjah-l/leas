import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LeasError, log } from './util.js';

export function validateProjectId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw new LeasError('Project ID must be 1-64 lowercase letters, digits, or hyphens.');
  }
  return value;
}

export function projectUrl(base, project) {
  validateProjectId(project);
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new LeasError('Use the server origin, without a path, credentials, query or fragment.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new LeasError('OTA requires HTTPS, except localhost.');
  return `${url.origin}/projects/${project}`;
}

export function configuredUpdateUrl(projectRoot) {
  const file = path.join(projectRoot, 'leas.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).update?.url : undefined;
}

export function configureUpdates({ projectRoot, url, project, channel = 'production' }) {
  if (!url || !project) throw new LeasError('Pass --url https://your-server and --project your-app.');
  const base = projectUrl(url, project);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(channel)) throw new LeasError('Invalid channel.');
  const appPath = path.join(projectRoot, 'app.json');
  if (['app.config.js', 'app.config.ts', 'app.config.mjs'].some(name => existsSync(path.join(projectRoot, name))) || !existsSync(appPath)) {
    throw new LeasError(`Dynamic Expo config: set updates.url to ${base}/api/manifest and requestHeaders.expo-channel-name to ${channel}; set leas.json update.url to ${base}.`);
  }
  const app = JSON.parse(readFileSync(appPath, 'utf8'));
  const expo = app.expo ?? app;
  if (!expo.runtimeVersion && !expo.ios?.runtimeVersion && !expo.android?.runtimeVersion) throw new LeasError('Choose a runtimeVersion policy before configuring OTA.');
  expo.updates = { ...expo.updates, url: `${base}/api/manifest`, requestHeaders: { ...expo.updates?.requestHeaders, 'expo-channel-name': channel } };
  const configPath = path.join(projectRoot, 'leas.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
  config.update = { ...config.update, project, url: base };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
  log.ok(`Configured ${project}: ${base}`);
  log.warn('Ship a new native binary with this URL, channel, and runtime. Existing native directories must be regenerated or updated.');
  return config.update;
}
