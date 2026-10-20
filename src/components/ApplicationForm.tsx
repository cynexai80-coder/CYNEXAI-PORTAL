import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, User, Mail, Phone, Briefcase, XCircle } from 'lucide-react';

const ApplicationForm = () => {
  const { courseId } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'student'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [applicationId, setApplicationId] = useState(''); // New state for the application ID

  // This object maps the URL courseId to the full course name.
  const courseNames = {
    'data-science-machine-learning': 'Data Science & Machine Learning',
    'artificial-intelligence-generative-ai': 'Artificial Intelligence & Generative AI',
    'full-stack-java-development': 'Full-Stack Java Development',
    'devops-cloud-technologies': 'DevOps & Cloud Technologies',
    'python-programming': 'Python Programming',
    'software-testing-manual-automation': 'Software Testing (Manual & Automation)',
    'sap-data-processing': 'SAP Data Processing'
  };

  const courseName = courseNames[courseId as keyof typeof courseNames] || 'Unknown Course';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Generate a unique application ID
    const newId = `CX-${Date.now().toString().slice(-6)}`;
    setApplicationId(newId);

    // IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL.
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw8QvbW81vI54G6BqfR_B8dhJ8YE3KfINn4ztIs1kikfsjE0YmWA7W58SgTaRVkdbifWQ/exec';

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          applicationId: newId, // Include the new application ID
          ...formData,
          courseId,
          courseName,
        }),
      });

      setIsSubmitted(true);
      console.log('Application data sent to Google Apps Script successfully.');
    } catch (err) {
      console.error('Failed to submit application:', err);
      setError('Failed to submit application. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-transparent">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto px-4"
        >
          <div className="bg-background/40 backdrop-blur-xl text-secondary rounded-2xl p-8 border border-[#41c8df]/30 shadow-[0_0_30px_rgba(65,200,223,0.15)] text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-[#41c8df] rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-8 h-8 text-secondary" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-4">Thank You for Applying!</h1>
            <p className="text-secondary/80 mb-6">
              Your application for <span className="text-[#41c8df] font-medium">{courseName}</span> has been submitted successfully. Our team will review your application and contact you within 24-48 hours.
            </p>
            <div className="space-y-3 mb-8 text-secondary/80">
              <div className="flex items-center justify-between text-sm">
                <span>Application ID:</span>
                <span className="font-mono">{applicationId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Course:</span>
                <span>{courseName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Link
                to="/"
                className="w-full bg-[#41c8df] text-[#010203] py-3 px-4 rounded-lg font-medium block text-center hover:bg-[#c09a2f] transition-colors duration-300"
              >
                Back to Home
              </Link>
              <Link
                to={`/course/${courseId}`}
                className="w-full border-2 border-[#41c8df] text-secondary py-3 px-4 rounded-lg font-medium block text-center hover:bg-[#41c8df]/10 transition-colors duration-300"
              >
                View Course Details
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-transparent">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to={`/course/${courseId}`}
            className="inline-flex items-center min-h-[24px] text-[#41c8df] hover:text-secondary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Link>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary mb-4">
            Apply for <span className="text-[#41c8df]">{courseName}</span>
          </h1>
          <p className="text-gray-300 text-lg">
            Take the first step towards transforming your career. Fill out the form below and our team will get in touch with you.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-background/40 backdrop-blur-xl text-secondary rounded-2xl p-8 border border-[#41c8df]/30 shadow-[0_0_40px_rgba(65,200,223,0.1)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <User className="w-4 h-4 inline mr-2" /> Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-secondary/5 border border-secondary/10 rounded-lg text-secondary placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#41c8df]/50 transition-colors duration-300"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <Mail className="w-4 h-4 inline mr-2" /> Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-secondary/5 border border-secondary/10 rounded-lg text-secondary placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#41c8df]/50 transition-colors duration-300"
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <Phone className="w-4 h-4 inline mr-2" /> Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-secondary/5 border border-secondary/10 rounded-lg text-secondary placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#41c8df]/50 transition-colors duration-300"
                placeholder="Enter your phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <Briefcase className="w-4 h-4 inline mr-2" /> Current Status *
              </label>
              <select
                name="type"
                title="Current Status"
                value={formData.type}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-secondary/5 border border-secondary/10 rounded-lg text-secondary focus:outline-none focus:ring-2 focus:ring-[#41c8df]/50 transition-colors duration-300"
              >
                <option value="student" className="bg-gray-900">Student</option>
                <option value="employed" className="bg-gray-900">Employed</option>
              </select>
            </div>
            <div className="bg-[#41c8df]/10 border border-[#41c8df]/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-secondary mb-2">Course Details</h3>
              <p className="text-[#41c8df] font-medium">{courseName}</p>
              <p className="text-gray-300 text-sm mt-1">
                You are applying for this course. Our team will provide you with detailed information about the curriculum, schedule, and fees.
              </p>
            </div>
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading || error ? 1 : 1.02 }}
              whileTap={{ scale: isLoading || error ? 1 : 0.98 }}
              className={`w-full py-4 px-6 rounded-lg font-semibold transition-colors duration-300 ${isLoading
                ? 'bg-[#CCCCCC] cursor-not-allowed'
                : 'bg-[#41c8df] text-[#010203] hover:bg-[#c09a2f]'
                }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#010203]/30 border-t-[#010203] rounded-full animate-spin mr-2"></div>
                  Submitting Application...
                </div>
              ) : (
                'Apply Now'
              )}
            </motion.button>
            {error && (
              <div className="mt-4 p-4 flex items-center bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-white rounded-lg border border-red-200">
                <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
          <div className="mt-8 p-4 bg-secondary/5 rounded-lg border border-secondary/10">
            <h4 className="text-secondary font-medium mb-2">What happens next?</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Our team will review your application within 24-48 hours</li>
              <li>• You'll receive a call to discuss the course details and your goals</li>
              <li>• We'll provide information about batch schedules and payment options</li>
              <li>• Upon confirmation, you'll receive access to our learning platform</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ApplicationForm;
