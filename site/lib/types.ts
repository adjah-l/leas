export type BuildRecord = {
  // Records come from the CLI, which may add fields ahead of the site knowing about them.
  [extra: string]: unknown;
  id: string;
  platform: 'ios' | 'android';
  profile: string;
  runner: 'local' | 'cloud';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  startedAt: string | null;
  durationMs: number | null;
  git?: { branch?: string | null; commit?: string | null; message?: string | null; dirty?: boolean };
  app?: { version?: string | null; buildNumber?: string | null };
  submission?: { status: string; track?: string | null; at?: string | null; error?: string | null };
};

export type UpdateRecord = {
  [extra: string]: unknown;
  id: string;
  channel?: string;
  channels: string[];
  runtimeVersion: string;
  platforms: string[];
  message: string;
  createdAt: string;
  bytes?: number;
  live?: boolean;
  promotedFrom?: string;
  git?: { branch?: string | null; commit?: string | null; message?: string | null };
};

/**
 * A credential as the dashboard sees it: metadata only.
 *
 * `leas sync` deliberately sends no key material and no password — an identity
 * string, an expiry date, and a truncated public fingerprint. Nothing here is
 * a secret, which is why a hosted page is allowed to hold it at all.
 */
export type CredentialRecord = {
  [extra: string]: unknown;
  id: string;
  platform: 'ios' | 'android';
  kind: string;
  profile?: string;
  identity: string | null;
  expires: string | null;
  daysLeft: number | null;
  status: 'ok' | 'expiring' | 'expired' | 'unknown';
  note?: string | null;
  appId?: string | null;
  fingerprint?: string;
};

export type DailyBucket = {
  date: string; succeeded: number; failed: number; active: number; canceled: number; total: number;
};

export type Snapshot = {
  project: string;
  generatedAt: string;
  stats: {
    total: number; inFlight: number; successRate: number | null; medianDurationMs: number | null;
    last7Days: number; submitted: number;
    byPlatform: Record<string, number>;
    byProfile: Record<string, number>;
    byStatus: Record<string, number>;
    daily: DailyBucket[];
  };
  builds: BuildRecord[];
  updates: UpdateRecord[];
  credentials?: CredentialRecord[];
};
