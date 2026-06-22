const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tiaras_schedule',
  port: parseInt(process.env.DB_PORT || '3308'),
};

async function resetAdminPassword() {
  console.log('=========================================');
  console.log('Mereset Password Admin...');
  console.log(`Menghubungkan ke database: ${dbConfig.database} di port ${dbConfig.port}`);
  console.log('=========================================');

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const [result] = await connection.query(
      "UPDATE users SET password = ? WHERE email = 'admin@tiara.com'",
      [hashedPassword]
    );

    if (result.affectedRows > 0) {
      console.log('✔ PASSWORD ADMIN BERHASIL DIRESET!');
      console.log(`Email: admin@tiara.com`);
      console.log(`Password Baru: ${newPassword}`);
    } else {
      // If admin user doesn't exist, create it
      await connection.query(
        "INSERT INTO users (name, email, password, whatsapp, role) VALUES (?, ?, ?, ?, 'admin')",
        ['Dinda Mutiara Nailah', 'admin@tiara.com', hashedPassword, '08123456789']
      );
      console.log('✔ AKUN ADMIN BERHASIL DIBUAT!');
      console.log(`Email: admin@tiara.com`);
      console.log(`Password: ${newPassword}`);
    }
    console.log('=========================================');

  } catch (err) {
    console.error('GAGAL MERESET PASSWORD ADMIN!');
    console.error('Details:', err);
    console.error('=========================================');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetAdminPassword();
