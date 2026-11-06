import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { startUpdateServer } from '../src/update-server.js';
import { installUpdate, remoteRequest } from '../src/update-remote.js';
import { resolveChannel, updateDir } from '../src/update-store.js';
import { rollbackUpdate, promoteUpdate } from '../src/update-publish.js';

function fixture(platform = 'ios', channel = 'production', runtimeVersion = '1', createdAt = new Date().toISOString()) {
  const encode = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64');
  return { record: { id: crypto.randomUUID(), platforms: [platform], channel, runtimeVersion, createdAt }, files: {
    'metadata.json': encode({ fileMetadata: { [platform]: { bundle: 'bundles/app.js', assets: [{ path: 'assets/icon', ext: 'png' }] } } }),
    'expoConfig.json': encode({ name: 'Test' }), 'bundles/app.js': encode('console.log("hello")'), 'assets/icon': encode('image'),
  } };
}
async function setup(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'leas-test-'));
  const { server } = await startUpdateServer({ projectRoot: root, port: 0, token: 'test-token' });
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(root, { recursive: true, force: true }); });
  const manifest = (platform = 'ios', extra = {}) => fetch(`${url}/api/manifest`, { headers: { 'expo-platform': platform, 'expo-runtime-version': '1', 'expo-protocol-version': '1', ...extra } });
  return { root, url, manifest };
}

test('authenticated remote publish, isolated platforms, no update, and asset restrictions', async t => {
  const { root, url, manifest } = await setup(t);
  assert.equal((await manifest()).status, 204);
  await assert.rejects(remoteRequest(url, 'publish', fixture(), 'wrong'), /401/);
  const ios = fixture();
  const android = fixture('android');
  await remoteRequest(url, 'publish', ios, 'test-token');
  await remoteRequest(url, 'publish', android, 'test-token');
  assert.equal(resolveChannel(root, 'production', '1', 'ios').update.id, ios.record.id);
  assert.equal(resolveChannel(root, 'production', '1', 'android').update.id, android.record.id);
  const response = await manifest();
  assert.equal(response.status, 200);
  assert.match(await response.text(), new RegExp(ios.record.id));
  assert.equal((await manifest('ios', { 'expo-current-update-id': ios.record.id })).status, 204);
  assert.equal((await manifest('ios', { 'expo-runtime-version': '2' })).status, 204);
  assert.equal((await manifest('ios', { accept: 'application/json' })).status, 406);
  assert.equal((await fetch(`${url}/api/assets?updateId=${ios.record.id}&asset=expoConfig.json`)).status, 404);
  const asset = await fetch(`${url}/api/assets?updateId=${ios.record.id}&asset=bundles/app.js`);
  assert.equal(await asset.text(), 'console.log("hello")');
  assert.equal((await fetch(`${url}/api/assets?updateId=..&asset=package.json`)).status, 404);
  await assert.rejects(remoteRequest(url, 'publish', ios, 'test-token'), /already exists/);
});

test('reject invalid packages without activation', async t => {
  const { root } = await setup(t);
  const bad = fixture();
  bad.files['../outside'] = 'eA==';
  assert.throws(() => installUpdate(root, bad), /path/);
  assert.equal(resolveChannel(root, 'production', '1', 'ios').kind, 'none');
  const missing = fixture();
  delete missing.files['bundles/app.js'];
  assert.throws(() => installUpdate(root, missing), /asset/);
});

test('rollback republishes immutable bytes and promotion follows selected release', async t => {
  const { root, url, manifest } = await setup(t);
  const old = fixture('ios', 'preview', '1', '2026-01-01T00:00:00.000Z');
  const newer = fixture('ios', 'preview', '1', '2026-02-01T00:00:00.000Z');
  installUpdate(root, old); installUpdate(root, newer);
  const { update } = rollbackUpdate({ projectRoot: root, channel: 'preview', runtimeVersion: '1', to: old.record.id, platform: 'ios' });
  assert.notEqual(update.id, old.record.id);
  assert.ok(update.createdAt > newer.record.createdAt);
  assert.deepEqual(readFileSync(path.join(updateDir(root, update.id), 'bundles/app.js')), readFileSync(path.join(updateDir(root, old.record.id), 'bundles/app.js')));
  const promoted = promoteUpdate({ projectRoot: root, from: 'preview', to: 'production', runtimeVersion: '1', platform: 'ios' });
  assert.equal(promoted.republishedFrom, update.id);
  await remoteRequest(url, 'rollback', { channel: 'production', runtimeVersion: '1', platform: 'ios', embedded: true }, 'test-token');
  assert.match(await (await manifest()).text(), /rollBackToEmbedded/);
  const incompatible = fixture('ios', 'preview', '2'); installUpdate(root, incompatible);
  assert.throws(() => rollbackUpdate({ projectRoot: root, channel: 'preview', runtimeVersion: '1', to: incompatible.record.id, platform: 'ios' }), /incompatible/);
});

test('signed manifests verify and asset symlinks cannot escape storage', async t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'leas-sign-'));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyPath = path.join(root, 'key.pem');
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs1', format: 'pem' }));
  const { server } = await startUpdateServer({ projectRoot: root, port: 0, privateKeyPath: keyPath });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(root, { recursive: true, force: true }); });
  const release = fixture(); installUpdate(root, release);
  const url = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${url}/api/manifest`, { headers: { 'expo-platform': 'ios', 'expo-runtime-version': '1', 'expo-expect-signature': 'sig, keyid="main"' } });
  const text = await response.text();
  const signature = text.match(/sig="([^"]+)"/)[1];
  const body = text.split('\r\n\r\n')[1].split('\r\n')[0];
  assert.equal(crypto.verify('RSA-SHA256', Buffer.from(body), publicKey, Buffer.from(signature, 'base64')), true);
  const manifest = JSON.parse(body);
  const asset = await fetch(manifest.launchAsset.url);
  assert.equal(asset.status, 200);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('base64url'), manifest.launchAsset.hash);
  const icon = path.join(updateDir(root, release.record.id), 'assets/icon');
  rmSync(icon); symlinkSync(keyPath, icon);
  assert.equal((await fetch(`${url}/api/assets?updateId=${release.record.id}&asset=assets/icon`)).status, 404);
});

test('remote history identifies the serving platforms', async t => {
  const { root, url } = await setup(t);
  const release = fixture(); installUpdate(root, release);
  const history = await remoteRequest(url, 'list', { channel: 'production' }, 'test-token');
  assert.equal(history[0].id, release.record.id);
  assert.deepEqual(history[0].servingPlatforms, ['ios']);
  await assert.rejects(remoteRequest(url, 'list', {}, 'wrong'), /401/);
});

test('shared server keeps projects, assets, channels, and rollback isolated', async t => {
  const { root, url } = await setup(t);
  const a = fixture(); const b = fixture();
  await remoteRequest(`${url}/projects/app-a`, 'publish', a, 'test-token');
  await remoteRequest(`${url}/projects/app-b`, 'publish', b, 'test-token');
  const headers = { 'expo-platform': 'ios', 'expo-runtime-version': '1' };
  const response = await fetch(`${url}/projects/app-a/api/manifest`, { headers });
  const body = await response.text();
  assert.match(body, new RegExp(a.record.id));
  assert.ok(!body.includes(b.record.id));
  assert.match(body, /\/projects\/app-a\/api\/assets/);
  assert.equal((await fetch(`${url}/projects/app-b/api/assets?updateId=${a.record.id}&asset=bundles/app.js`)).status, 404);
  await remoteRequest(`${url}/projects/app-a`, 'rollback', { channel: 'production', runtimeVersion: '1', platform: 'ios', embedded: true }, 'test-token');
  assert.match(await (await fetch(`${url}/projects/app-a/api/manifest`, { headers })).text(), /rollBackToEmbedded/);
  assert.match(await (await fetch(`${url}/projects/app-b/api/manifest`, { headers })).text(), new RegExp(b.record.id));
  assert.equal((await fetch(`${url}/projects/unknown/api/manifest`, { headers })).status, 204);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(path.join(root, 'projects/unknown')), false);
  await assert.rejects(remoteRequest(`${url}/projects/app-a`, 'list', {}, 'wrong'), /401/);
});

test('configure preserves existing Expo settings and persists a project URL', async t => {
  const { configureUpdates } = await import('../src/update-configure.js');
  const root = mkdtempSync(path.join(os.tmpdir(), 'leas-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { name: 'Test', runtimeVersion: { policy: 'appVersion' }, updates: { checkAutomatically: 'ON_LOAD' } } }));
  configureUpdates({ projectRoot: root, url: 'https://updates.example.com', project: 'app-a' });
  const app = JSON.parse(readFileSync(path.join(root, 'app.json'))).expo;
  assert.equal(app.updates.url, 'https://updates.example.com/projects/app-a/api/manifest');
  assert.equal(app.updates.checkAutomatically, 'ON_LOAD');
  assert.equal(app.runtimeVersion.policy, 'appVersion');
  assert.equal(JSON.parse(readFileSync(path.join(root, 'leas.json'))).update.project, 'app-a');
  assert.throws(() => configureUpdates({ projectRoot: root, url: 'https://updates.example.com', project: '../escape' }), /Project ID/);
});

test('signing arguments are redacted from logs', async () => {
  const { redactCommandArgs } = await import('../src/util.js');
  assert.deepEqual(redactCommandArgs('security', ['import', 'cert', '-P', 'secret']), ['import', 'cert', '-P', '[REDACTED]']);
  assert.deepEqual(redactCommandArgs('jarsigner', ['-storepass', 'secret']), ['-storepass', '[REDACTED]']);
});
