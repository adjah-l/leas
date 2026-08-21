import Link from 'next/link';
import { notFound } from 'next/navigation';
import { docs, bySlug } from '@/lib/docs';

export function generateStaticParams() {
  return docs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = bySlug(slug);
  return doc ? { title: doc.title, description: doc.blurb } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = bySlug(slug);
  if (!doc) notFound();

  const i = docs.findIndex((d) => d.slug === slug);
  const prev = docs[i - 1];
  const next = docs[i + 1];

  return (
    <>
      <div className="doc-head">
        <span className="n">Section {doc.num}</span>
        <h1>{doc.title}</h1>
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: doc.body }} />
      <div className="docfoot">
        {prev ? (
          <Link href={`/docs/${prev.slug}`}>
            <span className="k">← Previous</span>
            <b>{prev.title}</b>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/docs/${next.slug}`} style={{ textAlign: 'right' }}>
            <span className="k">Next →</span>
            <b>{next.title}</b>
          </Link>
        ) : <span />}
      </div>
    </>
  );
}
