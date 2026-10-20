
import { motion, Variants } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Code,
  Brain,
  Rocket,
} from 'lucide-react';
import TiltCard from './TiltCard';

import studentsIcon from '../assets/students.png';
import jobPlacementIcon from '../assets/job-placement.png';
import partnersIcon from '../assets/partners.png';

const Hero = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  const itemVariants: Variants = {
    hidden: { y: 60, opacity: 0, rotateX: 20 },
    visible: {
      y: 0,
      opacity: 1,
      rotateX: 0,
      transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 transition-colors duration-500 bg-background">

      {/* Glowing blobs - Using standard cyan and purple instead of hardcoded hex */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-float animation-delay-4000" />
      </div>

      {/* Floating Icons */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <Code className="absolute top-1/4 left-1/4 text-cyan-500/20 w-8 h-8 animate-float animation-delay-1000" />
        <Brain className="absolute top-1/3 right-1/4 text-cyan-500/20 w-10 h-10 animate-float animation-delay-3000" />
        <Rocket className="absolute bottom-1/3 left-1/3 text-cyan-500/20 w-6 h-6 animate-float animation-delay-5000" />
        <Sparkles className="absolute bottom-1/4 right-1/3 text-cyan-500/20 w-7 h-7 animate-float animation-delay-2000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-sm font-semibold tracking-wide mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Transform Your Tech Career
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold mb-6 text-foreground tracking-tight"
          >
            Master the Future of
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Technology</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Join our cutting-edge programs and unlock your potential in AI, Machine Learning,
            and emerging technologies. Learn from industry experts and build the skills that matter.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                to="/#courses"
                className="group bg-cyan-700 hover:bg-cyan-800 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-cyan-500/25 transition-all duration-300 flex items-center"
              >
                Explore Courses
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Clean Stat Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            {[
              { number: '500+', label: 'Students Trained', icon: studentsIcon, alt: 'Students icon' },
              { number: '95%', label: 'Job Placement Rate', icon: jobPlacementIcon, alt: 'Target icon' },
              { number: '50+', label: 'Industry Partners', icon: partnersIcon, alt: 'Handshake icon' },
            ].map((stat, index) => (
              <div
                key={index}
                className="bg-surface/80 backdrop-blur-md rounded-2xl p-8 border border-border shadow-sm hover:shadow-md hover:border-cyan-500/30 transition-all duration-300 group flex flex-col justify-center items-center"
              >
                <div className="mb-4 p-3 bg-cyan-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <img src={stat.icon} alt={stat.alt} className="w-8 h-8 opacity-80" style={{ filter: 'brightness(0) saturate(100%) invert(56%) sepia(87%) saturate(2255%) hue-rotate(151deg) brightness(101%) contrast(93%)' }} />
                </div>
                <div className="text-4xl font-black text-foreground mb-2">{stat.number}</div>
                <div className="text-muted-foreground font-medium text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
