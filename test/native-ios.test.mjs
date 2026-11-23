import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { iosContainer, exportOptionsPlist } from '../src/build-ios.js';

const cli = new URL('../src/cli.js', import.meta.url).pathname;
test('native project selection validates paths and ambiguity', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'leas-native-'));
  try {
    mkdirSync(path.join(dir, 'App.xcodeproj'));
    mkdirSync(path.join(dir, 'App.xcworkspace'));
    assert.deepEqual(iosContainer(dir, { projectPath: 'App.xcodeproj' }), ['-project', path.join(dir, 'App.xcodeproj')]);
    assert.deepEqual(iosContainer(dir, { workspacePath: 'App.xcworkspace' }), ['-workspace', path.join(dir, 'App.xcworkspace')]);
    assert.throws(() => iosContainer(dir, { projectPath: 'Missing.xcodeproj' }), /Missing/);
    assert.throws(() => iosContainer(dir, { projectPath: 'App.xcodeproj', workspacePath: 'App.xcworkspace' }), /either/);
    mkdirSync(path.join(dir, 'ios', 'Expo.xcworkspace'), { recursive: true });
    assert.deepEqual(iosContainer(dir, {}), ['-workspace', path.join(dir, 'ios', 'Expo.xcworkspace')]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('automatic export lets Xcode resolve extension profiles; manual preserves mapping and escapes XML', () => {
  const automatic = exportOptionsPlist({ method: 'app-store-connect', teamId: 'TEAM', automatic: true, uploadSymbols: true });
  assert.match(automatic, /<string>automatic<\/string>/);
  assert.doesNotMatch(automatic, /provisioningProfiles/);
  assert.match(automatic, /manageAppVersionAndBuildNumber<\/key><false\/>/);
  const manual = exportOptionsPlist({ method: 'app-store', teamId: 'TEAM', bundleId: 'com.app', profileName: 'App & Extensions', uploadSymbols: false });
  assert.match(manual, /<string>manual<\/string>/);
  assert.match(manual, /App &amp; Extensions/);
});
test('native CLI builds and exports without invoking npm or importing manual credentials', { skip: process.platform !== 'darwin' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'leas-native-cli-'));
  try {
    mkdirSync(path.join(dir, 'App.xcodeproj'));
    mkdirSync(path.join(dir, 'bin'));
    const calls = path.join(dir, 'calls.jsonl');
    writeFileSync(path.join(dir, 'bin', 'xcodebuild'), `#!${process.execPath}\nimport fs from 'node:fs';\nimport path from 'node:path';\nconst a=process.argv.slice(2); fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(a)+'\\n');\nif(a.includes('-exportArchive')) { const d=a[a.indexOf('-exportPath')+1];fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'App.ipa'),'fixture'); }\n`, { mode: 0o755 });
    writeFileSync(path.join(dir, 'bin', 'npx'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
    writeFileSync(path.join(dir, 'leas.json'), JSON.stringify({ build: { production: { ios: { projectPath: 'App.xcodeproj', scheme: 'App', signingStyle: 'automatic', teamId: 'TEAM', buildNumber: '5' } } } }));
    const result = spawnSync(process.execPath, [cli, 'build', '--platform', 'ios'], { cwd: dir, env: { ...process.env, PATH: path.join(dir, 'bin') + ':' + process.env.PATH }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const commands=readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(commands.length,2);
    assert.ok(commands[0].includes('-project'));
    assert.ok(commands[0].includes('CURRENT_PROJECT_VERSION=5'));
    assert.ok(commands[0].includes('CODE_SIGN_STYLE=Automatic'));
    assert.ok(commands[0].includes('-allowProvisioningUpdates'));
    assert.ok(commands[1].includes('-exportArchive'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('manual IPA export includes independent app and extension profiles', () => {
  const plist = exportOptionsPlist({ method: 'app-store-connect', teamId: 'TEAM', provisioningProfiles: { 'com.app': 'Main & Store', 'com.app.widget': 'Widget Store' }, uploadSymbols: true });
  assert.match(plist, /<key>com.app<\/key><string>Main &amp; Store<\/string>/);
  assert.match(plist, /<key>com.app.widget<\/key><string>Widget Store<\/string>/);
  assert.doesNotMatch(plist, /undefined/);
});
