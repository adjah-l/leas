import { log } from './util.js';
import { loadConfig } from './config.js';
import { scanCredentials, WARN_DAYS } from './credential-scan.js';

/**
 * `leas creds` — what is about to expire.
 *
 * Distribution certificates last three years and provisioning profiles one, so
 * the failure mode is not that you forget: it is that three years pass and the
 * reminder arrives as a broken release. This is the thing that has to be
 * checked on a schedule rather than remembered.
 */
export async function creds({ projectRoot, platforms, profileName, warnDays = WARN_DAYS, json = false }) {
  const config = loadConfig(projectRoot);
  const records = await scanCredentials({ projectRoot, config, profileName, platforms, warnDays });
  const summary = summarize(records, warnDays);

  if (json) console.log(JSON.stringify({ generatedAt: new Date().toISOString(), warnDays, ...summary, credentials: records }, null, 2));
  else print(records, summary, warnDays);

  return summary;
}

function summarize(records, warnDays) {
  const count = (s) => records.filter((r) => r.status === s).length;
  return {
    total: records.length,
    expired: count('expired'),
    expiring: count('expiring'),
    unknown: count('unknown'),
    // What a scheduled check acts on: something is broken, or about to be.
    needsAttention: count('expired') + count('expiring') > 0,
    warnDays,
  };
}

const MARK = {
  ok: '\x1b[32m✓\x1b[0m', expiring: '\x1b[33m!\x1b[0m',
  expired: '\x1b[31m✗\x1b[0m', unknown: '\x1b[2m·\x1b[0m',
};

function print(records, summary, warnDays) {
  if (!records.length) {
    log.warn('No expiring credentials configured for this profile.');
    return;
  }
  log.step('Credentials');
  const width = Math.max(...records.map((r) => r.kind.length));
  for (const r of records) {
    const when = r.expires
      ? `${r.expires.slice(0, 10)}  ${remaining(r.daysLeft)}`
      : `\x1b[2m${r.note ?? 'could not be read'}\x1b[0m`;
    const who = r.identity ? `\x1b[2m${r.identity}\x1b[0m` : '';
    console.log(`  ${MARK[r.status]} ${r.kind.padEnd(width)}  ${when}`);
    if (who) console.log(`    ${' '.repeat(width)}  ${who}`);
  }
  console.log('');
  if (summary.expired) log.err(`${summary.expired} expired. Builds signed with it will fail.`);
  else if (summary.expiring) log.warn(`${summary.expiring} expiring within ${warnDays} days. Renew before it bites.`);
  else if (summary.unknown) log.warn(`${summary.total - summary.unknown} valid, ${summary.unknown} could not be read.`);
  else log.ok(`All ${summary.total} valid, none within ${warnDays} days of expiry.`);
}

function remaining(days) {
  if (days === null) return '';
  if (days < 0) return `\x1b[31mexpired ${-days} day${days === -1 ? '' : 's'} ago\x1b[0m`;
  if (days === 0) return '\x1b[31mexpires today\x1b[0m';
  return `${days} day${days === 1 ? '' : 's'} left`;
}
