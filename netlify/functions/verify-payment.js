const crypto = require('crypto');
const Razorpay = require('razorpay');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Best-effort record of the payment so every rupee can be matched to a person later.
// Uses SERVER-ONLY env vars (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN, falling back to the VITE_ names
// that the build already uses). A failure here never breaks payment verification.
async function recordTransaction(row) {
  const url = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !authToken) return false;
  try {
    const { createClient } = require('@libsql/client');
    const db = createClient({ url, authToken });
    await db.execute({
      sql: `INSERT OR IGNORE INTO payment_transactions
            (id, order_id, payment_id, source, payment_type, amount, currency, status,
             customer_name, customer_email, customer_phone, course, notes_json, created_at)
            VALUES (?, ?, ?, 'razorpay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `pay_${row.payment_id}`, row.order_id, row.payment_id, row.payment_type || null,
        row.amount, row.currency || 'INR', row.status,
        row.customer_name || null, row.customer_email || null, row.customer_phone || null,
        row.course || null, JSON.stringify(row.notes || {}), new Date().toISOString(),
      ],
    });
    return true;
  } catch (e) {
    console.error('recordTransaction failed (non-fatal):', e && e.message);
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body || '{}');
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, { success: false, error: 'Missing required payment verification fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('RAZORPAY_KEY_SECRET is not configured.');
      return json(500, { success: false, error: 'Payment verification is not configured.' });
    }

    // 1) Cryptographic proof that Razorpay completed this payment for this order.
    const expected = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return json(400, { success: false, error: 'Invalid payment signature' });
    }

    // 2) Reconcile with Razorpay: order/payment must agree and the payment must be captured/authorized.
    let reconciled = false;
    let amount = null;
    let notes = {};
    let status = 'verified';
    try {
      const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
      const rzp = new Razorpay({ key_id, key_secret: secret });
      const [order, payment] = await Promise.all([
        rzp.orders.fetch(razorpay_order_id),
        rzp.payments.fetch(razorpay_payment_id),
      ]);
      if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== Number(order.amount)) {
        return json(400, { success: false, error: 'Payment does not match the order.' });
      }
      if (!['captured', 'authorized'].includes(payment.status)) {
        return json(400, { success: false, error: `Payment is not completed (status: ${payment.status}).` });
      }
      reconciled = true;
      amount = Number(order.amount) / 100;
      notes = order.notes || {};
      status = payment.status;
    } catch (e) {
      // The signature already proves the payment; log and continue.
      console.error('Reconciliation with Razorpay failed (signature was valid):', e && e.message);
    }

    // 3) Remember who paid what (best effort).
    const recorded = await recordTransaction({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      payment_type: notes.type,
      amount,
      status,
      customer_name: notes.customer_name,
      customer_email: notes.customer_email,
      customer_phone: notes.customer_phone,
      course: notes.course,
      notes,
    });

    return json(200, {
      success: true,
      message: 'Payment verified successfully',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      amount,
      reconciled,
      recorded,
    });
  } catch (error) {
    console.error('Netlify Function verify-payment error:', error);
    return json(500, { success: false, error: 'Payment verification failed' });
  }
};
