'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { docs } from '@/lib/docs';

export default function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="docsnav" aria-label="Documentation sections">
      <div className="h">Manual</div>
      <ol>
        {docs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/docs/${d.slug}`}
              data-on={pathname === `/docs/${d.slug}` ? '1' : '0'}
            >
              <span className="n">{d.num}</span>
              <span>{d.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
