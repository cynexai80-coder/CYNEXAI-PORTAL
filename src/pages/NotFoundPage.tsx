import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found | CynexAI';
    // A client-side 404 still answers HTTP 200, so tell crawlers not to index it.
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0a0a14] text-center p-6">
      <p className="text-6xl font-black text-indigo-500 mb-2">404</p>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="flex gap-3">
        <Link to="/" className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Go to home</Link>
        <Link to="/login" className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white font-semibold">Portal login</Link>
      </div>
    </main>
  );
}
