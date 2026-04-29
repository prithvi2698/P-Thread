import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database file
const dbPath = path.resolve(__dirname, '../../archive.db');
const db = new Database(dbPath);

// Create Tables
export function initializeSql() {
  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Users');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Orders');
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      uid TEXT,
      email TEXT NOT NULL,
      total REAL NOT NULL,
      shipping_amount REAL NOT NULL,
      payment_id TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uid) REFERENCES users(uid)
    )
  `);

  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Items');
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      color TEXT,
      size TEXT,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Cart');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart (
      uid TEXT PRIMARY KEY,
      items JSON NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uid) REFERENCES users(uid)
    )
  `);

  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Products');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL,
      original_price REAL,
      category TEXT,
      image TEXT,
      "images" JSON,
      "colors" JSON,
      "sizes" JSON,
      stock INTEGER DEFAULT 10,
      is_archived INTEGER DEFAULT 0
    )
  `);

  console.log('INITIALIZING_SQL_ARCHIVE // Sector: Reviews');
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Migration: Add original_price if missing
  const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
  const hasOriginalPrice = tableInfo.some(col => col.name === 'original_price');
  if (!hasOriginalPrice) {
    console.log('MIGRATING_SQL_ARCHIVE // ADDING_ORIGINAL_PRICE_COLUMN');
    db.exec('ALTER TABLE products ADD COLUMN original_price REAL');
  }
}

export function seedProducts(products: any[]) {
  const check = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
  console.log(`CHECKING_ARCHIVE_STOCK // Available: ${check.count} // Manifest: ${products.length}`);
  
  if (products.length > 0) {
    console.log('SYNCING_ARCHIVE // Core_Acquisition_Series_01');
    const insert = db.prepare(`
      INSERT OR REPLACE INTO products (id, name, description, price, original_price, category, image, images, colors, sizes, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    db.transaction(() => {
      for (const p of products) {
        insert.run(
          p.id, 
          p.name, 
          p.description || '', 
          p.price || 0, 
          p.originalPrice || p.price || 0,
          p.category, 
          p.image || (p.images && p.images[0]) || null,
          JSON.stringify(p.images || []), 
          JSON.stringify(p.colors || []), 
          JSON.stringify(p.sizes || []),
          p.stock || 10
        );
      }
    })();
    const after = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
    console.log(`ARCHIVE_SYNC_COMPLETE // Manifested: ${after.count} Products`);
  }
}

export default db;
