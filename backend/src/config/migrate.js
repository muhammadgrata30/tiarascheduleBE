const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function runMigration() {
  console.log('=========================================');
  console.log('Mulai Menjalankan Migrasi Database MySQL...');
  console.log(`Menghubungkan ke: ${dbConfig.host}:${dbConfig.port} sebagai ${dbConfig.user}`);
  console.log('=========================================');

  let connection;
  try {
    // 1. Connect to MySQL host
    connection = await mysql.createConnection({
      ...dbConfig,
      multipleStatements: true // Allow executing multiple statements from schema.sql
    });
    console.log('✔ Berhasil terhubung ke host MySQL.');

    // 2. Read schema.sql file
    const schemaPath = path.join(__dirname, '../../schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`File schema.sql tidak ditemukan di: ${schemaPath}`);
    }
    const sqlSchema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✔ Berhasil membaca berkas schema.sql.');

    // 3. Execute the schema statements
    console.log('Menjalankan query tabel dan seeder...');
    await connection.query(sqlSchema);
    
    console.log('=========================================');
    console.log('✔ MIGRASI BERHASIL DAN SEEDER SELESAI!');
    console.log('Database `tiaras_schedule` telah siap digunakan.');
    console.log('Akun Admin Utama: admin@tiara.com (Password: admin123)');
    console.log('=========================================');

  } catch (err) {
    console.error('=========================================');
    console.error('❌ MIGRASI GAGAL!');
    console.error('Details:', err);
    console.error('\nTips Perbaikan:');
    console.error('1. Pastikan database MySQL Anda sudah dinyalakan (di XAMPP / Laragon).');
    console.error('2. Pastikan password, username, dan port di file backend/.env sudah benar.');
    console.error('=========================================');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
