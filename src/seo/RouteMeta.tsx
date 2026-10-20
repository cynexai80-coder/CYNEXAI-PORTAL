// Written by the SEO crawl. Sets each page's title and description as the route changes.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import meta from './pages.json';
import { portalTitleFor } from './portalTitles';

type Page = { path: string; title: string; description: string };

// Logged-in app screens, transaction pages and certificate lookups must never be indexed.
const NOINDEX_PREFIXES = [
  '/login', '/student', '/teacher', '/manager', '/ceo', '/sales', '/dm', '/crm', '/admin',
  '/profile', '/chat', '/test', '/enroll', '/pay', '/certificate', '/certificates',
];

// What index.html shipped with, captured before the first route overrides it, so an unlisted route
// falls back to it instead of keeping the previous page's title/canonical.
let initialMeta: { title: string; description: string } | null = null;

function setMeta(selector: string, attr: string, value: string) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function setRobots(content: string) {
  let el = document.head.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!initialMeta) {
      initialMeta = {
        title: document.title,
        description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      };
    }
    const clean = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
    const lower = clean.toLowerCase();
    const noindex = NOINDEX_PREFIXES.some(p => lower === p || lower.startsWith(p + '/'));
    const page = (meta.pages as Page[]).find(p => p.path.toLowerCase() === lower);

    if (page) {
      document.title = page.title;
      setMeta('meta[name="description"]', 'content', page.description);
      setMeta('link[rel="canonical"]', 'href', meta.origin + (page.path === '/' ? '/' : page.path));
      setMeta('meta[property="og:title"]', 'content', page.title);
      setMeta('meta[property="og:description"]', 'content', page.description);
      setMeta('meta[property="og:url"]', 'content', meta.origin + page.path);
    } else {
      const portalTitle = portalTitleFor(clean);
      document.title = portalTitle ? `${portalTitle} | CynexAI` : initialMeta.title;
      setMeta('meta[name="description"]', 'content', initialMeta.description);
      setMeta('link[rel="canonical"]', 'href', meta.origin + clean);
      setMeta('meta[property="og:title"]', 'content', initialMeta.title);
      setMeta('meta[property="og:description"]', 'content', initialMeta.description);
      setMeta('meta[property="og:url"]', 'content', meta.origin + clean);
    }
    setRobots(noindex ? 'noindex, nofollow' : 'index, follow');
  }, [pathname]);
  return null;
}
