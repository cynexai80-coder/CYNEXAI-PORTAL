
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

// Written by the SEO crawl: what each photo shows, for image search and screen readers.
const SEO_IMAGE_ALT: Record<string, string> = {
  "/gallery_images/cynexAiimage.1.jpeg": "A CynexAI placement graphic showing three people standing together celebrating Swathi K's job offer.",
  "/gallery_images/cynexAi.2.jpeg": "Two men hold an offer letter inside an office under a MANAGER sign on a CynexAI graphic for Sai Nath.",
  "/gallery_images/cynexAi.3.jpeg": "A CynexAI job placement card featuring a headshot portrait of K. Pullaiah and his student testimonial.",
  "/gallery_images/6.png": "A CynexAI job placement card featuring a portrait of Chandrashekar and text details of his new job.",
  "/gallery_images/7.png": "A CynexAI graphic showcasing a portrait of Sai Nath alongside details of his placement at Cognizant.",
};

// IMPORTANT: The images from your request have been added here.
// These paths assume the images are located in the `public/gallery_images` folder.
const galleryImages = [
  '/gallery_images/cynexAiimage.1.jpeg',
  '/gallery_images/cynexAi.2.jpeg',
  '/gallery_images/cynexAi.3.jpeg',
  '/gallery_images/6.png',
  '/gallery_images/7.png',
  // Add more image paths as needed
];

const GalleryPage = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  // Variants for framer-motion animations
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        when: "beforeChildren",
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    // Main container with a transparent background to show the 3D scene
    <div className="min-h-screen bg-transparent text-gray-100 pt-16 pb-10">
      <section className="relative py-12 md:py-16">
        <div className="container mx-auto px-4 relative z-10">
          {/* Back button to return to the home page */}
          <Link to="/" className="inline-flex items-center px-4 py-2 bg-background/20 hover:bg-background/40 backdrop-blur-md border border-secondary/10 rounded-full text-[#41c8df] hover:text-secondary transition-all duration-300 mb-8 shadow-lg">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
          </Link>

          {/* Page header section with animations */}
          <motion.div
            ref={ref}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={containerVariants}
            className="text-center"
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl font-display font-bold text-secondary mb-4 drop-shadow-[0_0_15px_rgba(65,200,223,0.3)]"
            >
              Our Photo Gallery
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-gray-300 mb-10 max-w-2xl mx-auto text-lg"
            >
              Explore moments from our classes, events, and student life.
            </motion.p>
          </motion.div>

          {/* Gallery centered layout */}
          <div className="flex flex-wrap justify-center items-start gap-6 max-w-6xl mx-auto">
            {galleryImages.map((imageSrc, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -5 }}
                className="relative overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-secondary/10 group cursor-pointer w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]"
              >
                <img
                  src={imageSrc}
                  alt={SEO_IMAGE_ALT[imageSrc] ?? `Gallery Image ${index + 1}`}
                  className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-background/40 group-hover:bg-background/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ImageIcon className="w-10 h-10 text-secondary" />
                </div>
              </motion.div>
            ))}
          </div>
          {/* End Gallery Grid */}

          <motion.p
            variants={itemVariants}
            className="text-gray-400 mt-12 text-sm text-center font-medium tracking-wide"
          >
            (More photos coming soon!)
          </motion.p>
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;


























































































