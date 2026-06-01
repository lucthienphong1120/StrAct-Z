const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const secret = process.env.APP_SECRET || 'strava_auto_act_default_secret_32';
const secureSalt = process.env.ENCRYPTION_SALT || 'stract_z_secure_static_salt_2026_prod';
const key = crypto.scryptSync(secret, secureSalt, 32);
const legacyKey = crypto.scryptSync(secret, 'salt', 32);

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err.message);
    return text;
  }
}

function decrypt(hash) {
  if (!hash) return hash;
  try {
    if (!hash.includes(':')) return hash; // Not encrypted
    const [ivHex, encryptedHex] = hash.split(':');
    if (!ivHex || !encryptedHex) return hash;
    const iv = Buffer.from(ivHex, 'hex');
    
    // Try with primary key first
    try {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (primaryErr) {
      // Fallback to legacy key derived from 'salt'
      const decipherLegacy = crypto.createDecipheriv(algorithm, legacyKey, iv);
      let decryptedLegacy = decipherLegacy.update(encryptedHex, 'hex', 'utf8');
      decryptedLegacy += decipherLegacy.final('utf8');
      return decryptedLegacy;
    }
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

function decryptWithSaltVerification(hash) {
  if (!hash) return null;
  try {
    if (!hash.includes(':')) return { decrypted: hash, legacyUsed: false }; // Not encrypted
    const [ivHex, encryptedHex] = hash.split(':');
    if (!ivHex || !encryptedHex) return { decrypted: hash, legacyUsed: false };
    const iv = Buffer.from(ivHex, 'hex');
    
    // Try with primary key first
    try {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return { decrypted, legacyUsed: false };
    } catch (primaryErr) {
      // Fallback to legacy key derived from 'salt'
      const decipherLegacy = crypto.createDecipheriv(algorithm, legacyKey, iv);
      let decryptedLegacy = decipherLegacy.update(encryptedHex, 'hex', 'utf8');
      decryptedLegacy += decipherLegacy.final('utf8');
      return { decrypted: decryptedLegacy, legacyUsed: true };
    }
  } catch (err) {
    console.error('Decryption verification failed:', err.message);
    return null;
  }
}

module.exports = { encrypt, decrypt, decryptWithSaltVerification };
