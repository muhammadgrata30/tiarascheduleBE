const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Get all blocks
router.get('/', async (req, res) => {
  try {
    const [blocks] = await db.query('SELECT * FROM admin_blocks ORDER BY start_date ASC');
    res.json(blocks);
  } catch (err) {
    console.error('Fetch blocks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

// Add new block/holiday
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { start_date, end_date, title, type } = req.body;
  if (!start_date || !end_date || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO admin_blocks (start_date, end_date, title, type) VALUES (?, ?, ?, ?)',
      [start_date, end_date, title, type]
    );
    res.status(201).json({ message: 'Block added successfully', id: result.insertId });
  } catch (err) {
    console.error('Add block error:', err.message);
    res.status(500).json({ error: 'Failed to add block' });
  }
});

// Delete a block
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM admin_blocks WHERE id = ?', [id]);
    res.json({ message: 'Block deleted successfully' });
  } catch (err) {
    console.error('Delete block error:', err.message);
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

module.exports = router;
