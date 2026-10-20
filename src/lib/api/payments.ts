import { client, isTursoConfigured } from '../turso';

/**
 * Manual UPI payments are verified by a human against the bank statement, so we must at least
 * remember WHO said they paid WHAT. Razorpay payments are recorded server-side (verify-payment).
 */
export async function recordManualUpiIntent(data: {
  orderId: string;
  amount: number;
  name: string;
  email?: string;
  phone: string;
  course?: string;
  upiId?: string;
}): Promise<boolean> {
  if (!isTursoConfigured || !client) return false;
  try {
    await client.execute({
      sql: `INSERT OR IGNORE INTO payment_transactions
            (id, order_id, payment_id, source, payment_type, amount, currency, status,
             customer_name, customer_email, customer_phone, course, notes_json, created_at)
            VALUES (?, ?, NULL, 'upi_manual', 'Course Payment', ?, 'INR', 'pending_manual_verification', ?, ?, ?, ?, ?, ?)`,
      args: [
        `upi_${data.orderId}`, data.orderId, data.amount,
        data.name.trim(), (data.email || '').trim() || null, data.phone.trim(), data.course || null,
        JSON.stringify({ upi_id: data.upiId || null }), new Date().toISOString(),
      ],
    });
    return true;
  } catch (e) {
    console.error('Failed to record manual UPI payment intent', e);
    return false;
  }
}

export async function getPaymentTransactions(limit = 200): Promise<any[]> {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT ?',
      args: [limit],
    });
    return res.rows as any[];
  } catch (e) {
    console.error('Failed to load payment transactions', e);
    return [];
  }
}

export async function markPaymentVerified(id: string, verifiedBy: string): Promise<boolean> {
  if (!isTursoConfigured || !client) return false;
  try {
    await client.execute({
      sql: `UPDATE payment_transactions SET status = 'verified_manually',
              notes_json = json_set(COALESCE(notes_json, '{}'), '$.verified_by', ?, '$.verified_at', ?)
            WHERE id = ? AND source = 'upi_manual'`,
      args: [verifiedBy, new Date().toISOString(), id],
    });
    return true;
  } catch (e) {
    console.error('Failed to mark payment verified', e);
    return false;
  }
}
