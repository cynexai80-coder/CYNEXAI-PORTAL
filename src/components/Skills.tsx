import { motion, Variants } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Brain, Lightbulb, Users, Target } from 'lucide-react';
import './Skills.css';
import TiltCard from './TiltCard';

const Skills = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const skills = [
    {
      icon: Brain,
      title: 'Critical Thinking',
      description: 'Develop analytical skills to solve complex problems and make data-driven decisions in technology.',
      color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    },
    {
      icon: Target,
      title: 'Problem Solving',
      description: 'Master systematic approaches to identify, analyze, and resolve technical challenges efficiently.',
      color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    },
    {
      icon: Lightbulb,
      title: 'Creative Thinking',
      description: 'Foster innovation and creativity to develop unique solutions and breakthrough technologies.',
      color: 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-500/20',
    },
    {
      icon: Users,
      title: 'Interpersonal Skills',
      description: 'Build strong communication and collaboration skills essential for team success in tech.',
      color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.18 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  const headerVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: 'easeOut' } },
  };

  return (
    <section id="skills" className="py-24 relative bg-background overflow-hidden relative z-10 border-t border-border">
      {/* Background glow elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          ref={ref}
          variants={headerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Essential <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Skills</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Beyond technical expertise, we develop the core skills that make you a well-rounded technology professional
          </p>
        </motion.div>

        {/* Skill Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {skills.map((skill, index) => {
            const IconComponent = skill.icon;
            return (
              <motion.div key={index} variants={itemVariants} className="h-full">
                <div className="bg-surface/80 backdrop-blur-md rounded-2xl p-8 border border-border hover:border-cyan-500/30 transition-all duration-300 shadow-sm hover:shadow-md text-center h-full flex flex-col items-center">
                  
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${skill.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="w-8 h-8" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {skill.title}
                  </h3>

                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                    {skill.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Why These Skills Matter */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="mt-20 text-center"
        >
          <div className="bg-surface rounded-3xl p-8 md:p-12 border border-border shadow-sm">
            <h3 className="text-2xl md:text-3xl font-extrabold text-foreground mb-8 border-b border-border pb-4">
              Why These Skills Matter
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
              <div className="flex flex-col space-y-3">
                <h4 className="text-xl font-bold flex items-center text-cyan-700 dark:text-cyan-400">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mr-3 border border-cyan-500/20 text-lg">💼</span>
                  In the Workplace
                </h4>
                <p className="text-muted-foreground text-md leading-relaxed">
                  These soft skills complement your technical abilities, making you a valuable team member
                  who can communicate effectively, solve problems creatively, and adapt to changing requirements.
                </p>
              </div>
              <div className="flex flex-col space-y-3">
                <h4 className="text-xl font-bold flex items-center text-purple-600 dark:text-purple-400">
                  <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mr-3 border border-purple-500/20 text-lg">🚀</span>
                  For Career Growth
                </h4>
                <p className="text-muted-foreground text-md leading-relaxed">
                  Leadership positions require more than technical knowledge. These skills prepare you
                  for management roles and help you become a well-rounded technology professional.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Skills;
