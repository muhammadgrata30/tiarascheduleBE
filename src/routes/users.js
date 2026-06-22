const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken } = require('../middlewares/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) are allowed'));
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, whatsapp, role, profile_picture, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/me', authenticateToken, async (req, res) => {
  const { name, whatsapp, email, password } = req.body;
  const userId = req.user.id;

  if (!name || !whatsapp || !email) {
    return res.status(400).json({ error: 'Name, WhatsApp and Email are required' });
  }

  try {
    const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email is already taken by another user' });
    }

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name = ?, email = ?, whatsapp = ?, password = ? WHERE id = ?',
        [name, email, whatsapp, hashedPassword, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET name = ?, email = ?, whatsapp = ? WHERE id = ?',
        [name, email, whatsapp, userId]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an image' });
  }

  const userId = req.user.id;
  const dbPath = `/uploads/avatars/${req.file.filename}`;

  try {
    const [rows] = await db.query('SELECT profile_picture FROM users WHERE id = ?', [userId]);
    if (rows.length > 0 && rows[0].profile_picture) {
      const oldPath = path.join(__dirname, '../../', rows[0].profile_picture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [dbPath, userId]);

    res.json({
      message: 'Avatar uploaded successfully',
      profile_picture: dbPath
    });
  } catch (err) {
    console.error('Upload avatar error:', err.message);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

module.exports = router;
