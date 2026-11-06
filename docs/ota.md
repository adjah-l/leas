# Self-hosted OTA rollout

LEAS provides one shared OTA server with isolated projects and authenticated remote publishing. No LEAS
account or Pro subscription is required. Hosting, TLS, backups, and monitoring are
operator responsibilities. This is an initial self-hosted implementation, not a
managed replacement for every EAS Update feature.

## Deploy one shared instance

Build the versioned source checkout:

```sh
docker build -f Dockerfile.ota -t leas-ota .
docker volume create leas-ota-data
# Set LEAS_UPDATE_TOKEN to a long random secret in your host's secret manager.
export LEAS_PUBLIC_URL=https://updates.example.com
docker run -d --name leas-ota --restart unless-stopped \
  -p 127.0.0.1:4190:4190 -v leas-ota-data:/data \
  -e LEAS_UPDATE_TOKEN -e LEAS_PUBLIC_URL leas-ota
```

Place an HTTPS reverse proxy in front of port 4190. Forward request headers, allow
POST bodies up to 100 MiB and a 120-second request timeout, and disable caching for
`/api/manifest` and `/api/manage/*`. `/health` is a liveness endpoint. Persist and
back up `/data`; do not remove older assets while devices may use them.
Use one replica with a persistent volume. All apps share the server and TLS domain.
Each app uses `/projects/<project-id>` and independent storage at
`/data/projects/<project-id>/.leas/updates`. Keep the root operator token private.
For separate teams or CI scopes, set `LEAS_UPDATE_PROJECT_TOKENS_JSON` to a JSON
object mapping project IDs to distinct secrets; a configured project accepts its
own token instead of the root token. Unconfigured projects accept the root token. Never embed the operator token in app config or
`EXPO_PUBLIC_*`. Without a token configured, remote management is disabled.

For signed updates, mount the private key read-only at
`/data/credentials/updates/private-key.pem`. Generate keys with `leas update:keys`,
then create the X.509 certificate using its printed instructions. Include the public
certificate in the app, with `codeSigningMetadata` using `keyid: "main"` and
`alg: "rsa-v1_5-sha256"`. Test signing with the actual release client before rollout.

## Migrate each application

Install `expo-updates` using `npx expo install expo-updates`. From each supported repository:

```sh
npm install --save-dev leas-cli@1.1.0
npx leas update:configure --url https://updates.example.com --project my-app
```

Choose a unique, stable project ID (lowercase letters, digits and hyphens). This writes
`leas.json`'s `update.url` and the Expo manifest URL/channel, preserving the existing
runtime policy. The first authenticated publish creates its project storage. You do
not deploy another server. Dynamic Expo configs need the printed settings applied
manually. CLI URL precedence is `--url`, then `LEAS_UPDATE_URL`, then `leas.json`.

For manual configuration, merge these settings
into the existing Expo config, preserving unrelated settings:

```json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "url": "https://updates.example.com/projects/my-app/api/manifest",
      "requestHeaders": { "expo-channel-name": "production" }
    }
  }
}
```

Use a runtime policy compatible with the app's release process. Do not change an
existing policy blindly. Native changes require a new runtime and store build.
Fingerprint policy is not yet computed by LEAS. Keep EAS for apps relying on that
policy until runtime compatibility has been explicitly resolved.

Regenerate or update native projects so the URL, channel, runtime and optional
certificate reach the native binary. LEAS skips prebuild when native directories
already exist; a config edit alone is insufficient. Review native changes before
building. Ship and validate one new store binary per platform. Existing binaries
still contact Expo, so keep EAS Update available for those versions during migration.

## Publish from a repository or CI

Install this LEAS checkout/package version in the app first. Load the same public
build environment used for its store binary; LEAS does not fetch EAS environments.

```sh
export LEAS_UPDATE_URL=https://updates.example.com/projects/my-app
# Supply LEAS_UPDATE_TOKEN through local environment or CI secrets.
npx leas update --channel preview --platform all --message "Fix checkout"
npx leas update:promote --from preview --to production --platform ios --runtime 1.0.0
npx leas update:promote --from preview --to production --platform android --runtime 1.0.0
```

`--platform all` now exports iOS then Android separately, avoiding Expo's web export.
Each gets an independent channel/runtime/platform pointer. The two operations are
not transactional: if the second fails, inspect the first before retrying. A local
publish without `--url` or `LEAS_UPDATE_URL` does not deliver anything to a remote
server. Management commands use the same URL and token. `update:list` queries remote history when the URL is set, and local history otherwise.
Use `--json` for machine-readable history. Use explicit `--runtime` for management with dynamic app configs.

Test preview using a binary configured for the preview channel. Verify a visible JS
change on both platforms, restart behavior, incompatible-runtime rejection, signed
updates if enabled, and rollback before publishing production updates.

```sh
npx leas update:rollback --channel production --platform ios --runtime 1.0.0 --to UPDATE_UUID
npx leas update:rollback --channel production --platform android --runtime 1.0.0 --embedded
```

Restoring a previous release republishes its bytes under a new UUID and creation
time. Promotion likewise creates a new release. This lets the client select the
restored bundle instead of retaining a newer faulty update. Rollback is received
when the app next checks for updates; it is not an immediate push to devices.

## Current boundaries

Uploads use bounded JSON/base64 (100 MiB including encoding), so budget roughly
75 MiB of raw assets per platform and provision memory accordingly. There is no
resumable upload, object storage, automatic cleanup, project administration UI,
percentage rollout, remote environment service, or automatic Sentry sourcemap
upload. Export output is at `.leas/export` and is overwritten by each platform;
upload sourcemaps after each individual export if your app requires them.

Automated tests exercise HTTP publishing, authorization, protocol responses, platform
and runtime isolation, immutable assets, malformed uploads, promotion, and rollback.
Real Expo exports, device acceptance, signing configuration, Docker deployment and
store submissions still require validation in the target app/environment.

## Railway deployment

The repository includes `railway.json`. Set `RAILWAY_DOCKERFILE_PATH=Dockerfile.ota`
explicitly; this was needed for CLI deployments to select Docker instead of Railpack.
Attach one volume at `/data`, set `PORT=4190`, `LEAS_PUBLIC_URL` to the shared origin,
and `LEAS_UPDATE_TOKEN` as a secret. Optional signing secret:
`LEAS_UPDATE_PRIVATE_KEY_BASE64`. Deploy with `railway up --detach` and verify
`/health` before configuring any client. The container initializes volume ownership
and drops privileges to the Node user.

A shared process is an operational failure domain: all projects depend on its
uptime, disk and signing key. Separate deployments remain optional for regulatory,
team, scaling or availability needs, not a requirement for each repository.
