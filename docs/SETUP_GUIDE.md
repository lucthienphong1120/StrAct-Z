# ⚙️ Setup & Deployment Guide

This guide will walk you through setting up StrAct Z v1.15.0 on your local machine or server using Node.js and `npm`.

## Prerequisites

1. **Node.js**: v18.0.0 or higher is recommended.
2. **Strava API Credentials**:
   - Go to [Strava API Settings](https://www.strava.com/settings/api).
   - Create an application to get your `Client ID` and `Client Secret`.
   - Set the **Authorization Callback Domain** to your deployment domain (e.g., `localhost` for local testing, or `yourdomain.com` for production).

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/stract-z.git
   cd stract-z
   ```

2. **Install dependencies**:
   This project does not require heavy build tools or PM2. Just standard `npm`:
   ```bash
   npm install
   ```
   *Note: Ensure dependencies like `jsonwebtoken`, `bcryptjs`, `cookie-parser`, and `express-rate-limit` install correctly.*

3. **Configure Environment Variables**:
   Copy the sample environment file:
   ```bash
   cp .env.sample .env
   ```
   Edit `.env` using your text editor:
   - `STRAVA_CLIENT_ID`: Your Strava Client ID.
   - `STRAVA_CLIENT_SECRET`: Your Strava Client Secret.
   - `APP_SECRET`: Provide a long, random string. This is crucial for encrypting database tokens and signing JWT cookies.
   - `PORT`: (Optional) Defaults to 3000.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`: (Optional) Leave these blank to use the web-based First-Time Setup UI.

## Running the Application

### Development Mode
For testing and development (includes live-reloading):
```bash
npm run dev
```

### Production Mode
To run the server in a stable state:
```bash
npm start
```
*Note: This starts the app using native Node.js. If you want it to run continuously in the background on a Linux server without PM2, you can use `nohup` or create a `systemd` service.*

Example `systemd` setup (optional):
```ini
[Unit]
Description=StrAct Z
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/stract-z/server.js
WorkingDirectory=/path/to/stract-z
Restart=always
User=nobody
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## First-Time Initialization

1. Open your browser and navigate to `http://localhost:3000` (or your server's IP/Domain).
2. Because the database is empty, you will be redirected to the **Setup Wizard**.
3. Create your Admin account by providing a username and secure password.
4. You will be logged in automatically. Proceed to link your Strava account in the dashboard.

## Google Fit API Integration Guide

To enable Google Fit sync, follow these steps to obtain your credentials:

1. **Create Google Cloud Project**: Go to [Google Cloud Console](https://console.cloud.google.com/), create a new project.
2. **Enable Fitness API**: Search for "Fitness API" and click **Enable**.
3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Create app, choose **External**.
   - Go to **Data access**, Add Scopes:
     - `fitness.activity.read`
     - `fitness.body.read`
     - `fitness.location.read`
     - `fitness.activity.write`
     - `fitness.body.write`
     - `fitness.location.write`
4. **Create Credentials**:
   - Go to **APIs & Services > Credentials**.
   - Click **+ Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`.
   - **Important**: You must submit **Publish** app for verification on **Audience** before the "Connect with Google" button will work for other users. Until verified, only the developer (you) can connect their account at **Test users**.
5. **Update .env**: Copy the Client ID and Secret into your .env file.

```env
GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```
