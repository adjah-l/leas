import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'leas', template: '%s · leas' },
  description:
    'Self-hosted build, submit, and over-the-air updates for Expo and React Native apps. ' +
    'Build locally or in the cloud, ship to both stores, and push JS fixes without a release.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="topbar">
          <div className="topbar-in">
            <Link href="/" className="brand">leas</Link>
            <nav className="topnav">
              <Link href="/docs/setup">Get started</Link>
              <Link href="/docs">Docs</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/docs/updates">Updates</Link>
              <Link href="/docs/broken">Troubleshooting</Link>
            </nav>
          </div>
        </div>
        {children}
        <footer className="site">
          <div className="in">
            <span>leas · self-hosted build &amp; submit for Expo and React Native</span>
            <span>Apple and Google change their consoles regularly — verify button names against the live consoles.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
