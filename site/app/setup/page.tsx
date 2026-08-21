import type { Metadata } from 'next';
import Setup from '@/components/Setup';

export const metadata: Metadata = {
  title: 'Setup wizard',
  description:
    'Generate your leas.json, GitHub Actions workflows, and repo secrets script. ' +
    'Runs entirely in your browser — your signing keys never leave your machine.',
};

export default function SetupPage() {
  return <Setup />;
}
