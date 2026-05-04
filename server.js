/**
 * Strava Auto Activity Generator - Main Server
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const db = require('./src/db/database');
const scheduler = require('./src/services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate client IP behind 1Panel/Nginx/LiteSpeed
app.set('trust proxy', 1);

// Advanced Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for simplicity with inline scripts/styles in this UI
}));

// Basic Security Headers for caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Global Rate Limiting (Prevent DDoS)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Anti-Brute Force for Authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 failed auth attempts per windowMs
  skipSuccessfulRequests: true, // Only count failed attempts
  message: 'Too many failed login attempts, your IP has been temporarily locked out.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Basic Authentication (Protects UI & API if configured in .env)
const adminUser = process.env.ADMIN_USERNAME;
const adminPass = process.env.ADMIN_PASSWORD;

if (adminUser && adminPass) {
  app.use(authLimiter); // Apply strict brute force protection
  app.use((req, res, next) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (login && password && login === adminUser && password === adminPass) {
      return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="StrAct Z Secure Area"');
    res.status(401).send('Authentication required. Please check your ADMIN_USERNAME and ADMIN_PASSWORD in .env');
  });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🏃 Strava Auto Activity Generator`);
  console.log(`  📡 Server running at http://localhost:${PORT}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Initialize scheduler on startup
  try {
    const started = scheduler.startScheduler();
    if (started) {
      const status = scheduler.getStatus();
      console.log(`  ⏰ Scheduler active: ${status.cronExpression}`);
    } else {
      console.log('  ⏰ Scheduler disabled (enable in dashboard)');
    }
  } catch (err) {
    console.log('  ⏰ Scheduler initialization skipped');
  }

  console.log('');
});
