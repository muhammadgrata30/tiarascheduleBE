const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(__dirname, '../uploads/avatars');
const proofsDir = path.join(__dirname, '../uploads/proofs');
[uploadsDir, avatarsDir, proofsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const meetingsRouter = require('./routes/meetings');
const bookingsRouter = require('./routes/bookings');
const googleRouter = require('./routes/google');
const reportsRouter = require('./routes/reports');
const adminBlocksRouter = require('./routes/adminBlocks');

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/google', googleRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin-blocks', adminBlocksRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`Tiara's Schedule Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Failed to start server due to database error:', err.message);
    process.exit(1);
  }
}

startServer();
