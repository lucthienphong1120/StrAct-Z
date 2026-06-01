# Technical Migration Guide - v1.51.57

This version introduces security hardening, optimization, and code quality updates based on the comprehensive code review. Below are the key configuration changes and actions required to migrate.

## 1. Environment Configurations (`.env`)

Two configurations have been adjusted in `.env`:

### `ENCRYPTION_SALT` (New)
* **Purpose**: Used for key derivation to encrypt/decrypt Strava and Google Fit authentication tokens stored in the SQLite database. Previously, a static salt `'salt'` was hardcoded.
* **Action**:
  - Add `ENCRYPTION_SALT` to your `.env` file with a secure, unique random string.
  - *Example*: `ENCRYPTION_SALT=y0ur_s3cur3_c0nt3mp0rary_sa1t_2026`
  - **Backward Compatibility**: If the system fails to decrypt existing tokens with the new salt, it automatically falls back to decrypting using the legacy key (derived using the old salt `'salt'`). This ensures users do not lose their current Strava or Google Fit connections.

### `BASE_URL` (Enforced CORS)
* **Purpose**: CORS origin has been restricted in production to only allow requests originating from your application's domain.
* **Action**:
  - Make sure `BASE_URL` is correctly configured in your `.env` file to match the exact protocol, domain, and port of the frontend app.
  - *Example*: `BASE_URL=http://localhost:3000` or `BASE_URL=https://yourdomain.com`

---

## 2. Health & Monitoring

A public health check endpoint has been added for third-party uptime monitoring (e.g. UptimeRobot, Nginx/1Panel health checks).

* **Endpoint**: `/health`
* **Response format**:
```json
{
  "status": "ok",
  "uptime": 12.34
}
```

---

## 3. Database Updates

* **WAL Mode Enabled**: SQLite Write-Ahead Logging (WAL) has been activated. This improves transaction throughput and prevents potential `SQLITE_BUSY` database lock errors under concurrent cron scheduler execution.
* **Pagination Support**: The local generated activities fetch `/api/activities` now supports `limit` and `offset` query parameters.

---

## 4. GPX File Cleanup

GPX files of successfully uploaded activities are now automatically cleaned up.
* **Mechanism**: A weekly cron task runs every Sunday at **03:00 AM** (Vietnam time). It deletes `.gpx` files from the disk `data/gpx/` for activities with status `uploaded` that were created more than 30 days ago, and clears their filename references in the database.

---

## 5. Graceful Shutdown

The application now listens for `SIGINT` (Ctrl+C) and `SIGTERM` (systemd stop / docker stop) signals:
1. Stops all cron runners.
2. Waits up to 8 seconds for any active generation/upload jobs to complete.
3. Closes HTTP connections and terminates the Node.js process gracefully.
