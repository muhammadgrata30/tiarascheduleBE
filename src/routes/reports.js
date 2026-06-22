const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, isAdmin } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

router.get('/charts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        DATE_FORMAT(booking_date, '%Y-%m') as month,
        COUNT(b.id) as total_bookings,
        SUM(CASE WHEN m.price > 0 AND b.status = 'Approved' THEN m.price ELSE 0 END) as revenue
      FROM bookings b
      LEFT JOIN meeting_types m ON b.meeting_type_id = m.id
      WHERE b.booking_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Charts data error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chart statistics' });
  }
});

router.get('/export/pdf', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.id, b.booking_date, b.start_time, b.status, 
             u.name as user_name, u.email as user_email, u.whatsapp as user_whatsapp,
             m.title as meeting_title, m.price as meeting_price
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN meeting_types m ON b.meeting_type_id = m.id
      ORDER BY b.booking_date DESC, b.start_time DESC
    `);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings-report.pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#E07A8F').text("Tiara's Schedule - Laporan Pemesanan", { align: 'center' });
    doc.fontSize(10).fillColor('#555555').text(`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center' });
    doc.moveDown(2);

    const totalBookings = bookings.length;
    const approvedBookings = bookings.filter(b => b.status === 'Approved').length;
    const totalRevenue = bookings
      .filter(b => b.status === 'Approved')
      .reduce((sum, b) => sum + parseFloat(b.meeting_price || 0), 0);

    doc.fontSize(12).fillColor('#333333').text(`Total Pemesanan: ${totalBookings}`, { bullet: true });
    doc.text(`Disetujui: ${approvedBookings}`, { bullet: true });
    doc.text(`Total Pendapatan: Rp ${totalRevenue.toLocaleString('id-ID')}`, { bullet: true });
    doc.moveDown(2);

    doc.fillColor('#E07A8F').fontSize(11);
    doc.text('Nama Tamu', 30, 200, { width: 110 });
    doc.text('Tipe Rapat', 140, 200, { width: 120 });
    doc.text('Tanggal & Waktu', 260, 200, { width: 120 });
    doc.text('Status', 380, 200, { width: 100 });
    doc.text('Harga', 480, 200, { width: 80 });

    doc.moveTo(30, 215).lineTo(565, 215).stroke('#E07A8F');
    doc.moveDown(1.5);

    let y = 225;
    doc.fillColor('#333333').fontSize(9);

    bookings.forEach(b => {
      if (y > 750) {
        doc.addPage();
        y = 40;
        doc.fillColor('#E07A8F').fontSize(11);
        doc.text('Nama Tamu', 30, y, { width: 110 });
        doc.text('Tipe Rapat', 140, y, { width: 120 });
        doc.text('Tanggal & Waktu', 260, y, { width: 120 });
        doc.text('Status', 380, y, { width: 100 });
        doc.text('Harga', 480, y, { width: 80 });
        doc.moveTo(30, y + 15).lineTo(565, y + 15).stroke('#E07A8F');
        y += 25;
        doc.fillColor('#333333').fontSize(9);
      }

      const dateStr = new Date(b.booking_date).toLocaleDateString('id-ID');
      const timeStr = b.start_time.substring(0, 5);
      const priceStr = parseFloat(b.meeting_price) > 0 
        ? `Rp ${parseFloat(b.meeting_price).toLocaleString('id-ID')}` 
        : 'Gratis';

      doc.text(b.user_name, 30, y, { width: 110, lineBreak: false });
      doc.text(b.meeting_title || 'N/A', 140, y, { width: 120, lineBreak: false });
      doc.text(`${dateStr} ${timeStr}`, 260, y, { width: 120, lineBreak: false });
      doc.text(b.status, 380, y, { width: 100, lineBreak: false });
      doc.text(priceStr, 480, y, { width: 80, lineBreak: false });

      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

router.get('/export/excel', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.id, b.booking_date, b.start_time, b.status, b.notes, b.mood,
             u.name as user_name, u.email as user_email, u.whatsapp as user_whatsapp,
             m.title as meeting_title, m.price as meeting_price
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN meeting_types m ON b.meeting_type_id = m.id
      ORDER BY b.booking_date DESC, b.start_time DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bookings Report');

    worksheet.columns = [
      { header: 'ID Booking', key: 'id', width: 10 },
      { header: 'Nama Tamu', key: 'user_name', width: 25 },
      { header: 'Email Tamu', key: 'user_email', width: 25 },
      { header: 'WhatsApp', key: 'user_whatsapp', width: 18 },
      { header: 'Tipe Rapat', key: 'meeting_title', width: 25 },
      { header: 'Tanggal', key: 'booking_date', width: 15 },
      { header: 'Waktu Mulai', key: 'start_time', width: 15 },
      { header: 'Harga', key: 'meeting_price', width: 15 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Suasana (Mood)', key: 'mood', width: 20 },
      { header: 'Catatan', key: 'notes', width: 35 }
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE07A8F' }
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    bookings.forEach(b => {
      worksheet.addRow({
        id: b.id,
        user_name: b.user_name,
        user_email: b.user_email,
        user_whatsapp: b.user_whatsapp,
        meeting_title: b.meeting_title || 'N/A',
        booking_date: new Date(b.booking_date).toLocaleDateString('id-ID'),
        start_time: b.start_time.substring(0, 5),
        meeting_price: parseFloat(b.meeting_price) > 0 ? parseFloat(b.meeting_price) : 0,
        status: b.status,
        mood: b.mood || '-',
        notes: b.notes || '-'
      });
    });

    worksheet.getColumn('meeting_price').eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.numFmt = '"Rp "#,##0';
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err.message);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

module.exports = router;
