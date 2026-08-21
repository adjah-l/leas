import Link from 'next/link';
import { docs } from '@/lib/docs';

export const metadata = { title: 'Documentation' };

export default function DocsIndex() {
  return (
    <>
      <div className="doc-head">
        <span className="n">Operator&rsquo;s manual</span>
        <h1>Everything leas does, and how to work it</h1>
      </div>
      <div className="prose">
        <p>
          Thirteen sections, written for someone who has never seen the tool. Setup is sequential;
          everything after it is reference you jump into when you need it.
        </p>
      </div>
      <div className="cards" style={{ marginTop: 26 }}>
        {docs.map((d) => (
          <Link key={d.slug} className="card" href={`/docs/${d.slug}`}>
            <span className="k">Section {d.num}</span>
            <h3>{d.title}</h3>
            <p>{d.blurb}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
