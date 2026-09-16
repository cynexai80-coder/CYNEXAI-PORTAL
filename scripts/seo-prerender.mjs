// Written by the SEO crawl. Runs after the build: gives each public page its own <head>.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const { origin, pages } = JSON.parse(readFileSync(join(root, 'src/seo/pages.json'), 'utf8'));
const snapshots = existsSync(join(root, 'scripts/seo-snapshots.json'))
  ? JSON.parse(readFileSync(join(root, 'scripts/seo-snapshots.json'), 'utf8')) : {};
const shell = readFileSync(join(dist, 'index.html'), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const setTag = (doc, re, tag) => (re.test(doc) ? doc.replace(re, tag) : doc.replace('</head>', tag + '\n  </head>'));

for (const p of pages) {
  const url = origin + (p.path === '/' ? '/' : p.path);
  let doc = shell;
  doc = setTag(doc, /<title>[\s\S]*?<\/title>/i, '<title>' + esc(p.title) + '</title>');
  doc = setTag(doc, /<meta\s+name="description"[^>]*>/i, '<meta name="description" content="' + esc(p.description) + '">');
  doc = setTag(doc, /<link\s+rel="canonical"[^>]*>/i, '<link rel="canonical" href="' + esc(url) + '">');
  doc = setTag(doc, /<meta\s+property="og:title"[^>]*>/i, '<meta property="og:title" content="' + esc(p.title) + '">');
  doc = setTag(doc, /<meta\s+property="og:description"[^>]*>/i, '<meta property="og:description" content="' + esc(p.description) + '">');
  doc = setTag(doc, /<meta\s+property="og:url"[^>]*>/i, '<meta property="og:url" content="' + esc(url) + '">');
  doc = setTag(doc, /<meta\s+name="twitter:title"[^>]*>/i, '<meta name="twitter:title" content="' + esc(p.title) + '">');
  doc = setTag(doc, /<meta\s+name="twitter:description"[^>]*>/i, '<meta name="twitter:description" content="' + esc(p.description) + '">');
  if (p.ogImage) {
    doc = setTag(doc, /<meta\s+property="og:image"[^>]*>/i, '<meta property="og:image" content="' + esc(p.ogImage) + '">');
  }
  for (const block of p.jsonLd || []) {
    doc = doc.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(block).replace(/</g, '\\u003c') + '</script>\n  </head>');
  }
  if (snapshots[p.path]) doc = doc.replace(/<div id="root"><\/div>/, '<div id="root">' + snapshots[p.path] + '</div>');

  const out = p.path === '/' ? join(dist, 'index.html') : join(dist, p.path.replace(/^\/+/, ''), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, doc);
}
console.log('seo-prerender: wrote ' + pages.length + ' page heads');
