import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { updateDir, updatesRoot, safeJoin, setPointer, listUpdates, resolveChannel } from './update-store.js';
import { rollbackUpdate, promoteUpdate } from './update-publish.js';
import { LeasError } from './util.js';

const LIMIT = 100 * 1024 * 1024;

export async function remoteRequest(baseUrl, action, payload, token = process.env.LEAS_UPDATE_TOKEN) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new LeasError('Remote OTA requires HTTPS (except localhost).');
  if (!token) throw new LeasError('Set LEAS_UPDATE_TOKEN to publish or manage remote updates.');
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > LIMIT) throw new LeasError('Update exceeds the 100 MiB upload limit.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/manage/${action}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body,
  });
  if (!response.ok) throw new LeasError(`Remote OTA failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

export function packageUpdate(projectRoot, record) {
  const dir = updateDir(projectRoot, record.id);
  const metadata = JSON.parse(readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
  const names = new Set(['metadata.json', 'expoConfig.json']);
  for (const p of Object.values(metadata.fileMetadata)) {
    names.add(p.bundle);
    for (const asset of p.assets ?? []) names.add(asset.path);
  }
  return { record, files: Object.fromEntries([...names].map(name => [name, readFileSync(safeJoin(dir, name)).toString('base64')])) };
}

// Only the configured operator token grants writes; devices never receive it.
export async function manageUpdate(req, res, projectRoot, token, action) {
  const provided = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  const reply = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (!token || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return reply(401, { error: 'Unauthorized' });
  if (req.method !== 'POST') return reply(405, { error: 'Expected POST' });
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > LIMIT) { reply(413, { error: 'Upload exceeds 100 MiB' }); return; }
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let result;
    if (action === 'publish') result = installUpdate(projectRoot, payload);
    else if (action === 'list') {
      result = listUpdates(projectRoot, { channel: payload.channel, runtimeVersion: payload.runtimeVersion }).map(record => ({
        ...record, servingPlatforms: record.platforms.filter(platform => {
          const selected = resolveChannel(projectRoot, payload.channel ?? record.channel, record.runtimeVersion, platform);
          return selected.kind === 'update' && selected.update.id === record.id;
        }),
      }));
    }
    else if (action === 'rollback' || action === 'promote') {
      if (!['ios', 'android'].includes(payload.platform)) throw new LeasError('Specify ios or android.');
      const { channel, runtimeVersion, to, embedded, from, platform } = payload;
      result = (action === 'rollback' ? rollbackUpdate : promoteUpdate)({ projectRoot, channel, runtimeVersion, to, embedded, from, platform });
    } else return reply(404, { error: 'Unknown action' });
    reply(200, result);
  } catch (error) { reply(400, { error: error.message }); }
}

export function installUpdate(projectRoot, { record, files }) {
  const dir = updateDir(projectRoot, record?.id);
  if (!Array.isArray(record.platforms) || !record.platforms.length || record.platforms.some(p => !['ios', 'android'].includes(p))) throw new LeasError('Invalid platforms.');
  if (typeof record.runtimeVersion !== 'string' || !record.runtimeVersion || typeof record.channel !== 'string' || !record.channel || /[\\/\0]/.test(record.channel + record.runtimeVersion)) throw new LeasError('Invalid channel or runtime.');
  if (record.channel.length >= 256 || record.runtimeVersion.length >= 256 || record.channel === '..' || record.runtimeVersion === '..') throw new LeasError('Invalid channel or runtime.');
  if (!Number.isFinite(Date.parse(record.createdAt))) throw new LeasError('Invalid creation time.');
  if (existsSync(dir)) throw new LeasError('Update already exists; publish a new release.');
  const staging = path.join(updatesRoot(projectRoot), `.upload-${crypto.randomUUID()}`);
  mkdirSync(staging);
  try {
    for (const [name, data] of Object.entries(files)) {
      if (!name || name.includes('\\') || path.isAbsolute(name) || name.split('/').some(v => !v || v === '..' || v === '.') || name === 'update.json') throw new LeasError('Invalid upload path.');
      if (typeof data !== 'string' || Buffer.from(data, 'base64').toString('base64') !== data) throw new LeasError('Invalid file encoding.');
      const target = path.join(staging, name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(data, 'base64'));
    }
    const meta = JSON.parse(readFileSync(safeJoin(staging, 'metadata.json'), 'utf8'));
    JSON.parse(readFileSync(safeJoin(staging, 'expoConfig.json'), 'utf8'));
    if (JSON.stringify(Object.keys(meta.fileMetadata).sort()) !== JSON.stringify([...record.platforms].sort())) throw new LeasError('Platform metadata mismatch.');
    for (const p of Object.values(meta.fileMetadata)) {
      safeJoin(staging, p.bundle);
      for (const a of p.assets ?? []) safeJoin(staging, a.path);
    }
    const stored = { ...record, channels: [record.channel] };
    writeFileSync(path.join(staging, 'update.json'), JSON.stringify(stored));
    renameSync(staging, dir);
    for (const platform of record.platforms) setPointer(projectRoot, record.channel, record.runtimeVersion, { updateId: record.id }, platform);
    return stored;
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
