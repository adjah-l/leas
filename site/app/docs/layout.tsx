import DocsNav from '@/components/DocsNav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs">
      <DocsNav />
      <main className="doc">{children}</main>
    </div>
  );
}
