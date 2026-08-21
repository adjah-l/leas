import Link from 'next/link';
import { docs } from '@/lib/docs';

const START = ['setup', 'daily', 'updates', 'rotate', 'org', 'broken'];

export default function Home() {
  const featured = START.map((s) => docs.find((d) => d.slug === s)!).filter(Boolean);
  return (
    <>
      <section className="hero">
        <div className="eyebrow">build · submit · update</div>
        <h1>Your own EAS, on your own machines.</h1>
        <p className="lede">
          leas builds and signs your Expo or React Native app, submits it to the App Store and
          Google Play, and ships over-the-air JavaScript updates — from one command, on your
          laptop or on a fleet you rent by the minute.
        </p>
        <div className="cta">
          <Link className="btn" href="/docs/setup">Set it up</Link>
          <Link className="btn ghost" href="/dashboard">Open the dashboard</Link>
        </div>
        <pre>
{`leas build --platform all --profile production --auto-submit --cloud
leas update --channel production --message "Fix checkout crash"
leas update:rollback --channel production --embedded   `}<span className="c">{`# emergency stop`}</span>
        </pre>
      </section>

      <section className="sec">
        <h2>What it replaces</h2>
        <p className="sub">
          Every EAS service you were paying for, running on infrastructure you control.
        </p>
        <div className="tablewrap">
          <table className="matrix">
            <thead>
              <tr><th>Expo service</th><th>leas</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td><b>EAS Build</b></td><td><code>leas build</code> — local and cloud, iOS and Android</td><td className="yes">Built</td></tr>
              <tr><td><b>EAS Submit</b></td><td><code>leas submit</code> — App Store Connect API and Play Developer API v3</td><td className="yes">Built</td></tr>
              <tr><td><b>EAS Update</b></td><td><code>leas update</code> — self-hosted Expo Updates protocol v1</td><td className="yes">Built</td></tr>
              <tr><td><b>EAS Workflows</b></td><td>GitHub Actions workflows in your own repo</td><td className="yes">Built</td></tr>
              <tr><td><b>expo.dev dashboard</b></td><td><code>leas dashboard</code>, and this site</td><td className="yes">Built</td></tr>
              <tr><td><b>Accounts &amp; orgs</b></td><td>Single-tenant today — your credentials, your machines</td><td>See <Link href="/docs/market">Going to market</Link></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="sec">
        <h2>Start here</h2>
        <p className="sub">
          The manual, in the order you will actually need it.
        </p>
        <div className="cards">
          {featured.map((d) => (
            <Link key={d.slug} className="card" href={`/docs/${d.slug}`}>
              <span className="k">Section {d.num}</span>
              <h3>{d.title}</h3>
              <p>{d.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2>The one thing you cannot build around</h2>
        <p className="sub" style={{ maxWidth: '70ch' }}>
          Apple&rsquo;s macOS licence forbids running macOS on non-Apple hardware, so every
          &ldquo;cloud iOS build&rdquo; on earth — Expo&rsquo;s included — is somebody&rsquo;s real
          Mac. You are not missing a trick; there isn&rsquo;t one. Your only decision is whose Mac
          you rent, and leas keeps that decision swappable: a cloud build runs the identical engine
          as a local one, just on different hardware.{' '}
          <Link href="/docs/model">How it works →</Link>
        </p>
      </section>
    </>
  );
}
