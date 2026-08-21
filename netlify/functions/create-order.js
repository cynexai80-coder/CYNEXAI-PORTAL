const Razorpay = require('razorpay');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { amount, currency = 'INR', receipt, notes } = body;

    const numericAmount = Math.round(Number(amount));
    if (!numericAmount || numericAmount < 100) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Amount is required and must be at least 100 paise (₹1)'
        })
      };
    }

    const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TSKMGfh7KVHbUh';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'MPON4w2yEDSkVPLRCwi7gAvh';

    const razorpay = new Razorpay({
      key_id,
      key_secret
    });

    const options = {
      amount: numericAmount,
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    };

    const order = await razorpay.orders.create(options);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id
      })
    };
  } catch (error) {
    console.error('Netlify Function create-order error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to create Razorpay order'
      })
    };
  }
};
