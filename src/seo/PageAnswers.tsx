// Written by the SEO crawl. Shows the page's short answer and its questions, from src/seo/pages.json,
// so visitors, Google's answer boxes and AI assistants all read the same words.
import { useLocation } from 'react-router-dom';
import meta from './pages.json';

type Faq = { q: string; a: string };
type Page = { path: string; summary?: string; faqs?: Faq[] };

export default function PageAnswers() {
  const { pathname } = useLocation();
  const clean = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const page = (meta.pages as Page[]).find(p => p.path.toLowerCase() === clean.toLowerCase());
  if (!page || (!page.summary && !page.faqs?.length)) return null;
  return (
    <section aria-label="About this page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-gray-300">
      {page.summary && <p className="text-lg leading-relaxed">{page.summary}</p>}
      {!!page.faqs?.length && (
        <div className={page.summary ? 'mt-12' : ''}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {page.faqs.map(f => (
              <div key={f.q} className="py-5">
                <h3 className="text-lg font-semibold text-white">{f.q}</h3>
                <p className="mt-2 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
