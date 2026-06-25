const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, isAdmin } = require('../middlewares/auth');
const { uploadProof } = require('../config/cloudinary');

const WORKING_SLOTS = [
  '14:00:00',
  '15:00:00',
  '16:00:00',
  '17:00:00',
  '18:00:00',
  '19:00:00',
  '20:00:00',
];

function checkOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

router.get('/availability', async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date query parameter is required' });
  }

  try {
    // 1. Cek tabel admin_blocks apakah hari ini libur atau diblokir
    const [blocks] = await db.query(
      'SELECT * FROM admin_blocks WHERE ? BETWEEN start_date AND end_date',
      [date]
    );

    if (blocks.length > 0) {
      // Jika diblokir satu hari penuh, kembalikan semua slot sebagai tidak tersedia
      const allBusy = WORKING_SLOTS.map(slot => ({
        time: slot.substring(0, 5),
        fullTime: slot,
        available: false,
        reason: blocks[0].title
      }));
      return res.json({ date, slots: allBusy });
    }

    const [dbBookings] = await db.query(
      'SELECT start_time, end_time FROM bookings WHERE booking_date = ? AND status != "Rejected"',
      [date]
    );

    const busyRanges = [];

    dbBookings.forEach(booking => {
      busyRanges.push({
        start: booking.start_time,
        end: booking.end_time
      });
    });

    const availability = WORKING_SLOTS.map(slot => {
      const [hour, minute] = slot.split(':').map(Number);
      const slotStart = slot;
      const endHour = String(hour + 1).padStart(2, '0');
      const slotEnd = `${endHour}:00:00`;

      let isBusy = false;
      for (const range of busyRanges) {
        if (checkOverlap(slotStart, slotEnd, range.start, range.end)) {
          isBusy = true;
          break;
        }
      }

      return {
        time: slot.substring(0, 5),
        fullTime: slot,
        available: !isBusy
      };
    });

    res.json({ date, slots: availability });
  } catch (err) {
    console.error('Availability check error:', err.message);
    res.status(500).json({ error: 'Failed to fetch slot availability' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { meeting_type_id, notes, mood, prep_items, booking_date, start_time } = req.body;
  const userId = req.user.id;

  if (!meeting_type_id || !booking_date || !start_time) {
    return res.status(400).json({ error: 'Meeting type, date, and start time are required' });
  }

  try {
    const [meetingTypes] = await db.query('SELECT * FROM meeting_types WHERE id = ?', [meeting_type_id]);
    if (meetingTypes.length === 0) {
      return res.status(404).json({ error: 'Meeting type not found' });
    }
    const meeting = meetingTypes[0];

    const [sHour, sMin] = start_time.split(':').map(Number);
    const totalMinutes = sHour * 60 + sMin + meeting.duration;
    const endHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const endMin = String(totalMinutes % 60).padStart(2, '0');
    const end_time = `${endHour}:${endMin}:00`;

    // Cek block admin
    const [blocks] = await db.query(
      'SELECT * FROM admin_blocks WHERE ? BETWEEN start_date AND end_date',
      [booking_date]
    );

    if (blocks.length > 0) {
      return res.status(400).json({ error: 'Tanggal tersebut tidak tersedia (Diblokir oleh Admin).' });
    }

    const [dbBookings] = await db.query(
      'SELECT start_time, end_time FROM bookings WHERE booking_date = ? AND status != "Rejected"',
      [booking_date]
    );

    const busyRanges = [];
    dbBookings.forEach(b => busyRanges.push({ start: b.start_time, end: b.end_time }));

    let isAvailable = true;
    for (const range of busyRanges) {
      if (checkOverlap(start_time, end_time, range.start, range.end)) {
        isAvailable = false;
        break;
      }
    }

    if (!isAvailable) {
      return res.status(400).json({ error: 'Selected slot is no longer available' });
    }

    const isPaid = parseFloat(meeting.price) > 0;
    const initialStatus = isPaid ? 'Pending Payment' : 'Approved';

    const [result] = await db.query(
      'INSERT INTO bookings (user_id, meeting_type_id, notes, mood, prep_items, booking_date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, meeting_type_id, notes || '', mood || '', JSON.stringify(prep_items || []), booking_date, start_time, end_time, initialStatus]
    );

    res.status(201).json({
      message: isPaid ? 'Booking created. Please make payment.' : 'Booking confirmed!',
      bookingId: result.insertId,
      status: initialStatus
    });
  } catch (err) {
    console.error('Create booking error:', err.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.post('/:id/payment-proof', authenticateToken, uploadProof.single('proof'), async (req, res) => {
  const bookingId = req.params.id;
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a payment proof file' });
  }

  // Cloudinary stores URL in req.file.path
  const dbPath = req.file.path;

  try {
    const [bookings] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookings[0];

    if (booking.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized operation' });
    }

    await db.query(
      'UPDATE bookings SET payment_proof = ?, status = "Pending Approval" WHERE id = ?',
      [dbPath, bookingId]
    );

    res.json({
      message: 'Payment proof uploaded successfully. Booking is now pending admin approval.',
      payment_proof: dbPath
    });
  } catch (err) {
    console.error('Upload proof error:', err.message);
    res.status(500).json({ error: 'Failed to upload payment proof' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT b.*, m.title as meeting_title, m.price, m.duration, m.color_theme 
       FROM bookings b
       LEFT JOIN meeting_types m ON b.meeting_type_id = m.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error('History fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/admin/list', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name as user_name, u.email as user_email, u.whatsapp as user_whatsapp, 
              m.title as meeting_title, m.price, m.duration
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN meeting_types m ON b.meeting_type_id = m.id
       ORDER BY b.booking_date DESC, b.start_time DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin fetch bookings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings list' });
  }
});

router.put('/admin/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  const bookingId = req.params.id;

  try {
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (rows[0].status === 'Approved') {
      return res.status(400).json({ error: 'Booking is already approved' });
    }

    await db.query('UPDATE bookings SET status = "Approved" WHERE id = ?', [bookingId]);

    res.json({ message: 'Booking successfully approved!' });
  } catch (err) {
    console.error('Approve booking error:', err.message);
    res.status(500).json({ error: 'Failed to approve booking' });
  }
});

router.put('/admin/:id/reject', authenticateToken, isAdmin, async (req, res) => {
  const bookingId = req.params.id;

  try {
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query('UPDATE bookings SET status = "Rejected" WHERE id = ?', [bookingId]);

    res.json({ message: 'Booking rejected successfully' });
  } catch (err) {
    console.error('Reject booking error:', err.message);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
  const bookingId = req.params.id;

  try {
    const [rows] = await db.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query('DELETE FROM bookings WHERE id = ?', [bookingId]);

    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Delete booking error:', err.message);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

router.put('/admin/:id/comment', authenticateToken, isAdmin, async (req, res) => {
  const bookingId = req.params.id;
  const { admin_comment } = req.body;

  try {
    const [rows] = await db.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query('UPDATE bookings SET admin_comment = ? WHERE id = ?', [admin_comment, bookingId]);

    res.json({ message: 'Komentar Admin berhasil disimpan' });
  } catch (err) {
    console.error('Add comment error:', err.message);
    res.status(500).json({ error: 'Gagal menyimpan komentar admin' });
  }
});

module.exports = router;
