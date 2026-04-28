import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqliteDb, { initializeSql, seedProducts } from './src/db/sqlite.js';
import { PRODUCTS } from './src/constants.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestore: any;
let resendClient: Resend | null = null;
let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) {
      console.warn('RAZORPAY_CREDENTIALS_MISSING // PAYMENTS_UNVERIFIED');
    }
    razorpayInstance = new Razorpay({
      key_id: key || 'rzp_test_placeholder',
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
  try {
    const projId = firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT;
    console.log(`INITIALIZING_FIREBASE_ADMIN // PROJECT: ${projId}`);
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: projId,
      });
    }
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    console.log(`INITIALIZING_FIRESTORE // DATABASE: ${dbId}`);
    firestore = getFirestore(admin.app(), dbId);
  } catch (firebaseErr) {
    console.error('FIREBASE_ADMIN_INIT_FAILURE:', firebaseErr);
  }

  try {
    console.log('STARTING_SERVER_PHASE // DB_INIT');
    initializeSql();
    seedProducts(PRODUCTS);
    console.log('STARTING_SERVER_PHASE // DB_SYNC_COMPLETE');
  } catch (dbErr) {
    console.error('DATABASE_INITIALIZATION_CRITICAL_FAILURE:', dbErr);
  }
  
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Product Sector
  app.get('/api/products', (req, res) => {
    try {
      console.log('RETR_PRODUCTS // Archival_Sync_Active');
      const products = sqliteDb.prepare('SELECT * FROM products WHERE is_archived = 0').all();
      const mapped = products.map((p: any) => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        colors: JSON.parse(p.colors || '[]'),
        sizes: JSON.parse(p.sizes || '[]'),
        isNew: p.is_archived === 0 // Logic for display
      }));
      res.json(Array.isArray(mapped) ? mapped : []);
    } catch (err) {
      console.error('CRITICAL_PRODUCT_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
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
  app.get('/api/orders', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });
    
    try {
      if (!firestore) throw new Error('FIRESTORE_NOT_INITIALIZED');
      const snapshot = await firestore.collection('orders')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();
      
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: (doc.data().createdAt as admin.firestore.Timestamp)?.toDate()?.toISOString()
      }));
      
      res.json(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.error('FIREBASE_ORDER_FETCH_FAILURE:', err);
      res.status(500).json([]);
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
  
  app.get('/api/admin/orders', async (req, res) => {
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      if (!firestore) throw new Error('FIRESTORE_NOT_INITIALIZED');
      const snapshot = await firestore.collection('orders')
        .orderBy('createdAt', 'desc')
        .get();
      
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        user_email: doc.data().email,
        created_at: (doc.data().createdAt as admin.firestore.Timestamp)?.toDate()?.toISOString()
      }));
      
      res.json(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.error('ADMIN_FIREBASE_ORDER_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
  });

  app.patch('/api/admin/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      if (!firestore) throw new Error('FIRESTORE_NOT_INITIALIZED');
      await firestore.collection('orders').doc(id).update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'ORDER_UPDATE_FAILURE' });
    }
  });

  app.patch('/api/admin/products/:id', (req, res) => {
    const { id } = req.params;
    const { stock, price } = req.body;
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      if (stock !== undefined) {
        sqliteDb.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, id);
      }
      if (price !== undefined) {
        sqliteDb.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'PRODUCT_UPDATE_FAILURE' });
    }
  });

  // Payment Logic Sector
  app.post('/api/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_items } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const finalizePayment = () => {
      // Decrement Inventory
      if (order_items && Array.isArray(order_items)) {
        try {
          sqliteDb.transaction(() => {
            const updateStock = sqliteDb.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
            for (const item of order_items) {
              const result = updateStock.run(item.quantity, item.id, item.quantity);
              if (result.changes === 0) {
                console.warn(`STOCK_INSUFFICIENT // Product: ${item.id}`);
              }
            }
          })();
        } catch (err) {
          console.error('INVENTORY_UPDATE_FAILURE:', err);
        }
      }
      res.json({ success: true });
    };

    if (!secret) {
      console.warn('SKIP_SIGNATURE_VERIFICATION // NO_SECRET');
      return finalizePayment();
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
      finalizePayment();
    } else {
      res.status(400).json({ success: false, error: 'SIGNATURE_INVALID' });
    }
  });

  app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    try {
      const razorpay = getRazorpay();
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // in paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`
      });
      res.json(order);
    } catch (err) {
      console.error('RAZORPAY_ORDER_FAILURE:', err);
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
