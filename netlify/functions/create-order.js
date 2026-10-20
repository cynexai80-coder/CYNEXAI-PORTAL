const Razorpay = require('razorpay');

// ── Server-side pricing ─────────────────────────────────────────────────────
// The browser NEVER decides the price of fixed-fee products. Coupons and fees live here.
const TOKEN_BASE_INR = 2000;
const TOKEN_MIN_INR = 100;
const ENROLLMENT_FEE_INR = 500;
const COUPONS_INR = { SAVE25: 500, CYNEX50: 1000, LAUNCH70: 1400 };
const MAX_CUSTOM_INR = 1000000; // upper bound for free-amount ("/pay") payments

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Razorpay allows <= 15 notes with string values <= 256 chars.
const sanitizeNotes = (notes) => {
  const out = {};
  if (!notes || typeof notes !== 'object') return out;
  Object.entries(notes).slice(0, 15).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    out[String(k).slice(0, 40)] = String(v).slice(0, 250);
  });
  return out;
};

function resolveAmountPaise(body, notes) {
  const type = notes.type || '';
  if (type === 'Token Slot Booking') {
    const coupon = String(notes.coupon || '').trim().toUpperCase();
    const discount = COUPONS_INR[coupon] || 0;
    const inr = Math.max(TOKEN_BASE_INR - discount, TOKEN_MIN_INR);
    return { paise: inr * 100, source: 'server-token-price' };
  }
  if (type === 'Enrollment Fee') {
    return { paise: ENROLLMENT_FEE_INR * 100, source: 'server-enrollment-fee' };
  }
  // Custom payment: accept the requested amount, but only within sane limits.
  const requested = Math.round(Number(body.amount));
  if (!requested || requested < 100 || requested > MAX_CUSTOM_INR * 100) return { paise: 0 };
  return { paise: requested, source: 'custom' };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const notes = sanitizeNotes(body.notes);
    const { paise, source } = resolveAmountPaise(body, notes);

    if (!paise) {
      return json(400, {
        success: false,
        error: `Amount must be between ₹1 and ₹${MAX_CUSTOM_INR.toLocaleString('en-IN')}`,
      });
    }

    const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      console.error('Razorpay keys are not configured on the server.');
      return json(500, { success: false, error: 'Payments are not configured. Please contact support.' });
    }

    const razorpay = new Razorpay({ key_id, key_secret });
    const order = await razorpay.orders.create({
      amount: paise,
      currency: 'INR',
      receipt: String(body.receipt || `rcpt_${Date.now()}`).slice(0, 40),
      notes: { ...notes, price_source: source },
    });

    return json(200, {
      success: true,
      order_id: order.id,
      amount: order.amount, // the price the SERVER decided; the client must use this value
      currency: order.currency,
      key_id,
    });
  } catch (error) {
    console.error('Netlify Function create-order error:', error);
    return json(500, { success: false, error: 'Failed to create the payment order. Please try again.' });
  }
};
