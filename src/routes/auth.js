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

// Check if system needs setup
router.get('/system/needs-setup', async (req, res) => {
  try {
    const count = await db.getAccountCount();
    res.json({ needsSetup: count === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register a new account
router.post('/system/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 5) {
    return res.status(400).json({ error: 'Username (min 3) and password (min 5) required' });
  }

  try {
    const existing = await db.getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    await db.createAccount(username, password);
    res.json({ success: true });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

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

const { authenticateToken, requirePageAuth } = require('../middleware/auth');

// Redirect to Strava OAuth
router.get('/connect', requirePageAuth, (req, res) => {
  // Pass accountId in state to ensure we know who is connecting
  const authUrl = stravaApi.getAuthUrl(req.user.id);
  res.redirect(authUrl);
});

// OAuth callback
router.get('/callback', requirePageAuth, async (req, res) => {
  const { code, error, scope, state } = req.query;
  const accountId = req.user.id; // From requirePageAuth

  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // If state doesn't match accountId, it might be a CSRF or mixed session
    if (state && parseInt(state) !== accountId) {
      console.warn(`OAuth state mismatch: got ${state}, expected ${accountId}`);
    }
    
    await stravaApi.exchangeCode(accountId, code);
    res.redirect('/?success=connected');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect('/?error=' + encodeURIComponent('Authentication failed'));
  }
});

// Disconnect
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    await stravaApi.disconnect(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get auth status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const tokens = await db.getTokens(req.user.id);
    const gfTokens = await db.getExternalTokens(req.user.id, 'google_fit');

    res.json({
      authenticated: !!(tokens && tokens.access_token),
      athlete: tokens ? {
        id: tokens.athlete_id,
        name: tokens.athlete_name,
        avatar: tokens.athlete_avatar,
      } : null,
      googleFitConnected: !!(gfTokens && gfTokens.access_token),
      googleFitUser: gfTokens ? {
        name: gfTokens.provider_user_name,
        avatar: gfTokens.provider_user_avatar
      } : null
    });
  } catch (err) {
    res.json({ authenticated: false, error: err.message });
  }
});

module.exports = router;
