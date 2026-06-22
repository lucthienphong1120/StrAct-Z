/**
 * StrAct Z - Public API Integration & Security Test Script
 * 
 * Tests:
 * 1. Unauthorized access (no token) -> 401
 * 2. Invalid token access -> 401
 * 3. Lockout mechanism (10 failed consecutive attempts lock IP for 24h) -> 403
 * 4. Whitelisting logic for VIP accounts -> 403 (unmatched IP) / 200 (matched IP)
 * 5. GET /api/public/stats (valid read) -> 200
 * 6. GET /api/public/activities (valid history) -> 200
 * 7. POST /api/public/activities/generate (activity generation draft) -> 200, created_by: 'API'
 * 
 * Usage: node scripts/test_public_api.js
 */

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const db = require('../src/db/database');
const publicApiRoutes = require('../src/routes/publicApi');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('=== Starting StrAct Z Public API Integration Tests ===\n');

  // Initialize database
  const dbInstance = await db.getDb();

  // Create clean slate for test user
  const testUsername = 'test_api_runner_' + Date.now();
  const testPassword = 'testpassword123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(testPassword, salt);
  
  // Insert test user
  const now = new Date().toISOString();
  await dbInstance.run(
    "INSERT INTO accounts (username, password_hash, role, created_at) VALUES (?, ?, 'vip', ?)",
    [testUsername, passwordHash, now]
  );
  
  const userRecord = await dbInstance.get('SELECT id FROM accounts WHERE username = ?', [testUsername]);
  const testUserId = userRecord.id;
  console.log(`[INFO] Created test user: ${testUsername} (ID: ${testUserId})`);

  // Setup express server for routing tests
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Enable trust proxy for testing IP whitelisting/lockout
  app.set('trust proxy', true);

  // Mount public API router
  app.use('/api/public', publicApiRoutes);

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/public`;
  console.log(`[INFO] Test server listening on ${baseUrl}`);

  let passed = true;

  try {
    // Test 1: No Token
    console.log('\n[Test 1] Request with NO Token...');
    const resNoToken = await fetch(`${baseUrl}/stats`);
    console.log(`Status: ${resNoToken.status}`);
    const bodyNoToken = await resNoToken.json();
    console.log('Response:', bodyNoToken);
    if (resNoToken.status === 401 && bodyNoToken.error.includes('No API token provided')) {
      console.log('✅ PASS: Unauthorized rejected with 401');
    } else {
      console.log('❌ FAIL: Expected 401 unauthorized');
      passed = false;
    }

    // Test 2: Invalid Token
    console.log('\n[Test 2] Request with INVALID Token...');
    const resInvalidToken = await fetch(`${baseUrl}/stats`, {
      headers: { 'Authorization': 'Bearer stz_invalid_token_value_xyz' }
    });
    console.log(`Status: ${resInvalidToken.status}`);
    const bodyInvalidToken = await resInvalidToken.json();
    console.log('Response:', bodyInvalidToken);
    if (resInvalidToken.status === 401 && bodyInvalidToken.error.includes('Invalid API token')) {
      console.log('✅ PASS: Invalid token rejected with 401');
    } else {
      console.log('❌ FAIL: Expected 401 invalid token');
      passed = false;
    }

    // Test 3: Lockout Mechanism (10 failed attempts)
    console.log('\n[Test 3] Lockout testing (10 failed attempts)...');
    const testIp = '127.0.0.1';
    
    // Clear any previous attempts first
    await db.resetFailedAttempts(testIp);
    
    // Trigger 9 failed attempts (IP should NOT lock yet)
    for (let i = 1; i <= 9; i++) {
      await fetch(`${baseUrl}/stats`, {
        headers: { 'Authorization': 'Bearer stz_invalid_token_attempt_' + i }
      });
    }

    // Check locked status (should be false)
    const isLockedBefore = await db.isIpLocked(testIp);
    console.log(`IP Locked after 9 failed attempts: ${isLockedBefore}`);
    if (isLockedBefore) {
      console.log('❌ FAIL: IP locked prematurely after 9 attempts');
      passed = false;
    }

    // Trigger 10th failed attempt (IP should lock now)
    await fetch(`${baseUrl}/stats`, {
      headers: { 'Authorization': 'Bearer stz_invalid_token_attempt_10' }
    });

    const isLockedAfter = await db.isIpLocked(testIp);
    console.log(`IP Locked after 10 failed attempts: ${isLockedAfter}`);
    if (!isLockedAfter) {
      console.log('❌ FAIL: IP not locked after 10 failed attempts');
      passed = false;
    }

    // Try a request while locked
    const resLocked = await fetch(`${baseUrl}/stats`, {
      headers: { 'Authorization': 'Bearer stz_invalid_token_attempt_11' }
    });
    console.log(`Status when locked: ${resLocked.status}`);
    const bodyLocked = await resLocked.json();
    console.log('Response:', bodyLocked);
    if (resLocked.status === 403 && bodyLocked.error.includes('temporarily locked out')) {
      console.log('✅ PASS: IP lockout active and returns 403');
    } else {
      console.log('❌ FAIL: Locked request did not return 403 with lockout warning');
      passed = false;
    }

    // Test 4: Reset Lockout for next tests
    console.log('\n[Test 4] Resetting IP lockout...');
    await db.resetFailedAttempts(testIp);
    const isLockedReset = await db.isIpLocked(testIp);
    console.log(`IP Locked after reset: ${isLockedReset}`);
    if (isLockedReset) {
      console.log('❌ FAIL: IP failed to unlock');
      passed = false;
    } else {
      console.log('✅ PASS: IP unlocked successfully');
    }

    // Generate a valid token
    const plainToken = 'stz_' + crypto.randomBytes(30).toString('hex');
    const tokenName = 'Integration Test Token';
    
    // Create token in DB
    await db.createApiToken(testUserId, tokenName, null, plainToken);
    console.log(`[INFO] Created valid API Token in DB: ${plainToken.slice(0, 12)}...`);

    // Test 5: Whitelisting Mismatch (VIP role check)
    console.log('\n[Test 5] Whitelist testing (mismatched IP whitelist)...');
    // Update token whitelist to mismatch 127.0.0.1
    await dbInstance.run(
      'UPDATE api_tokens SET ip_whitelist = ? WHERE account_id = ?',
      ['10.0.0.1', testUserId]
    );

    const resWhitelistMismatch = await fetch(`${baseUrl}/stats`, {
      headers: { 'Authorization': `Bearer ${plainToken}` }
    });
    console.log(`Status with mismatched whitelist: ${resWhitelistMismatch.status}`);
    const bodyWhitelistMismatch = await resWhitelistMismatch.json();
    console.log('Response:', bodyWhitelistMismatch);
    if (resWhitelistMismatch.status === 403 && bodyWhitelistMismatch.error.includes('IP not whitelisted')) {
      console.log('✅ PASS: Mismatched IP rejected with 403');
    } else {
      console.log('❌ FAIL: Expected 403 due to IP whitelist mismatch');
      passed = false;
    }

    // Test 6: Whitelisting Success (VIP matching IP)
    console.log('\n[Test 6] Whitelist testing (matching IP whitelist)...');
    // Clear lockout caused by mismatch
    await db.resetFailedAttempts(testIp);
    
    // Update whitelist to match local IP
    await dbInstance.run(
      'UPDATE api_tokens SET ip_whitelist = ? WHERE account_id = ?',
      ['127.0.0.1, ::1', testUserId]
    );

    const resWhitelistMatch = await fetch(`${baseUrl}/stats`, {
      headers: { 'Authorization': `Bearer ${plainToken}` }
    });
    console.log(`Status with matching whitelist: ${resWhitelistMatch.status}`);
    const bodyWhitelistMatch = await resWhitelistMatch.json();
    console.log('Response stats keys:', Object.keys(bodyWhitelistMatch));
    if (resWhitelistMatch.status === 200 && bodyWhitelistMatch.total !== undefined) {
      console.log('✅ PASS: Matching IP allowed to read stats');
    } else {
      console.log('❌ FAIL: Expected 200 OK with stats payload');
      passed = false;
    }

    // Test 7: POST /activities/generate (Draft activity generation)
    console.log('\n[Test 7] POST /activities/generate (Hanoi coordinates, upload: false)...');
    const resGen = await fetch(`${baseUrl}/activities/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${plainToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: 21.0035,
        lon: 105.8488,
        upload: false
      })
    });
    console.log(`Status: ${resGen.status}`);
    const bodyGen = await resGen.json();
    console.log('Response:', bodyGen);
    if (resGen.status === 200 && bodyGen.success && bodyGen.activity) {
      const dbAct = await dbInstance.get('SELECT * FROM activities WHERE id = ?', [bodyGen.activity.id]);
      console.log('Database Record:', {
        id: dbAct.id,
        activity_name: dbAct.activity_name,
        distance_km: dbAct.distance_km,
        created_by: dbAct.created_by,
        upload_status: dbAct.upload_status
      });

      if (dbAct.created_by === 'API') {
        console.log('✅ PASS: Activity successfully generated with created_by = "API"');
      } else {
        console.log(`❌ FAIL: Expected created_by = "API", got: ${dbAct.created_by}`);
        passed = false;
      }
    } else {
      console.log('❌ FAIL: Activity generation endpoint failed');
      passed = false;
    }

    // Test 8: GET /activities (Read activity history)
    console.log('\n[Test 8] GET /activities (Read list)...');
    const resList = await fetch(`${baseUrl}/activities?limit=10`, {
      headers: { 'Authorization': `Bearer ${plainToken}` }
    });
    console.log(`Status: ${resList.status}`);
    const bodyList = await resList.json();
    console.log(`Response array length: ${bodyList.length}`);
    if (resList.status === 200 && Array.isArray(bodyList) && bodyList.length > 0) {
      console.log('✅ PASS: GET activities returned history list');
    } else {
      console.log('❌ FAIL: Failed to retrieve activity history');
      passed = false;
    }

  } catch (err) {
    console.error('Unexpected test execution error:', err);
    passed = false;
  } finally {
    // Cleanup temporary resources
    console.log('\n--- Cleaning up test resources ---');
    try {
      // Delete generated activities
      await dbInstance.run('DELETE FROM activities WHERE account_id = ?', [testUserId]);
      
      // Delete api tokens
      await dbInstance.run('DELETE FROM api_tokens WHERE account_id = ?', [testUserId]);
      
      // Delete temporary accounts
      await dbInstance.run('DELETE FROM accounts WHERE id = ?', [testUserId]);
      
      // Reset lockout registry
      await db.resetFailedAttempts('127.0.0.1');
      console.log('[INFO] Test DB data cleaned up successfully.');
    } catch (e) {
      console.error('[WARN] Cleanup error:', e.message);
    }

    // Shutdown HTTP test server
    server.close();
    console.log('[INFO] Test server shutdown.');
    
    // Close DB connection
    await db.closeDb();
  }

  console.log('\n=== Verification Summary ===');
  if (passed) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (v3.0.0 is secure)');
    process.exit(0);
  } else {
    console.error('🚨 INTEGRATION TESTS FAILED. Please review output logs.');
    process.exit(1);
  }
}

runTests();
