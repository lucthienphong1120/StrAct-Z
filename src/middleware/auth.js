const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';

function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
}

function requirePageAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.redirect('/login.html');
  }
}

module.exports = { authenticateToken, requirePageAuth };
