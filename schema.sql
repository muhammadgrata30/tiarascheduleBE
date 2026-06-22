-- Inisialisasi Database
CREATE DATABASE IF NOT EXISTS tiaras_schedule;
USE tiaras_schedule;

-- 1. Tabel Users (Untuk User & Admin)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  profile_picture VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Tipe Meeting
CREATE TABLE IF NOT EXISTS meeting_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  duration INT NOT NULL DEFAULT 60, -- dalam menit
  color_theme VARCHAR(50) DEFAULT '#ff85a2', -- warna hex pastel
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Pemesanan (Bookings)
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  meeting_type_id INT,
  notes TEXT,
  mood VARCHAR(100),
  prep_items TEXT, -- JSON array string
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('Pending Payment', 'Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
  payment_proof VARCHAR(255) NULL, -- file path bukti transfer
  admin_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE SET NULL
);

-- 4. Tabel Admin Blocks (Libur / Blokir Jadwal)
CREATE TABLE IF NOT EXISTS admin_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('BLOCK', 'HOLIDAY') DEFAULT 'BLOCK',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Tipe Meeting Default (jika tabel kosong)
INSERT INTO meeting_types (title, description, price, duration, color_theme) 
SELECT 'Meeting internal OC', 'Pertemuan internal koordinasi organisasi OC. Bebas biaya.', 0.00, 45, '#A2CFFE'
WHERE NOT EXISTS (SELECT * FROM meeting_types WHERE title = 'Meeting internal OC');

INSERT INTO meeting_types (title, description, price, duration, color_theme) 
SELECT 'Meeting konsultasi anak', 'Konsultasi khusus anak berbayar Rp 100.000 via transfer Bank Mandiri.', 100000.00, 60, '#FF85A2'
WHERE NOT EXISTS (SELECT * FROM meeting_types WHERE title = 'Meeting konsultasi anak');

INSERT INTO meeting_types (title, description, price, duration, color_theme) 
SELECT 'Meeting kerjasama', 'Diskusi mengenai potensi kolaborasi dan kerjasama profesional. Bebas biaya.', 0.00, 60, '#E8DFFF'
WHERE NOT EXISTS (SELECT * FROM meeting_types WHERE title = 'Meeting kerjasama');

INSERT INTO meeting_types (title, description, price, duration, color_theme) 
SELECT 'Meeting lainnya', 'Pertemuan untuk kebutuhan lainnya. Silakan sebutkan topik pembahasan Anda.', 0.00, 30, '#FFFFFF'
WHERE NOT EXISTS (SELECT * FROM meeting_types WHERE title = 'Meeting lainnya');

-- Seed Admin Default (jika admin belum ada)
INSERT INTO users (name, email, password, whatsapp, role)
SELECT 'Dinda Mutiara Nailah', 'admin@tiara.com', '$2a$10$ugPPhg66eAebPYJpv1LnAOhV1E7t1atNv7jdOxYekEdNvGUbkBfQm', '08123456789', 'admin'
WHERE NOT EXISTS (SELECT * FROM users WHERE email = 'admin@tiara.com');
