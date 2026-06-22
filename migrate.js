const { initializeDatabase, getPool } = require('./src/config/db');

async function migrate() {
  try {
    console.log('Initializing DB...');
    await initializeDatabase();
    const db = getPool();
    
    console.log('Running migrations...');
    
    // Drop google_tokens
    await db.query('DROP TABLE IF EXISTS google_tokens');
    console.log('Dropped google_tokens');

    // Remove google_event_id and add admin_comment
    try {
      await db.query('ALTER TABLE bookings DROP COLUMN google_event_id');
      console.log('Dropped google_event_id from bookings');
    } catch (e) { console.log('google_event_id might not exist'); }
    
    try {
      await db.query('ALTER TABLE bookings ADD COLUMN admin_comment TEXT NULL');
      console.log('Added admin_comment to bookings');
    } catch (e) { console.log('admin_comment might already exist'); }

    // Create admin_blocks is handled by db.js initializeDatabase() now, but we can call it to be safe
    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
