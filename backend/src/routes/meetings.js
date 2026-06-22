const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM meeting_types ORDER BY price DESC, id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Fetch meetings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch meeting types' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM meeting_types WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Meeting type not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch single meeting error:', err.message);
    res.status(500).json({ error: 'Failed to fetch meeting type' });
  }
});

router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { title, description, price, duration, color_theme } = req.body;

  if (!title || price === undefined || !duration) {
    return res.status(400).json({ error: 'Title, price and duration are required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO meeting_types (title, description, price, duration, color_theme) VALUES (?, ?, ?, ?, ?)',
      [title, description || '', price, duration, color_theme || '#ff85a2']
    );
    res.status(201).json({
      message: 'Meeting type created successfully',
      meetingTypeId: result.insertId
    });
  } catch (err) {
    console.error('Create meeting error:', err.message);
    res.status(500).json({ error: 'Failed to create meeting type' });
  }
});

router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { title, description, price, duration, color_theme } = req.body;
  const meetingId = req.params.id;

  if (!title || price === undefined || !duration) {
    return res.status(400).json({ error: 'Title, price and duration are required' });
  }

  try {
    const [result] = await db.query(
      'UPDATE meeting_types SET title = ?, description = ?, price = ?, duration = ?, color_theme = ? WHERE id = ?',
      [title, description || '', price, duration, color_theme || '#ff85a2', meetingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Meeting type not found' });
    }

    res.json({ message: 'Meeting type updated successfully' });
  } catch (err) {
    console.error('Update meeting error:', err.message);
    res.status(500).json({ error: 'Failed to update meeting type' });
  }
});

router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  const meetingId = req.params.id;

  try {
    const [result] = await db.query('DELETE FROM meeting_types WHERE id = ?', [meetingId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Meeting type not found' });
    }
    res.json({ message: 'Meeting type deleted successfully' });
  } catch (err) {
    console.error('Delete meeting error:', err.message);
    res.status(500).json({ error: 'Failed to delete meeting type' });
  }
});

module.exports = router;
