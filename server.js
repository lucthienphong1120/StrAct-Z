/**
 * Strava Auto Activity Generator - Main Server
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const db = require('./src/db/database');
const scheduler = require('./src/services/scheduler');
const { authenticateToken, requirePageAuth } = require('./src/middleware/auth');

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

app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve login and register pages unauthenticated
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Explicitly serve district data GeoJSON
app.get('/geo/hanoi_urban_districts.geojson', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'geo', 'hanoi_urban_districts.geojson'));
});

// Protect static files
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Routes
// Apply strict brute force protection ONLY to login endpoint
app.use('/auth/system/login', authLimiter);

// Auth Routes (connect, callback, login, logout are public, others might need auth)
app.use('/auth', authRoutes);

// Protect API routes
app.use('/api', authenticateToken, apiRoutes);

// Serve main page (protected)
app.get('/', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🏃 Strava Auto Activity Generator`);
  console.log(`  📡 Server running at http://localhost:${PORT}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Initialize scheduler on startup
  try {
    await scheduler.startAllSchedulers();
    console.log('  ⏰ Multi-tenant schedulers initialized');
  } catch (err) {
    console.error('  ⏰ Scheduler initialization skipped:', err.message);
  }

  console.log('');
});
