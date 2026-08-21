/**
 * Pure generators for the setup wizard.
 *
 * Everything here runs in the browser and returns strings. No answer the user
 * types ever leaves the page — that is the whole point of the product, so the
 * generation deliberately has no server half to drift away from.
 */

export type Platform = 'ios' | 'android';

export type Answers = {
  appName: string;
  bundleId: string;
  packageName: string;
  platforms: Platform[];
  cloud: boolean;
  repo: string;
  autoSubmit: boolean;
  nodeVersion: string;
  // Apple
  ascAppId: string;
  ascKeyId: string;
  ascIssuerId: string;
  certPath: string;
  profilePath: string;
  // Google
  keystorePath: string;
  keyAlias: string;
  serviceAccountPath: string;
  track: string;
  // Dashboard
  syncUrl: string;
};

export const DEFAULT_ANSWERS: Answers = {
  appName: '',
  bundleId: '',
  packageName: '',
  platforms: ['ios', 'android'],
  cloud: true,
  repo: '',
  autoSubmit: true,
  nodeVersion: '22',
  ascAppId: '',
  ascKeyId: '',
  ascIssuerId: '',
  certPath: 'credentials/ios/dist.p12',
  profilePath: 'credentials/ios/profile.mobileprovision',
  keystorePath: 'credentials/android/upload.keystore',
  keyAlias: 'upload',
  serviceAccountPath: 'credentials/android/play-service-account.json',
  track: 'internal',
  syncUrl: '',
};

export const has = (a: Answers, p: Platform) => a.platforms.includes(p);

/** Unanswered fields become loud placeholders rather than silently-wrong values. */
const or = (v: string, fallback: string) => (v.trim() ? v.trim() : fallback);

export const ascKeyPath = (a: Answers) =>
  `credentials/ios/AuthKey_${or(a.ascKeyId, 'XXXXXXXXXX')}.p8`;

/* ------------------------------- validation ------------------------------- */

export type Field = keyof Answers;

const RULES: Partial<Record<Field, { test: (v: string) => boolean; msg: string }>> = {
  bundleId: {
    test: (v) => /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v),
    msg: 'Reverse-DNS, e.g. com.yourcompany.app',
  },
  packageName: {
    test: (v) => /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(v),
    msg: 'Lowercase reverse-DNS, e.g. com.yourcompany.app',
  },
  ascAppId: { test: (v) => /^\d{6,}$/.test(v), msg: 'The numeric Apple ID from App Information' },
  ascKeyId: { test: (v) => /^[A-Z0-9]{10}$/.test(v), msg: '10 characters, e.g. ABCD1234EF' },
  ascIssuerId: {
    test: (v) => /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v),
    msg: 'A UUID shown above the key list',
  },
  repo: { test: (v) => /^[\w.-]+\/[\w.-]+$/.test(v), msg: 'owner/repo' },
  syncUrl: { test: (v) => /^https?:\/\/[^\s]+$/.test(v), msg: 'A full https:// URL' },
};

/** Which fields this configuration actually needs answered. */
export function required(a: Answers): Field[] {
  const f: Field[] = ['appName'];
  if (has(a, 'ios')) f.push('bundleId');
  if (has(a, 'android')) f.push('packageName');
  if (has(a, 'ios') && a.autoSubmit) f.push('ascAppId', 'ascKeyId', 'ascIssuerId');
  if (a.cloud) f.push('repo');
  return f;
}

/** Errors for filled-in-but-malformed values. Empty values are "incomplete", not "invalid". */
export function errors(a: Answers): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  for (const [field, rule] of Object.entries(RULES) as [Field, (typeof RULES)[Field]][]) {
    const value = String(a[field] ?? '').trim();
    if (value && rule && !rule.test(value)) out[field] = rule.msg;
  }
  return out;
}

export function missing(a: Answers): Field[] {
  return required(a).filter((f) => !String(a[f] ?? '').trim());
}

/* -------------------------------- leas.json -------------------------------- */

export function leasJson(a: Answers): string {
  const ios = has(a, 'ios');
  const android = has(a, 'android');

  const dev: Record<string, unknown> = { developmentClient: true };
  if (ios) dev.ios = { exportMethod: 'development', configuration: 'Debug' };
  if (android) dev.android = { buildType: 'apk' };

  const preview: Record<string, unknown> = { extends: 'production' };
  if (ios) preview.ios = { exportMethod: 'ad-hoc' };
  if (android) preview.android = { buildType: 'apk' };

  const production: Record<string, unknown> = {};
  if (ios) {
    production.ios = {
      configuration: 'Release',
      exportMethod: 'app-store',
      distributionCertificatePath: a.certPath,
      provisioningProfilePath: a.profilePath,
    };
  }
  if (android) {
    production.android = {
      buildType: 'app-bundle',
      keystorePath: a.keystorePath,
      keyAlias: or(a.keyAlias, 'upload'),
    };
  }

  const submit: Record<string, unknown> = {};
  if (ios) {
    submit.ios = {
      ascAppId: or(a.ascAppId, 'REPLACE_WITH_ASC_APP_ID'),
      ascApiKeyId: or(a.ascKeyId, 'REPLACE_WITH_KEY_ID'),
      ascApiIssuerId: or(a.ascIssuerId, 'REPLACE_WITH_ISSUER_ID'),
      ascApiKeyPath: ascKeyPath(a),
      waitForProcessing: true,
    };
  }
  if (android) {
    submit.android = {
      packageName: or(a.packageName, 'REPLACE_WITH_PACKAGE_NAME'),
      serviceAccountKeyPath: a.serviceAccountPath,
      track: a.track,
      releaseNotes: { 'en-US': 'Bug fixes and improvements.' },
    };
  }

  return JSON.stringify(
    {
      cli: { version: '>=0.1.0' },
      build: { development: dev, preview, production },
      submit: { production: submit },
    },
    null,
    2,
  ) + '\n';
}

/* -------------------------------- workflows -------------------------------- */

export function iosWorkflow(a: Answers): string {
  const submitStep = a.autoSubmit
    ? `
      - name: Submit to App Store Connect
        if: inputs.submit == 'true'
        env:
          LEAS_ASC_API_KEY_BASE64: \${{ secrets.LEAS_ASC_API_KEY_BASE64 }}
          LEAS_ASC_KEY_ID: \${{ secrets.LEAS_ASC_KEY_ID }}
          LEAS_ASC_ISSUER_ID: \${{ secrets.LEAS_ASC_ISSUER_ID }}
        run: npx leas submit --platform ios --profile "\${{ inputs.profile }}"
`
    : '';

  return `name: leas-ios

# Generated by the leas setup wizard for ${or(a.appName, 'your app')}.
# \`leas build --cloud\` dispatches this; the job body is the same engine you
# run locally, so the two cannot drift apart.

on:
  workflow_dispatch:
    inputs:
      profile:
        description: Build profile from leas.json
        type: string
        default: production
      submit:
        description: Auto-submit after a successful build
        type: string
        default: '${a.autoSubmit}'

jobs:
  build:
    # The one job that cannot run on Linux: Apple's EULA requires Apple hardware.
    runs-on: macos-15
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${a.nodeVersion}, cache: npm }
      - uses: maxim-lobanov/setup-xcode@v1
        with: { xcode-version: latest-stable }

      - run: npm ci

      - name: Build and sign
        env:
          LEAS_IOS_DIST_CERT_BASE64: \${{ secrets.LEAS_IOS_DIST_CERT_BASE64 }}
          LEAS_IOS_DIST_CERT_PASSWORD: \${{ secrets.LEAS_IOS_DIST_CERT_PASSWORD }}
          LEAS_IOS_PROVISIONING_PROFILE_BASE64: \${{ secrets.LEAS_IOS_PROVISIONING_PROFILE_BASE64 }}
        run: npx leas build --platform ios --profile "\${{ inputs.profile }}" --local
${submitStep}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ios-\${{ inputs.profile }}
          path: .leas/build/ios/export/*.ipa
          if-no-files-found: warn
`;
}

export function androidWorkflow(a: Answers): string {
  const submitStep = a.autoSubmit
    ? `
      - name: Submit to Google Play
        if: inputs.submit == 'true'
        env:
          LEAS_PLAY_SERVICE_ACCOUNT_BASE64: \${{ secrets.LEAS_PLAY_SERVICE_ACCOUNT_BASE64 }}
        run: npx leas submit --platform android --profile "\${{ inputs.profile }}"
`
    : '';

  return `name: leas-android

# Generated by the leas setup wizard for ${or(a.appName, 'your app')}.

on:
  workflow_dispatch:
    inputs:
      profile:
        description: Build profile from leas.json
        type: string
        default: production
      submit:
        description: Auto-submit after a successful build
        type: string
        default: '${a.autoSubmit}'

jobs:
  build:
    # Android needs nothing but Linux + JDK + SDK, so it runs on cheap runners.
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${a.nodeVersion}, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: android-actions/setup-android@v3
      - uses: gradle/actions/setup-gradle@v4

      - run: npm ci

      - name: Build and sign
        env:
          LEAS_ANDROID_KEYSTORE_BASE64: \${{ secrets.LEAS_ANDROID_KEYSTORE_BASE64 }}
          LEAS_ANDROID_KEYSTORE_PASSWORD: \${{ secrets.LEAS_ANDROID_KEYSTORE_PASSWORD }}
          LEAS_ANDROID_KEY_ALIAS: \${{ secrets.LEAS_ANDROID_KEY_ALIAS }}
          LEAS_ANDROID_KEY_PASSWORD: \${{ secrets.LEAS_ANDROID_KEY_PASSWORD }}
        run: npx leas build --platform android --profile "\${{ inputs.profile }}" --local
${submitStep}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: android-\${{ inputs.profile }}
          path: |
            .leas/build/android/*.aab
            .leas/build/android/*.apk
          if-no-files-found: warn
`;
}

/* ------------------------------ secrets script ----------------------------- */

export function secretsScript(a: Answers): string {
  const lines: string[] = [];
  const repo = or(a.repo, 'OWNER/REPO');

  if (has(a, 'ios')) {
    lines.push('', '# ---- Apple ----');
    lines.push(`from_file LEAS_IOS_DIST_CERT_BASE64 "${a.certPath}"`);
    lines.push('from_prompt LEAS_IOS_DIST_CERT_PASSWORD "Password you set when exporting the .p12"');
    lines.push(`from_file LEAS_IOS_PROVISIONING_PROFILE_BASE64 "${a.profilePath}"`);
    if (a.autoSubmit) {
      lines.push(`from_file LEAS_ASC_API_KEY_BASE64 "${ascKeyPath(a)}"`);
      lines.push(`from_value LEAS_ASC_KEY_ID "${or(a.ascKeyId, 'REPLACE_WITH_KEY_ID')}"`);
      lines.push(`from_value LEAS_ASC_ISSUER_ID "${or(a.ascIssuerId, 'REPLACE_WITH_ISSUER_ID')}"`);
    }
  }

  if (has(a, 'android')) {
    lines.push('', '# ---- Google ----');
    lines.push(`from_file LEAS_ANDROID_KEYSTORE_BASE64 "${a.keystorePath}"`);
    lines.push('from_prompt LEAS_ANDROID_KEYSTORE_PASSWORD "Keystore password"');
    lines.push(`from_value LEAS_ANDROID_KEY_ALIAS "${or(a.keyAlias, 'upload')}"`);
    lines.push('from_prompt LEAS_ANDROID_KEY_PASSWORD "Key password (often the same as the keystore password)"');
    if (a.autoSubmit) {
      lines.push(`from_file LEAS_PLAY_SERVICE_ACCOUNT_BASE64 "${a.serviceAccountPath}"`);
    }
  }

  return `#!/usr/bin/env bash
#
# leas-secrets.sh — pushes your signing material into GitHub Actions secrets.
#
# Run this from your project root. It talks to GitHub directly using your own
# \`gh\` login. Nothing is sent to leas, and no key file leaves this machine
# except as an encrypted GitHub secret.
#
#   chmod +x leas-secrets.sh && ./leas-secrets.sh
#
set -euo pipefail

REPO="${repo}"

command -v gh >/dev/null || { echo "gh CLI not found: https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run 'gh auth login' first." >&2; exit 1; }

from_file() {   # $1 = secret name, $2 = path to credential
  [ -f "$2" ] || { echo "missing file: $2" >&2; exit 1; }
  base64 < "$2" | tr -d '\\n' | gh secret set "$1" --repo "$REPO"
  echo "  set $1  <- $2"
}
from_value() {  # $1 = secret name, $2 = literal value
  printf '%s' "$2" | gh secret set "$1" --repo "$REPO"
  echo "  set $1"
}
from_prompt() { # $1 = secret name, $2 = prompt text
  read -rsp "$2: " value; echo
  printf '%s' "$value" | gh secret set "$1" --repo "$REPO"
  echo "  set $1"
}

echo "Setting secrets on $REPO"
${lines.join('\n')}

echo
echo "Done. Verify with: gh secret list --repo $REPO"
`;
}

/* --------------------------------- misc ---------------------------------- */

export function gitignoreSnippet(): string {
  return `# leas
.leas/

# Signing material — never commit these.
credentials/
`;
}

export function keytoolCommand(a: Answers): string {
  return `mkdir -p ${a.keystorePath.split('/').slice(0, -1).join('/') || '.'}
keytool -genkeypair -v \\
  -keystore ${a.keystorePath} \\
  -alias ${or(a.keyAlias, 'upload')} \\
  -keyalg RSA -keysize 2048 -validity 10000`;
}

export function p12Command(a: Answers): string {
  return `# After downloading the Apple Distribution certificate, double-click it to
# install, then in Keychain Access right-click it and Export as .p12 to:
#   ${a.certPath}`;
}

export function syncSnippet(a: Answers): string {
  return `# Point the CLI at your hosted dashboard, then push a snapshot.
export LEAS_SITE_URL=${or(a.syncUrl, 'https://your-leas-site.vercel.app')}
export LEAS_SYNC_TOKEN=$(openssl rand -hex 24)   # set the same value on the site

leas sync`;
}

export function nextSteps(a: Answers): string {
  const platform = a.platforms.length === 2 ? 'all' : a.platforms[0] ?? 'all';
  const lines = [
    // doctor first: it finds in seconds what a build finds forty minutes in.
    `npx leas doctor --platform ${platform}`,
    `npx leas build --platform ${platform} --profile preview`,
  ];
  lines.push(
    `npx leas build --platform ${platform} --profile production${a.autoSubmit ? ' --auto-submit' : ''}`,
  );
  if (a.cloud) {
    lines.push(
      `npx leas build --platform ${platform} --profile production${a.autoSubmit ? ' --auto-submit' : ''} --cloud`,
    );
  }
  lines.push('npx leas dashboard');
  return lines.join('\n');
}

/* ------------------------------ output bundle ------------------------------ */

export type GeneratedFile = { name: string; body: string; note: string };

export function files(a: Answers): GeneratedFile[] {
  const out: GeneratedFile[] = [
    { name: 'leas.json', body: leasJson(a), note: 'Project root. Replaces eas.json.' },
  ];
  if (a.cloud && has(a, 'ios')) {
    out.push({
      name: '.github/workflows/leas-ios.yml',
      body: iosWorkflow(a),
      note: 'Rented Apple hardware, dispatched by --cloud.',
    });
  }
  if (a.cloud && has(a, 'android')) {
    out.push({
      name: '.github/workflows/leas-android.yml',
      body: androidWorkflow(a),
      note: 'Ubuntu runner — cheap, no Apple constraint.',
    });
  }
  if (a.cloud) {
    out.push({
      name: 'leas-secrets.sh',
      body: secretsScript(a),
      note: 'Run once. Uploads to GitHub via your own gh login.',
    });
  }
  out.push({
    name: '.gitignore',
    body: gitignoreSnippet(),
    note: 'Append to the file you already have.',
  });
  return out;
}
