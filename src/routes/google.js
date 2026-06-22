const express = require('express');
const router = express.Router();
const db = require('../config/db');
const calendarService = require('../services/calendar');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

router.get('/auth-url', authenticateToken, isAdmin, (req, res) => {
  try {
    const url = calendarService.getAuthUrl();
    if (!url) {
      return res.status(500).json({ error: 'Google OAuth client is not configured on the server' });
    }
    res.json({ url });
  } catch (err) {
    console.error('Error generating auth URL:', err.message);
    res.status(500).json({ error: 'Failed to generate Auth URL' });
  }
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error('Google OAuth error from callback:', error);
    return res.redirect(`${FRONTEND_URL}/admin/google?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send('OAuth Code is missing');
  }

  try {
    const oauth2Client = new (require('googleapis').google.auth.OAuth2)(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    await calendarService.saveTokens(tokens);

    res.redirect(`${FRONTEND_URL}/admin/google?connected=true`);
  } catch (err) {
    console.error('Error in OAuth callback:', err.message);
    res.redirect(`${FRONTEND_URL}/admin/google?error=callback_failed`);
  }
});

router.get('/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const connected = await calendarService.isConnected();
    res.json({ connected });
  } catch (err) {
    console.error('Error checking connection status:', err.message);
    res.status(500).json({ error: 'Failed to retrieve connection status' });
  }
});

router.post('/disconnect', authenticateToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM google_tokens');
    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (err) {
    console.error('Error disconnecting Google Calendar:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

module.exports = router;
