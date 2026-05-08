/**
 * Auth Routes - Strava OAuth2 authentication
 */

const express = require('express');
const router = express.Router();
const stravaApi = require('../services/strava-api');
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';

// System Login (JWT)
router.post('/system/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System Logout
router.post('/system/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

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
