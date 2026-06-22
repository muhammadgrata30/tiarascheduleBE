const { google } = require('googleapis');
const db = require('../config/db');
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

function getOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured in .env');
    return null;
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]
  });
}

async function saveTokens(tokens) {
  const { access_token, refresh_token, expiry_date } = tokens;
  await db.query('DELETE FROM google_tokens');
  await db.query(
    'INSERT INTO google_tokens (access_token, refresh_token, expiry_date) VALUES (?, ?, ?)',
    [access_token, refresh_token || '', expiry_date]
  );
  console.log('Google Calendar tokens saved to database.');
}

async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  try {
    const [rows] = await db.query('SELECT * FROM google_tokens LIMIT 1');
    if (rows.length === 0) {
      console.log('No Google tokens found in database. Calendar sync is disabled.');
      return null;
    }

    const { access_token, refresh_token, expiry_date } = rows[0];
    
    oauth2Client.setCredentials({
      access_token,
      refresh_token,
      expiry_date
    });

    oauth2Client.on('tokens', async (newTokens) => {
      console.log('Google OAuth token refreshed.');
      const updatedTokens = {
        access_token: newTokens.access_token || access_token,
        refresh_token: newTokens.refresh_token || refresh_token,
        expiry_date: newTokens.expiry_date || expiry_date
      };
      await saveTokens(updatedTokens);
    });

    return oauth2Client;
  } catch (err) {
    console.error('Error loading Google Calendar client:', err.message);
    return null;
  }
}

async function isConnected() {
  const client = await getAuthenticatedClient();
  return client !== null;
}

async function getBusySlots(dateString) {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    console.log('Google Calendar not connected. No busy slots retrieved from Google.');
    return [];
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const timeMin = new Date(`${dateString}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${dateString}T23:59:59Z`).toISOString();

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: 'primary' }]
      }
    });

    const busy = response.data.calendars.primary.busy || [];
    return busy.map(slot => ({
      start: slot.start,
      end: slot.end
    }));
  } catch (err) {
    console.error('Error fetching free/busy query:', err.message);
    return [];
  }
}

async function createCalendarEvent(booking) {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    console.log('Google Calendar is not connected. Skipping calendar event creation.');
    return null;
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const startDateTime = new Date(`${booking.booking_date}T${booking.start_time}`).toISOString();
  const endDateTime = new Date(`${booking.booking_date}T${booking.end_time}`).toISOString();

  const moodText = booking.mood ? `Mood Rapat: ${booking.mood}\n` : '';
  let prepText = '';
  if (booking.prep_items) {
    try {
      const items = JSON.parse(booking.prep_items);
      if (Array.isArray(items) && items.length > 0) {
        prepText = `Persiapan:\n- ${items.join('\n- ')}\n`;
      }
    } catch (e) {
      // Ignore
    }
  }

  const description = `${moodText}${prepText}\nCatatan User: ${booking.notes || 'Tidak ada catatan.'}\n\nWhatsApp User: ${booking.whatsapp}\nEmail User: ${booking.email}\nStatus Pembayaran: ${booking.price > 0 ? 'Sudah Lunas (Transfer Mandiri)' : 'Gratis'}`;

  const event = {
    summary: `[Tiara's Schedule] ${booking.meeting_title} - ${booking.user_name}`,
    description,
    start: {
      dateTime: startDateTime,
      timeZone: 'Asia/Jakarta'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Jakarta'
    },
    attendees: [
      { email: booking.email }
    ],
    reminders: {
      useDefault: true
    }
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all'
    });
    console.log('Google Calendar Event created:', response.data.htmlLink);
    return response.data.id;
  } catch (err) {
    console.error('Error creating Google Calendar event:', err.message);
    return null;
  }
}

async function deleteCalendarEvent(eventId) {
  const auth = await getAuthenticatedClient();
  if (!auth || !eventId) return;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });
    console.log('Google Calendar Event deleted:', eventId);
  } catch (err) {
    console.error('Error deleting Google Calendar event:', err.message);
  }
}

module.exports = {
  getAuthUrl,
  saveTokens,
  isConnected,
  getBusySlots,
  createCalendarEvent,
  deleteCalendarEvent
};
