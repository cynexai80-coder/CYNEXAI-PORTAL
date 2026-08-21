import React, { useState, useEffect, useRef } from 'react';
import { motion, Variants } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { X, Smartphone, RefreshCcw, Copy, CreditCard, ShieldCheck } from 'lucide-react'; // Added Copy icon
import { useNavigate } from 'react-router-dom';
import { openRazorpayCheckout } from '../lib/razorpay';

// Define courses - Ensure this data is always valid
const coursesData = [
  { id: 'DSB001', name: 'Data Science & Machine Learning' },
  { id: 'AIML002', name: 'Artificial Intelligence & Generative AI' },
  { id: 'FSD003', name: 'Full Stack Java Development' },
  { id: 'DEV004', name: 'DevOps & Cloud Technologies' },
  { id: 'PYT005', name: 'Python Programming' },
  { id: 'SWT006', name: 'Software Testing (Manual + Automation)' },
  { id: 'SAP007', name: 'SAP (Data Processing)' },
  { id: 'OTHER', name: 'Other / Custom Payment' }
];

const PaymentPage = () => {
  const [inViewRef, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const [checkoutDetails, setCheckoutDetails] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    selectedCourseId: '',
    amount: '' as string,
  });

  // IMPORTANT: Replace with YOUR ACTUAL PERSONAL UPI ID (VPA)
  const YOUR_UPI_ID = 'reddyl62@fifederal'; // e.g., yourname@ybl or yourphonepeid@upi
  const YOUR_BUSINESS_NAME_DISPLAY = 'CynexAI'; // This name will be shown on YOUR website only

  const [internalOrderId, setInternalOrderId] = useState<string>('');
  const [upiPaymentLink, setUpiPaymentLink] = useState<string>('');

  const pageTopRef = useRef<HTMLDivElement>(null); // Ref for scrolling to top

  const generateNewOrderId = () => {
    return `CXAI_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  useEffect(() => {
    setInternalOrderId(generateNewOrderId());
  }, []);

  const selectedCourseName = coursesData.find(course => course.id === checkoutDetails.selectedCourseId)?.name || 'N/A';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
        setCheckoutDetails(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setCheckoutDetails(prev => ({ ...prev, [name]: value }));
    }
    if (paymentStatus === 'error') {
      setMessage('');
      setPaymentStatus('idle');
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkoutDetails.selectedCourseId) {
      setMessage('Please select a course.');
      setPaymentStatus('error');
      return;
    }

    const parsedAmount = parseFloat(checkoutDetails.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setMessage('Please enter a valid amount greater than zero.');
      setPaymentStatus('error');
      return;
    }

    if (!checkoutDetails.fullName.trim() || !checkoutDetails.phoneNumber.trim()) {
      setMessage('Please fill in your Full Name and Phone Number.');
      setPaymentStatus('error');
      return;
    }

    setPaymentStatus('pending');

    const generatedUpiLink = `upi://pay?pa=${encodeURIComponent(YOUR_UPI_ID)}&pn=${encodeURIComponent(YOUR_BUSINESS_NAME_DISPLAY)}&tr=${encodeURIComponent(internalOrderId)}&am=${parsedAmount.toFixed(2)}&cu=INR`;
    setUpiPaymentLink(generatedUpiLink);

    setTimeout(() => {
      if (pageTopRef.current) {
        pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);

    console.log("Payment initiated details:", {
      internalOrderId: internalOrderId,
      amount: parsedAmount,
      upiId: YOUR_UPI_ID,
      customer: checkoutDetails,
      selectedCourse: selectedCourseName,
      timestamp: new Date().toISOString()
    });

    setMessage(
      `Please complete your payment of ₹${parsedAmount.toFixed(2)}.` +
      `\n\n**IMPORTANT:** For amounts above ₹2,000, you may need to manually enter the UPI ID and amount in your UPI app.` +
      `\n\n**Crucial:** Please include the Order ID: ${internalOrderId} in the payment notes/remarks.` +
      `\n\nWe will verify your payment manually based on the exact amount, Order ID, and your provided details. Thank you!`
    );
  };

  const handleRazorpayPay = async (e: React.MouseEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(checkoutDetails.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setMessage('Please enter a valid payment amount.');
      setPaymentStatus('error');
      return;
    }
    if (!checkoutDetails.fullName.trim() || !checkoutDetails.phoneNumber.trim()) {
      setMessage('Please provide your full name and phone number.');
      setPaymentStatus('error');
      return;
    }

    setPaymentStatus('pending');
    setMessage('Opening Razorpay Standard Checkout...');

    await openRazorpayCheckout({
      amount: parsedAmount,
      name: 'CynexAI',
      description: `Course Payment: ${selectedCourseName}`,
      receipt: internalOrderId,
      customer: {
        name: checkoutDetails.fullName,
        email: checkoutDetails.email,
        contact: checkoutDetails.phoneNumber
      },
      notes: {
        course: selectedCourseName,
        courseId: checkoutDetails.selectedCourseId,
        orderId: internalOrderId
      },
      onSuccess: (res) => {
        setPaymentStatus('success');
        setMessage(`Payment Verified Successfully! Payment ID: ${res.razorpay_payment_id}. Thank you for enrolling with CynexAI.`);
      },
      onError: (err) => {
        setPaymentStatus('error');
        setMessage(err.description || 'Razorpay payment failed or was cancelled.');
      },
      onDismiss: () => {
        setPaymentStatus('idle');
      }
    });
  };

  const resetPayment = () => {
    setCheckoutDetails({
      fullName: '',
      phoneNumber: '',
      email: '',
      selectedCourseId: '',
      amount: '',
    });
    setPaymentStatus('idle');
    setMessage('');
    setInternalOrderId(generateNewOrderId());
    setUpiPaymentLink('');
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Avoid scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      setMessage(`${fieldName} copied to clipboard!`);
      // Briefly show success for copy action, then revert to pending message
      const originalMessage = `Please complete your payment of ₹${parseFloat(checkoutDetails.amount || '0').toFixed(2)}.` +
        `\n\n**IMPORTANT:** For amounts above ₹2,000, you may need to manually enter the UPI ID and amount in your UPI app.` +
        `\n\n**Crucial:** Please include the Order ID: ${internalOrderId} in the payment notes/remarks.` +
        `\n\nWe will verify your payment manually based on the exact amount, Order ID, and your provided details. Thank you!`;

      setTimeout(() => setMessage(originalMessage), 2000);
    } catch {
      setMessage(`Failed to copy ${fieldName}. Please copy manually.`);
      setPaymentStatus('error');
    }
    document.body.removeChild(textarea);
  };

  const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: Variants = { hidden: { y: 50, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.6 } } };

  return (
    <div ref={pageTopRef} className="min-h-screen bg-transparent text-gray-100 pt-20 pb-10 flex items-center justify-center font-inter">
      <motion.div
        ref={inViewRef}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={containerVariants}
        className="relative bg-background/40 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(65,200,223,0.1)] p-6 sm:p-8 w-full max-w-5xl mx-auto border border-secondary/10 flex flex-col lg:flex-row"
      >
        {/* Close Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-4 text-gray-400 hover:text-secondary transition-colors z-10"
          aria-label="Close payment modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Left Column: Payment Details & QR Code */}
        <div className="lg:w-2/5 lg:pr-8 mb-8 lg:mb-0 text-center">
          <motion.h2 variants={itemVariants} className="text-xl sm:text-2xl font-bold mb-6 border-b pb-3 border-secondary/10 text-secondary">
            2. Complete Your Payment
          </motion.h2>

          {paymentStatus === 'pending' ? (
            <motion.div variants={containerVariants} className="space-y-4">
              <p className="text-lg font-semibold text-gray-200">
                Scan this QR Code to pay ₹{parseFloat(checkoutDetails.amount || '0').toFixed(2)}:
              </p>
              <a href={upiPaymentLink} target="_blank" rel="noopener noreferrer" className="inline-block">
                {upiPaymentLink && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiPaymentLink)}`}
                    alt="UPI QR Code"
                    className="mx-auto border border-gray-300 dark:border-white/10 rounded-lg p-2"
                  />
                )}
                {!upiPaymentLink && (
                  <div className="mx-auto w-[250px] h-[250px] bg-secondary/10 flex items-center justify-center rounded-lg border border-secondary/20">
                    <p className="text-sm text-gray-400">Generating QR...</p>
                  </div>
                )}
              </a>

              <p className="text-lg font-semibold text-gray-200 mt-4">
                Or Pay to UPI ID:
              </p>
              <div className="flex items-center justify-center space-x-2">
                <p className="text-2xl font-bold text-[#41c8df] break-all">
                  {YOUR_UPI_ID}
                </p>
                <button
                  onClick={() => copyToClipboard(YOUR_UPI_ID, 'UPI ID')}
                  className="p-2 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors"
                  aria-label="Copy UPI ID"
                >
                  <Copy className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              <p className="text-xl font-bold text-red-600 mt-4 flex items-center justify-center">
                Order ID: {internalOrderId}
                <button
                  onClick={() => copyToClipboard(internalOrderId, 'Order ID')}
                  className="ml-2 p-2 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors"
                  aria-label="Copy Order ID"
                >
                  <Copy className="w-5 h-5 text-gray-300" />
                </button>
              </p>

              <p className="text-base text-gray-300 mt-2 font-medium">
                **IMPORTANT:** Please include this **Order ID** in the payment notes/remarks of your UPI app.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                For payments above ₹2,000, it is highly recommended to click 'Open UPI App' directly or manually enter the details.
              </p>

              <a
                href={upiPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#41c8df] text-black py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center mt-6"
              >
                Open UPI App <Smartphone className="w-5 h-5 ml-2" />
              </a>

              <button
                onClick={resetPayment}
                className="w-full bg-secondary/10 text-secondary py-3 rounded-lg font-semibold hover:bg-secondary/20 transition-colors duration-300 flex items-center justify-center mt-4 border border-secondary/20"
              >
                Start New Payment <RefreshCcw className="w-5 h-5 ml-2" />
              </button>

            </motion.div>
          ) : (
            <motion.div variants={containerVariants} className="space-y-4">
              <p className="text-lg text-gray-300">
                You will make a direct UPI payment. Please ensure all details are correct.
              </p>
              <p className="text-md text-gray-400">
                After submitting your details, you'll be shown a UPI QR code and a button to open your UPI app to complete the payment.
              </p>
              {message && (
                <p className={`mt-6 text-center font-medium ${paymentStatus === 'error' ? 'text-red-400' : 'text-gray-300'
                  }`}>
                  {message}
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Column: Order Summary & Customer Information */}
        <div className="lg:w-3/5 lg:pl-8">
          <motion.h2 variants={itemVariants} className="text-xl sm:text-2xl font-bold mb-6 border-b pb-3 border-secondary/10 text-secondary">
            Order Details
          </motion.h2>

          {paymentStatus !== 'pending' ? (
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Course Dropdown */}
              <motion.div variants={itemVariants}>
                <label htmlFor="selectedCourseId" className="block text-sm font-medium text-gray-300 mb-2">Select Course</label>
                <select
                  id="selectedCourseId"
                  name="selectedCourseId"
                  value={checkoutDetails.selectedCourseId}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-secondary/5 border border-secondary/10 focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] text-secondary outline-none transition-colors"
                >
                  <option value="" className="bg-gray-900">-- Select a Course --</option>
                  {coursesData.map(course => (
                    <option key={course.id} value={course.id} className="bg-gray-900">
                      {course.name}
                    </option>
                  ))}
                </select>
              </motion.div>

              {/* Amount Input Field */}
              <motion.div variants={itemVariants}>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2 text-left">Amount (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">₹</span>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    value={checkoutDetails.amount}
                    onChange={handleInputChange}
                    placeholder="e.g., 500.00"
                    required
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-secondary/5 border border-secondary/10 focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] text-secondary placeholder-gray-500 outline-none text-xl font-bold transition-colors"
                  />
                </div>
              </motion.div>

              {/* Order Summary Display */}
              <motion.div variants={itemVariants} className="bg-secondary/5 rounded-lg p-4 border border-secondary/10 space-y-3 mb-6">
                <div className="flex justify-between items-center text-lg">
                  <span className="text-gray-400">Selected Course:</span>
                  <span className="font-semibold text-gray-100">{selectedCourseName}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span className="text-gray-400">Coupon Code:</span>
                  <button type="button" className="text-[#41c8df] hover:underline text-sm">Apply</button>
                </div>
                <div className="flex justify-between items-center text-2xl font-bold pt-4 border-t border-secondary/10">
                  <span className="text-secondary">Total Amount:</span>
                  <span className="text-[#41c8df]">INR ₹{parseFloat(checkoutDetails.amount || '0').toFixed(2)}</span>
                </div>
              </motion.div>

              {/* Customer Information */}
              <motion.div variants={itemVariants} className="bg-secondary/5 rounded-lg p-4 border border-secondary/10 space-y-4">
                <h3 className="text-lg font-semibold mb-4 text-secondary">Your Information</h3>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={checkoutDetails.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g., John Doe"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-secondary/5 border border-secondary/10 focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] text-secondary placeholder-gray-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={checkoutDetails.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., 9876543210"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-secondary/5 border border-secondary/10 focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] text-secondary placeholder-gray-500 outline-none transition-colors"
                    pattern="[0-9]{10}"
                    title="Phone number must be 10 digits"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={checkoutDetails.email}
                    onChange={handleInputChange}
                    placeholder="e.g., your.email@example.com"
                    className="w-full px-4 py-3 rounded-lg bg-secondary/5 border border-secondary/10 focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] text-secondary placeholder-gray-500 outline-none transition-colors"
                  />
                </div>
              </motion.div>

              {/* Submit Payment Buttons */}
              <div className="space-y-3 mt-6">
                <motion.button
                  type="button"
                  onClick={handleRazorpayPay}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={
                    !checkoutDetails.selectedCourseId ||
                    isNaN(parseFloat(checkoutDetails.amount)) || parseFloat(checkoutDetails.amount) <= 0 ||
                    !checkoutDetails.fullName.trim() ||
                    !checkoutDetails.phoneNumber.trim()
                  }
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 py-3.5 rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                >
                  <CreditCard className="w-5 h-5 mr-2" /> Pay with Razorpay (Cards, NetBanking, UPI)
                </motion.button>

                <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <span className="h-[1px] bg-slate-700 flex-1" />
                  <span>OR</span>
                  <span className="h-[1px] bg-slate-700 flex-1" />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={
                    !checkoutDetails.selectedCourseId ||
                    isNaN(parseFloat(checkoutDetails.amount)) || parseFloat(checkoutDetails.amount) <= 0 ||
                    !checkoutDetails.fullName.trim() ||
                    !checkoutDetails.phoneNumber.trim()
                  }
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-3 rounded-xl font-semibold hover:bg-slate-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Smartphone className="w-5 h-5 mr-2 text-cyan-400" /> Pay via Manual UPI QR
                </motion.button>
              </div>
            </form>
          ) : (
            <div className="text-center text-gray-400 text-lg">
              <p>Please complete your payment using the options on the left.</p>
              <p className="mt-2 text-gray-500">Or click "Start New Payment" if you need to change details.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentPage;
