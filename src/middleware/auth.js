const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';

async function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user data from database to prevent BAC
    const dbInstance = await db.getDb();
    const user = await dbInstance.get('SELECT id, username, role FROM accounts WHERE id = ?', [verified.id]);
    if (!user) {
      return res.status(401).json({ error: 'Access denied. User account not found.' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
}

async function requirePageAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    
    const dbInstance = await db.getDb();
    const user = await dbInstance.get('SELECT id, username, role FROM accounts WHERE id = ?', [verified.id]);
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login.html');
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.redirect('/login.html');
  }
}

module.exports = { authenticateToken, requirePageAuth };
