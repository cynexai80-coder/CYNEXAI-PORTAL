import { motion, easeOut } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Users, Star } from 'lucide-react';

const Courses = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const courses = [
    {
      id: 'data-science-machine-learning',
      title: 'Data Science & Machine Learning',
      description: 'Master data analysis, machine learning algorithms, and AI implementation for real-world applications.',
      image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '6 months',
      students: '150+',
      rating: 4.9,
      level: 'Intermediate',
      skills: ['Python', 'TensorFlow', 'Pandas', 'Scikit-learn']
    },
    {
      id: 'artificial-intelligence-generative-ai',
      title: 'Artificial Intelligence & Generative AI',
      description: 'Deep dive into ML algorithms, neural networks, and advanced generative modeling techniques.',
      image: 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '6 months',
      students: '200+',
      rating: 4.8,
      level: 'Advanced',
      skills: ['Python', 'PyTorch', 'Keras', 'Transformers']
    },
    {
      id: 'full-stack-java-development',
      title: 'Full Stack Java Development',
      description: 'Build robust web applications from frontend to backend using Java frameworks like Spring Boot.',
      image: '/java.png',
      duration: '6 months',
      students: '120+',
      rating: 4.7,
      level: 'Intermediate',
      skills: ['Java', 'Spring Boot', 'React/Angular', 'SQL']
    },
    {
      id: 'devops-cloud-technologies',
      title: 'DevOps & Cloud Technologies',
      description: 'Learn cloud infrastructure, CI/CD pipelines, and deployment strategies on AWS, Azure, or GCP.',
      image: '/Devops.png',
      duration: '6 months',
      students: '180+',
      rating: 4.8,
      level: 'Intermediate',
      skills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins']
    },
    {
      id: 'python-programming',
      title: 'Python Programming',
      description: 'Master Python fundamentals for data analysis, web development, and automation.',
      image: 'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '6 months',
      students: '250+',
      rating: 4.7,
      level: 'Beginner',
      skills: ['Python', 'OOP', 'Data Structures', 'Flask/Django']
    },
    {
      id: 'software-testing-manual-automation',
      title: 'Software Testing (Manual + Automation)',
      description: 'Master software testing methodologies, automation frameworks, and quality assurance for robust applications.',
      image: 'https://images.pexels.com/photos/1181263/pexels-photo-1181263.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '6 months',
      students: '140+',
      rating: 4.5,
      level: 'Intermediate',
      skills: ['Selenium', 'Jest', 'Cypress', 'API Testing']
    },
    {
      id: 'sap-data-processing',
      title: 'SAP (Systems, Applications, and Products in Data Processing)',
      description: 'Enterprise resource planning with SAP modules, business process optimization, and implementation strategies.',
      image: 'https://images.pexels.com/photos/1181316/pexels-photo-1181316.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '6 months',
      students: '90+',
      rating: 4.6,
      level: 'Professional',
      skills: ['SAP HANA', 'ABAP', 'Fiori', 'S/4HANA']
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0, scale: 0.98 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: easeOut }
    }
  };

  return (
    <section id="courses" className="py-24 bg-background transition-colors duration-500 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2 variants={itemVariants} className="text-3xl md:text-5xl font-display font-bold mb-6 text-foreground">
              Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Courses</span>
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-muted-foreground">
              Industry-aligned curriculum designed to make you job-ready from day one.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
              <motion.div key={course.id} variants={itemVariants} className="h-full">
                <div
                  className="w-full h-full bg-surface rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl hover:border-cyan-500/30 transition-all duration-300 flex flex-col group"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-cyan-800 dark:text-cyan-400 border border-border shadow-sm">
                      {course.level}
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-cyan-500" />
                        {course.duration}
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1 text-cyan-500" />
                        {course.students}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-3 line-clamp-2">{course.title}</h3>
                    <p className="text-muted-foreground text-sm mb-6 line-clamp-3 flex-1">{course.description}</p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {course.skills.map(skill => (
                        <span key={skill} className="px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-md border border-border/50">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center">
                        <Star className="w-5 h-5 text-yellow-400 fill-current" />
                        <span className="ml-1 font-bold text-foreground">{course.rating}</span>
                      </div>
                      
                      <Link 
                        to={`/course/${course.id}`}
                        className="text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 font-semibold flex items-center min-h-[24px] py-1 text-sm transition-colors"
                      >
                        Learn More <ArrowRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Courses;
