'use client';
import { useState } from 'react';
import type { DailyBucket } from '@/lib/types';
import { niceTicks, barPath } from '@/lib/format';

// Outcome is a state, not a series identity — so these come from the reserved
// status palette, and every one of them is labelled as well as coloured.
const SERIES = [
  { key: 'succeeded', label: 'Succeeded', color: 'var(--st-good)' },
  { key: 'failed', label: 'Failed', color: 'var(--st-crit)' },
  { key: 'active', label: 'In progress', color: 'var(--st-warn)' },
  { key: 'canceled', label: 'Canceled', color: 'var(--st-idle)' },
] as const;

export default function BuildsChart({ daily }: { daily: DailyBucket[] }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = 680, H = 196, PL = 26, PR = 8, PT = 18, PB = 26;
  const iw = W - PL - PR, ih = H - PT - PB;
  const max = Math.max(1, ...daily.map((d) => d.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const step = iw / daily.length;
  const bw = Math.min(26, step - 8);
  const y = (v: number) => PT + ih - (v / top) * ih;
  const peak = daily.reduce((a, d, i) => (d.total > daily[a].total ? i : a), 0);

  return (
    <div style={{ position: 'relative' }}>
      <div className="legend">
        {SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Builds per day for the last 14 days, stacked by outcome. Full data in the table below.">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text className="tick" x={PL - 7} y={y(t) + 3.5} textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1} />
        {daily.map((d, i) => {
          const cx = PL + step * i + step / 2;
          const x = cx - bw / 2;
          const day = new Date(`${d.date}T12:00:00`);
          let acc = 0;
          const segs: React.ReactNode[] = [];
          let first = true;
          for (const s of SERIES) {
            const v = d[s.key];
            if (!v) continue;
            const h = (v / top) * ih;
            const yy = y(acc + v);
            // 2px gap between stacked segments; only the top end is rounded
            segs.unshift(
              <path key={s.key} d={barPath(x, yy, bw, Math.max(1, h - (acc ? 2 : 0)), first ? 4 : 0)}
                fill={s.color} />,
            );
            acc += v; first = false;
          }
          return (
            <g key={d.date}>
              {hover?.i === i && (
                <rect x={cx - step / 2 + 1} y={PT} width={step - 2} height={ih} rx={2} fill="var(--surface-2)" />
              )}
              {segs}
              {(i === daily.length - 1 || i === peak) && d.total > 0 && (
                <text className="dlabel" x={cx} y={y(d.total) - 7} textAnchor="middle">{d.total}</text>
              )}
              {(i % 2 === 0 || i === daily.length - 1) && (
                <text className="tick" x={cx} y={H - PB + 15} textAnchor="middle">
                  {day.getMonth() + 1}/{day.getDate()}
                </text>
              )}
              <rect x={cx - step / 2} y={PT} width={step} height={ih} fill="transparent"
                onMouseMove={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tip on" style={{
          left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 900) - 180),
          top: hover.y - 12,
        }}>
          <div className="d">
            {new Date(`${daily[hover.i].date}T12:00:00`).toLocaleDateString(undefined,
              { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          {SERIES.filter((s) => daily[hover.i][s.key]).map((s) => (
            <div className="r" key={s.key}>
              <i style={{ background: s.color }} />{s.label}<b>{daily[hover.i][s.key]}</b>
            </div>
          ))}
          {daily[hover.i].total === 0 && <div className="r" style={{ color: 'var(--muted)' }}>No builds</div>}
        </div>
      )}
    </div>
  );
}
