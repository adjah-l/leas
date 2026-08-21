export const pad = (n: number) => String(n).padStart(2, '0');

export function dur(ms: number | null | undefined) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function niceTicks(max: number) {
  const choices = [1, 2, 5, 10, 20, 50, 100];
  const step = choices.find((s) => max / s <= 5) ?? Math.ceil(max / 5);
  const out: number[] = [];
  for (let v = 0; v <= Math.ceil(max / step) * step; v += step) out.push(v);
  return out;
}

/** Rect path with optionally rounded top corners, anchored to the baseline. */
export function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return rr
    ? `M${x} ${y + h}V${y + rr}a${rr} ${rr} 0 0 1 ${rr} ${-rr}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${y + h}Z`
    : `M${x} ${y + h}V${y}h${w}V${y + h}Z`;
}
