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
    const result = await db.query(
      'SELECT balance FROM customer WHERE cid = $1',
      [req.user.cid]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ balance: Number(result.rows[0].balance).toFixed(2) });

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
  const client = await db.connect();

  try {
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    await client.query('BEGIN');

    await client.query(
      'UPDATE customer SET balance = balance + $1 WHERE cid = $2',
      [amount, req.user.cid]
    );

    await client.query(
      'INSERT INTO transactions (cid, type, amount) VALUES ($1, $2, $3)',
      [req.user.cid, 'DEPOSIT', amount]
    );

    await client.query('COMMIT');

    res.json({ message: 'Deposit successful' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});


/*
========================
WITHDRAW
========================
*/
router.post('/withdraw', verifyToken, async (req, res) => {
  const client = await db.connect();

  try {
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      'SELECT balance FROM customer WHERE cid = $1 FOR UPDATE',
      [req.user.cid]
    );

    const currentBalance = Number(result.rows[0].balance);

    if (amount > currentBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await client.query(
      'UPDATE customer SET balance = balance - $1 WHERE cid = $2',
      [amount, req.user.cid]
    );

    await client.query(
      'INSERT INTO transactions (cid, type, amount) VALUES ($1, $2, $3)',
      [req.user.cid, 'WITHDRAW', amount]
    );

    await client.query('COMMIT');

    res.json({ message: 'Withdraw successful' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});


/*
========================
TRANSFER
========================
*/
router.post('/transfer', verifyToken, async (req, res) => {
  const client = await db.connect();

  try {
    const { phone, amount } = req.body;

    if (!phone || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    await client.query('BEGIN');

    const senderResult = await client.query(
      'SELECT * FROM customer WHERE cid = $1 FOR UPDATE',
      [req.user.cid]
    );

    const sender = senderResult.rows[0];

    if (amount > sender.balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const receiverResult = await client.query(
      'SELECT * FROM customer WHERE phone = $1 FOR UPDATE',
      [phone]
    );

    if (!receiverResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Receiver not found' });
    }

    const receiver = receiverResult.rows[0];

    await client.query(
      'UPDATE customer SET balance = balance - $1 WHERE cid = $2',
      [amount, sender.cid]
    );

    await client.query(
      'UPDATE customer SET balance = balance + $1 WHERE cid = $2',
      [amount, receiver.cid]
    );

    await client.query(
      'INSERT INTO transactions (cid, type, amount) VALUES ($1, $2, $3)',
      [sender.cid, 'TRANSFER', amount]
    );

    await client.query(
      'INSERT INTO transactions (cid, type, amount) VALUES ($1, $2, $3)',
      [receiver.cid, 'RECEIVED', amount]
    );

    await client.query('COMMIT');

    res.json({ message: 'Transfer successful' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});


/*
========================
TRANSACTION HISTORY
========================
*/
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT type, amount, created_at FROM transactions WHERE cid = $1 ORDER BY created_at DESC',
      [req.user.cid]
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
