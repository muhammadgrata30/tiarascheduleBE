const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken } = require('../middlewares/auth');
const { uploadAvatar } = require('../config/cloudinary');

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

router.post('/me/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an image' });
  }

  const userId = req.user.id;
  // With Cloudinary, the secure URL is in req.file.path
  const dbPath = req.file.path;

  try {
    // Note: If you want to delete the old avatar from Cloudinary, you would need
    // to extract the public_id from the old URL and call cloudinary.uploader.destroy().
    // For MVP, we simply overwrite the database reference.

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
