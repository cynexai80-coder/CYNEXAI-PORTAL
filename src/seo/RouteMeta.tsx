// Written by the SEO crawl. Sets each page's title and description as the route changes.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import meta from './pages.json';

type Page = { path: string; title: string; description: string };

function setMeta(selector: string, attr: string, value: string) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export default function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const clean = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
    const page = (meta.pages as Page[]).find(p => p.path.toLowerCase() === clean.toLowerCase());
    if (!page) return;
    document.title = page.title;
    setMeta('meta[name="description"]', 'content', page.description);
    setMeta('link[rel="canonical"]', 'href', meta.origin + (page.path === '/' ? '/' : page.path));
    setMeta('meta[property="og:title"]', 'content', page.title);
    setMeta('meta[property="og:description"]', 'content', page.description);
    setMeta('meta[property="og:url"]', 'content', meta.origin + page.path);
  }, [pathname]);
  return null;
}
