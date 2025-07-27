# Complete Enterprise Software Monitor Structure

## Project Architecture

The solution consists of two separate applications:

### 1. **Client Application** (Installed on each PC)
```
software-usage-monitor-client/
│
├── src/
│   ├── main/
│   │   ├── main.js                 # Main process with enterprise integration
│   │   ├── monitoring.js           # Process monitoring (Windows/Mac compatible)
│   │   ├── data-manager.js         # Data persistence with cost management
│   │   └── enterprise-client.js    # Server sync, offline queue, auto-start
│   │
│   └── renderer/
│       ├── index.html              # UI with cost editor modal
│       ├── preload.js              # Secure IPC with cost/sync methods
│       ├── renderer.js             # UI logic with cost management
│       └── styles.css              # Styles including cost editor
│
├── assets/
│   ├── icon.ico                    # Windows icon
│   ├── icon.icns                   # macOS icon
│   ├── icon.png                    # Linux icon
│   └── tray-icon.png               # System tray icon
│
├── build/
│   └── entitlements.mac.plist      # macOS permissions
│
├── package.json                    # Client dependencies
├── LICENSE.txt
└── README.md
```

### 2. **Server Application** (Central monitoring server)
```
software-usage-monitor-server/
│
├── server.js                       # Express server with MongoDB
├── package.json                    # Server dependencies
├── .env                           # Environment configuration
├── docker-compose.yml             # Docker setup (optional)
└── README.md                      # Server documentation
```

## Installation & Deployment

### Server Setup (One-time)

1. **Install on central server**:
```bash
# Clone server repository
git clone [server-repo]
cd software-usage-monitor-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings:
# MONGODB_URI=mongodb://localhost:27017/software-monitor
# API_KEY=your-secure-api-key
# PORT=3000

# Start MongoDB
mongod --dbpath /data/db

# Start server
npm start
# Or use PM2 for production
pm2 start server.js --name monitor-server
```

2. **Server package.json**:
```json
{
  "name": "software-usage-monitor-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

### Client Deployment (Each PC)

1. **Configure for your server**:
```bash
# Windows
set MONITOR_SERVER_URL=https://your-server.company.com
set MONITOR_API_KEY=your-api-key
set DEPARTMENT=Engineering

# macOS/Linux
export MONITOR_SERVER_URL=https://your-server.company.com
export MONITOR_API_KEY=your-api-key
export DEPARTMENT=Engineering
```

2. **Build and install**:
```bash
cd software-usage-monitor-client
npm install
npm run build:win  # or build:mac

# The installer will be in dist/
# Deploy via GPO, SCCM, or MDM
```

## Key Features Now Working

### 1. ✅ **Cost Management (Fixed)**
- Click "Costs" button in header
- Edit costs for all applications and plugins
- Changes persist locally and sync to server
- Total cost calculations update automatically

### 2. ✅ **Enterprise Architecture**
- **Server**: Centralized MongoDB-based collection
- **Clients**: Auto-sync every 8 hours
- **Offline**: Queue system for disconnected clients
- **Auto-start**: Configured on system boot

### 3. ✅ **Data Flow**
```
Client PC → Local Monitoring → Local Storage → 
  ↓ (Every 8 hours or manual sync)
Enterprise Server → MongoDB → 
  ↓
API Endpoints → Reports/Analytics
```

### 4. ✅ **Server API Endpoints**
- `POST /api/usage-data` - Receive client data
- `GET /api/reports/summary` - Enterprise summary
- `GET /api/reports/costs` - Cost analysis
- `GET /api/reports/unused` - Unused licenses
- `GET /api/departments/:dept` - Department details

## Configuration Options

### Client Configuration (environment variables)
```bash
# Required
MONITOR_SERVER_URL=https://monitor.company.com
MONITOR_API_KEY=secure-key-here
DEPARTMENT=YourDept

# Optional
SYNC_INTERVAL=28800000  # 8 hours in ms
AUTO_START=true
OFFLINE_QUEUE_SIZE=1000
```

### Server Configuration (.env file)
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/software-monitor

# Security
API_KEY=your-secure-api-key
NODE_ENV=production

# Server
PORT=3000

# Optional
AGGREGATION_INTERVAL=3600000  # 1 hour
MAX_REQUEST_SIZE=50mb
```

## Usage Instructions

### For End Users (Client)
1. **Monitoring starts automatically** on boot
2. **View usage**: Open from system tray
3. **Edit costs**: Click "Costs" button
4. **Manual sync**: Settings → Sync Now

### For IT Administrators (Server)
1. **View all clients**: `GET /api/reports/summary`
2. **Department costs**: `GET /api/reports/costs?department=Engineering`
3. **Find unused**: `GET /api/reports/unused?threshold=30`
4. **Export data**: Use MongoDB export tools

## Security Features
- API key authentication
- HTTPS encryption required
- Rate limiting (100 requests/15min)
- Helmet.js security headers
- Input validation
- Department-based access

## Monitoring Accuracy
- **Minute-level tracking**: Every process check
- **Session tracking**: Start/end times recorded
- **Multi-method detection**: Process + directory + registry
- **Plugin accuracy**: Host app association + standalone
- **Cost tracking**: Per-license with custom pricing

## Troubleshooting

### Client Issues
```bash
# Check logs
%APPDATA%\software-usage-monitor\logs\

# Verify sync
Look for "sync-status" in UI

# Test connection
curl https://your-server/api/health
```

### Server Issues
```bash
# Check MongoDB
mongo --eval "db.stats()"

# View logs
pm2 logs monitor-server

# Test endpoints
curl -H "X-API-Key: your-key" https://your-server/api/reports/summary
```

## Next Steps
1. Deploy server to production
2. Create installer packages for clients
3. Configure auto-deployment via GPO/MDM
4. Set up monitoring dashboards
5. Schedule regular cost reviews