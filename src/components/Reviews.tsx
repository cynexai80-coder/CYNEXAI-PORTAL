import { useState, useEffect } from 'react';
import { motion, AnimatePresence, easeOut } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import TiltCard from './TiltCard';

const Reviews = () => {
  const [currentReview, setCurrentReview] = useState(0);
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const reviews = [
    {
      name: 'Anil Kumar',
      role: 'Java Developer at BeamX Techlab',
      course: 'Full Stack Java',
      rating: 5,
      text: 'CynexAI gave me the skills and confidence I needed to land my first job in tech. The trainers are industry experts and the placement support is truly effective.',
      image: 'gallery_images/WhatsApp%20Image%202025-07-28%20at%2016.47.23_9abc2e80.jpg?version%3D1755168647258',
    },
    {
      name: 'Suresh Kumar',
      role: 'Python Developer at Wexl Edu Pvt Ltd',
      course: 'Full Stack Python',
      rating: 5,
      text: 'From day one, the learning experience was smooth, practical, and job-focused. I highly recommend CynexAI to anyone serious about starting a tech career.',
      image: 'gallery_images/WhatsApp Image 2025-07-28 at 16.48.15_34734bc2.jpg',
    },
    {
      name: 'Y. Bhavana',
      role: 'Web Developer at Zuper Pvt Ltd',
      course: 'Web development',
      rating: 5,
      text: 'The Web Development course at CynexAI helped me build real websites from scratch. HTML, CSS, JavaScript, and React were taught in a very easy-to-understand way.',
      image: 'gallery_images/WhatsApp Image 2025-07-28 at 17.01.27_a8763108.jpg',
    },
    {
      name: 'K. Pullaiah',
      role: 'Software Tester at Persistent Systems',
      course: 'Testing (Manual + Automation)',
      rating: 5,
      text: 'CynexAI\'s software testing course gave me a strong foundation in both manual and automation testing. The real-time projects and Selenium sessions helped me get placed quickly.',
      image: 'gallery_images/WhatsApp Image 2025-07-28 at 17.17.45_290e8232.jpg',
    },
    {
      name: 'Chandrashekar',
      role: 'Software Tester at Paramount Software',
      course: 'Testing (Auto + Manual)',
      rating: 5,
      text: 'CynexAI\'s software testing course gave me a strong foundation in both manual and automation testing. The real-time projects and Selenium sessions helped me get placed quickly',
      image: 'gallery_images/WhatsApp Image 2025-07-30 at 13.53.04_4aea19f7.jpg',
    },
    {
      name: 'Sai Nath',
      role: 'Web Developer at Cognizent',
      course: 'Full Stack',
      rating: 5,
      text: 'CynexAI\'s software testing course gave me a strong foundation in both manual and automation testing. The real-time projects and Selenium sessions helped me get placed quickly',
      image: 'gallery_images/WhatsApp Image 2025-07-30 at 13.50.41_ed43fe99.jpg',
    },
  ];

  // Auto-slide functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % reviews.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [reviews.length]);

  const nextReview = () => {
    setCurrentReview((prev) => (prev + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentReview((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: easeOut,
      },
    },
  };

  return (
    <section id="reviews" className="py-24 relative overflow-hidden bg-background border-t border-border">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="text-center mb-16"
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-5xl font-display font-bold mb-6 text-foreground"
          >
            Student <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Success Stories</span>
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-lg text-muted-foreground max-w-3xl mx-auto"
          >
            Hear from our graduates who have transformed their careers and achieved their dreams
          </motion.p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="relative"
        >
          {/* Main Review Display */}
          <div className="relative max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentReview}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full"
              >
                <div className="bg-surface/80 backdrop-blur-md rounded-3xl p-8 md:p-12 border border-border shadow-sm hover:shadow-lg transition-all duration-500 w-full relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Profile Image */}
                    <div className="relative flex-shrink-0">
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-cyan-500/20 p-1 shadow-md bg-surface">
                        <img
                          src={reviews[currentReview].image}
                          alt={reviews[currentReview].name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = 'https://placehold.co/400x400/1C1C1C/white?text=User'; }}
                        />
                      </div>
                      <div className="absolute -top-2 -right-2 bg-cyan-500 rounded-full p-2 shadow-lg">
                        <Quote className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Review Content */}
                    <div className="flex-1 text-center md:text-left">
                      {/* Stars */}
                      <div className="flex justify-center md:justify-start mb-4">
                        {[...Array(reviews[currentReview].rating)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 text-yellow-400 fill-current drop-shadow-sm" />
                        ))}
                      </div>

                      {/* Review Text */}
                      <p className="text-lg md:text-xl text-foreground mb-6 leading-relaxed italic">
                        "{reviews[currentReview].text}"
                      </p>

                      {/* Reviewer Info */}
                      <div>
                        <h4 className="text-xl font-semibold text-foreground mb-1">
                          {reviews[currentReview].name}
                        </h4>
                        <p className="text-cyan-700 dark:text-cyan-400 font-medium mb-1">
                          {reviews[currentReview].role}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Graduate of {reviews[currentReview].course}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <button
              onClick={prevReview}
              aria-label="Previous review"
              className="absolute left-0 md:-left-6 top-1/2 transform -translate-y-1/2 bg-surface hover:bg-muted backdrop-blur-sm rounded-full p-3 border border-border shadow-sm transition-all duration-300 group z-10"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>

            <button
              onClick={nextReview}
              aria-label="Next review"
              className="absolute right-0 md:-right-6 top-1/2 transform -translate-y-1/2 bg-surface hover:bg-muted backdrop-blur-sm rounded-full p-3 border border-border shadow-sm transition-all duration-300 group z-10"
            >
              <ChevronRight className="w-6 h-6 text-foreground" />
            </button>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-8 space-x-3">
            {reviews.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentReview(index)}
                aria-label={`Go to review ${index + 1}`}
                aria-current={index === currentReview ? 'true' : undefined}
                // 24px hit area around a 12px dot (WCAG 2.5.8)
                className="group flex h-[24px] w-[24px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <span
                  aria-hidden="true"
                  className={`block h-3 w-3 rounded-full transition-all duration-300 ${index === currentReview
                    ? 'bg-cyan-500 scale-125'
                    : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'
                    }`}
                />
              </button>
            ))}
          </div>

          {/* All Reviews Grid (Hidden on Mobile) */}
          <div className="hidden lg:grid grid-cols-3 gap-6 mt-16">
            {reviews.map((review, index) => (
              <div
                key={index}
                onClick={() => setCurrentReview(index)}
                className={`cursor-pointer backdrop-blur-md rounded-xl p-5 border transition-all duration-300 shadow-sm hover:-translate-y-1 ${index === currentReview
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-md'
                  : 'bg-surface/50 border-border hover:border-cyan-500/30 hover:bg-surface'
                  }`}
              >
                <div className="flex items-center space-x-3 mb-3">
                  <img
                    src={review.image}
                    alt={review.name}
                    className="w-10 h-10 rounded-full object-cover border border-border"
                    onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = 'https://placehold.co/400x400/1C1C1C/white?text=User'; }}
                  />
                  <div>
                    <h5 className="text-sm font-bold text-foreground">{review.name}</h5>
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold">{review.role}</p>
                  </div>
                </div>
                <div className="flex mb-2">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 italic">"{review.text}"</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Reviews;
