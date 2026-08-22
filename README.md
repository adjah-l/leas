# leas

Self-hosted EAS. Build and auto-submit Expo / React Native apps to the App Store and Google Play —
on your own machine or on your own cloud fleet, with one command and one config file.

```
leas build --platform all --profile production --auto-submit          # local
leas build --platform all --profile production --auto-submit --cloud  # rented Macs + Linux
```

## Where it lives

| | |
| --- | --- |
| Site &amp; docs | the commercial site — see `LEAS_CANONICAL_SITE` below |
| This app | https://leas-lawrence-adjahs-projects.vercel.app — dashboard |
| Repo | https://github.com/adjah-l/leas (private) |
| Vercel project | `leas` — root directory `site/`, production branch `main` |

Push to `main` and the site redeploys.

**The manual and the setup wizard now live on the commercial site.** Keeping a second copy here
would split search authority between two identical corpora, so setting **`LEAS_CANONICAL_SITE`**
on this Vercel project (to the marketing origin, no trailing slash) makes `/`, `/setup`, `/docs`,
and `/docs/*` permanently redirect there. Unset, nothing redirects and this app serves them as
before — so the switch is a single environment variable, flipped when the domain is live.

`/dashboard` stays here either way. It is the app surface, not a marketing page.

### Making the hosted dashboard show your real builds

The site ships with sample data so it is useful the moment it deploys. To replace it with your
own history:

1. Create a Blob store on the Vercel project (Storage → Create → Blob). Vercel sets
   `BLOB_READ_WRITE_TOKEN` for you.
2. Add an environment variable `LEAS_SYNC_TOKEN` — any long random string:
   `openssl rand -hex 24`
3. Redeploy, then push from your project:

```bash
export LEAS_SITE_URL=https://leas-lawrence-adjahs-projects.vercel.app
export LEAS_SYNC_TOKEN=the-same-string
leas sync
```

`leas sync` posts the same snapshot the local dashboard renders. Without those two variables the
site keeps serving sample data and says so on the page, rather than pretending to be live.

## Why this is buildable

Expo's EAS is, underneath, three things: a **build engine** (prebuild → xcodebuild / gradle → signed
artifact), a **credential store**, and a **machine fleet**. None of it is magic. The only piece you
cannot replicate for free is the fleet's Apple hardware, because Apple's macOS EULA forbids running
macOS on non-Apple machines — so cloud iOS builds are always *someone's* Mac.

`leas` treats local and cloud as the same engine on different hardware. `leas build --cloud` dispatches
a GitHub Actions run that executes `leas build --local` on `macos-15`. One code path, two machines.

| Expo service   | leas equivalent                          | Status |
| -------------- | ---------------------------------------- | ------ |
| EAS Build      | `leas build` (local + cloud)             | ✅ v1 |
| EAS Submit     | `leas submit` (ASC API + Play API v3)    | ✅ v1 |
| EAS Workflows  | GitHub Actions workflows in `.github/`   | ✅ v1 |
| EAS dashboard  | `leas dashboard` (local, live)           | ✅ v1 |
| (no equivalent)| `leas doctor` — preflight every credential | ✅ v1 |
| (no equivalent)| `leas creds` — expiry watch, scheduled | ✅ v1 |
| EAS Update     | `leas update` (self-hosted protocol v1)  | ✅ v1 |
| EAS Hosting    | Vercel / any host                        | n/a |

## Credential expiry

Distribution certificates last three years and provisioning profiles last one — long enough that
nobody remembers, short enough that everybody is eventually caught. `leas creds` reads the dates
back out of the files themselves, soonest first:

```bash
leas creds                 # what expires, and when
leas creds --days 60       # widen the warning window
leas creds --check         # exit non-zero if anything falls inside it
```

The scheduled version is the one that matters. `templates/leas-credentials.yml` runs weekly on a
Linux runner, reads the expiry dates out of the same repository secrets your builds already use,
and opens an issue thirty days before anything lapses — then closes it once you have renewed. The
setup wizard emits it for you.

**A credential record is metadata only** — a name, a date, and a public certificate fingerprint.
No key material and no password is ever read out or transmitted. That is what makes expiry
something a dashboard can hold without becoming a custodian of your signing identity, and it is
why `leas sync` can put these dates on a web page at all.

## The dashboard

```bash
leas dashboard            # http://localhost:4180
```

Every build writes a record to `.leas/builds/`, whether it ran locally or on the
fleet. The dashboard reads that directory and pushes updates over SSE as records change,
so a build appears the moment it starts and its status flips the moment it lands. Cloud
builds are reconciled against GitHub Actions every 15 seconds, so a run that finishes
while your laptop is asleep is still correct when you look.

It shows total builds and success rate, median build time, how many reached a store
track, what is in flight right now, a 14-day history split by outcome, and the
platform / channel breakdown — plus a filterable table of every build with its commit,
duration, and submission state.

```bash
node scripts/seed-demo.mjs   # fill it with sample history to see the shape
```

## Over-the-air updates

Ship a JavaScript fix to devices already in the field — no build, no submission, no review.

```bash
leas update --channel production --message "Fix checkout crash"
leas update:promote --from preview --to production   # ship what you tested, byte for byte
leas update:rollback --channel production --embedded # emergency stop
leas update:serve --url https://updates.example.com
```

This is a self-hosted implementation of the [Expo Updates protocol
v1](https://docs.expo.dev/technical-specs/expo-updates-1/), so the stock `expo-updates` client
talks to it unmodified — point `expo.updates.url` at your server and nothing else changes.
Manifests and directives are served as `multipart/mixed`, assets are content-hashed and verified
by the client, and `leas update:keys` enables RSA code signing so a device refuses any update you
did not sign.

**`runtimeVersion` is the safety mechanism.** An update only reaches binaries built against a
matching runtime version. Updates carry JS and assets only — a native change needs a new build,
and shipping JS that calls absent native code crashes the app for everyone who receives it.

## Setup

The fastest path is the wizard at [`/setup`](https://leas-lawrence-adjahs-projects.vercel.app/setup).
Answer a few questions and it generates `leas.json`, your workflows, and a script that loads your
signing material into your own repo's secrets. It runs entirely in the browser — it has no server
half, so your keys never leave your machine.

By hand:

```bash
npm install                  # inside your RN/Expo app, or npm link this repo
npx leas init                # writes leas.json (same shape as eas.json)
npx leas doctor              # check everything before the first build
```

## Preflight

```bash
leas doctor                      # everything, including live API checks
leas doctor --offline            # skip the calls to Apple and Google
leas doctor --json               # machine-readable, for CI
```

Signing failures are expensive because they surface forty minutes into a build. `doctor` finds them
in about two seconds, and exits non-zero so it works as a CI gate. It checks:

- **Identifiers** — that `app.json`, `leas.json`, and the provisioning profile all name the same app.
  Drift here is the single most common cause of a failed build.
- **Certificate and profile together** — that the profile has not expired, is not secretly an ad-hoc
  profile, and actually lists the distribution certificate you hold. A certificate the profile does
  not list cannot sign against it.
- **Expiry** — distribution certificates last three years, provisioning profiles one. `doctor` warns
  30 days out rather than on the morning you need to ship a hotfix.
- **The store APIs, for real** — it authenticates to App Store Connect and distinguishes a bad key
  (401) from a key with no role granted (403), and opens and immediately abandons a Play edit, which
  is the only way to prove the service account was actually granted release permission.
- **The fleet** — that the workflows exist and every secret they reference is set on the repo.

### Credentials

Every credential resolves from **either** a local file path in `leas.json` **or** a base64 env var,
so the identical build code runs on your laptop and on a CI worker.

| Purpose | File | Env var |
| --- | --- | --- |
| iOS distribution cert | `.p12` | `LEAS_IOS_DIST_CERT_BASE64` + `LEAS_IOS_DIST_CERT_PASSWORD` |
| iOS provisioning profile | `.mobileprovision` | `LEAS_IOS_PROVISIONING_PROFILE_BASE64` |
| App Store Connect API key | `AuthKey_XXX.p8` | `LEAS_ASC_API_KEY_BASE64` + `LEAS_ASC_KEY_ID` + `LEAS_ASC_ISSUER_ID` |
| Android upload keystore | `.keystore` | `LEAS_ANDROID_KEYSTORE_BASE64` + `_PASSWORD` + `_KEY_ALIAS` + `_KEY_PASSWORD` |
| Play publishing account | service account `.json` | `LEAS_PLAY_SERVICE_ACCOUNT_BASE64` |

Encode any of them with `base64 -i file | pbcopy`, then `gh secret set NAME`.

Getting the two API keys:
- **App Store Connect** → Users and Access → Integrations → App Store Connect API → generate a key
  with the *App Manager* role. You download the `.p8` exactly once.
- **Google Play** → Google Cloud console → create a service account → download its JSON key → then in
  Play Console → Users and permissions → invite that service account email and grant *Release apps*.

## How signing works

**iOS.** `leas` imports your `.p12` into a throwaway keychain (never your login keychain), installs the
provisioning profile where `xcodebuild` expects it, archives with `CODE_SIGN_STYLE=Manual`, generates an
`ExportOptions.plist` from the profile's real name and team, exports the `.ipa`, then deletes the keychain.

**Android.** The Expo template signs release builds with the *debug* keystore. Rather than patching
`build.gradle`, `leas` builds normally and then re-signs the artifact with your real upload key —
`jarsigner` for `.aab`, `apksigner` for `.apk`. Idempotent, and it leaves your gradle files alone.

## How submission works

**iOS** validates then uploads via `xcrun altool` with an App Store Connect API key, then optionally
polls the ASC API until `processingState` is `VALID`, so `--auto-submit` blocks until TestFlight is
actually ready rather than returning at upload.

**Android** drives the Play Developer API v3 edit lifecycle directly over HTTPS — `edits.insert` →
`bundles.upload` → `tracks.update` → `edits.commit` — with a service-account JWT. No Fastlane, no Ruby.
A failed run abandons its edit so you never accumulate dangling drafts.

## Running the fleet elsewhere

GitHub Actions is the default because it rents Apple hardware by the minute with zero commitment.
When per-minute cost or queue time stops working, swap the fleet without touching the engine:

| Fleet | Notes |
| --- | --- |
| GitHub Actions `macos-15` | no hardware, per-minute, free tier on public repos |
| AWS EC2 Mac (`mac2.metal`) | 24-hour minimum allocation — cheap only at steady volume |
| MacStadium / Orka | Kubernetes-style orchestration of real Mac hardware |
| Scaleway Mac mini M-series | hourly, cheapest dedicated option in the EU |
| A Mac mini on your desk | a self-hosted runner is genuinely viable at low volume |

The engine is `leas build --local`. The fleet is just what runs it.
