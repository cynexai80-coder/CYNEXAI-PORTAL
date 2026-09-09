import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowUp
} from 'lucide-react';

import { CynexLogo } from './ui/CynexLogo';

// Custom X (Twitter) Icon
const XIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href.includes('#')) {
      e.preventDefault();
      const [path, hash] = href.split('#');
      const targetPath = path === '' ? '/' : path;
      const targetId = hash;

      if (location.pathname === targetPath) {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        navigate(targetPath, { state: { scrollToId: targetId } });
      }
    } else if (href === '/') {
      if (location.pathname === '/') {
        e.preventDefault();
        scrollToTop();
      }
    }
  };

  const footerLinks = {
    courses: [
      { name: 'Data Science & Machine Learning', href: '/course/data-science-machine-learning' }, 
      { name: 'Artificial Intelligence & Generative AI', href: '/course/artificial-intelligence-generative-ai' }, 
      { name: 'Full Stack Java Development', href: '/course/full-stack-java-development' }, 
      { name: 'DevOps & Cloud Technologies', href: '/course/devops-cloud-technologies' }, 
      { name: 'Python Programming', href: '/course/python-programming' }, 
      { name: 'Software Testing (Manual + Automation)', href: '/course/software-testing-manual-automation' }, 
      { name: 'SAP (Data Processing)', href: '/course/sap-data-processing' }, 
    ],
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Contact', href: '/#contact' },
      { name: 'Blog', href: '/blog' },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: 'https://www.facebook.com/profile.php?id=61577768308585', hoverColor: 'hover:text-[#1877F2]' },
    { icon: XIcon, href: 'https://x.com/CynexAi?t=5k9RLyNOu_3lxItwPwoeNA&s=08', hoverColor: 'hover:text-cyan-500' },
    { icon: Instagram, href: 'https://www.instagram.com/cynexai.in?igsh=MWk5YWhlOHN5a2lqdw==', hoverColor: 'hover:text-cyan-500' },
    { icon: Linkedin, href: 'https://www.linkedin.com/company/cynexai/posts/?feedView=all', hoverColor: 'hover:text-[#0077b5]' },
    { icon: Youtube, href: 'https://www.youtube.com/@CynexAI', hoverColor: 'hover:text-[#FF0000]' },
  ];

  return (
    <footer className="relative bg-surface border-t border-border text-muted-foreground overflow-hidden transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <Link
                to="/"
                onClick={(e) => handleNavClick('/', e)}
                className="flex items-center space-x-3 mb-6 group transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <CynexLogo size="lg" />
              </Link>

              <p className="text-muted-foreground mb-6 leading-relaxed">
                Transforming careers through cutting-edge technology education.
                Join thousands of students who have successfully transitioned into
                high-paying tech roles with our industry-aligned programs.
              </p>

              {/* Social Media Icons */}
              <div className="flex items-center space-x-4 mb-6">
                {socialLinks.map((social, index) => {
                  const IconComponent = social.icon;
                  return (
                    <motion.a
                      key={index}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.2, y: -2 }}
                      className={`transition-colors duration-200 text-muted-foreground ${social.hoverColor}`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </motion.a>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-muted-foreground">
                  <Phone className="w-4 h-4 mr-3 text-cyan-500" />
                  <span>+91 9966639869</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Mail className="w-4 h-4 mr-3 text-cyan-500" />
                  <span>contact@Cynexai.in</span>
                </div>
                <div className="flex items-start text-muted-foreground">
                  <MapPin className="w-4 h-4 mr-3 mt-1 text-cyan-500 flex-shrink-0" />
                  <span className="text-sm">
                    MIG-215, Rd Number 1, KPHB Phase I,
                    Kukatpally, Hyderabad, Telangana 500072
                  </span>
                </div>
              </div>
            </div>

            {/* Courses */}
            <div>
              <h3 className="text-foreground font-semibold mb-6">Popular Courses</h3>
              <ul className="space-y-3">
                {footerLinks.courses.map((link, index) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      className="text-muted-foreground hover:text-cyan-500 transition-colors duration-200 text-sm font-medium"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-foreground font-semibold mb-6">Company</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      onClick={(e) => handleNavClick(link.href, e)}
                      className="text-muted-foreground hover:text-cyan-500 transition-colors duration-200 text-sm font-medium"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Newsletter Section */}
        <div className="py-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-foreground font-semibold mb-2">Stay Updated</h3>
              <p className="text-muted-foreground text-sm">
                Get the latest updates on new courses and tech trends
              </p>
            </div>
            <div className="flex w-full md:w-auto flex-nowrap">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 min-w-0 px-4 py-3 bg-background border border-border rounded-l-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-sm"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-cyan-500 text-white hover:bg-cyan-600 rounded-r-lg font-medium transition-all duration-300 flex-shrink-0 shadow-sm"
              >
                Subscribe
              </motion.button>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="py-6 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-muted-foreground text-sm text-center md:text-left">
              © 2025 CynexAI. All rights reserved. | Privacy Policy | Terms of Service
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <motion.button
        onClick={scrollToTop}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-4 right-4 z-50 bg-cyan-500 text-white p-3 rounded-full shadow-lg hover:bg-cyan-600 transition-colors duration-300"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    </footer>
  );
};

export default Footer;
