import { NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import type { Snapshot } from '@/lib/types';
import { demoSnapshot } from '@/lib/demo';

export const dynamic = 'force-dynamic';

const BLOB_PATH = 'leas/snapshot.json';

/**
 * GET  the latest snapshot the CLI pushed, or demo data when nothing is wired up.
 * POST a snapshot from `leas sync`, authenticated with a shared token.
 *
 * Storage is optional on purpose: the site is useful the moment it deploys,
 * and becomes live as soon as Blob and a token are configured.
 */
export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ...demoSnapshot, source: 'demo' });
  }
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (!blobs.length) return NextResponse.json({ ...demoSnapshot, source: 'demo' });
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`blob fetch ${res.status}`);
    const snapshot = (await res.json()) as Snapshot;
    return NextResponse.json({ ...snapshot, source: 'live', uploadedAt: blobs[0].uploadedAt });
  } catch {
    return NextResponse.json({ ...demoSnapshot, source: 'demo' });
  }
}

export async function POST(request: Request) {
  const token = process.env.LEAS_SYNC_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'This site has no LEAS_SYNC_TOKEN set, so it cannot accept pushes.' },
      { status: 501 },
    );
  }
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!supplied || supplied !== token) {
    return NextResponse.json({ error: 'Bad or missing sync token.' }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'No Blob store is connected to this project, so there is nowhere to save the snapshot.' },
      { status: 501 },
    );
  }

  let body: Snapshot;
  try {
    body = (await request.json()) as Snapshot;
  } catch {
    return NextResponse.json({ error: 'Body was not valid JSON.' }, { status: 400 });
  }
  if (!body || !Array.isArray(body.builds)) {
    return NextResponse.json({ error: 'Snapshot must include a builds array.' }, { status: 400 });
  }

  const blob = await put(BLOB_PATH, JSON.stringify(body), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return NextResponse.json({
    ok: true, url: blob.url,
    builds: body.builds.length, updates: body.updates?.length ?? 0,
  });
}
