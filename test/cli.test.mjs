import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const cli = new URL('../src/cli.js', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('--version and -v print the package version', () => {
  for (const flag of ['--version', '-v']) {
    const out = execFileSync(process.execPath, [cli, flag], { encoding: 'utf8' });
    assert.equal(out.trim(), pkg.version);
  }
});

function androidProject() {
  const dir = mkdtempSync(path.join(tmpdir(), 'leas-test-'));
  writeFileSync(path.join(dir, 'app.json'), JSON.stringify({
    expo: { name: 'demo', slug: 'demo', version: '1.0.0', android: { package: 'com.demo.app' } },
  }));
  writeFileSync(path.join(dir, 'leas.json'), JSON.stringify({
    build: { production: { android: { buildType: 'app-bundle' } } },
    submit: { production: { android: { packageName: 'com.demo.app', track: 'internal' } } },
  }));
  return dir;
}

function playCheck(dir, env) {
  const res = spawnSync(process.execPath, [cli, 'doctor', '--platform', 'android', '--offline', '--json'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  const report = JSON.parse(res.stdout);
  return report.checks.find((c) => c.name === 'Play service account');
}

test('doctor reads a valid Play service account instead of throwing', () => {
  const dir = androidProject();
  try {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = {
      type: 'service_account',
      client_email: 'ci@demo.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
    const check = playCheck(dir, {
      LEAS_PLAY_SERVICE_ACCOUNT_BASE64: Buffer.from(JSON.stringify(sa)).toString('base64'),
    });
    assert.ok(check, 'Play service account check is reported');
    assert.doesNotMatch(String(check.detail), /resolve is not defined/);
    assert.equal(check.status, 'ok', `expected ok, got ${check.status}: ${check.detail}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor explains a missing Play service account', () => {
  const dir = androidProject();
  try {
    const check = playCheck(dir, { LEAS_PLAY_SERVICE_ACCOUNT_BASE64: '' });
    assert.equal(check.status, 'fail');
    assert.doesNotMatch(String(check.detail), /resolve is not defined/);
    assert.match(String(check.detail), /play-service-account\.json|LEAS_PLAY_SERVICE_ACCOUNT_BASE64/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
