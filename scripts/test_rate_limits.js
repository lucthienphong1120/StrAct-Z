/**
 * StrAct Z - Rate Limiter Integration & Header Verification Test Script
 * 
 * Verifies that the correct rate limiters are applied to the correct routes
 * by inspecting the headers returned by Express.
 * 
 * Usage: node scripts/test_rate_limits.js
 */

const express = require('express');
const http = require('http');
const db = require('../src/db/database');
const apiRoutes = require('../src/routes/api');
const authRoutes = require('../src/routes/auth');
const publicApiRoutes = require('../src/routes/publicApi');
const cookieParser = require('cookie-parser');

// Mock auth middleware for testing private API routes
function mockAuthenticateToken(req, res, next) {
  req.user = { id: 9999, username: 'test_rate_limiter_user', role: 'basic' };
  next();
}

async function runRateLimitTests() {
  console.log('=== Starting StrAct Z Rate Limiter Header Integration Tests ===\n');

  // Initialize DB connection so database queries inside routes don't crash
  const dbInstance = await db.getDb();
  await dbInstance.run("INSERT OR IGNORE INTO accounts (id, username, password_hash, role) VALUES (9999, 'testuser', 'dummy', 'basic')");

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount Auth limiters exactly like server.js
  const rateLimit = require('express-rate-limit');
  
  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
  });
  const authRegisterLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
  });
  const authGeneralLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
  });

  app.use('/auth/system/login', authLoginLimiter);
  app.use('/auth/system/register', authRegisterLimiter);
  app.use('/auth/connect', authGeneralLimiter);
  app.use('/auth/callback', authGeneralLimiter);
  app.use('/auth/disconnect', authGeneralLimiter);

  // Mount routes
  app.use('/auth', authRoutes);
  app.use('/api/public', publicApiRoutes);
  app.use('/api', mockAuthenticateToken, apiRoutes);

  // Start HTTP test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[INFO] Test server listening on ${baseUrl}`);

  let passed = true;

  // Test specifications: [path, method, body, expectedLimitHeaderVal, description]
  const tests = [
    {
      path: '/auth/system/register',
      method: 'POST',
      body: { username: 'testuser_rate_limit', password: 'password123' },
      expectedLimit: 5,
      description: 'authRegisterLimiter on POST /auth/system/register'
    },
    {
      path: '/auth/connect',
      method: 'GET',
      body: null,
      expectedLimit: 15,
      description: 'authGeneralLimiter on GET /auth/connect'
    },
    {
      path: '/api/stats',
      method: 'GET',
      body: null,
      expectedLimit: 100,
      description: 'apiReadLimiter on GET /api/stats'
    },
    {
      path: '/api/config',
      method: 'POST',
      body: {},
      expectedLimit: 10,
      description: 'apiConfigLimiter on POST /api/config'
    },
    {
      path: '/api/generate',
      method: 'POST',
      body: {},
      expectedLimit: 15,
      description: 'apiGenerateLimiter on POST /api/generate'
    },
    {
      path: '/api/scheduler',
      method: 'POST',
      body: {},
      expectedLimit: 10,
      description: 'apiSchedulerLimiter on POST /api/scheduler'
    },
    {
      path: '/api/activities/1',
      method: 'DELETE',
      body: null,
      expectedLimit: 15,
      description: 'apiDeleteLimiter on DELETE /api/activities/:id'
    },
    {
      path: '/api/api-tokens',
      method: 'POST',
      body: { name: 'test_token' },
      expectedLimit: 5,
      description: 'apiSensitiveLimiter on POST /api/api-tokens'
    },
    {
      path: '/api/public/activities',
      method: 'GET',
      body: null,
      expectedLimit: 60,
      description: 'publicGetLimiter on GET /api/public/activities'
    }
  ];

  try {
    for (const test of tests) {
      console.log(`\n[Test] Checking ${test.description}...`);
      
      const options = {
        method: test.method,
        headers: {},
        redirect: 'manual'
      };
      
      if (test.body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(test.body);
      }
      
      if (test.path.startsWith('/api/public')) {
        options.headers['Authorization'] = 'Bearer stz_invalid_dummy_token';
      }

      if (test.path === '/auth/connect') {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';
        const token = jwt.sign({ id: 9999, username: 'testuser', role: 'basic' }, JWT_SECRET);
        options.headers['Cookie'] = `token=${token}`;
      }

      const res = await fetch(`${baseUrl}${test.path}`, options);
      
      // Log all headers to debug
      console.log('Headers:');
      for (const [key, value] of res.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      const limitHeaderVal = res.headers.get('ratelimit-limit') || res.headers.get('x-ratelimit-limit');
      
      console.log(`Response Status: ${res.status}`);
      console.log(`Resolved Rate Limit: ${limitHeaderVal}`);

      if (limitHeaderVal === String(test.expectedLimit)) {
        console.log(`✅ PASS: Rate limit correctly resolved to ${test.expectedLimit}`);
      } else {
        console.log(`❌ FAIL: Expected rate limit ${test.expectedLimit}, got ${limitHeaderVal}`);
        passed = false;
      }
    }
  } catch (err) {
    console.error('Test execution error:', err);
    passed = false;
  } finally {
    // Cleanup
    server.close();
    console.log('\n[INFO] Test server shutdown.');
    await db.closeDb();
  }

  console.log('\n=== Rate Limiter Verification Summary ===');
  if (passed) {
    console.log('🎉 ALL RATE LIMITER TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('🚨 RATE LIMITER TESTS FAILED.');
    process.exit(1);
  }
}

runRateLimitTests();
