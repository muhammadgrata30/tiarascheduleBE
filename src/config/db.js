const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306'),
};

let pool;

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Successfully connected to MySQL host.');
    
    const dbName = process.env.DB_NAME || 'tiaras_schedule';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database \`${dbName}\` created or verified.`);
    await connection.end();

    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('MySQL Connection Pool created.');
    await setupTables();
    return pool;
  } catch (err) {
    console.error('=========================================');
    console.error('Database initialization error!');
    console.error('Details:', err);
    console.error('Silakan periksa hal-hal berikut:');
    console.error('1. Apakah server MySQL Anda sudah dinyalakan (misal: Apache/MySQL di XAMPP)?');
    console.error('2. Apakah konfigurasi di file /backend/.env Anda sudah sesuai dengan MySQL Anda (DB_USER, DB_PASSWORD, DB_PORT)?');
    console.error('=========================================');
    throw err;
  }
}

async function setupTables() {
  const connection = await pool.getConnection();
  try {
    console.log('Checking and setting up database tables...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(50) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        profile_picture VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS meeting_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        duration INT NOT NULL DEFAULT 60,
        color_theme VARCHAR(50) DEFAULT '#ff85a2',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        meeting_type_id INT,
        notes TEXT,
        mood VARCHAR(100),
        prep_items TEXT,
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('Pending Payment', 'Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
        payment_proof VARCHAR(255) NULL,
        admin_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        type ENUM('BLOCK', 'HOLIDAY') DEFAULT 'BLOCK',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const [meetings] = await connection.query('SELECT COUNT(*) as count FROM meeting_types');
    if (meetings[0].count === 0) {
      console.log('Seeding default meeting types...');
      const seedMeetings = [
        ['Meeting internal OC', 'Pertemuan internal koordinasi organisasi OC. Bebas biaya.', 0.00, 45, '#A2CFFE'],
        ['Meeting konsultasi anak', 'Konsultasi khusus anak berbayar Rp 100.000 via transfer Bank Mandiri.', 100000.00, 60, '#FF85A2'],
        ['Meeting kerjasama', 'Diskusi mengenai potensi kolaborasi dan kerjasama profesional. Bebas biaya.', 0.00, 60, '#E8DFFF'],
        ['Meeting lainnya', 'Pertemuan untuk kebutuhan lainnya. Silakan sebutkan topik pembahasan Anda.', 0.00, 30, '#FFFFFF']
      ];
      for (const m of seedMeetings) {
        await connection.query(
          'INSERT INTO meeting_types (title, description, price, duration, color_theme) VALUES (?, ?, ?, ?, ?)',
          m
        );
      }
    }

    const [admins] = await connection.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (admins[0].count === 0) {
      console.log('Seeding default administrator...');
      const adminUsername = process.env.ADMIN_INITIAL_USERNAME || 'admin';
      const adminEmail = 'admin@tiara.com';
      const adminPass = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPass, 10);
      await connection.query(
        "INSERT INTO users (name, email, password, whatsapp, role) VALUES (?, ?, ?, ?, 'admin')",
        ['Dinda Mutiara Nailah', adminEmail, hashedPassword, '08123456789']
      );
      console.log(`Default admin created: ${adminEmail} (password: ${adminPass})`);
    }

    console.log('Database tables successfully verified and seeded.');
  } catch (err) {
    console.error('Failed to setup database tables:', err);
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  initializeDatabase,
  getPool: () => {
    if (!pool) throw new Error('Database pool not initialized. Call initializeDatabase first.');
    return pool;
  },
  query: async (sql, params) => {
    if (!pool) throw new Error('Database pool not initialized. Call initializeDatabase first.');
    return pool.query(sql, params);
  }
};
