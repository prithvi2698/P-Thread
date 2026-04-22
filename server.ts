import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqliteDb, { initializeSql } from './src/db/sqlite.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let resendClient: Resend | null = null;
let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const key = process.env.VITE_RAZORPAY_KEY || 'rzp_test_SfiDxogVmgebVI';
    const secret = process.env.RAZORPAY_SECRET;
    if (!secret) {
      console.warn('RAZORPAY_SECRET_MISSING // PAYMENTS_UNVERIFIED');
    }
    razorpayInstance = new Razorpay({
      key_id: key,
      key_secret: secret || 'placeholder',
    });
  }
  return razorpayInstance;
}

function getResendClient(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('ARCHIVAL_SYNC_FAILURE // RESEND_API_KEY is missing from environment.');
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

async function startServer() {
  initializeSql();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post('/api/auth-sync', async (req, res) => {
    const { uid, email, displayName } = req.body;
    try {
      const stmt = sqliteDb.prepare('INSERT OR REPLACE INTO users (uid, email, display_name) VALUES (?, ?, ?)');
      stmt.run(uid, email, displayName);
      res.json({ success: true });
    } catch (err) {
      console.error('SQL_AUTH_SYNC_FAILURE:', err);
      res.status(500).json({ error: 'SQL sync failed' });
    }
  });

  // Order Management Sector
  app.get('/api/orders', (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });
    
    try {
      const orders = sqliteDb.prepare(`
        SELECT o.*, 
        (SELECT json_group_array(json_object('name', product_name, 'color', color, 'size', size, 'quantity', quantity, 'price', price)) FROM order_items WHERE order_id = o.id) as items
        FROM orders o WHERE uid = ? ORDER BY created_at DESC
      `).all(uid);
      
      res.json(orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) })));
    } catch (err) {
      res.status(500).json({ error: 'ORDER_FETCH_FAILURE' });
    }
  });

  // Cart Persistence Sector
  app.get('/api/cart', (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });
    
    try {
      const row = sqliteDb.prepare('SELECT items FROM cart WHERE uid = ?').get(uid) as { items: string } | undefined;
      res.json(row ? JSON.parse(row.items) : []);
    } catch (err) {
      res.status(500).json({ error: 'CART_FETCH_FAILURE' });
    }
  });

  app.post('/api/cart', (req, res) => {
    const { uid, items } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });

    try {
      sqliteDb.prepare('INSERT OR REPLACE INTO cart (uid, items, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run(uid, JSON.stringify(items));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'CART_SYNC_FAILURE' });
    }
  });

  // Admin Sector (Restricted)
  const ADMIN_EMAILS = ['prithvi2698@gmail.com'];
  
  app.get('/api/admin/orders', (req, res) => {
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      const orders = sqliteDb.prepare(`
        SELECT o.*, u.email as user_email,
        (SELECT json_group_array(json_object('name', product_name, 'color', color, 'size', size, 'quantity', quantity, 'price', price)) FROM order_items WHERE order_id = o.id) as items
        FROM orders o 
        LEFT JOIN users u ON o.uid = u.uid
        ORDER BY created_at DESC
      `).all();
      res.json(orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) })));
    } catch (err) {
      res.status(500).json({ error: 'ADMIN_ORDER_FETCH_FAILURE' });
    }
  });

  app.patch('/api/admin/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      sqliteDb.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'ORDER_UPDATE_FAILURE' });
    }
  });

  // Payment Verification Route
  app.post('/api/payment/verify', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_SECRET;

    if (!secret) {
      console.warn('SKIP_SIGNATURE_VERIFICATION // NO_SECRET');
      return res.json({ success: true }); // Fallback for dev
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'SIGNATURE_INVALID' });
    }
  });

  app.post('/api/payment/create-order', async (req, res) => {
    const { amount } = req.body;
    try {
      const razorpay = getRazorpay();
      const order = await razorpay.orders.create({
        amount: amount * 100, // in paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`
      });
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'ORDER_CREATION_FAILURE' });
    }
  });

  // Phone Verification Sector
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS pending_verifications (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    )
  `);

  app.post('/api/verify-init', (req, res) => {
    const { phone } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit manifest
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10m window

    try {
      const stmt = sqliteDb.prepare('INSERT OR REPLACE INTO pending_verifications (phone, code, expires_at) VALUES (?, ?, ?)');
      stmt.run(phone, code, expiresAt);
      
      console.log(`[TERMINAL_COMMS] DISPATCHING_CODE ${code} TO_TARGET ${phone}`);
      // In production, sync with SMS Gateway (Twilio/etc)
      res.json({ success: true, message: 'MANIFEST_DISPATCHED' });
    } catch (err) {
      res.status(500).json({ error: 'PROTOCOL_ERROR' });
    }
  });

  app.post('/api/verify-confirm', (req, res) => {
    const { phone, code } = req.body;
    try {
      const stmt = sqliteDb.prepare('SELECT code FROM pending_verifications WHERE phone = ? AND expires_at > ?');
      const row = stmt.get(phone, new Date().toISOString()) as { code: string } | undefined;

      if (row && row.code === code) {
        sqliteDb.prepare('DELETE FROM pending_verifications WHERE phone = ?').run(phone);
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: 'INVALID_SEQUENCE' });
      }
    } catch (err) {
      res.status(500).json({ error: 'HANDSHAKE_FAILURE' });
    }
  });

  app.post('/api/send-receipt', async (req, res) => {
    const { email, orderDetails, total, shipping, paymentId, userId } = req.body;
    const orderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    try {
      // SQL Sync
      sqliteDb.transaction(() => {
        const orderStmt = sqliteDb.prepare('INSERT INTO orders (id, uid, email, total, shipping_amount, payment_id) VALUES (?, ?, ?, ?, ?, ?)');
        orderStmt.run(orderId, userId || null, email, total, shipping, paymentId || null);

        const itemStmt = sqliteDb.prepare('INSERT INTO order_items (order_id, product_name, color, size, quantity, price) VALUES (?, ?, ?, ?, ?, ?)');
        for (const item of orderDetails) {
          itemStmt.run(orderId, item.name, item.color, item.size, item.quantity, item.price);
        }
      })();

      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: 'P-THREAD STUDIO <onboarding@resend.dev>',
        to: [email],
        subject: 'ARCHIVE_SECURED // Acquisition Receipt Manifest',
        html: `
          <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; border: 1px solid #e61e1e;">
            <h1 style="color: #e61e1e; font-size: 24px; border-bottom: 2px solid #e61e1e; padding-bottom: 10px;">P-THREAD STUDIO // ACQUISITION_RECEIPT</h1>
            <p style="font-size: 12px; color: #888;">Manifest_ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            
            <div style="margin: 40px 0;">
              <h2 style="font-size: 16px; color: #fff; text-transform: uppercase;">Secured Items:</h2>
              <ul style="list-style: none; padding: 0;">
                ${orderDetails.map((item: any) => `
                  <li style="margin-bottom: 15px; border-left: 2px solid #333; padding-left: 15px;">
                    <strong style="display: block;">${item.name}</strong>
                    <span style="font-size: 12px; color: #888;">${item.color} / ${item.size} // QTY: ${item.quantity}</span>
                    <span style="display: block; color: #e61e1e;">₹${item.price}.00</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <div style="border-top: 1px solid #333; padding-top: 20px;">
              <div style="display: flex; gap: 20px; flex-direction: column;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #888;">SHIPPING_SURCHARGE:</span>
                  <span style="color: #fff;">₹${shipping}.00</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #888;">ACQUISITION_TOTAL:</span>
                  <strong style="color: #fff; font-size: 20px;">₹${total}.00</strong>
                </div>
              </div>
            </div>

            <p style="margin-top: 40px; font-size: 10px; color: #444; line-height: 1.6;">
              LOGISTICS_NOTE: Your items are now moving through the studio distribution grid. Tracking manifests will be updated in your terminal as sectors are cleared.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend Error:', error);
        return res.status(400).json({ error });
      }

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('Server Internal Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`P-THREAD STUDIO Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('SERVER_START_FAILURE:', err);
  process.exit(1);
});
