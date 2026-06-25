const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const sendEmail = require('../utils/sendEmail');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'tiaras_secret_key_for_jsonwebtoken_123!';

router.post('/register', async (req, res) => {
  const { name, email, password, whatsapp } = req.body;

  if (!name || !email || !password || !whatsapp) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Input Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, whatsapp, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, whatsapp, 'user']
    );

    const token = jwt.sign(
      { id: result.insertId, name, email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        whatsapp,
        role: 'user'
      }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsapp: user.whatsapp,
        role: user.role,
        profile_picture: user.profile_picture
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

module.exports = router;

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    const user = rows[0];
    // Create a 15-minute token
    const resetToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '15m' });
    
    // Front-end reset link (e.g., frontend-domain.com/reset-password?token=...)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <h2>Password Reset</h2>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Please click the link below to set a new password. This link is valid for 15 minutes.</p>
      <a href="${resetLink}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `;

    const emailSent = await sendEmail(email, 'Password Reset Request', htmlContent);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send reset email' });
    }

    res.json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password Route
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
});
