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
    const key = process.env.RAZORPAY_KEY_ID?.trim();
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!key || !secret || key.includes('YOUR_') || secret.includes('YOUR_')) {
      throw new Error('RAZORPAY_CREDENTIALS_INVALID // Please ensure you have replaced placeholders with real live keys in the environment settings.');
    }
    const isLive = key.startsWith('rzp_live_');
    const isTest = key.startsWith('rzp_test_');
    
    if (!isLive && !isTest) {
      console.error(`RAZORPAY_KEY_FORMAT_ERROR // Key ID must start with rzp_test_ or rzp_live_. Current prefix: ${key.substring(0, 9)}`);
    }

    console.log(`RAZORPAY_INIT // ID: ${key.substring(0, 12)}... // SECRET_MASKED // MODE: ${isLive ? 'LIVE' : isTest ? 'TEST' : 'UNKNOWN'}`);
    
    razorpayInstance = new Razorpay({
      key_id: key,
      key_secret: secret,
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
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global Context
  const context: {
    firestore: any;
    resend: Resend | null;
    razorpay: Razorpay | null;
    isFirestoreEnabled: boolean;
  } = {
    firestore: null,
    resend: null,
    razorpay: null,
    isFirestoreEnabled: true // Assume enabled until proven otherwise
  };

  // Improved Firebase Init
  try {
    console.log('INITIALIZING_RESOURCES_SYNC');
    
    // 1. SQLite Init (MUST be first and successful)
    initializeSql();
    seedProducts(PRODUCTS);
    console.log('SQLITE_READY');
  } catch (sqlErr) {
    console.error('SQLITE_INIT_CRITICAL_FAILURE:', sqlErr);
    // Continue but log, as better-sqlite3 might have already loaded
  }

  const initPromise = (async () => {
    try {
      console.log('INITIALIZING_CLOUD_RESOURCES_ASYNC');
      
      // Firebase Admin Init
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      
      if (!admin.apps.length) {
        console.log(`PROVISIONING_FIREBASE_ADMIN // AUTO_DETECT // DB_ID: ${dbId}`);
        admin.initializeApp();
      }
      
      const app = admin.app();
      console.log(`FIREBASE_APP_INITIALIZED // ACTIVE_PROJECT: ${app.options.projectId}`);
      
      // We try the configured database ID, but also log if it seems unconventional
      context.firestore = getFirestore(app, (dbId === '(default)' || !dbId) ? undefined : dbId);
      
      // Critical Diagnostic Read
      try {
        console.log(`ATTEMPTING_DIAGNOSTIC_READ // DB: ${dbId}`);
        const testRef = context.firestore.collection('products').limit(1);
        await testRef.get();
        console.log('DIAGNOSTIC_READ_SUCCESS');
      } catch (diagErr: any) {
        if (diagErr.message?.includes('Cloud Firestore API has not been used') || diagErr.message?.includes('disabled')) {
          console.error('CRITICAL_CONFIG_ERROR: Cloud Firestore API is DISABLED in this project. Cross-device sync will be inactive.');
          context.isFirestoreEnabled = false;
          context.firestore = null;
        } else if (diagErr.message?.includes('PERMISSION_DENIED') || diagErr.code === 7) {
          console.error("CRITICAL_IAM_ERROR: Service Account lacks Cloud Datastore User role.");
          context.isFirestoreEnabled = false;
          context.firestore = null;
        }
      }

      // Firestore Seeding
      if (context.firestore) {
        try {
          const productsSnapshot = await context.firestore.collection('products').limit(1).get();
          if (productsSnapshot.empty) {
            console.log('SEEDING_FIRESTORE');
            const batch = context.firestore.batch();
            PRODUCTS.forEach((p: any) => {
              batch.set(context.firestore.collection('products').doc(p.id), {
                ...p,
                price: Number(p.price),
                originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            await batch.commit();
            console.log('FIRESTORE_SEED_COMPLETE');
          }
        } catch (e: any) {
          console.warn(`FIRESTORE_SEED_SKIPPED // ${e.message}`);
        }
      }
    } catch (err) {
      console.error('RESOURCE_INIT_ERROR:', err);
    }
  })();

  // Middleware to ensure init is logged (does not block, just for tracking)
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`API_REQUEST: ${req.method} ${req.url}`);
    }
    next();
  });

  // RESTORE THE SHARED REFS
  // We'll update the global firestore variable once init is done
  initPromise.then(() => {
    firestore = context.firestore;
  });

  app.get('/api/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        sqlite: !!sqliteDb,
        firestore: !!firestore && context.isFirestoreEnabled,
        razorpay: !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET,
        resend: !!process.env.RESEND_API_KEY
      },
      cloudSync: context.isFirestoreEnabled ? 'active' : 'disabled_by_policy_or_api'
    };
    res.json(health);
  });

  app.get('/api/firestore-health', async (req, res) => {
    try {
      if (!firestore || !context.isFirestoreEnabled) return res.status(503).json({ status: 'error', message: 'FIRESTORE_NOT_AVAILABLE_OR_DISABLED' });
      await firestore.collection('system').doc('health').set({
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        status: 'Operational'
      });
      res.json({ status: 'ok', database: firebaseConfig.firestoreDatabaseId });
    } catch (err: any) {
      console.error('FIRESTORE_HEALTH_FALURE:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Product Sector
  app.get('/api/products', (req, res) => {
    try {
      const products = sqliteDb.prepare('SELECT * FROM products WHERE is_archived = 0').all();
      console.log(`RETR_PRODUCTS // Active_Items: ${products.length} // Table_Scan_Complete`);
      
      const mapped = products.map((p: any) => ({
        ...p,
        originalPrice: p.original_price,
        images: JSON.parse(p.images || '[]'),
        colors: JSON.parse(p.colors || '[]'),
        sizes: JSON.parse(p.sizes || '[]'),
        isNew: p.is_archived === 0 
      }));
      res.json(Array.isArray(mapped) ? mapped : []);
    } catch (err) {
      console.error('CRITICAL_PRODUCT_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
  });

  // API Routes
  app.post('/api/auth-sync', async (req, res) => {
    const { uid, email, displayName, name, photoURL } = req.body;
    const finalName = name || displayName;
    try {
      // Local SQLite Sync
      const stmt = sqliteDb.prepare('INSERT OR REPLACE INTO users (uid, email, display_name) VALUES (?, ?, ?)');
      stmt.run(uid, email, finalName || null);

      // Firestore Cloud Sync (Only if enabled)
      if (firestore && context.isFirestoreEnabled) {
        try {
          await firestore.collection('users').doc(uid).set({
            uid,
            email,
            displayName: finalName || null,
            photoURL: photoURL || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (fErr: any) {
          if (fErr.message?.includes('disabled') || fErr.code === 7) {
            context.isFirestoreEnabled = false;
          }
          console.error(`FIRESTORE_AUTH_SYNC_FAILURE // UID: ${uid} // ERROR: ${fErr.message}`);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('AUTH_SYNC_FAILURE:', err);
      res.status(500).json({ error: 'Auth sync failed' });
    }
  });

  // Order Management Sector
  app.get('/api/orders', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });
    
    try {
      if (firestore && context.isFirestoreEnabled) {
        try {
          const snapshot = await firestore.collection('orders')
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .get();
          
          const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: (doc.data().createdAt as admin.firestore.Timestamp)?.toDate()?.toISOString()
          }));
          
          return res.json(Array.isArray(orders) ? orders : []);
        } catch (fErr) {
          console.warn('FIRESTORE_ORDERS_RETR_FAILURE // FALLING_BACK_TO_SQL');
        }
      }
      
      const orders = sqliteDb.prepare('SELECT * FROM orders WHERE uid = ? ORDER BY created_at DESC').all(uid);
      const ordersWithItems = orders.map((order: any) => {
        const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        return {
          ...order,
          items,
          created_at: order.created_at
        };
      });
      res.json(ordersWithItems);
    } catch (err) {
      console.error('ORDER_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
  });

  // Cart Persistence Sector
  app.get('/api/cart', async (req, res) => {
    const { uid } = req.query as { uid: string };
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });
    
    try {
      let cloudItems = null;
      if (firestore && context.isFirestoreEnabled) {
        try {
          const cartDoc = await firestore.collection('users').doc(uid).collection('cart').doc('default').get();
          if (cartDoc.exists) {
            cloudItems = cartDoc.data()?.items;
          }
        } catch (innerErr) {
          console.warn('FIRESTORE_RETR_FAILURE // USING_SQL_CACHE');
        }
      }

      if (cloudItems !== null) {
        return res.json(cloudItems);
      }

      const row = sqliteDb.prepare('SELECT items FROM cart WHERE uid = ?').get(uid) as { items: string } | undefined;
      res.json(row ? JSON.parse(row.items) : []);
    } catch (err) {
      console.error('CART_RETR_CRITICAL_FAILURE:', err);
      res.status(500).json({ error: 'CART_FETCH_FAILURE' });
    }
  });

  // Review Sector
  app.get('/api/reviews/:productId', async (req, res) => {
    const { productId } = req.params;
    try {
      if (firestore && context.isFirestoreEnabled) {
        try {
          const snapshot = await firestore.collection('reviews')
            .where('productId', '==', productId)
            .orderBy('createdAt', 'desc')
            .get();
          const reviews = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            createdAt: (doc.data().createdAt as admin.firestore.Timestamp)?.toDate()?.toISOString() || new Date().toISOString()
          }));
          return res.json(reviews);
        } catch (fErr) {
          console.warn('FIRESTORE_REVIEWS_RETR_FAILURE // FALLING_BACK_TO_SQL');
        }
      }

      const rows = sqliteDb.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC').all(productId);
      const reviews = rows.map((r: any) => ({
        id: String(r.id),
        productId: r.product_id,
        userId: r.user_id,
        userName: r.user_name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at
      }));
      res.json(reviews);
    } catch (err) {
      console.error('REVIEW_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
  });

  app.post('/api/reviews', async (req, res) => {
    const { productId, rating, comment, userName, userId } = req.body;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    try {
      let firestoreId = null;
      if (firestore && context.isFirestoreEnabled) {
        try {
          const docRef = await firestore.collection('reviews').add({
            productId,
            rating,
            comment,
            userName,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          firestoreId = docRef.id;
        } catch (fErr) {
          console.error('FIRESTORE_REVIEW_SUBMISSION_FAILURE:', fErr);
        }
      }

      const stmt = sqliteDb.prepare('INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(productId, userId, userName || 'Anonymous', rating, comment);
      
      res.json({ id: firestoreId || String(info.lastInsertRowid) });
    } catch (err) {
      console.error('REVIEW_SUBMISSION_FAILURE:', err);
      res.status(500).json({ error: 'REVIEW_SUBMISSION_FAILURE' });
    }
  });

  app.post('/api/cart', async (req, res) => {
    const { uid, items } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID_REQUIRED' });

    try {
      sqliteDb.prepare('INSERT OR REPLACE INTO cart (uid, items, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run(uid, JSON.stringify(items));

      // CLOUD SYNC (Only if enabled)
      if (firestore && context.isFirestoreEnabled) {
        try {
          await firestore.collection('users').doc(uid).collection('cart').doc('default').set({
            items,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (fErr: any) {
          if (fErr.message?.includes('disabled') || fErr.code === 7) {
            context.isFirestoreEnabled = false;
          }
          console.error(`FIRESTORE_CART_SYNC_FAILURE // UID: ${uid} // ERROR: ${fErr.message}`);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('CART_SYNC_FAILURE:', err);
      res.status(500).json({ error: 'CART_SYNC_FAILURE' });
    }
  });

  // Admin Sector (Restricted)
  const ADMIN_EMAILS = ['prithvi2698@gmail.com'];
  
  app.get('/api/admin/orders', async (req, res) => {
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      if (firestore && context.isFirestoreEnabled) {
        try {
          const snapshot = await firestore.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
          
          const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            user_email: doc.data().email,
            created_at: (doc.data().createdAt as admin.firestore.Timestamp)?.toDate()?.toISOString()
          }));
          
          return res.json(Array.isArray(orders) ? orders : []);
        } catch (fErr) {
          console.warn('FIRESTORE_ADMIN_ORDERS_RETR_FAILURE // FALLING_BACK_TO_SQL');
        }
      }
      
      const orders = sqliteDb.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
      const ordersWithItems = orders.map((order: any) => {
        const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        return {
          ...order,
          items,
          user_email: order.email,
          created_at: order.created_at
        };
      });
      res.json(ordersWithItems);
    } catch (err) {
      console.error('ADMIN_ORDER_FETCH_FAILURE:', err);
      res.status(500).json([]);
    }
  });

  app.patch('/api/admin/orders/:id/update-id', async (req, res) => {
    const { id: oldId } = req.params;
    const { newId } = req.body;
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    if (!newId || newId.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_ID_SEQUENCE' });
    }

    try {
      if (firestore && context.isFirestoreEnabled) {
        try {
          const docRef = firestore.collection('orders').doc(oldId);
          const doc = await docRef.get();
          if (doc.exists) {
            const data = doc.data();
            await firestore.collection('orders').doc(newId).set({
              ...data,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await docRef.delete();
          }
        } catch (fErr) {
          console.error('FIRESTORE_ID_UPDATE_FAILURE:', fErr);
        }
      }

      sqliteDb.transaction(() => {
        // Since we are changing PK, we need to update children or use ON UPDATE CASCADE if it was set
        // But manually updating is safer if PRAGMA foreign_keys = OFF
        const updateOrder = sqliteDb.prepare('UPDATE orders SET id = ? WHERE id = ?');
        const updateItems = sqliteDb.prepare('UPDATE order_items SET order_id = ? WHERE order_id = ?');
        
        updateItems.run(newId, oldId);
        updateOrder.run(newId, oldId);
      })();
      
      res.json({ success: true });
    } catch (err) {
      console.error('ID_UPDATE_FAILURE:', err);
      res.status(500).json({ error: 'ID_UPDATE_FAILURE' });
    }
  });

  app.post('/api/admin/orders/:id/resend', async (req, res) => {
    const { id } = req.params;
    const emailHeader = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(emailHeader)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      let order: any;
      if (firestore && context.isFirestoreEnabled) {
        const doc = await firestore.collection('orders').doc(id).get();
        if (doc.exists) {
          order = { id: doc.id, ...doc.data() };
        }
      }

      if (!order) {
        const row = sqliteDb.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
        if (row) {
          const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
          order = { ...row, items };
        }
      }

      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      const resend = getResendClient();
      const orderItems = order.items || [];
      const targetEmail = order.email || order.user_email;

      const { data, error } = await resend.emails.send({
        from: 'P-THREAD <onboarding@resend.dev>',
        to: [targetEmail],
        subject: 'ARCHIVE_RESYNC // Manifest Re-Dispatch',
        html: `
          <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; border: 1px solid #e61e1e;">
            <p style="color: #e61e1e; font-size: 10px; margin-bottom: 20px;">[RE-DISPATCH_PROTOCOL_ACTIVE]</p>
            <h1 style="color: #e61e1e; font-size: 24px; border-bottom: 2px solid #e61e1e; padding-bottom: 10px;">P-THREAD // ACQUISITION_RECEIPT</h1>
            <p style="font-size: 12px; color: #888;">Manifest_ID: ${order.id}</p>
            
            <div style="margin: 40px 0;">
              <h2 style="font-size: 16px; color: #fff; text-transform: uppercase;">Secured Items:</h2>
              <ul style="list-style: none; padding: 0;">
                ${orderItems.map((item: any) => `
                  <li style="margin-bottom: 15px; border-left: 2px solid #333; padding-left: 15px;">
                    <strong style="display: block;">${item.name || item.product_name}</strong>
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
                  <span style="color: #fff;">₹${order.shipping_amount || order.shippingAmount || 0}.00</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #888;">ACQUISITION_TOTAL:</span>
                  <strong style="color: #fff; font-size: 20px;">₹${order.total}.00</strong>
                </div>
              </div>
            </div>

            <p style="margin-top: 40px; font-size: 10px; color: #444; line-height: 1.6;">
              LOGISTICS_NOTE: Manifest re-synchronized by operator. Current sector status: ${order.status}.
            </p>
          </div>
        `,
      });

      if (error) return res.status(400).json({ error });
      res.json({ success: true, data });
    } catch (err) {
      console.error('RESEND_FAILURE:', err);
      res.status(500).json({ error: 'RESEND_PROTOCOL_ERROR' });
    }
  });

  app.patch('/api/admin/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const email = req.headers['x-admin-email'] as string;
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS' });

    try {
      let firestoreUpdated = false;
      if (firestore && context.isFirestoreEnabled) {
        try {
          await firestore.collection('orders').doc(id).update({
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          firestoreUpdated = true;
        } catch (fErr) {
          console.error('FIRESTORE_ORDER_UPDATE_FAILURE:', fErr);
        }
      }

      // Always update SQL if it exists
      sqliteDb.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
      
      res.json({ success: true, firestoreUpdated });
    } catch (err) {
      console.error('ORDER_UPDATE_FAILURE:', err);
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

    if (!secret) {
      return res.status(500).json({ error: 'RAZORPAY_SECRET_MISSING' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'SIGNATURE_INVALID' });
    }

    // Decrement Inventory
    if (order_items && Array.isArray(order_items)) {
      try {
        sqliteDb.transaction(() => {
          const updateStock = sqliteDb.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
          for (const item of order_items) {
            updateStock.run(item.quantity, item.id, item.quantity);
          }
        })();
      } catch (err) {
        console.error('INVENTORY_UPDATE_FAILURE:', err);
      }
    }
    res.json({ success: true });
  });

  app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
    console.log(`CREATE_ORDER_INCOMING // Amount: ${amount}`);
    
    // Minimum 1 INR (100 paise)
    if (amount === undefined || amount < 1) {
      return res.status(400).json({ error: 'INVALID_AMOUNT // Minimum amount is 1 INR' });
    }

    try {
      const razorpay = getRazorpay();
      const options = {
        amount: Math.round(amount * 100), // in paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`
      };
      
      console.log('RAZORPAY_GATEWAY_INIT // Options:', JSON.stringify(options));
      const order = await razorpay.orders.create(options);
      console.log('RAZORPAY_ORDER_SUCCESS // ID:', order.id);
      res.json(order);
    } catch (err: any) {
      console.error('RAZORPAY_ORDER_FAILURE:', err);
      
      // Detailed error analysis
      let errorMsg = 'ORDER_CREATION_FAILURE';
      if (err.error) {
        errorMsg = err.error.description || err.error.code || errorMsg;
        if (err.error.description === 'Authentication failed') {
          errorMsg = 'RAZORPAY_AUTH_FAILED // Check Key ID and Secret in Settings';
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      res.status(500).json({ 
        error: errorMsg,
        details: err.error || null,
        hint: 'Ensure VITE_RAZORPAY_KEY_ID matches RAZORPAY_KEY_ID and Secret is correct.'
      });
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
    const { email, phone, address, city, postalCode, country, orderDetails, total, shipping, paymentId, userId } = req.body;
    const orderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log(`PROCESSING_ORDER // ID: ${orderId} // TARGET: ${email}`);

    try {
      // 1. SQL Sync (PRIMARY)
      try {
        sqliteDb.transaction(() => {
          const orderStmt = sqliteDb.prepare('INSERT INTO orders (id, uid, email, phone, address, city, postal_code, country, total, shipping_amount, payment_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          orderStmt.run(orderId, userId || null, email, phone || null, address || null, city || null, postalCode || null, country || null, total, shipping, paymentId || null);

          const itemStmt = sqliteDb.prepare('INSERT INTO order_items (order_id, product_name, color, size, quantity, price) VALUES (?, ?, ?, ?, ?, ?)');
          for (const item of orderDetails) {
            itemStmt.run(orderId, item.name, item.color, item.size, item.quantity, item.price);
          }
        })();
        console.log(`ORDER_SQL_PERSISTED // ID: ${orderId}`);
      } catch (sqlErr) {
        console.error('ORDER_SQL_CRITICAL_FAILURE:', sqlErr);
        throw new Error('DATABASE_COMMIT_FAILURE');
      }

      // 2. FIRESTORE SYNC (SECONDARY)
      if (firestore && context.isFirestoreEnabled) {
        try {
          await firestore.collection('orders').doc(orderId).set({
            userId: userId || null,
            email,
            phone: phone || null,
            shippingAddress: {
              address: address || null,
              city: city || null,
              postalCode: postalCode || null,
              country: country || null
            },
            total,
            shippingAmount: shipping,
            paymentId: paymentId || null,
            items: orderDetails,
            status: 'PENDING_DISPATCH',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`ORDER_FIRESTORE_SYNCED // ID: ${orderId}`);
        } catch (fErr) {
          console.warn('ORDER_FIRESTORE_SYNC_FAILURE // CONTINUING_WITH_SQL:', fErr);
        }
      }

      // 3. EMAIL RECEIPT (TERTIARY - NON-BLOCKING)
      try {
        const resend = getResendClient();
        const { error } = await resend.emails.send({
          from: 'P-THREAD <onboarding@resend.dev>',
          to: [email],
          subject: 'ARCHIVE_SECURED // Acquisition Receipt Manifest',
          html: `
            <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; border: 1px solid #e61e1e;">
              <h1 style="color: #e61e1e; font-size: 24px; border-bottom: 2px solid #e61e1e; padding-bottom: 10px;">P-THREAD // ACQUISITION_RECEIPT</h1>
              <p style="font-size: 12px; color: #888;">Manifest_ID: ${orderId}</p>
              
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
                LOGISTICS_NOTE: Your items are now moving through the distribution grid. Tracking manifests will be updated in your terminal as sectors are cleared.
              </p>
            </div>
          `,
        });

        if (error) {
          console.warn('EMAIL_DISPATCH_FAILED // SILENT:', error);
        } else {
          console.log(`EMAIL_DISPATCHED // ID: ${orderId}`);
        }
      } catch (mailErr) {
        console.warn('RESEND_NOT_CONFIGURED // EMAIL_SKIPPED');
      }

      // 4. RESPONSE SUCCESS
      res.status(200).json({ success: true, orderId });
    } catch (err: any) {
      console.error('SERVER_ORDER_HANDLER_FAILURE:', err);
      res.status(500).json({ 
        error: 'ORDER_COMMIT_FAILURE', 
        message: err.message || 'INTERNAL_PROTOCOL_ERROR' 
      });
    }
  });

  // API 404 Handler (to avoid falling through to HTML SPA fallback)
  app.use('/api', (req, res) => {
    console.warn(`API_404: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'API_ENDPOINT_NOT_FOUND', path: req.url });
  });

  // Global Error Handler for API Routes
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('API_GLOBAL_ERROR:', err);
    res.status(500).json({ 
      error: 'INTERNAL_SERVER_ERROR', 
      message: err.message || 'An unexpected protocol error occurred.'
    });
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
    console.log(`P-THREAD Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('SERVER_START_FAILURE:', err);
  process.exit(1);
});
