require('dotenv').config({ path: '../.env' }); // load parent .env

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@libsql/client');
const multer = require('multer');
const cron = require('node-cron');
const { processVoiceTurn, generateInitialQuestionVoice } = require('./voiceLogic');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TSKMGfh7KVHbUh',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'MPON4w2yEDSkVPLRCwi7gAvh'
});

app.use(cors()); 
app.use(bodyParser.json());

// --- Turso Database ---
const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL || '',
  authToken: process.env.VITE_TURSO_AUTH_TOKEN || '',
});

// --- WhatsApp Client ---
let qrCodeData = null;
let isWhatsAppReady = false;

const whatsapp = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

whatsapp.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrCodeData = qr;
    isWhatsAppReady = false;
});

whatsapp.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isWhatsAppReady = true;
    qrCodeData = null;
});

whatsapp.on('message', async (message) => {
    console.log(`Received message: ${message.body} from ${message.from}`);
    if (db && process.env.VITE_TURSO_DATABASE_URL) {
        try {
            await db.execute({
                sql: `INSERT INTO whatsapp_messages (id, lead_id, direction, message_body, timestamp) 
                      VALUES (?, ?, ?, ?, ?)`,
                args: [
                    message.id.id, 
                    message.from, 
                    'inbound', 
                    message.body, 
                    new Date().toISOString()
                ]
            });
            console.log('Saved message to Turso CRM');
        } catch (e) {
            console.error('Turso insert error', e);
        }
    }
});

whatsapp.initialize();

// --- API Endpoints ---
app.get('/api/whatsapp/status', (req, res) => {
    if (isWhatsAppReady) {
        return res.json({ status: 'ready' });
    }
    if (qrCodeData) {
        return res.json({ status: 'needs_login', qr: qrCodeData });
    }
    return res.json({ status: 'initializing' });
});

app.post('/api/whatsapp/send', async (req, res) => {
    if (!isWhatsAppReady) {
        return res.status(400).json({ error: 'WhatsApp is not ready' });
    }
    const { phone, message } = req.body;
    if (!phone || !message) {
         return res.status(400).json({ error: 'Phone and message are required' });
    }
    const formattedPhone = phone.replace(/\D/g, '') + '@c.us';
    try {
         await whatsapp.sendMessage(formattedPhone, message);
         res.json({ success: true });
    } catch(e) {
         res.status(500).json({ error: e.message });
    }
});

// --- Razorpay Payment Endpoints ---

// 1. Get Public Key ID
app.get(['/api/razorpay/config', '/razorpay/config'], (req, res) => {
    res.json({
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TSKMGfh7KVHbUh'
    });
});

// 2. Create Order Endpoint
app.post(['/api/create-order', '/create-order'], async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, notes } = req.body;
        
        // Amount must be in paise (e.g. 2000 INR = 200000 paise)
        const numericAmount = Math.round(Number(amount));
        
        if (!numericAmount || numericAmount < 100) {
            return res.status(400).json({
                success: false,
                error: 'Amount is required and must be at least 100 paise (₹1)'
            });
        }

        const options = {
            amount: numericAmount,
            currency: currency || 'INR',
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: notes || {}
        };

        const order = await razorpay.orders.create(options);
        
        return res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TSKMGfh7KVHbUh'
        });
    } catch (error) {
        console.error('Razorpay create-order error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create Razorpay order'
        });
    }
});

// 3. Verify Payment Signature Endpoint
app.post(['/api/verify-payment', '/verify-payment'], async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification fields'
            });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET || 'MPON4w2yEDSkVPLRCwi7gAvh';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            console.log(`Payment Verified: Order ${razorpay_order_id}, Payment ${razorpay_payment_id}`);

            // Optional: Save transaction record if DB is configured
            if (db && process.env.VITE_TURSO_DATABASE_URL) {
                try {
                    await db.execute({
                        sql: `INSERT OR IGNORE INTO payment_transactions (id, order_id, payment_id, status, created_at) VALUES (?, ?, ?, ?, ?)`,
                        args: [
                            `pay_${Date.now()}`,
                            razorpay_order_id,
                            razorpay_payment_id,
                            'captured',
                            new Date().toISOString()
                        ]
                    }).catch(() => {});
                } catch (dbErr) {
                    console.error('Failed to log payment transaction:', dbErr);
                }
            }

            return res.json({
                success: true,
                message: 'Payment verified successfully',
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id
            });
        } else {
            console.warn(`Payment signature mismatch: order ${razorpay_order_id}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('Razorpay verify-payment error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Payment verification failed'
        });
    }
});


const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/voice-interview/start', async (req, res) => {
    try {
        const { context, voice = 'aura-asteria-en' } = req.body;

        const result = await generateInitialQuestionVoice(
            context || 'Student in training', 
            voice, 
            process.env.GROQ_VOICE_API,
            process.env.DEEPGRAM_VOICE_API
        );

        res.json({
            aiResponse: result.aiText,
            audioBase64: result.audioBuffer.toString('base64')
        });
    } catch (error) {
        console.error("Voice start error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/voice-interview', upload.single('audio'), async (req, res) => {
    try {
        const chatHistory = req.body?.chatHistory;
        const context = req.body?.context || 'Student in training';
        const turnCount = parseInt(req.body?.turnCount || '1', 10);
        const voice = req.body?.voice || 'aura-asteria-en';
        const audioBuffer = req.file?.buffer;

        if (!audioBuffer) return res.status(400).json({ error: 'No audio file provided' });

        const result = await processVoiceTurn(
            audioBuffer, 
            chatHistory, 
            context,
            turnCount,
            voice,
            process.env.GROQ_VOICE_API, 
            process.env.DEEPGRAM_VOICE_API
        );

        // Send audio buffer back as base64 and texts as headers, or just a JSON response with audio as base64 string
        res.json({
            transcript: result.transcript,
            aiResponse: result.aiResponse,
            audioBase64: result.audioBuffer.toString('base64')
        });

    } catch (error) {
        console.error("Voice interview error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
  res.status(200).send('CynexAI Backend API is running with WhatsApp Automation.');
});

// ─── Daily Task Midnight Cron Job ────────────────────────────────────────────
// Runs at 23:59:30 every night (IST) for ALL users — marks incomplete
// daily tasks as 'Missed' and creates fresh copies for the next day.
cron.schedule('30 59 23 * * *', async () => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  console.log(`[CRON] Daily task rollover starting for date: ${today} → ${tomorrow}`);

  try {
    // 1. Fetch ALL incomplete daily tasks that are due today or earlier
    const result = await db.execute({
      sql: `SELECT * FROM tasks WHERE task_type = 'Daily' AND due_date <= ? AND status NOT IN ('Done', 'Excused', 'Missed')`,
      args: [today]
    });
    const incompleteDailies = result.rows;
    console.log(`[CRON] Found ${incompleteDailies.length} incomplete daily tasks to mark Missed`);

    // 2. Mark all as Missed
    for (const task of incompleteDailies) {
      await db.execute({
        sql: `UPDATE tasks SET status = 'Missed' WHERE id = ?`,
        args: [task.id]
      });
    }

    // 3. Find all daily tasks due today, group by (title + assignee_id)
    //    and create tomorrow's copy if one doesn't already exist
    const todayResult = await db.execute({
      sql: `SELECT * FROM tasks WHERE task_type = 'Daily' AND due_date = ?`,
      args: [today]
    });
    const todayTasks = todayResult.rows;

    // Group by title+assignee to avoid duplicates
    const seen = new Set();
    let created = 0;
    for (const task of todayTasks) {
      const key = `${task.title}__${task.assignee_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if tomorrow's copy already exists
      const existsResult = await db.execute({
        sql: `SELECT id FROM tasks WHERE task_type = 'Daily' AND title = ? AND assignee_id = ? AND due_date = ?`,
        args: [task.title, task.assignee_id, tomorrow]
      });
      if (existsResult.rows.length > 0) continue;

      // Create tomorrow's copy
      const newId = 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO tasks (id, title, description, assignee_id, status, priority, due_date, project_id, related_entity, task_type, target_number, current_number, start_date, tags, recurrence_rule, created_by, lead_id, student_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'To Do', ?, ?, ?, ?, 'Daily', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newId,
          task.title,
          task.description || '',
          task.assignee_id,
          task.priority || 'Medium',
          tomorrow,
          task.project_id || null,
          task.related_entity || null,
          task.target_number || null,
          task.start_date || null,
          task.tags || null,
          task.recurrence_rule || null,
          task.created_by || null,
          task.lead_id || null,
          task.student_id || null,
          now,
          now
        ]
      });
      created++;
    }

    console.log(`[CRON] ✅ Daily rollover done — ${incompleteDailies.length} marked Missed, ${created} new tasks created for ${tomorrow}`);
  } catch (err) {
    console.error('[CRON] ❌ Daily task rollover failed:', err);
  }
}, {
  timezone: 'Asia/Kolkata' // IST
});

console.log('[CRON] Daily task rollover scheduled at 23:59:30 IST every night');
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Node.js backend server running on http://localhost:${PORT}`);
});
