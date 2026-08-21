// Generates a realistic build history so the dashboard can be exercised.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
const dir = '.leas/builds';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rnd() * a.length)];

const commits = [
  ['a3f9c21', 'Fix push notification deep link on cold start'],
  ['7e21b0d', 'Bump expo-updates and re-run prebuild'],
  ['c04d8a6', 'Add offline cache for the schedule screen'],
  ['19bb7f4', 'Correct Android versionCode after failed submit'],
  ['5da0e93', 'Onboarding copy revision'],
  ['b81c447', 'Upgrade RN, resolve pod conflicts'],
  ['2fe6d10', 'Analytics events for checkout funnel'],
];
const profiles = ['production', 'production', 'production', 'preview', 'preview', 'development'];
const records = [];
const now = Date.now();

for (let day = 13; day >= 0; day--) {
  const weekend = [0, 6].includes(new Date(now - day * 864e5).getDay());
  const n = weekend ? Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const platform = rnd() > 0.45 ? 'ios' : 'android';
    const profile = pick(profiles);
    const runner = rnd() > 0.35 ? 'cloud' : 'local';
    const created = now - day * 864e5 - Math.floor(rnd() * 10 * 36e5);
    const failed = rnd() < 0.16;
    const canceled = !failed && rnd() < 0.04;
    const base = platform === 'ios' ? 9 * 6e4 : 5 * 6e4;
    const durationMs = Math.round(base + rnd() * base * 0.8);
    const [commit, message] = pick(commits);
    const submitted = !failed && !canceled && profile === 'production' && rnd() > 0.35;
    records.push({
      id: `bld_${new Date(created).toISOString().slice(0,10).replace(/-/g,'')}_${Math.floor(rnd()*1e6).toString(16).padStart(6,'0')}`,
      platform, profile, runner,
      status: failed ? 'failed' : canceled ? 'canceled' : 'succeeded',
      createdAt: new Date(created).toISOString(),
      startedAt: new Date(created + 4000).toISOString(),
      finishedAt: new Date(created + 4000 + durationMs).toISOString(),
      durationMs: failed ? Math.round(durationMs * 0.4) : durationMs,
      git: { branch: rnd() > 0.75 ? 'release/1.4' : 'main', commit, message, dirty: rnd() < 0.12 },
      app: { version: '1.4.' + (13 - day), buildNumber: String(120 + records.length) },
      artifact: failed || canceled ? null : {
        path: `.leas/build/${platform}/App.${platform === 'ios' ? 'ipa' : 'aab'}`,
        bytes: Math.round((platform === 'ios' ? 42 : 28) * 1e6 + rnd() * 8e6),
        kind: platform === 'ios' ? 'ipa' : 'aab',
      },
      submission: submitted
        ? { status: 'submitted', track: platform === 'ios' ? 'TestFlight' : 'internal',
            at: new Date(created + durationMs + 9e4).toISOString(), error: null }
        : { status: 'none', track: null, at: null, error: null },
      error: failed ? pick([
        'xcodebuild exited with code 65',
        'Provisioning profile doesn\'t include signing certificate',
        'gradlew exited with code 1',
      ]) : null,
      cloud: runner === 'cloud' ? { runId: 17000000 + records.length, url: 'https://github.com/acme/app/actions' } : null,
    });
  }
}

// two builds still in flight right now, so the live view has something to show
records.push({
  id: 'bld_live_ios01', platform: 'ios', profile: 'production', runner: 'cloud',
  status: 'running', createdAt: new Date(now - 254e3).toISOString(),
  startedAt: new Date(now - 250e3).toISOString(), finishedAt: null, durationMs: null,
  git: { branch: 'main', commit: 'a3f9c21', message: 'Fix push notification deep link on cold start', dirty: false },
  app: { version: '1.4.14', buildNumber: '164' }, artifact: null,
  submission: { status: 'none', track: null, at: null, error: null }, error: null,
  cloud: { runId: 17009001, url: 'https://github.com/acme/app/actions' },
});
records.push({
  id: 'bld_live_and01', platform: 'android', profile: 'production', runner: 'cloud',
  status: 'queued', createdAt: new Date(now - 41e3).toISOString(),
  startedAt: null, finishedAt: null, durationMs: null,
  git: { branch: 'main', commit: 'a3f9c21', message: 'Fix push notification deep link on cold start', dirty: false },
  app: { version: '1.4.14', buildNumber: '165' }, artifact: null,
  submission: { status: 'none', track: null, at: null, error: null }, error: null,
  cloud: { runId: 17009002, url: 'https://github.com/acme/app/actions' },
});

for (const r of records) writeFileSync(`${dir}/${r.id}.json`, JSON.stringify(r, null, 2) + '\n');
console.log(`seeded ${records.length} build records`);
