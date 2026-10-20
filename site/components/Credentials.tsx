import type { CredentialRecord } from '@/lib/types';

/**
 * The expiry watch, as a panel.
 *
 * Apple distribution certificates and provisioning profiles both last about one year, which is long
 * enough that nobody remembers and short enough that everybody is eventually
 * caught. Sorting by soonest-first means the thing about to break is the thing
 * at the top.
 */
export default function Credentials({ items }: { items: CredentialRecord[] }) {
  if (!items.length) {
    return (
      <div className="panel creds">
        <div className="panel-h"><h2>Credentials</h2></div>
        <div className="ota-empty">
          No credential history yet. Run <code>leas creds</code> locally, or{' '}
          <code>leas sync</code> to push expiry dates here. Neither sends a key or a password.
        </div>
      </div>
    );
  }

  const attention = items.filter((c) => c.status === 'expired' || c.status === 'expiring');
  const soonest = items.find((c) => c.daysLeft != null && c.status !== 'expired');

  return (
    <div className="panel creds">
      <div className="panel-h">
        <h2>Credentials</h2>
        <span className="note">
          {attention.length
            ? `${attention.length} need${attention.length === 1 ? 's' : ''} attention`
            : soonest?.daysLeft != null
              ? `next expiry in ${soonest.daysLeft} days`
              : 'metadata only — no keys stored'}
        </span>
      </div>

      {items.map((c) => (
        <div className={`cred-row ${c.status}`} key={`${c.platform}-${c.id}`}>
          <span className={`cred-pill ${c.status}`}><i />{LABEL[c.status]}</span>
          <div>
            <div className="cred-kind">
              {c.kind}
              <span className={`plat ${c.platform}`}><i />{c.platform === 'ios' ? 'iOS' : 'Android'}</span>
            </div>
            <div className="ota-meta">
              {c.identity && <span>{c.identity}</span>}
              {c.appId && <span className="rt">{c.appId}</span>}
              {c.note && <span className="cred-note">{c.note}</span>}
              {c.fingerprint && <span className="sha">{c.fingerprint}</span>}
            </div>
          </div>
          <div className="ota-right">
            {c.expires ? (
              <>
                {c.expires.slice(0, 10)}<br />
                <span className={c.status === 'ok' ? '' : 'cred-count'}>{countdown(c.daysLeft)}</span>
              </>
            ) : '—'}
          </div>
        </div>
      ))}

      <div className="cred-foot">
        Expiry dates and public fingerprints only — <b>no key material or passwords are sent here.</b>{' '}
        Gate a build with <code>leas creds --check</code>.
      </div>
    </div>
  );
}

const LABEL: Record<CredentialRecord['status'], string> = {
  ok: 'valid', expiring: 'expiring', expired: 'expired', unknown: 'unread',
};

function countdown(days: number | null) {
  if (days == null) return '';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}
