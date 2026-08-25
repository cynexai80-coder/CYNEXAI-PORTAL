import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, User, Phone, Mail, Calendar, School, BookOpen, CheckCircle2, AlertCircle, Monitor, MapPin, CreditCard } from 'lucide-react';
import { openRazorpayCheckout } from '../lib/razorpay';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxYUOSw5Ca8CRwVj1Nu8KfnzOzwI01fjoz058y4mQWWzuO29It1CAll_oUJ7_sWdu0/exec';

export default function EnrollPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    college: '',
    batch: '',
    dob: '',
    course: '',
    mode: '' // Online or Offline
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const submitToSheets = async (data: typeof formData) => {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.mode) {
      setError('Please select a learning mode (Online or Offline).');
      return;
    }
    if (!formData.course) {
      setError('Please select a course.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Step 1: Submit to Google Sheets first
      await submitToSheets(formData);

      // Step 2: Open Razorpay for ₹500 enrollment fee
      openRazorpayCheckout({
        amount: 500,
        name: 'CynexAI Enrollment Fee',
        description: `${formData.course} — ${formData.mode} Mode`,
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone
        },
        notes: {
          course: formData.course,
          mode: formData.mode,
          college: formData.college,
          batch: formData.batch
        },
        receipt: `enroll_${Date.now()}`,
        onSuccess: () => {
          setSuccess(true);
          setFormData({ name: '', phone: '', email: '', college: '', batch: '', dob: '', course: '', mode: '' });
          setIsSubmitting(false);
        },
        onError: (err) => {
          setError(`Payment failed: ${err.description || 'Please try again.'}`);
          setIsSubmitting(false);
        },
        onDismiss: () => {
          // Sheets already submitted; just let user know
          setError('Payment was not completed. Your details were saved — you can retry payment anytime.');
          setIsSubmitting(false);
        }
      });

    } catch (err: any) {
      console.error('Enrollment error', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-900/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-black rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">Enrollment Successful!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-2">Your payment of <strong>₹500</strong> was received.</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mb-8">Thank you for enrolling with CynexAI. Our team will get back to you shortly with onboarding details.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-900/50 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full bg-white dark:bg-black rounded-3xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white font-display mb-2">Join CynexAI</h1>
            <p className="text-slate-300 text-sm max-w-sm mx-auto">Fill in your details and pay ₹500 enrollment fee to confirm your seat.</p>
          </div>
        </div>

        {/* Fee Banner */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 px-8 py-3 flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-800 dark:text-emerald-300 text-sm font-medium">
            Enrollment Fee: <span className="font-bold">₹500</span> — paid securely via Razorpay after form submission.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Full Name *</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Phone Number *</label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="johndoe@example.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">College Name</label>
              <div className="relative">
                <School className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  name="college"
                  value={formData.college}
                  onChange={handleChange}
                  placeholder="University Name"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Current Batch (Year)</label>
              <div className="relative">
                <BookOpen className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  name="batch"
                  value={formData.batch}
                  onChange={handleChange}
                  placeholder="e.g. 2024"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Date of Birth</label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Course Dropdown */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Interested Course *</label>
              <div className="relative">
                <GraduationCap className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                <select
                  name="course"
                  required
                  value={formData.course}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white appearance-none"
                >
                  <option value="" disabled>Select a course</option>
                  <option value="Testing">Testing</option>
                  <option value="Full stack Java">Full stack Java</option>
                  <option value="Full Stack Python">Full Stack Python</option>
                  <option value="AI & Generative AI">AI & Generative AI</option>
                  <option value="Data Science with AI">Data Science with AI</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Data Analytics">Data Analytics</option>
                  <option value="SAP">SAP</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Mode Dropdown */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">Learning Mode *</label>
              <div className="relative">
                {formData.mode === 'Offline' ? (
                  <MapPin className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                ) : (
                  <Monitor className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                )}
                <select
                  name="mode"
                  required
                  value={formData.mode}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-slate-900 dark:text-white appearance-none"
                >
                  <option value="" disabled>Select mode</option>
                  <option value="Online">🖥️ Online</option>
                  <option value="Offline">📍 Offline</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Info Badge */}
          {formData.mode && (
            <div className={`flex items-center gap-3 p-3 rounded-xl text-sm ${formData.mode === 'Online' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'}`}>
              {formData.mode === 'Online' ? (
                <><Monitor className="w-4 h-4 flex-shrink-0" /><span>Online mode: Live classes via Zoom/Meet with recordings & AI tools access.</span></>
              ) : (
                <><MapPin className="w-4 h-4 flex-shrink-0" /><span>Offline mode: In-person sessions at our Hyderabad center with hands-on labs.</span></>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-slate-900/10"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving & Opening Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Enroll Now — Pay ₹500
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">Your details are saved to Google Sheets, then payment of ₹500 opens securely via Razorpay.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
