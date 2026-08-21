import { readFileSync, statSync, createReadStream } from 'node:fs';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { log, LeasError } from './util.js';
import { materialize } from './credentials.js';

const PLAY = 'https://androidpublisher.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export async function submitAndroid({ artifactPath, profile }) {
  const keyPath = materialize({
    filePath: profile.serviceAccountKeyPath,
    base64Env: 'LEAS_PLAY_SERVICE_ACCOUNT_BASE64',
    name: 'play-service-account.json',
  });
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  const packageName = profile.packageName;
  if (!packageName) throw new LeasError('submit.<profile>.android.packageName is required.');
  const track = profile.track ?? 'internal';
  const isBundle = artifactPath.endsWith('.aab');

  log.step('Authenticating with Google Play');
  const token = await googleAccessToken(sa);

  const edit = await play(token, 'POST', `/androidpublisher/v3/applications/${packageName}/edits`);
  log.dim(`edit id ${edit.id}`);

  try {
    log.step(`Uploading ${isBundle ? 'bundle' : 'apk'} (${(statSync(artifactPath).size / 1e6).toFixed(1)} MB)`);
    const uploaded = await uploadArtifact({ token, packageName, editId: edit.id, artifactPath, isBundle });
    const versionCode = uploaded.versionCode;
    log.ok(`Uploaded versionCode ${versionCode}`);

    log.step(`Assigning to track "${track}"`);
    const release = {
      versionCodes: [String(versionCode)],
      status: profile.releaseStatus ?? (profile.rollout ? 'inProgress' : 'completed'),
    };
    if (profile.rollout) release.userFraction = Number(profile.rollout);
    if (profile.releaseName) release.name = profile.releaseName;
    if (profile.releaseNotes) {
      release.releaseNotes = Object.entries(profile.releaseNotes)
        .map(([language, text]) => ({ language, text }));
    }
    await play(token, 'PUT',
      `/androidpublisher/v3/applications/${packageName}/edits/${edit.id}/tracks/${track}`,
      { track, releases: [release] });

    if (profile.changesNotSentForReview !== undefined) {
      await play(token, 'POST',
        `/androidpublisher/v3/applications/${packageName}/edits/${edit.id}:commit?changesNotSentForReview=${profile.changesNotSentForReview}`);
    } else {
      await play(token, 'POST', `/androidpublisher/v3/applications/${packageName}/edits/${edit.id}:commit`);
    }
    log.ok(`Released to ${track}.`);
    return { versionCode, track };
  } catch (e) {
    // Abandon the edit so a failed run doesn't leave a dangling draft.
    await play(token, 'DELETE', `/androidpublisher/v3/applications/${packageName}/edits/${edit.id}`)
      .catch(() => {});
    throw e;
  }
}

async function uploadArtifact({ token, packageName, editId, artifactPath, isBundle }) {
  const kind = isBundle ? 'bundles' : 'apks';
  const url = `${PLAY}/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/${kind}?uploadType=media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': isBundle ? 'application/octet-stream' : 'application/vnd.android.package-archive',
      'Content-Length': String(statSync(artifactPath).size),
    },
    body: Readable.toWeb(createReadStream(artifactPath)),
    duplex: 'half',
  });
  if (!res.ok) throw new LeasError(`Play upload ${res.status}: ${await res.text()}`);
  return res.json();
}

async function play(token, method, endpoint, body) {
  const res = await fetch(`${PLAY}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new LeasError(`Play API ${method} ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? {} : res.json().catch(() => ({}));
}

/** Service-account JWT grant (RS256) exchanged for an OAuth2 access token. */
export async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = [
    b64({ alg: 'RS256', typ: 'JWT' }),
    b64({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 }),
  ].join('.');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key).toString('base64url');

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${sig}`,
    }),
  });
  if (!res.ok) throw new LeasError(`Google token exchange ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}
