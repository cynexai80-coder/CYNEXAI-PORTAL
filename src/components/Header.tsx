import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

import { CynexLogo } from './ui/CynexLogo';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Courses', href: '#courses' },
  { name: 'Skills', href: '#skills' },
  { name: 'Reviews', href: '#reviews' },
  { name: 'Contact', href: '#contact' },
  { name: 'Gallery', href: '/gallery' },
  { name: 'Blog', href: '/blog' },
  // 'Pay Now' has been removed as requested.
  { name: 'About Us', href: '/about' }, // Added 'About Us' link
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for scrollToId in location state (e.g., from Footer links or other pages)
  useEffect(() => {
    if (location.pathname === '/' && (location.state as any)?.scrollToId) {
      const targetId = (location.state as any).scrollToId;
      console.log(`[Header] Navigation state detected. Attempting to scroll to: ${targetId}`);
      
      const timer = setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          // Clean up state
          navigate('/', { replace: true, state: {} });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location, navigate]);

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault(); // Always prevent default, we're handling navigation
    setIsOpen(false); // Close mobile menu on click
    console.log(`[Header] Link clicked: ${href}`);
    console.log(`[Header] Current path: ${location.pathname}, Current hash: ${location.hash}`);

    if (href.startsWith('/')) { // It's a regular path like '/', '/gallery', or '/about'
      navigate(href);
      console.log(`[Header] Navigating to path: ${href}`);
    } else if (href.startsWith('#')) { // It's a hash link like '#courses'
      const targetId = href.substring(1);

      if (location.pathname === '/') {
        // If we are already on the home page, just scroll to the element
        console.log(`[Header] On home page. Attempting to scroll to ID: ${targetId}`);
        const element = document.getElementById(targetId);

        if (element) {
          console.log(`[Header] FOUND element with ID: ${targetId}. Scheduling scroll.`);
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
            console.log(`[Header] Scrolled to element with ID: ${targetId} (after timeout).`);
          }, 300); // 300ms delay to allow menu animation to complete
        } else {
          console.warn(`[Header] Element with ID '${targetId}' NOT FOUND on the current (Home) page.`);
        }
      } else {
        // If we are on a different page, navigate to home and pass state to scroll there
        console.log(`[Header] Not on home page. Navigating to / with state: { scrollToId: '${targetId}' }`);
        navigate('/', { state: { scrollToId: targetId } });
      }
    }
  };


  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      // Ultra-premium glassmorphism based on scroll state
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b border-border bg-background/80 backdrop-blur-md shadow-sm ${scrolled ? 'py-0' : 'py-2'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* HEADER CONTAINER: Fixed height back to original compact size */}
        <div className="flex justify-between items-center h-16 lg:h-20"> {/* Original compact height */}
          {/* Logo */}
          <Link
            to="/"
            onClick={() => {
              setIsOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center h-full"
          >
            <CynexLogo size="lg" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map(({ name, href }) => {
              const isActive =
                href === '/'
                  ? location.pathname === '/' && location.hash === ''
                  : href.startsWith('#')
                    ? location.pathname === '/' && location.hash === href
                    : location.pathname === href;

              return (
                <a
                  key={name}
                  href={href}
                  onClick={(e) => handleNavClick(href, e)}
                  className={`relative font-bold tracking-wide transition-all duration-300 px-6 py-2.5 rounded-full text-sm uppercase
                    ${isActive
                      ? 'bg-cyan-500/10 text-cyan-500 shadow-sm border border-cyan-500/20'
                      : 'text-foreground hover:bg-muted'
                    }`}
                >
                  {name}
                </a>
              );
            })}

            {/* Theme Toggle - REMOVED */}
          </nav>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsOpen((o) => !o)}
            className="lg:hidden p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black hover:bg-background/10 transition-colors"
            aria-label="Toggle navigation"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="lg:hidden overflow-hidden bg-background/95 backdrop-blur-lg rounded-lg mt-2 shadow-2xl border border-border"
            >
              <div className="px-4 py-4 space-y-3">
                {navItems.map(({ name, href }) => {
                  const isActive =
                    href === '/'
                      ? location.pathname === '/' && location.hash === ''
                      : href.startsWith('#')
                        ? location.pathname === '/' && location.hash === href
                        : location.pathname === href;

                  return (
                    <a
                      key={name}
                      href={href}
                      onClick={(e) => handleNavClick(href, e)}
                      className={`block py-3 px-6 rounded-xl text-lg font-bold transition-all duration-300
                        ${isActive
                          ? 'bg-cyan-500/10 text-cyan-500 shadow-sm border border-cyan-500/20'
                          : 'text-foreground hover:bg-muted'
                        }`}
                    >
                      {name}
                    </a>
                  );
                })}

                {/* Mobile Theme Toggle - REMOVED */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
