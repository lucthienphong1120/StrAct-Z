const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');

const JWT_SECRET = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';

async function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
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
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
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

async function authenticateApiToken(req, res, next) {
  const ip = req.ip;

  try {
    // 1. Check IP lockout first
    const isLocked = await db.isIpLocked(ip);
    if (isLocked) {
      return res.status(403).json({ error: 'Your IP is temporarily locked out due to too many failed API authentication attempts. Please try again after 24 hours.' });
    }

    // 2. Extract token from multiple sources (Authorization header and Query parameter only)
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }
    
    // Check query parameter
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No API token provided.' });
    }

    // 3. Hash and validate token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.validateApiToken(tokenHash);

    if (!user) {
      await db.incrementFailedAttempts(ip);
      return res.status(401).json({ error: 'Invalid API token.' });
    }

    // 4. IP Whitelist check (VIP only)
    if (user.ip_whitelist) {
      if (user.role === 'vip') {
        const allowedIps = user.ip_whitelist.split(',').map(item => item.trim());
        
        let normalizedIp = ip;
        if (ip.startsWith('::ffff:')) {
          normalizedIp = ip.substring(7);
        }
        
        const isMatched = allowedIps.some(allowedIp => {
          let normalizedAllowed = allowedIp;
          if (allowedIp.startsWith('::ffff:')) {
            normalizedAllowed = allowedIp.substring(7);
          }
          return normalizedIp === normalizedAllowed;
        });

        if (!isMatched) {
          console.warn(`[API Auth] IP mismatch: client IP ${normalizedIp} not in whitelist [${allowedIps.join(', ')}]`);
          await db.incrementFailedAttempts(ip);
          return res.status(403).json({ error: 'Access denied. IP not whitelisted.' });
        }
      }
    }

    // 5. Successful authentication
    await db.resetFailedAttempts(ip);
    
    // Attach to request
    req.user = user;
    next();
  } catch (err) {
    console.error('[API Auth] Error during token authentication:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

module.exports = { authenticateToken, requirePageAuth, authenticateApiToken };
