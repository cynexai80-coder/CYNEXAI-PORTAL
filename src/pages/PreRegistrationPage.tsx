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
  Percent,
  Zap,
  ArrowRight
} from 'lucide-react';
import { openRazorpayCheckout } from '../lib/razorpay';

interface Coupon {
  code: string;
  discount: number;
  description: string;
  badge: string;
}

const AVAILABLE_COUPONS: Coupon[] = [
  {
    code: 'SAVE25',
    discount: 500,
    description: 'Get 25% OFF — Save ₹500 on your token booking',
    badge: 'POPULAR'
  },
  {
    code: 'CYNEX50',
    discount: 1000,
    description: 'Get 50% OFF — Save ₹1000 Early Bird Offer',
    badge: 'SUPER SAVER'
  },
  {
    code: 'LAUNCH70',
    discount: 1400,
    description: 'Get 70% OFF — Save ₹1400 Limited Launch Offer',
    badge: 'LIMITED'
  }
];

export default function PreRegistrationPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccessMessage, setCouponSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  const [showCouponsList, setShowCouponsList] = useState(true);

  // Form state for slot booking customer details
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    courseInterest: 'Data Science & AI'
  });

  const basePrice = 2000;
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalPrice = Math.max(basePrice - discountAmount, 100);

  const applyCouponCode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    const found = AVAILABLE_COUPONS.find(c => c.code === cleanCode);

    if (found) {
      setAppliedCoupon(found);
      setCouponCode(found.code);
      setCouponError('');
      setCouponSuccessMessage(`Awesome! Coupon '${found.code}' applied. You saved ₹${found.discount}!`);
      setTimeout(() => setCouponSuccessMessage(''), 4000);
    } else if (cleanCode === '') {
      setCouponError('Please enter a coupon code');
    } else {
      setCouponError(`Invalid coupon code '${cleanCode}'. Try SAVE25, CYNEX50 or LAUNCH70`);
    }
  };

  const handleApplyCouponForm = (e: React.FormEvent) => {
    e.preventDefault();
    applyCouponCode(couponCode);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setCouponSuccessMessage('');
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
        // Dismissed share
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const triggerRazorpayPayment = async (customerDetails?: { name: string; email: string; phone: string }) => {
    setIsProcessingPayment(true);

    const name = customerDetails?.name || leadForm.name || 'Candidate';
    const email = customerDetails?.email || leadForm.email || 'candidate@cynexai.in';
    const phone = customerDetails?.phone || leadForm.phone || '9999999999';

    await openRazorpayCheckout({
      amount: finalPrice,
      name: 'CynexAI',
      description: `Course Pre-Registration & Token Booking ${appliedCoupon ? `(Coupon: ${appliedCoupon.code})` : ''}`,
      customer: {
        name,
        email,
        contact: phone
      },
      notes: {
        course: leadForm.courseInterest || 'Pre-Registration',
        coupon: appliedCoupon ? appliedCoupon.code : 'NONE',
        type: 'Token Slot Booking',
        original_amount: basePrice,
        discount_amount: discountAmount,
        final_amount: finalPrice
      },
      onSuccess: (result) => {
        setIsProcessingPayment(false);
        setPaymentSuccessData(result);
        setIsModalOpen(true);
      },
      onError: (err) => {
        setIsProcessingPayment(false);
        alert(err.description || 'Payment could not be completed. Please try again.');
      },
      onDismiss: () => {
        setIsProcessingPayment(false);
      }
    });
  };

  const handleBuyNow = () => {
    setIsModalOpen(true);
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerRazorpayPayment(leadForm);
  };

  const handleAddToCart = () => {
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 3000);
  };

  const faqs = [
    {
      question: 'Who is this course for?',
      answer: 'This course is designed for collecting token amount to book a slot for the CynexAI professional training program.'
    },
    {
      question: 'Do I need any prior experience?',
      answer: 'No prior experience is required. We start from the basics and progress step by step.'
    },
    {
      question: 'How long do I have access?',
      answer: 'You get lifetime access to the course content, AI tools, and future curriculum updates.'
    },
    {
      question: 'Will this be Refundable?',
      answer: 'No, Slot booking token amount will not be refunded as it immediately grants access to AI preparation tools and locks your batch seat.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      
      {/* Top Breadcrumbs & Hero Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
          <Link to="/" className="hover:text-cyan-600 transition-colors">Home</Link>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <Link to="/courses" className="hover:text-cyan-600 transition-colors">Courses</Link>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-slate-900 font-semibold">Pre Registration</span>
        </nav>

        {/* Hero Card Section */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 lg:p-10 shadow-sm flex flex-col-reverse lg:flex-row items-center gap-8 lg:gap-12">
          
          {/* Left Text Content */}
          <div className="w-full lg:w-1/2 space-y-5 text-left">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Official Token Reservation
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Pre Registration
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
              Book your Slot now by Paying token amount and unlock instant lifetime access to CynexAI tools.
            </p>

            {/* Badges List */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 text-xs font-medium text-slate-700">
              
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <Video className="w-4 h-4 text-cyan-600" />
                <span>Self-Paced</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <Globe className="w-4 h-4 text-cyan-600" />
                <span>English</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <Clock className="w-4 h-4 text-cyan-600" />
                <span>0 Duration</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <CalendarDays className="w-4 h-4 text-cyan-600" />
                <span>Access valid for 99999 days</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>4.5</span>
                <span className="text-slate-500 font-normal">(26,521 ratings)</span>
              </div>

            </div>

          </div>

          {/* Right Hero Graphic Card */}
          <div className="w-full lg:w-1/2">
            <div className="relative w-full aspect-video sm:aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-700 p-6 flex flex-col justify-between shadow-xl text-white">
              
              {/* Top Card Badge */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white text-sm">
                    CX
                  </div>
                  <span className="font-bold tracking-wider text-sm uppercase">CynexAI Portal</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider">
                  Early Bird Token
                </span>
              </div>

              {/* Center Pass Identity */}
              <div className="my-auto py-4">
                <p className="text-xs text-cyan-100 uppercase tracking-widest font-semibold">Guaranteed Seat Access</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  PRE-REGISTRATION PASS
                </h3>
                <div className="flex items-center gap-3 mt-3">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-400 text-slate-950 text-xs font-black">
                    LIFETIME VALIDITY
                  </span>
                  <span className="text-xs text-cyan-100">
                    Instant AI Tools Unlocked
                  </span>
                </div>
              </div>

              {/* Bottom Card Strip */}
              <div className="pt-3 border-t border-white/20 flex justify-between items-center text-xs text-cyan-100 font-mono">
                <span>PASS ID: #CX-2026-TOKEN</span>
                <div className="flex items-center gap-1.5 font-sans font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Verified Admission</span>
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* Main Content Grid: Left Content (2/3) + Right Sticky Card (1/3) */}
        <div className="mt-10 flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column */}
          <div className="flex-1 w-full space-y-8 text-left">
            
            {/* 1. This Course Includes Section */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5 mb-6">
                <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <Package className="w-5 h-5" />
                </div>
                <span>This Course Includes</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-cyan-300 transition-colors">
                  <div className="h-11 w-11 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">AI Resume Builder</span>
                    <span className="text-xs text-slate-500">ATS-optimized instant generator</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-cyan-300 transition-colors">
                  <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">AI Mock Interviews</span>
                    <span className="text-xs text-slate-500">Voice & real-time adaptive feedback</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-cyan-300 transition-colors">
                  <div className="h-11 w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">AI Smart Chat</span>
                    <span className="text-xs text-slate-500">24/7 intelligent doubt resolver</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-cyan-300 transition-colors">
                  <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">with Lifetime access</span>
                    <span className="text-xs text-slate-500">Never expires, unlimited practice</span>
                  </div>
                </div>

              </div>
            </section>

            {/* 2. Description Section */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">
                Description
              </h2>

              <div className="text-sm text-slate-600 leading-relaxed space-y-4">
                <p>
                  This is for slot booking for an actual course in CynexAI. This helps you to block a seat by paying a non-refundable token amount.
                </p>
                <p className="font-semibold text-slate-800">
                  With us you will get AI Resume Builder, AI Interview, AI Mock Interviews. We cover everything you require!
                </p>
                <p>
                  By pre-registering, you will not only guarantee your place but also unlock immediate access to our AI Resume Builder and AI Interviewer. These powerful tools will help you craft a compelling resume that highlights your unique skills and practice interview scenarios with intelligent, adaptive feedback. We will cover everything you need to make a powerful first impression and prepare you for the demands of modern hiring processes, ensuring you are job-ready.
                </p>
                <p>
                  This opportunity is ideal for ambitious professionals, recent graduates, and career changers who are serious about investing in their future and leveraging the latest technology to achieve their goals. If you are looking for a competitive edge and a streamlined path to career advancement with personalized AI support, this pre-registration is your first step. It is designed for those ready to take proactive measures in their career journey.
                </p>
                <p>
                  Upon successful pre-registration, you will have secured your seat and gained immediate access to our AI-powered career tools. This positions you perfectly to benefit from future course offerings and to immediately start refining your professional profile. Be ready to impress employers and navigate the job market with unprecedented confidence and technological support, ensuring you are prepared for whatever comes next.
                </p>
              </div>
            </section>

            {/* 3. Frequently Asked Questions (Accordion) */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5 mb-6">
                <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <CircleHelp className="w-5 h-5" />
                </div>
                <span>Frequently Asked Questions</span>
              </h2>

              <div className="space-y-3">
                {faqs.map((faq, index) => {
                  const isOpen = activeFaq === index;
                  return (
                    <div
                      key={index}
                      className={`border rounded-xl transition-all duration-200 ${
                        isOpen 
                          ? 'border-cyan-200 bg-cyan-50/30 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFaq(isOpen ? null : index)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-sm sm:text-base text-slate-800 cursor-pointer"
                      >
                        <span className="pr-4">{faq.question}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'transform rotate-180 text-cyan-600' : ''
                          }`}
                        />
                      </button>
                      
                      {isOpen && (
                        <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* Right Sticky Checkout Sidebar */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="sticky top-24 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl space-y-6 text-left">
              
              {/* Pricing Box */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Token Amount
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    ₹{finalPrice.toLocaleString('en-IN')}
                  </span>
                  {appliedCoupon && (
                    <span className="text-lg text-slate-400 line-through font-semibold">
                      ₹{basePrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {appliedCoupon && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    You save ₹{appliedCoupon.discount}!
                  </div>
                )}
              </div>

              {/* Coupon Code Box */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-cyan-600" />
                    Apply Coupon Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCouponsList(!showCouponsList)}
                    className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                  >
                    {showCouponsList ? 'Hide Offers' : 'View Offers'}
                  </button>
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="font-mono font-bold text-xs uppercase block">{appliedCoupon.code}</span>
                        <span className="text-[11px] text-emerald-700">₹{appliedCoupon.discount} discount applied</span>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCouponForm} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                      placeholder="Enter coupon (e.g. LAST10)"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white uppercase transition-all"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {couponError && (
                  <div className="text-xs text-red-600 font-medium">
                    {couponError}
                  </div>
                )}

                {couponSuccessMessage && (
                  <div className="text-xs text-emerald-600 font-medium">
                    {couponSuccessMessage}
                  </div>
                )}

                {/* Available Coupon Codes List */}
                {showCouponsList && !appliedCoupon && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Available Coupons for you:
                    </p>
                    <div className="space-y-2">
                      {AVAILABLE_COUPONS.map((coupon) => (
                        <div
                          key={coupon.code}
                          className="p-3 rounded-xl border border-dashed border-cyan-200 bg-cyan-50/40 hover:bg-cyan-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-300">
                                {coupon.code}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                {coupon.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-tight">
                              {coupon.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyCouponCode(coupon.code)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                
                {/* Buy Now Button */}
                <button
                  onClick={handleBuyNow}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Buy Now (₹{finalPrice.toLocaleString('en-IN')})
                </button>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {cartAdded ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Added to Cart!</span>
                    </>
                  ) : (
                    'Add to Cart'
                  )}
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Link Copied!</span>
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
              <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-600">
                <Gift className="w-4 h-4 text-cyan-600" />
                <span>Get Instant Access after registration</span>
              </div>

              {/* Trust Badges */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SSL 256-Bit Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Instant Activation</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Razorpay Checkout & Candidate Form Modal (Clean White Theme) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-200">
            
            <button
              onClick={() => { setIsModalOpen(false); setPaymentSuccessData(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
            >
              ✕
            </button>

            {paymentSuccessData ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Payment Verified!</h3>
                  <p className="text-xs text-emerald-600 font-bold mt-1">
                    Slot Pre-Registration Successfully Confirmed
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Paid:</span>
                    <span className="font-bold text-slate-900">₹{finalPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment ID:</span>
                    <span className="font-mono text-cyan-700 font-bold">{paymentSuccessData.razorpay_payment_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order ID:</span>
                    <span className="font-mono text-slate-700">{paymentSuccessData.razorpay_order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Captured & Signature Verified
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Thank you! Your AI Resume Builder, Mock Interviews, and student tools are unlocked. A confirmation receipt has been sent to your email.
                </p>

                <button
                  onClick={() => { setIsModalOpen(false); setPaymentSuccessData(null); }}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Access Student Portal
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-cyan-700 font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    CynexAI Slot Pre-Registration
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Complete Slot Booking</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Token Amount to Pay: <strong className="text-slate-900 font-bold">₹{finalPrice.toLocaleString('en-IN')}</strong> {appliedCoupon && `(Coupon ${appliedCoupon.code} applied)`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@gmail.com"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Interest</label>
                  <select
                    value={leadForm.courseInterest}
                    onChange={(e) => setLeadForm({ ...leadForm, courseInterest: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
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
                  disabled={isProcessingPayment}
                  className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-cyan-600/20 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessingPayment ? (
                    'Opening Razorpay...'
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Pay ₹{finalPrice.toLocaleString('en-IN')} with Razorpay
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
