'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { dur, ago } from '@/lib/format';
import BuildsChart from './BuildsChart';

type Loaded = Snapshot & { source?: 'live' | 'demo'; uploadedAt?: string };

const FILTERS = [
  { key: 'platform', values: ['all', 'ios', 'android'] },
  { key: 'runner', values: ['all', 'local', 'cloud'] },
  { key: 'status', values: ['all', 'succeeded', 'failed', 'running'] },
] as const;

export default function Dashboard({ initial }: { initial: Loaded }) {
  const [data, setData] = useState<Loaded>(initial);
  const [filters, setFilters] = useState<Record<string, string>>({
    platform: 'all', profile: 'all', runner: 'all', status: 'all',
  });
  const [tick, setTick] = useState(0);

  // The hosted dashboard polls rather than streaming: a serverless function has
  // no filesystem to watch, and a snapshot only changes when the CLI pushes one.
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/snapshot', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* keep showing the last good snapshot */ }
    }, 20_000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);

  const profiles = useMemo(
    () => ['all', ...Object.keys(data.stats.byProfile ?? {})], [data.stats.byProfile]);

  const rows = data.builds.filter((b) =>
    (filters.platform === 'all' || b.platform === filters.platform) &&
    (filters.profile === 'all' || b.profile === filters.profile) &&
    (filters.runner === 'all' || b.runner === filters.runner) &&
    (filters.status === 'all' || b.status === filters.status));

  const s = data.stats;
  const rate = s.successRate == null ? '—' : Math.round(s.successRate * 100);
  const groups = [...FILTERS.slice(0, 1), { key: 'profile' as const, values: profiles }, ...FILTERS.slice(1)];

  return (
    <>
      <div className="bar">
        <span className="proj">{data.project}</span>
        <span className="sp" />
        <span className={`live ${data.source === 'live' ? 'on' : 'demo'}`}>
          <span className="dot" />
          {data.source === 'live'
            ? `live · pushed ${data.uploadedAt ? ago(data.uploadedAt) : 'recently'}`
            : 'preview data'}
        </span>
      </div>

      {data.source !== 'live' && (
        <div className="banner">
          <b>Nothing has been pushed to this site yet.</b> These are sample builds so you can see
          the shape. Run <code>leas sync</code> from your project to replace them with your own —
          see <a href="/docs/dash">The dashboard</a>.
        </div>
      )}

      <div className="tiles">
        <Tile k="Total builds" v={s.total} sub={`${s.last7Days} in the last 7 days`} />
        <Tile k="Success rate" v={rate === '—' ? '—' : <>{rate}<small>%</small></>}
          sub={`${s.byStatus.succeeded ?? 0} succeeded · ${s.byStatus.failed ?? 0} failed`} />
        <Tile k="Median build" v={dur(s.medianDurationMs)} sub="successful builds only" />
        <Tile k="Submitted" v={s.submitted} sub="reached a store track" />
        <Tile k="In flight" v={s.inFlight} sub={s.inFlight ? 'running now' : 'nothing building'}
          hot={s.inFlight > 0} />
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><h2>Builds per day</h2><span className="note">last 14 days</span></div>
          <BuildsChart daily={s.daily} />
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Platform &amp; channel</h2></div>
          <div className="split">
            <SplitRow label="iOS" n={s.byPlatform.ios ?? 0} total={s.total} color="var(--ios)" />
            <SplitRow label="Android" n={s.byPlatform.android ?? 0} total={s.total} color="var(--android-s)" />
            <div className="split-sub">
              Channels ·{' '}
              {Object.entries(s.byProfile ?? {}).sort((a, b) => b[1] - a[1])
                .map(([p, n]) => <span key={p}><b>{p}</b> {n}&nbsp;&nbsp;</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="panel ota">
        <div className="panel-h">
          <h2>Over-the-air updates</h2>
          <span className="note">
            {data.updates?.length
              ? `${data.updates.length} published · ${data.updates.filter((u) => u.live).length} serving now`
              : ''}
          </span>
        </div>
        {data.updates?.length ? data.updates.slice(0, 8).map((u) => (
          <div className="ota-row" key={u.id + (u.promotedFrom ?? '')}>
            <span className={`ota-live${u.live ? ' on' : ''}`}>
              <i />{u.live ? 'serving' : 'superseded'}
            </span>
            <div>
              <div className="ota-msg">{u.message || 'No message'}</div>
              <div className="ota-meta">
                {(u.channels ?? []).map((c) => <span className="tag" key={c}>{c}</span>)}
                <span className="rt">runtime {u.runtimeVersion}</span>
                <span>{(u.platforms ?? []).join(' + ')}</span>
                {u.git?.commit && <span className="sha">{u.git.commit}</span>}
                {u.promotedFrom && <span>promoted from {u.promotedFrom}</span>}
              </div>
            </div>
            <div className="ota-right">
              {ago(u.createdAt)}<br />{u.bytes ? `${(u.bytes / 1e6).toFixed(1)} MB` : ''}
            </div>
          </div>
        )) : (
          <div className="ota-empty">
            No updates published yet. Ship a JS-only change with <code>leas update --channel production</code>.
          </div>
        )}
      </div>

      <div className="filters">
        {groups.map((g) => (
          <div className="fgroup" key={g.key}>
            {g.values.map((v) => (
              <button key={v} className="fbtn" aria-pressed={filters[g.key] === v}
                onClick={() => setFilters((f) => ({ ...f, [g.key]: v }))}>
                {v === 'all' ? g.key : v}
              </button>
            ))}
          </div>
        ))}
        <span className="count">{rows.length} of {data.builds.length} builds</span>
      </div>

      <div className="tw">
        {rows.length ? (
          <table>
            <thead><tr>
              {['Status','Platform','Channel','Where','Version','Commit','Duration','Submitted','Started']
                .map((h) => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((b) => {
                const live = b.status === 'queued' || b.status === 'running';
                const elapsed = live
                  ? Date.now() - Date.parse(b.startedAt ?? b.createdAt) + tick * 0
                  : b.durationMs;
                return (
                  <tr key={b.id} className={live ? 'active' : ''}>
                    <td><span className={`pill ${b.status}`}><i />{b.status}</span></td>
                    <td><span className={`plat ${b.platform}`}><i />{b.platform === 'ios' ? 'iOS' : 'Android'}</span></td>
                    <td><span className="tag">{b.profile}</span></td>
                    <td>{b.runner === 'cloud' ? 'Cloud' : 'Local'}</td>
                    <td className="num">
                      {b.app?.version ?? '—'}
                      {b.app?.buildNumber && <span className="sha"> ({b.app.buildNumber})</span>}
                    </td>
                    <td>
                      <span className="sha">{b.git?.commit ?? '—'}{b.git?.dirty ? ' *' : ''}</span>
                      <span className="msg">{b.git?.message ?? ''}</span>
                    </td>
                    <td className="num">{dur(elapsed)}</td>
                    <td>
                      {b.submission?.status === 'submitted'
                        ? <span className="sent">{b.submission.track ?? 'sent'}</span>
                        : b.submission?.status === 'failed'
                          ? <span style={{ color: 'var(--st-crit)' }}>failed</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="num">{ago(b.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <h2>{data.builds.length ? 'No builds match these filters' : 'No builds yet'}</h2>
            <p>{data.builds.length
              ? 'Clear a filter to see the rest.'
              : 'Run leas build and push a snapshot with leas sync.'}</p>
          </div>
        )}
      </div>
    </>
  );
}

function Tile({ k, v, sub, hot }: { k: string; v: React.ReactNode; sub: string; hot?: boolean }) {
  return (
    <div className={`tile${hot ? ' hot' : ''}`}>
      <span className="k">{k}</span>
      <div className="v">{v}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function SplitRow({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  const pct = Math.round((n / Math.max(1, total)) * 100);
  return (
    <div className="split-row">
      <span className="lbl"><i style={{ background: color }} />{label}</span>
      <span className="track"><span className="fill" style={{ width: `${pct}%`, background: color }} /></span>
      <span className="n">{n} · {pct}%</span>
    </div>
  );
}
