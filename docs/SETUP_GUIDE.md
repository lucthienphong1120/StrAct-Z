# ⚙️ Setup & Deployment Guide

This guide provides end-to-end instructions for deploying and running **StrAct Z** on a fresh Linux server (Ubuntu/Debian, CentOS, or VPS) with production best practices, including Node.js, process management (PM2 / Systemd), Nginx reverse proxy with SSL (Let's Encrypt), and Strava API callback configuration.

---

## 📋 1. System Requirements

- **Operating System**: Linux (Ubuntu 20.04/22.04/24.04 LTS, Debian 11/12 recommended)
- **Specs**: Minimum 1 vCPU, 1GB RAM, 10GB SSD
- **Network**: Public IPv4 address, ports 80 and 443 open
- **Domain**: A registered domain or subdomain pointing to your server's IP (e.g., `run.yourdomain.com`)
- **Strava Developer Account**: Client ID and Client Secret from [Strava API Settings](https://www.strava.com/settings/api)

---

## 🚀 2. Server Preparation & Node.js Installation

Connect to your server via SSH and update packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential
```

### Install Node.js (v22 LTS recommended)

```bash
# Setup NodeSource repository for Node.js 22 LTS (Active LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v   # Expected: v22.x or higher (e.g. v22.23.4)
npm -v    # Expected: 10.x or higher (e.g. 10.9.9)
```

---

## 📦 3. Clone Repository & Install Dependencies

Choose a deployment directory (e.g., `/var/www/stract-z` or your user home directory):

```bash
sudo mkdir -p /var/www/stract-z
sudo chown -R $USER:$USER /var/www/stract-z

# Clone the repository
git clone https://github.com/lucthienphong1120/StrAct-Z.git /var/www/stract-z
cd /var/www/stract-z

# Install production dependencies (npm 10+)
npm install --omit=dev
```

---

## 🔑 4. Environment Configuration (`.env`)

### Step 4.1: Create Strava API Application

Before configuring `.env`, you need API credentials from Strava:

1. Log into your Strava account in your web browser.
2. Navigate to: **[https://www.strava.com/settings/api](https://www.strava.com/settings/api)**
3. If creating an application for the first time, fill in the form:
   - **Application Name**: `StrAct Z` (or any custom name)
   - **Category**: `Training`
   - **Club**: (Leave blank)
   - **Website**: Your application URL (e.g., `https://run.yourdomain.com` or `http://IP:3000`)
   - **Application Description**: `Auto running activity generator & sync`
   - **Authorization Callback Domain** *(CRITICAL)*:
     - Enter strictly your **domain or subdomain hostname** (e.g., `run.yourdomain.com` or `yourdomain.com`).
     - **DO NOT** include protocol prefix (`https://`), port numbers (`:3000`), or trailing slashes (`/`).
     - If testing locally or via IP before domain setup, you can enter `localhost` or your server's public IP address.
4. Click **Create** / **Save**.
5. Once created, copy the credentials:
   - **Client ID**: A numeric ID (e.g., `145982`) ➔ used for `STRAVA_CLIENT_ID`
   - **Client Secret**: Click **Show** to reveal the secret string ➔ used for `STRAVA_CLIENT_SECRET`

---

### Step 4.2: Generate Secret Key (`APP_SECRET`)

Generate a secure 64-character random key for encrypting stored OAuth tokens and signing JWT cookies:

```bash
openssl rand -hex 32
```
Copy the printed hex string for the `APP_SECRET` field.

---

### Step 4.3: Create and Edit `.env`

Copy the sample environment file and open it in `nano`:

```bash
cp .env.sample .env
nano .env
```

Configure the parameters:

```ini
# Strava API Credentials (obtained from Step 4.1)
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# Server Configuration
PORT=3000
BASE_URL=https://run.yourdomain.com

# Mandatory: Encryption key for database tokens & JWT (from Step 4.2)
APP_SECRET=your_generated_64_character_hex_key_here

# Optional: Cryptographic salt for token key derivation (keep default or change for prod)
ENCRYPTION_SALT=stract_z_secure_static_salt_2026_prod

# Optional: Initial admin account (Leave commented out to register via web UI)
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=your_secure_password
```

| Parameter | Description |
| :--- | :--- |
| `STRAVA_CLIENT_ID` | Numeric Client ID from [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | Secret key from Strava API management page |
| `PORT` | Local port Express listens on (default: `3000`) |
| `BASE_URL` | Public URL users access the app (must match Nginx domain with `https://`) |
| `APP_SECRET` | 32+ character random key used to encrypt SQLite data & sign cookies |
| `ENCRYPTION_SALT` | Static salt for AES-256-CBC token encryption |

> [!IMPORTANT]
> - `BASE_URL` **MUST** use `https://` in production so that Strava OAuth callbacks and Service Worker PWA function properly.
> - `APP_SECRET` must be kept safe and backed up. Changing it after accounts/tokens are created will invalidate encrypted tokens in SQLite.
> - In `nano`, press **`Ctrl + O`** then **`Enter`** to save, followed by **`Ctrl + X`** to exit.

## 🏃 5. Process Management (Keep App Running)

Choose either **PM2** (recommended for ease of use) or **Systemd**.

### Option A: Using PM2 (Recommended)

Install PM2 globally:
```bash
sudo npm install -g pm2
```

Start StrAct Z:
```bash
cd /var/www/stract-z
pm2 start server.js --name "stract-z" --time
```

Enable auto-start on server boot:
```bash
pm2 save
pm2 startup
# (Run the sudo env PATH... command that PM2 prints out)
```

Useful PM2 commands:
- `pm2 status` : Check application status
- `pm2 logs stract-z` : View live application logs
- `pm2 restart stract-z` : Restart the service
- `pm2 stop stract-z` : Stop the service

---

### Option B: Using Systemd Service

Create a systemd service file:
```bash
sudo nano /etc/systemd/system/stract-z.service
```

Paste the following content (adjust paths and user accordingly):
```ini
[Unit]
Description=StrAct Z Running Activity Automation
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/stract-z
ExecStart=/usr/bin/node /var/www/stract-z/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Reload and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable stract-z
sudo systemctl start stract-z
sudo systemctl status stract-z
```

---

## 🌐 6. Nginx Reverse Proxy & SSL (HTTPS)

### Install Nginx & Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Configure Nginx Server Block

Create a configuration file in `/etc/nginx/conf.d/` (standard across Linux distributions):
```bash
sudo nano /etc/nginx/conf.d/stract-z.conf
```
*(Alternatively, on Debian/Ubuntu systems with `sites-available`, you can use `/etc/nginx/sites-available/stract-z` and symlink to `sites-enabled/`).*

Paste the following configuration (replace `run.yourdomain.com` with your domain):

```nginx
server {
    listen 80;
    server_name run.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001; # Match PORT in your .env
        proxy_http_version 1.1;
        
        # Essential Proxy Headers for Auth, Rate Limiter & Geocoding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support & PWA bypass
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # Timeouts for OSRM / Strava API background sync
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    client_max_body_size 10M;
}
```

Verify syntax and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Obtain Free SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d run.yourdomain.com
```
Follow the prompt instructions. Certbot will automatically configure HTTPS and renewal hooks.

---

## 🔒 7. Firewall Setup (UFW)

Ensure basic security with Uncomplicated Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 🔗 8. Strava API Settings Alignment

Go to [Strava API Settings](https://www.strava.com/settings/api):
1. **Application Name**: `StrAct Z`
2. **Category**: `Training`
3. **Club**: (Leave blank or select your club)
4. **Website**: `https://run.yourdomain.com`
5. **Authorization Callback Domain**:
   - Set strictly to your hostname: `run.yourdomain.com`
   - **Do NOT** include `https://`, paths, or trailing slashes.

---

## 💾 9. Data Storage & Backups

- Database and activity files are stored under:
  - SQLite Database: `/var/www/stract-z/data/strava_runs.sqlite`
  - Activity files (FIT/GPX): `/var/www/stract-z/data/activity/`
- The `data/` directory is created automatically on server startup.
- **Backup Script (Optional)**:
  You can set up a daily cron job to backup the SQLite database:
  ```bash
  0 3 * * * cp /var/www/stract-z/data/strava_runs.sqlite /backup/strava_runs_$(date +\%F).sqlite
  ```

---

## 🔄 10. Updating to New Versions

Whenever updates are pushed to Git:

```bash
cd /var/www/stract-z
git pull origin main
npm install --omit=dev

# If using PM2:
pm2 restart stract-z

# If using Systemd:
sudo systemctl restart stract-z
```
*Note: Service Worker cache is invalidated automatically by `CACHE_NAME` in `public/sw.js` across version releases.*

---

## 🧪 11. Built-in Verification Scripts

You can verify your installation and tests directly on the server:

```bash
# Verify Hanoi POIs and GeoJSON boundary consistency
npm run verify:pois

# Test rate limits configuration
npm run test:limits

# Test public API endpoints & security tokens
npm run test:api
```

---

## 🛠️ 12. Troubleshooting & Production Gotchas

### 1. Port Collision (`EADDRINUSE: address already in use :::3000`) & 100% CPU Spike
- **Symptom**: Server CPU spikes to 90–100%, and PM2 restart count (`↺`) increments rapidly by hundreds or thousands.
- **Cause**: Port 3000 is already occupied by another service/API on the server (e.g. an existing backend service). When PM2 restarts crashed processes, a crash loop occurs.
- **Solution**:
  1. Change `PORT` in `/var/www/stract-z/.env` to an unused port (e.g. `3001`):
     ```ini
     PORT=3001
     ```
  2. Update the upstream port in `/etc/nginx/conf.d/stract-z.conf`:
     ```nginx
     proxy_pass http://127.0.0.1:3001;
     ```
  3. Reload Nginx and restart PM2 with the `--update-env` flag:
     ```bash
     nginx -t && systemctl reload nginx
     pm2 restart stract-z --update-env
     ```
  4. Also restart any conflicting service that was in crash loop:
     ```bash
     pm2 restart all
     ```

### 2. Updating Environment Variables in PM2
- **Gotcha**: Running `pm2 restart <app>` does **NOT** reload updated `.env` values into memory by default.
- **Rule**: Always pass `--update-env` when environment variables change:
  ```bash
  pm2 restart stract-z --update-env
  ```

### 3. Git Pull Conflict on `package-lock.json`
- **Symptom**: `error: Your local changes to the following files would be overwritten by merge: package-lock.json`.
- **Cause**: Running `npm install` on the server locally touched the lockfile.
- **Solution**: Discard the server's local lockfile changes and pull the verified version from Git:
  ```bash
  git checkout package-lock.json
  git pull origin main
  ```

### 4. Handling `npm audit` Warnings & Avoid `--force`
- **Gotcha**: `npm audit` reports vulnerabilities originating from `node-gyp` and `tar` inside `sqlite3`'s build tooling.
- **Rule**: **NEVER** run `npm audit fix --force`. Doing so attempts to upgrade `sqlite3` to major version 6, which breaks compatibility with the `sqlite` database wrapper. Standard `npm audit fix` (without `--force`) is safe. Build tool warnings do not expose vulnerabilities to HTTP runtime requests.

### 5. High CPU Diagnosis Command
If you suspect high CPU usage, use this command to inspect the exact script and PID consuming CPU:
```bash
ps -eo pid,user,%cpu,%mem,command --sort=-%cpu | head -n 10
```
Or open the PM2 interactive monitor:
```bash
pm2 monit
```

