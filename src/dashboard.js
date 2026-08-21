import http from 'node:http';
import { watch, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listBuilds, summarize, buildsDir, updateBuild } from './store.js';
import { listUpdates, updatesRoot, readPointer, channelsOf } from './update-store.js';
import { capture, log } from './util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * A local dashboard rather than a hosted one, because everything leas knows
 * already lives on this machine. fs.watch on the build directory is the
 * real-time source; clients get told to refetch over SSE.
 */
export async function startDashboard({ projectRoot, port = 4180, open = true }) {
  const clients = new Set();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      if (url.pathname === '/') return sendHtml(res, projectRoot);
      if (url.pathname === '/api/builds') return sendJson(res, snapshot(projectRoot));
      if (url.pathname === '/api/stream') return openStream(req, res, clients);
      res.writeHead(404).end('Not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  const broadcast = debounce(() => {
    for (const client of clients) client.write('event: builds\ndata: {}\n\n');
  }, 120);

  watch(buildsDir(projectRoot), broadcast);
  watch(updatesRoot(projectRoot), { recursive: true }, broadcast);

  // Cloud builds finish on someone else's machine, so poll GitHub for the ones
  // still in flight and fold their result back into the local record.
  const poll = setInterval(() => reconcileCloud(projectRoot).then(broadcast).catch(() => {}), 15_000);
  server.on('close', () => clearInterval(poll));

  await new Promise((resolve) => server.listen(port, resolve));
  const address = `http://localhost:${port}`;
  log.ok(`Dashboard running at ${address}`);
  log.dim('watching .leas/builds — updates appear live');
  if (open) await capture('open', [address]).catch(() => {});
  return { server, address };
}

export function snapshot(projectRoot) {
  const builds = listBuilds(projectRoot);
  const updates = listUpdates(projectRoot).map((u) => ({
    ...u,
    channels: channelsOf(u),
    live: channelsOf(u).some((c) => readPointer(projectRoot, c, u.runtimeVersion)?.updateId === u.id),
  }));
  return {
    project: path.basename(projectRoot),
    generatedAt: new Date().toISOString(),
    stats: summarize(builds),
    builds,
    updates,
  };
}

function sendJson(res, body) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendHtml(res, projectRoot) {
  const file = path.join(HERE, 'dashboard-ui.html');
  const html = readFileSync(file, 'utf8')
    .replace('__PROJECT__', path.basename(projectRoot));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function openStream(req, res, clients) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
}

/** Fold GitHub Actions state back into any cloud build still marked in flight. */
async function reconcileCloud(projectRoot) {
  const pending = listBuilds(projectRoot)
    .filter((b) => b.runner === 'cloud' && ['queued', 'running'].includes(b.status) && b.cloud?.runId);
  for (const build of pending) {
    const out = await capture('gh', ['run', 'view', String(build.cloud.runId),
      '--json', 'status,conclusion,url']).catch(() => null);
    if (!out) continue;
    const { status, conclusion } = JSON.parse(out);
    if (status !== 'completed') {
      if (build.status === 'queued' && status === 'in_progress') {
        updateBuild(projectRoot, build.id, { status: 'running' });
      }
      continue;
    }
    updateBuild(projectRoot, build.id, {
      status: conclusion === 'success' ? 'succeeded'
        : conclusion === 'cancelled' ? 'canceled' : 'failed',
      error: conclusion === 'success' ? null : `GitHub Actions run ${conclusion}`,
    });
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
