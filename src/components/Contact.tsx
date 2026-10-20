import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Phone, Mail, Globe, MapPin, Clock, Users } from 'lucide-react';

const Contact = () => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    courseInterest: 'Select a course',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx3j2nwzJWA1_OpjGPwTRGMvJA8aboye9V9YPuMHnBflsVyAmKHCaa9benkaQ7KcUZuQ/exec';

  const contactInfo = [
    { icon: Phone, label: 'Phone', value: '+91 9966639869', href: 'tel:+919966639869' },
    { icon: Mail, label: 'Email', value: 'contact@Cynexai.in', href: 'mailto:contact@Cynexai.in' },
    { icon: Globe, label: 'Website', value: 'CynexAI.in', href: 'https://CynexAI.in' },
    { icon: MapPin, label: 'Location', value: 'KPHB Phase I, Kukatpally, Hyderabad', href: 'https://maps.app.goo.gl/cMq38RHfxHpgEDKn9' },
  ];

  const stats = [
    { icon: Users, value: '100+', label: 'Students Trained' },
    { icon: Clock, value: '24/7', label: 'Support Available' },
    { icon: Globe, value: '10+', label: 'Cities Reached' },
  ];

  const courses = [
    'Data Science with AI',
    'Artificial Intelligence & Generative AI',
    'Full Stack JAVA Development',
    'DevOps & Cloud Services',
    'Python Programming',
    'Testing(Manual + Automation)',
    'SAP(FICO, MM, SD, ABAP)'
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants: Variants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  const formFieldVariants: Variants = {
    hidden: { x: -30, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setStatusMessage('');

    const dataToSend = new FormData();
    dataToSend.append('fullName', formData.fullName);
    dataToSend.append('email', formData.email);
    dataToSend.append('phone', formData.phone);
    dataToSend.append('courseInterest', formData.courseInterest);
    dataToSend.append('message', formData.message);
    dataToSend.append('sheetName', 'Messages');

    if (!formData.fullName || !formData.email || !formData.message) {
      setSubmitStatus('error');
      setStatusMessage('Please fill out all required fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(SCRIPT_URL, { method: 'POST', body: dataToSend });
      if (response.ok) {
        setSubmitStatus('success');
        setStatusMessage('Your message has been sent successfully!');
        setFormData({ fullName: '', email: '', phone: '', courseInterest: 'Select a course', message: '' });
      } else {
        setSubmitStatus('error');
        setStatusMessage('Failed to send message. Please try again later.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
      setStatusMessage('An error occurred. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 relative bg-background overflow-hidden relative z-10 border-t border-border">

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-5xl font-display font-bold mb-4 text-foreground"
          >
            Get In <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Touch</span>
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ready to transform your career? Contact us today and take the first step towards your tech journey.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="space-y-12"
          >
            <div>
              <motion.h3 variants={itemVariants} className="text-2xl font-bold mb-6 text-foreground">
                Contact Information
              </motion.h3>
              <div className="space-y-4">
                {contactInfo.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.a
                      key={i}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variants={itemVariants}
                      whileHover={{ x: 5, scale: 1.01 }}
                      className="flex items-center space-x-4 p-5 bg-surface rounded-xl border border-border hover:border-cyan-500/50 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 flex-shrink-0"
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{item.label}</p>
                        <p className="font-bold text-foreground">{item.value}</p>
                      </div>
                    </motion.a>
                  );
                })}
              </div>
            </div>

            <div>
              <motion.h3 variants={itemVariants} className="text-2xl font-bold mb-6 text-foreground">
                Why Choose Us
              </motion.h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      whileHover={{ y: -5 }}
                      className="p-6 bg-surface rounded-xl border border-border text-center hover:border-cyan-500/30 hover:shadow-md transition-all duration-300 cursor-default shadow-sm"
                    >
                      <Icon className="w-8 h-8 text-cyan-500 mx-auto mb-3" />
                      <div className="text-2xl font-black text-foreground mb-1">{stat.value}</div>
                      <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="bg-surface/80 backdrop-blur-md rounded-2xl p-8 lg:p-10 border border-border hover:border-cyan-500/30 transition-all duration-300 shadow-sm"
          >
            <motion.h3 variants={itemVariants} className="text-2xl font-bold text-foreground mb-6">
              Send us a Message
            </motion.h3>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {[
                { label: 'Full Name', id: 'fullName', type: 'text', placeholder: 'John Doe', required: true },
                { label: 'Email', id: 'email', type: 'email', placeholder: 'john@example.com', required: true },
                { label: 'Phone', id: 'phone', type: 'tel', placeholder: '+91 9876543210', required: false },
              ].map((field, i) => (
                <motion.div key={field.id} variants={formFieldVariants}>
                  <label htmlFor={field.id} className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
                  <input
                    type={field.type}
                    id={field.id}
                    name={field.id}
                    value={formData[field.id as keyof typeof formData]}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all duration-300 hover:border-cyan-500/50 shadow-sm"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                </motion.div>
              ))}

              <motion.div variants={formFieldVariants}>
                <label htmlFor="courseInterest" className="block text-sm font-medium text-foreground mb-2">Course Interest</label>
                <select
                  id="courseInterest"
                  name="courseInterest"
                  value={formData.courseInterest}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-cyan-500 outline-none transition-all duration-300 hover:border-cyan-500/50 shadow-sm"
                >
                  {courses.map((course, index) => (
                    <option key={index} value={course}>{course}</option>
                  ))}
                </select>
              </motion.div>

              <motion.div variants={formFieldVariants}>
                <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-cyan-500 outline-none transition-all duration-300 hover:border-cyan-500/50 resize-none shadow-sm"
                  placeholder="Your message..."
                  required
                />
              </motion.div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                className={`w-full py-4 font-bold rounded-xl transition-all duration-300 shadow-sm ${isSubmitting
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-cyan-700 text-white hover:bg-cyan-800 hover:shadow-md'
                  }`}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </motion.button>
            </form>

            <AnimatePresence>
              {submitStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-6 p-4 rounded-xl text-center font-medium border ${submitStatus === 'success' 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                    }`}
                >
                  {statusMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
