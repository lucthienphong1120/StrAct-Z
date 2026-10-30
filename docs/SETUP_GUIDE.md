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

### Install Node.js (v20 LTS recommended)

```bash
# Setup NodeSource repository for Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v   # Expected: v20.x or higher
npm -v    # Expected: 10.x or higher
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

# Install production dependencies
npm install --production
```

---

## 🔑 4. Environment Configuration (`.env`)

Copy the sample environment configuration file:

```bash
cp .env.sample .env
nano .env
```

Fill in the required configuration variables:

```ini
# Strava API Credentials
# Get these from https://www.strava.com/settings/api
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# Server Configuration
PORT=3000
BASE_URL=https://run.yourdomain.com

# Mandatory: Encryption key for your tokens (Use a secure, random string >= 32 characters)
APP_SECRET=your_super_secret_random_key_min_32_chars_long

# Optional: Cryptographic salt for token key derivation
ENCRYPTION_SALT=stract_z_secure_static_salt_2026_prod

# Optional: Initial admin account (Leave commented out to register via web UI on first launch)
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=your_secure_password
```

> [!IMPORTANT]
> - `BASE_URL` **MUST** use `https://` in production so that Strava OAuth callbacks and Service Worker PWA function properly.
> - `APP_SECRET` must be kept safe and backed up. Changing it after accounts/tokens are created will invalidate encrypted tokens in SQLite.

---

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

Create a configuration file for your domain:
```bash
sudo nano /etc/nginx/sites-available/stract-z
```

Paste the following configuration (replace `run.yourdomain.com` with your domain):

```nginx
server {
    server_name run.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Essential Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # Timeouts for OSRM / Strava API background sync
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static assets caching (optional, optimizes PWA delivery)
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|geojson)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    client_max_body_size 10M;
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/stract-z /etc/nginx/sites-enabled/
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
npm install --production

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
