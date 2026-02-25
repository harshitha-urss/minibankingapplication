const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/*
========================
REGISTER
========================
*/
router.post('/register', async (req, res) => {
  try {
    const { cname, email, password, phone } = req.body;

    if (!cname || !email || !password || !phone) {
      return res.status(400).json({ error: 'ALL_FIELDS_REQUIRED' });
    }

    const [existingUser] = await db.query(
      'SELECT * FROM customer WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'USER_ALREADY_EXISTS' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'INSERT INTO customer (cname, email, phone, cpassword) VALUES (?, ?, ?, ?)',
      [cname, email, phone, hashedPassword]
    );

    res.status(201).json({
      message: 'REGISTRATION_SUCCESS'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/*
========================
LOGIN
========================
*/
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'ALL_FIELDS_REQUIRED' });
    }

    const [users] = await db.query(
      'SELECT * FROM customer WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.cpassword);

    if (!isMatch) {
      return res.status(400).json({ error: 'WRONG_PASSWORD' });
    }

    const token = jwt.sign(
      { cid: user.cid },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'LOGIN_SUCCESS',
      token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;