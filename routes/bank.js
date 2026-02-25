const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');

/*
========================
GET BALANCE
========================
*/
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT balance FROM customer WHERE cid = ?',
      [req.user.cid]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ balance: Number(rows[0].balance).toFixed(2) });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


/*
========================
DEPOSIT
========================
*/
router.post('/deposit', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    await connection.beginTransaction();

    await connection.query(
      'UPDATE customer SET balance = balance + ? WHERE cid = ?',
      [amount, req.user.cid]
    );

    await connection.query(
      'INSERT INTO transactions (cid, type, amount) VALUES (?, ?, ?)',
      [req.user.cid, 'DEPOSIT', amount]
    );

    await connection.commit();

    res.json({ message: 'Deposit successful' });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});


/*
========================
WITHDRAW
========================
*/
router.post('/withdraw', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT balance FROM customer WHERE cid = ? FOR UPDATE',
      [req.user.cid]
    );

    const currentBalance = Number(rows[0].balance);

    if (amount > currentBalance) {
      await connection.rollback();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await connection.query(
      'UPDATE customer SET balance = balance - ? WHERE cid = ?',
      [amount, req.user.cid]
    );

    await connection.query(
      'INSERT INTO transactions (cid, type, amount) VALUES (?, ?, ?)',
      [req.user.cid, 'WITHDRAW', amount]
    );

    await connection.commit();

    res.json({ message: 'Withdraw successful' });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});


/*
========================
TRANSFER (USING PHONE)
========================
*/
router.post('/transfer', verifyToken, async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    // Get sender
    const [senderRows] = await db.query(
      'SELECT * FROM customer WHERE cid = ?',
      [req.user.cid]
    );

    const sender = senderRows[0];

    if (amount > sender.balance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Get receiver using phone
    const [receiverRows] = await db.query(
      'SELECT * FROM customer WHERE phone = ?',
      [phone]
    );

    if (receiverRows.length === 0) {
      return res.status(400).json({ message: 'Receiver not found' });
    }

    const receiver = receiverRows[0];

    // Deduct from sender
    await db.query(
      'UPDATE customer SET balance = balance - ? WHERE cid = ?',
      [amount, sender.cid]
    );

    // Add to receiver
    await db.query(
      'UPDATE customer SET balance = balance + ? WHERE cid = ?',
      [amount, receiver.cid]
    );

    // Insert transactions
    await db.query(
      'INSERT INTO transactions (cid, type, amount) VALUES (?, ?, ?)',
      [sender.cid, 'TRANSFER', amount]
    );

    await db.query(
      'INSERT INTO transactions (cid, type, amount) VALUES (?, ?, ?)',
      [receiver.cid, 'RECEIVED', amount]
    );

    res.json({ message: 'Transfer successful' });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/*
========================
TRANSACTION HISTORY
========================
*/
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const [transactions] = await db.query(
      'SELECT type, amount, created_at FROM transactions WHERE cid = ? ORDER BY created_at DESC',
      [req.user.cid]
    );

    res.json(transactions);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;