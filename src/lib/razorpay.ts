// Razorpay Standard Web Checkout Integration for CynexAI

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export interface RazorpayCustomerInfo {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpayCheckoutOptions {
  amount: number; // in INR (e.g. 2000 for ₹2,000)
  name?: string;
  description?: string;
  image?: string;
  customer?: RazorpayCustomerInfo;
  notes?: Record<string, any>;
  receipt?: string;
  onSuccess?: (paymentResult: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    verified: boolean;
    serverVerification?: any;
  }) => void;
  onError?: (error: { code?: string; description?: string; source?: string; step?: string; reason?: string }) => void;
  onDismiss?: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFAULT_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TSKMGfh7KVHbUh';

/**
 * Dynamically load the Razorpay checkout.js script if not already present
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    if (window.Razorpay) {
      return resolve(true);
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay Standard Checkout modal with complete order creation & signature verification
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    const err = { description: 'Razorpay SDK failed to load. Please check your internet connection.' };
    options.onError?.(err);
    alert(err.description);
    return;
  }

  try {
    // 1. Convert INR to paise (e.g. 2000 -> 200000 paise)
    const amountInPaise = Math.round(options.amount * 100);

    // 2. Call backend to create Razorpay Order
    let orderData: { success: boolean; order_id: string; key_id?: string; amount: number; currency: string } | null = null;

    try {
      const res = await fetch(`${API_BASE}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: options.receipt || `rcpt_${Date.now()}`,
          notes: options.notes || {}
        })
      });

      if (res.ok) {
        orderData = await res.json();
      }
    } catch (e) {
      console.warn('Backend order creation call failed, trying fallback or checking server status:', e);
    }

    if (!orderData || !orderData.order_id) {
      // Direct Razorpay test fallback if backend is unreachable during dev preview
      console.warn('Using client fallback for test credentials if server not responding');
    }

    const razorpayKey = orderData?.key_id || DEFAULT_KEY_ID;

    // 3. Configure Razorpay modal options
    const rzpOptions: any = {
      key: razorpayKey,
      amount: amountInPaise,
      currency: 'INR',
      name: options.name || 'CynexAI',
      description: options.description || 'Course Pre-Registration & Token Booking',
      image: options.image || 'https://cynexai.in/logo.png',
      order_id: orderData?.order_id,
      prefill: {
        name: options.customer?.name || '',
        email: options.customer?.email || '',
        contact: options.customer?.contact || ''
      },
      notes: options.notes || { platform: 'CynexAI' },
      theme: {
        color: '#06b6d4' // CynexAI cyan brand color
      },
      modal: {
        ondismiss: () => {
          console.log('Razorpay modal closed by user');
          options.onDismiss?.();
        }
      },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
          // 4. Verify Payment Signature via Backend
          let verified = false;
          let serverVerificationResult: any = null;

          try {
            const verifyRes = await fetch(`${API_BASE}/api/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyRes.ok) {
              serverVerificationResult = await verifyRes.json();
              verified = serverVerificationResult.success === true;
            }
          } catch (verifyErr) {
            console.error('Server verification error:', verifyErr);
          }

          options.onSuccess?.({
            ...response,
            verified,
            serverVerification: serverVerificationResult
          });
        } catch (hErr: any) {
          options.onError?.({ description: hErr.message || 'Payment handling failed' });
        }
      }
    };

    const rzp = new window.Razorpay(rzpOptions);

    rzp.on('payment.failed', (response: any) => {
      console.error('Razorpay payment failed:', response.error);
      options.onError?.(response.error);
    });

    rzp.open();
  } catch (error: any) {
    console.error('Failed to launch Razorpay Checkout:', error);
    options.onError?.({ description: error.message || 'Checkout initiation failed' });
  }
}
