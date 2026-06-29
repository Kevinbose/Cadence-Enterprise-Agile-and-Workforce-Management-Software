# Cadence - Enterprise Agile and Workforce Management Software

Cadence (built for the Yakkay Tech Agile Platform) is a full-stack enterprise platform combining Agile project management (Jira/Kanban style) with real-time workforce telemetry, geofenced attendance tracking, and smart IT provisioning.

This repository contains two main layers:
1. **`/backend`**: Express.js REST API using Sequelize ORM (MySQL) with JWT authentication, timezone-aware cron sweeps, and geofence tracking.
2. **`/frontend`**: React client powered by Redux Toolkit, TailwindCSS, and Lucide React icons, featuring glassmorphism and real-time state management.

---

## 🚀 Key Modules & Architecture

### 1. Atlassian Kanban Engine
- Subtask/Task/Story hierarchy with cascade completion logic: completing all subtasks auto-promotes the parent task, and completing all tasks auto-promotes the user story.
- Scrum Master command dashboards for active sprint controls.

### 2. Geofenced Attendance Logging & Dynamic Overrides
- Morning clock-in audits using Haversine formula calculation.
- Automatically locks down the system if employee attempts to check in outside the defined 100m geofence radius of Yakkay Tech HQ.
- Regularization unlock requests for WFH anomalies.
- **Scrum Master / Manager Overrides**: Integrated a secure override system enabling leaders (Scrum Masters and Managers) to adjudicate shift statuses to `PRESENT_OFFICE`, `WFH_APPROVED`, or `ABSENT`.
- **Dynamic Lock/Unlock**: Real-time locking and unlocking of employee dashboards based on leader status edits (e.g., marking `ABSENT` locks out the day, while overriding back to `PRESENT_OFFICE` or `WFH_APPROVED` unlocks the shift immediately).
- **Session Accumulator**: Automatically computes and persists currently active work hours when overrides are applied mid-session, preventing telemetry loss.
- **Auditable Leadership Logs**: Tracks the exact identity of the adjudicating user and displays the specific leader's name (e.g., `Locked by Alan ScrumMaster`) in the employee's header status bar and Manager Hub history view.

### 3. Workforce Intelligence Cockpit
- Real-time performance indicators: Attendance Reliability Index (ARI), First Time Pass Rate (FTPR), and goalpost-updating git-diff tamper flags.
- Trust Score calculations which trigger visual warning streams in the Manager Hub when scoring drop below 75%.

### 4. IT Provisioning Console (`/create-team`)
- Air-gapped administration system for IT Managers to provision new Manager and Employee identities.
- Automatically generates sequential employee IDs (e.g. `YT-2026-004`) and maps direct manager hierarchies based on assigned team boundaries.

### 5. Secure Profile & Credentials Console (`/profile`)
- Unified employee details console showing Name, Role, Corporate Email, and dynamic organization reporting structures (e.g. Reports To manager's name).
- **Self-Service Credentials Manager**: Securely updates password with robust frontend validation, authenticated bcrypt password hashing on the backend, and a double-confirmation security dialog box.

---

## 🛠️ Getting Started (Local Development)

### Backend Setup
1. Navigate to `/backend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` based on `.env.production` placeholders:
   ```ini
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=DEV_SUPER_SECRET_YAKKAY_KEY_2026
   CLIENT_URL=http://localhost:3000

   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=yakkay_agile_db
   DB_PORT=3306

   OFFICE_LATITUDE=12.953412
   OFFICE_LONGITUDE=80.184855
   GEOFENCE_RADIUS_METERS=100
   ```
4. Run standard seeders:
   ```bash
   # Initialize tables & system default users
   npm run seed:auth
   # Provision the IT SuperAdmin
   npm run seed:superadmin
   # Populate telemetry data & task history
   node scripts/seedLargeTelemetryData.js
   ```
5. Launch backend:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to `/frontend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch frontend client:
   ```bash
   npm start
   ```
   Go to [http://localhost:3000](http://localhost:3000) to view the client.

---

## 🌐 Production Deployment Guide (VPS)

### 1. Database Preparation
Create a new MySQL schema on your VPS:
```sql
CREATE DATABASE yakkay_prod_agile_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Sequelize will automatically synchronize the schema and construct all tables, indices, and ENUM modifications on backend startup.

### 2. Backend Daemon Setup (PM2)
Install PM2 globally and start the Node process:
```bash
sudo npm install -g pm2
cd /path/to/yakkay-tech-platform/backend

# Run seeder under production env
export NODE_ENV=production
npm run seed:superadmin
npm run seed:auth
node scripts/seedLargeTelemetryData.js

# Launch backend process
pm2 start server.js --name "yakkay-backend"
pm2 save
pm2 startup
```

### 3. Frontend Compilation
Build the React static assets locally or on your VPS using the production configuration:
```bash
cd /path/to/yakkay-tech-platform/frontend
npm run build
```
This compiles optimized HTML, JS, and CSS static bundles to the `/build` folder.

### 4. Nginx Reverse Proxy Server Configuration
To serve the static React frontend on standard web ports (`80`/`443`) and route all API calls to the PM2 backend process on port `8080`, define this block in your Nginx configuration:

```nginx
server {
    listen 80;
    server_name platform.yakkaytech.com;

    # Serve static frontend React app
    location / {
        root /path/to/yakkay-tech-platform/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls directly to PM2 Backend
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Reload Nginx:
```bash
sudo systemctl reload nginx
```
