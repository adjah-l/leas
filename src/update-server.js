import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { log, LeasError } from './util.js';
import {
  updateDir, resolveChannel, assetMetadata, safeJoin, mimeFor,
} from './update-store.js';

/**
 * Expo Updates protocol v1 server.
 *
 * GET /api/manifest   the update a device should run, or a directive
 * GET /api/assets     the bundle and assets that manifest points at
 *
 * The device sends its platform, runtimeVersion, channel and the update id it
 * is already running; the server answers with a newer manifest, a
 * noUpdateAvailable directive, or a rollBackToEmbedded directive.
 */
export async function startUpdateServer({ projectRoot, port = 4190, baseUrl, privateKeyPath }) {
  const url = baseUrl ?? `http://localhost:${port}`;
  const privateKey = privateKeyPath && existsSync(privateKeyPath)
    ? readFileSync(privateKeyPath, 'utf8') : null;

  const server = http.createServer(async (req, res) => {
    try {
      const target = new URL(req.url, url);
      if (target.pathname === '/api/manifest') return manifest({ req, res, projectRoot, baseUrl: url, privateKey });
      if (target.pathname === '/api/assets') return assets({ req, res, projectRoot, target });
      if (target.pathname === '/health') return json(res, 200, { ok: true, baseUrl: url });
      json(res, 404, { error: 'Not found' });
    } catch (e) {
      log.err(e.message);
      json(res, e instanceof LeasError ? 404 : 500, { error: e.message });
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  log.ok(`Update server listening on ${url}`);
  log.dim(`manifest: ${url}/api/manifest`);
  if (privateKey) log.dim('code signing enabled');
  else log.warn('no signing key — run `leas update:keys` to enable code signing');
  if (url.includes('localhost')) {
    log.warn('localhost is not reachable from a phone. Expose it (e.g. a tunnel) and pass --url.');
  }
  return { server, url };
}

/* ---------- manifest endpoint ---------- */

async function manifest({ req, res, projectRoot, baseUrl, privateKey }) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Expected GET.' });

  const h = req.headers;
  const protocolVersion = parseInt(str(h['expo-protocol-version']) ?? '0', 10);
  const platform = str(h['expo-platform']);
  const runtimeVersion = str(h['expo-runtime-version']);
  const channel = str(h['expo-channel-name']) ?? 'production';

  if (platform !== 'ios' && platform !== 'android') {
    return json(res, 400, { error: 'Unsupported platform. Expected ios or android.' });
  }
  if (!runtimeVersion) return json(res, 400, { error: 'No expo-runtime-version provided.' });

  const resolved = resolveChannel(projectRoot, channel, runtimeVersion);
  if (resolved.kind === 'none') {
    return json(res, 404, {
      error: `No update published to channel "${channel}" for runtime version ${runtimeVersion}.`,
    });
  }

  const signWith = str(h['expo-expect-signature']) ? privateKey : null;
  if (str(h['expo-expect-signature']) && !privateKey) {
    return json(res, 400, { error: 'Code signing requested but this server has no key.' });
  }

  if (resolved.kind === 'rollback') {
    if (protocolVersion === 0) return json(res, 400, { error: 'Rollbacks need protocol version 1.' });
    // A device already on the embedded update has nothing to roll back to.
    const embedded = str(h['expo-embedded-update-id']);
    if (embedded && str(h['expo-current-update-id']) === embedded) {
      return directive(res, { type: 'noUpdateAvailable' }, protocolVersion, signWith);
    }
    return directive(res, {
      type: 'rollBackToEmbedded',
      parameters: { commitTime: resolved.commitTime },
    }, protocolVersion, signWith);
  }

  const record = resolved.update;
  const dir = updateDir(projectRoot, record.id);
  const meta = JSON.parse(readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
  const perPlatform = meta.fileMetadata?.[platform];
  if (!perPlatform) {
    return json(res, 404, { error: `Update ${record.id} has no ${platform} bundle.` });
  }

  // Protocol v1 lets us tell an already-current device to do nothing.
  if (protocolVersion === 1 && str(h['expo-current-update-id']) === record.id) {
    return directive(res, { type: 'noUpdateAvailable' }, protocolVersion, signWith);
  }

  const body = {
    id: record.id,
    createdAt: record.createdAt,
    runtimeVersion,
    launchAsset: assetMetadata({
      dir, filePath: perPlatform.bundle, ext: null,
      isLaunchAsset: true, baseUrl, updateId: record.id,
    }),
    assets: (perPlatform.assets ?? []).map((a) => assetMetadata({
      dir, filePath: a.path, ext: a.ext,
      isLaunchAsset: false, baseUrl, updateId: record.id,
    })),
    metadata: {},
    extra: {
      expoClient: readExpoConfig(dir),
      channel,
      // leas-specific, ignored by the client but handy when debugging a device
      leas: { message: record.message ?? null, commit: record.git?.commit ?? null },
    },
  };

  const parts = [part('manifest', body, signWith)];
  const assetRequestHeaders = {};
  for (const asset of [...body.assets, body.launchAsset]) assetRequestHeaders[asset.key] = {};
  parts.push(part('extensions', { assetRequestHeaders }, null));
  multipart(res, parts, protocolVersion);
}

function readExpoConfig(dir) {
  const file = path.join(dir, 'expoConfig.json');
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
}

/* ---------- asset endpoint ---------- */

function assets({ req, res, projectRoot, target }) {
  const updateId = target.searchParams.get('updateId');
  const asset = target.searchParams.get('asset');
  if (!updateId || !asset) return json(res, 400, { error: 'updateId and asset are required.' });

  const dir = updateDir(projectRoot, updateId);
  if (!existsSync(dir)) return json(res, 404, { error: `No update ${updateId}.` });

  const file = safeJoin(dir, asset);           // throws on traversal
  const meta = JSON.parse(readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
  const platforms = Object.values(meta.fileMetadata ?? {});
  const isBundle = platforms.some((p) => p.bundle === asset);
  // Exported assets are named by content hash with no file extension, so the
  // real type lives in metadata.json — never in the filename.
  const ext = platforms.flatMap((p) => p.assets ?? []).find((a) => a.path === asset)?.ext
    ?? path.extname(file);

  res.writeHead(200, {
    'Content-Type': isBundle ? 'application/javascript' : mimeFor(ext),
    'Content-Length': statSync(file).size,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.end(readFileSync(file));
}

/* ---------- protocol plumbing ---------- */

const str = (v) => (Array.isArray(v) ? undefined : v);

/** Structured-field dictionary, e.g. sig="...", keyid="main" */
function sfvDictionary(entries) {
  return Object.entries(entries)
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(', ');
}

function signRSASHA256(data, privateKey) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

function part(name, payload, privateKey) {
  const bodyText = JSON.stringify(payload);
  const headers = {
    'content-disposition': `form-data; name="${name}"`,
    'content-type': 'application/json; charset=utf-8',
  };
  if (privateKey) {
    headers['expo-signature'] = sfvDictionary({
      sig: signRSASHA256(bodyText, privateKey), keyid: 'main',
    });
  }
  return { headers, bodyText };
}

function multipart(res, parts, protocolVersion) {
  const boundary = `leas${crypto.randomBytes(16).toString('hex')}`;
  const chunks = [];
  for (const p of parts) {
    chunks.push(`--${boundary}\r\n`);
    for (const [k, v] of Object.entries(p.headers)) chunks.push(`${k}: ${v}\r\n`);
    chunks.push('\r\n', p.bodyText, '\r\n');
  }
  chunks.push(`--${boundary}--\r\n`);
  const body = Buffer.from(chunks.join(''), 'utf8');

  res.writeHead(200, {
    'expo-protocol-version': String(protocolVersion),
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
    'content-type': `multipart/mixed; boundary=${boundary}`,
    'content-length': body.length,
  });
  res.end(body);
}

function directive(res, body, protocolVersion, privateKey) {
  if (protocolVersion === 0) {
    return json(res, 400, { error: 'Directives require protocol version 1.' });
  }
  multipart(res, [part('directive', body, privateKey)], 1);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}
