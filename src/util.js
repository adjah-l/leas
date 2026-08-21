import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const C = { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' };

export const log = {
  step: (m) => console.log(`\n${C.cyan}${C.bold}▸ ${m}${C.off}`),
  info: (m) => console.log(`  ${m}`),
  dim: (m) => console.log(`  ${C.dim}${m}${C.off}`),
  warn: (m) => console.log(`${C.yellow}!  ${m}${C.off}`),
  ok: (m) => console.log(`${C.green}✓  ${m}${C.off}`),
  err: (m) => console.error(`${C.red}✗  ${m}${C.off}`),
};

export class LeasError extends Error {}

/** Run a command, streaming output. Rejects on non-zero exit. */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    log.dim(`$ ${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new LeasError(`${cmd} exited with code ${code}`)));
  });
}

/** Run a command, capturing stdout. */
export function capture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve(out.trim()) : reject(new LeasError(`${cmd} failed: ${err.trim() || out.trim()}`)));
  });
}

export function requireBinary(bin, hint) {
  const dirs = (process.env.PATH || '').split(':');
  if (!dirs.some((d) => d && existsSync(path.join(d, bin)))) {
    throw new LeasError(`Missing required tool '${bin}'.${hint ? ` ${hint}` : ''}`);
  }
}

export function requireEnv(name, hint) {
  const v = process.env[name];
  if (!v) throw new LeasError(`Missing env var ${name}.${hint ? ` ${hint}` : ''}`);
  return v;
}
