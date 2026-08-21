import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Video,
  Globe,
  Clock,
  CalendarDays,
  Star,
  Package,
  CircleHelp,
  ChevronDown,
  ShoppingCart,
  Share2,
  Gift,
  CheckCircle2,
  Sparkles,
  Tag,
  ShieldCheck,
  Bot,
  MessageSquare,
  FileText,
  UserCheck,
  Check,
  Copy,
  ExternalLink
} from 'lucide-react';

// =========================================================================
// RAZORPAY CONFIGURATION
// You can paste your direct Razorpay Payment Link here or via .env
// Example: 'https://rzp.io/l/cynexai-prereg'
// =========================================================================
const RAZORPAY_PAYMENT_URL = import.meta.env.VITE_RAZORPAY_PRE_REG_URL || '';

export default function PreRegistrationPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState('');
  const [copied, setCopied] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for direct slot booking fallback
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    courseInterest: 'Data Science & AI'
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const basePrice = 2000;
  const discountAmount = appliedCoupon === 'LAST10' ? 200 : 0;
  const finalPrice = basePrice - discountAmount;

  const handleApplyCoupon = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();
    if (cleanCode === 'LAST10') {
      setAppliedCoupon('LAST10');
      setCouponError('');
    } else if (cleanCode === '') {
      setCouponError('Please enter a coupon code');
    } else {
      setCouponError('Invalid coupon code. Try LAST10');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pre Registration | CynexAI',
      text: 'Book your Slot now by paying token amount at CynexAI!',
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User dismissed share dialog
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleBuyNow = () => {
    if (RAZORPAY_PAYMENT_URL && RAZORPAY_PAYMENT_URL.trim() !== '') {
      window.open(RAZORPAY_PAYMENT_URL, '_blank');
    } else {
      // If Razorpay link not yet configured, open reservation modal
      setIsModalOpen(true);
    }
  };

  const handleAddToCart = () => {
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 3000);
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const faqs = [
    {
      question: 'Who is this course for?',
      answer: 'This course is designed for collecting token amount to book a slot'
    },
    {
      question: 'Do I need any prior experience?',
      answer: 'No prior experience is required. We start from the basics and progress step by step.'
    },
    {
      question: 'How long do I have access?',
      answer: 'You get lifetime access to the course content and future updates.'
    },
    {
      question: 'Will this be Refundable?',
      answer: 'No, Slot booking amount will not be refunded.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Breadcrumbs & Hero Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 pb-4 text-xs sm:text-sm text-slate-400">
          <Link to="/" className="hover:text-cyan-400 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <Link to="/#courses" className="hover:text-cyan-400 transition-colors">Courses</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-cyan-400 font-medium">Pre Registration</span>
        </div>

        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-[#0d1424] to-[#0a0f1d] p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl">
          
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Left Hero Details */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Early Bird Slot Booking
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                  Pre Registration
                </h1>
                <p className="mt-3 text-base sm:text-lg text-slate-300 font-normal">
                  Book your Slot now by Paying token amount
                </p>
              </div>

              {/* Meta Badges */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-200">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 shadow-sm">
                  <Video className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">Self-Paced</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 shadow-sm">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">English</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 shadow-sm">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">0</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 shadow-sm">
                  <CalendarDays className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">Access valid for 99999 days</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold">4.5</span>
                  <span className="text-slate-400 text-xs">(26,521 ratings)</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Banner */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950/40 p-6 shadow-2xl group hover:border-cyan-500/40 transition-all duration-300">
                <div className="aspect-[16/10] rounded-xl overflow-hidden relative flex flex-col justify-between p-6 bg-[#0a101d] border border-slate-800 shadow-inner">
                  
                  {/* Decorative High-Tech Grid & Glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

                  {/* Pass Header */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-black text-cyan-400 text-sm">
                        CX
                      </div>
                      <span className="font-bold text-sm tracking-wide text-white">CYNEX<span className="text-cyan-400">AI</span></span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                      TOKEN PASS
                    </span>
                  </div>

                  {/* Center Content */}
                  <div className="relative z-10 my-auto py-4">
                    <div className="text-xs uppercase tracking-widest text-cyan-400/90 font-semibold mb-1">
                      Official Slot Booking
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                      Pre-Registration
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Guaranteed Batch Seat + AI Career Suite
                    </div>
                  </div>

                  {/* Pass Footer */}
                  <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Instant AI Access</span>
                    <span className="text-cyan-300 font-mono font-bold">₹2,000</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Main Content Grid: Left Sections vs Right Sticky Purchase Panel */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Section: This Course Includes */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-lg">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-6">
                <Package className="w-5 h-5 text-cyan-400" />
                This Course Includes
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">AI Resume Builder</div>
                    <div className="text-xs text-slate-400">ATS-optimized instant generator</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">AI Mock Interviews</div>
                    <div className="text-xs text-slate-400">Voice & real-time adaptive feedback</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">AI Smart Chat</div>
                    <div className="text-xs text-slate-400">24/7 intelligent doubt resolver</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">with Lifetime access</div>
                    <div className="text-xs text-slate-400">Never expires, unlimited practice</div>
                  </div>
                </div>

              </div>
            </section>

            {/* Section: Description */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-lg text-left">
              <h2 className="text-xl font-bold text-white mb-6">Description</h2>
              
              <div className="space-y-4 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                <p className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-200">
                  This is For just Slot booking for a actual course in CynexAI, this helps you to block a seat with paying non-refundable token amount ,
                  <br /><strong className="text-white mt-1 block">With us you will get AI Resume Builder , AI Interview , AI Mock Interviews</strong>
                </p>

                <div className="font-bold text-white text-lg pt-2">
                  We cover everything you require!!!
                </div>

                <p>
                  By pre-registering, you&apos;ll not only guarantee your place but also unlock immediate access to our AI Resume Builder and AI Interviewer. These powerful tools will help you craft a compelling resume that highlights your unique skills and practice interview scenarios with intelligent, adaptive feedback. We will cover everything you need to make a powerful first impression and prepare you for the demands of modern hiring processes, ensuring you are job-ready.
                </p>

                <p>
                  This opportunity is ideal for ambitious professionals, recent graduates, and career changers who are serious about investing in their future and leveraging the latest technology to achieve their goals. If you&apos;re looking for a competitive edge and a streamlined path to career advancement with personalized AI support, this pre-registration is your first step. It&apos;s designed for those ready to take proactive measures in their career journey.
                </p>

                <p>
                  Upon successful pre-registration, you will have secured your seat and gained immediate access to our AI-powered career tools. This positions you perfectly to benefit from future course offerings and to immediately start refining your professional profile. Be ready to impress employers and navigate the job market with unprecedented confidence and technological support, ensuring you are prepared for whatever comes next.
                </p>
              </div>
            </section>

            {/* Section: FAQs */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-lg text-left">
              <div className="flex items-center gap-2.5 mb-6">
                <CircleHelp className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold text-white">Frequently Asked Questions</h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, index) => {
                  const isOpen = activeFaq === index;
                  return (
                    <div
                      key={index}
                      className="border border-slate-800 rounded-xl overflow-hidden bg-slate-800/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFaq(isOpen ? null : index)}
                        className="w-full flex items-center justify-between p-4 text-left font-medium text-slate-100 hover:text-cyan-400 transition-colors"
                      >
                        <span className="text-sm sm:text-base">{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${
                            isOpen ? 'rotate-180 text-cyan-400' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-900/40">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* Right Sticky Checkout Box (4 cols) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-[#0c1220] p-6 shadow-2xl backdrop-blur-md space-y-6 text-left">
              
              {/* Pricing Display */}
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Token Booking Fee
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-white">
                    ₹{finalPrice.toLocaleString('en-IN')}
                  </span>
                  {appliedCoupon && (
                    <span className="text-lg text-slate-500 line-through">
                      ₹{basePrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                {appliedCoupon && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Coupon {appliedCoupon} applied (₹200 saved!)
                  </div>
                )}
              </div>

              {/* Coupon Code Input Box */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  Have a Coupon Code?
                </label>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono font-bold text-sm text-emerald-300">{appliedCoupon}</span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter LAST10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors uppercase"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {couponError && (
                  <div className="text-xs text-red-400 mt-1.5">
                    {couponError}
                  </div>
                )}

                {!appliedCoupon && (
                  <div className="mt-2 text-[11px] text-slate-400">
                    💡 Tip: Use coupon code <strong className="text-cyan-400 cursor-pointer" onClick={() => { setCouponCode('LAST10'); setAppliedCoupon('LAST10'); }}>LAST10</strong> for instant ₹200 off!
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                
                {/* Buy Now Button */}
                <button
                  onClick={handleBuyNow}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Buy Now
                </button>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  {cartAdded ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Added to Cart!</span>
                    </>
                  ) : (
                    'Add to Cart'
                  )}
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Course</span>
                    </>
                  )}
                </button>
              </div>

              {/* Instant Access Banner */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Gift className="w-4 h-4 text-cyan-400" />
                <span>Get Instant Access after registration</span>
              </div>

              {/* Trust Badges */}
              <div className="pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SSL 256-Bit Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Instant Activation</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Direct Slot Booking / Lead Modal (Fallback when direct Razorpay URL is being configured) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl text-left">
            
            <button
              onClick={() => { setIsModalOpen(false); setFormSubmitted(false); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            {formSubmitted ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Slot Reserved!</h3>
                <p className="text-sm text-slate-300">
                  Thank you, <strong className="text-white">{leadForm.name}</strong>. Our admissions counselor will contact you via WhatsApp/Call at <strong className="text-cyan-400">{leadForm.phone}</strong> with the instant Razorpay payment link for ₹{finalPrice}.
                </p>
                <button
                  onClick={() => { setIsModalOpen(false); setFormSubmitted(false); }}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    CynexAI Slot Pre-Registration
                  </div>
                  <h3 className="text-xl font-black text-white">Complete Slot Booking</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Total token amount: <strong className="text-cyan-300">₹{finalPrice}</strong> {appliedCoupon && `(Coupon ${appliedCoupon} applied)`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@gmail.com"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Course Interest</label>
                  <select
                    value={leadForm.courseInterest}
                    onChange={(e) => setLeadForm({ ...leadForm, courseInterest: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Full Stack Development">Full Stack Web Development</option>
                    <option value="Cloud & DevOps">Cloud & DevOps</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Cyber Security">Cyber Security</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:opacity-95"
                >
                  Confirm & Book Slot (₹{finalPrice})
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
