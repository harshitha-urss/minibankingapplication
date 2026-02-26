require('dotenv').config();
const db = require('./db');

async function setupDatabase() {
  try {
    console.log("🚀 Creating tables...");

    // CUSTOMER TABLE
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer (
        cid SERIAL PRIMARY KEY,
        cname VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15) UNIQUE NOT NULL,
        cpassword TEXT NOT NULL,
        balance NUMERIC(12,2) DEFAULT 0.00
      );
    `);

    // TRANSACTIONS TABLE
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        tid SERIAL PRIMARY KEY,
        cid INTEGER REFERENCES customer(cid) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Tables created successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    process.exit(1);
  }
}

setupDatabase();