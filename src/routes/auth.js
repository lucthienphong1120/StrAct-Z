/**
 * Auth Routes - Strava OAuth2 authentication
 */

const express = require('express');
const router = express.Router();
const stravaApi = require('../services/strava-api');
const db = require('../db/database');

// Redirect to Strava OAuth
router.get('/connect', (req, res) => {
  const authUrl = stravaApi.getAuthUrl();
  res.redirect(authUrl);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code, error, scope } = req.query;

  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    await stravaApi.exchangeCode(code);
    res.redirect('/?success=connected');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect('/?error=' + encodeURIComponent('Authentication failed'));
  }
});

// Disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await stravaApi.disconnect();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get auth status
router.get('/status', async (req, res) => {
  try {
    const tokens = await db.getTokens();
    if (tokens && tokens.access_token) {
      res.json({
        authenticated: true,
        athlete: {
          id: tokens.athlete_id,
          name: tokens.athlete_name,
          avatar: tokens.athlete_avatar,
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (err) {
    res.json({ authenticated: false, error: err.message });
  }
});

module.exports = router;
