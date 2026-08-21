import Dashboard from '@/components/Dashboard';
import { demoSnapshot } from '@/lib/demo';
import type { Snapshot } from '@/lib/types';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

async function getSnapshot() {
  // Rendered on the server so the page is useful before any JS runs.
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  if (!base) return { ...demoSnapshot, source: 'demo' as const };
  try {
    const res = await fetch(`${base}/api/snapshot`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Snapshot & { source?: 'live' | 'demo' };
  } catch {
    return { ...demoSnapshot, source: 'demo' as const };
  }
}

export default async function DashboardPage() {
  const snapshot = await getSnapshot();
  return <div className="shell">
    <Dashboard initial={snapshot} />
  </div>;
}
