# Enterprise Software Monitor - Setup Guide

## Overview
This enterprise solution consists of:
1. **Server Component**: Centralized data collection and reporting
2. **Client Application**: Installed on all enterprise PCs for usage tracking

## Key Features Implemented

### 1. **Editable Cost Management**
- Click "Costs" button in header to manage software costs
- Edit monthly costs for each application and plugin
- Total costs auto-update for accurate savings calculations
- Costs persist and sync across the enterprise

### 2. **Fixed Real-Time Monitoring**
- Accurate tracking of all running applications
- Plugin detection across multiple methods
- Live updates every minute
- Visual feedback with animations

### 3. **Enterprise Architecture**

#### Client Features:
- **Auto-start on boot**: Configured for Windows and macOS
- **Accurate tracking**: Monitors usage time, frequency, sessions
- **Offline support**: Stores data locally when offline
- **Auto-sync**: Sends data to server 3 times daily (every 8 hours)
- **Queue management**: Syncs offline data when connection restored

#### Server Features:
- RESTful API for data collection
- Department-based organization
- Centralized reporting
- Cost analysis across enterprise

## Installation Instructions

### Client Setup (Each PC)

1. **Install the client app**:
```bash
# Clone and setup
git clone [repository]
cd software-usage-monitor
npm install

# Configure enterprise settings
set MONITOR_SERVER_URL=https://your-server.com
set MONITOR_API_KEY=your-api-key
set DEPARTMENT=YourDepartment
```

2. **Build for deployment**:
```bash
# Windows
npm run build:win

# macOS  
npm run build:mac
```

3. **Deploy via GPO/MDM**:
- Use the generated installer
- Configure auto-start on system boot
- Set environment variables for server connection

### Server Setup

1. **Create server application**:
```javascript
// server.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');

app.use(express.json());

// Usage data endpoint
app.post('/api/usage-data', async (req, res) => {
  const { clientId, department, data } = req.body;
  
  // Store in database
  await UsageData.create({
    clientId,
    department,
    timestamp: new Date(),
    applications: data.applications,
    plugins: data.plugins,
    costs: data.costs
  });
  
  res.json({ success: true });
});

// Reporting endpoints
app.get('/api/reports/summary', async (req, res) => {
  // Generate enterprise-wide usage summary
});

app.get('/api/reports/savings', async (req, res) => {
  // Calculate potential savings
});

app.listen(3000);
```

2. **Database schema**:
```javascript
const UsageDataSchema = new Schema({
  clientId: String,
  department: String,
  timestamp: Date,
  applications: Object,
  plugins: Object,
  costs: Object,
  systemInfo: Object
});
```

## Configuration

### Client Environment Variables
```bash
MONITOR_SERVER_URL=https://monitor-server.company.com
MONITOR_API_KEY=your-secure-api-key
DEPARTMENT=Engineering
AUTO_START=true
SYNC_INTERVAL=28800000  # 8 hours in ms
```

### Auto-Start Configuration

#### Windows:
The app automatically configures Windows startup via:
```javascript
app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe'),
  args: ['--hidden']
});
```

#### macOS:
```javascript
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true
});
```

#### Linux:
Create systemd service at `/etc/systemd/system/software-monitor.service`

## Usage

### Cost Management
1. Click "Costs" button in the app header
2. Switch between Applications and Plugins tabs
3. Edit monthly costs for each item
4. Click "Save Changes" to persist

### Monitoring
1. The app starts monitoring automatically on boot
2. Data syncs to server 3 times daily
3. Offline data queues and syncs when online
4. View real-time usage in the dashboard

### Enterprise Reporting
Access centralized reports from the server:
- Department-wise usage
- Total software costs
- Unused license identification
- Savings opportunities

## Measurement Accuracy

The system tracks:
- **Usage Time**: Precise minute-by-minute tracking
- **Frequency**: Number of times application launched
- **Sessions**: Start/end times with duration
- **Active Detection**: Real-time process monitoring
- **Plugin Usage**: Multiple detection methods
- **Cost Tracking**: Editable costs with auto-calculation

## Offline Support

When offline:
1. Data continues to be collected locally
2. Stored in `offline-queue.json`
3. Automatic retry every 5 minutes
4. Bulk sync when connection restored
5. No data loss during network outages

## Security

- API key authentication
- HTTPS encryption for data transfer
- Local data encryption (optional)
- Department-based access control
- Audit logs for all changes

## Troubleshooting

### Client Issues
- Check logs at `%APPDATA%/software-usage-monitor/logs`
- Verify server URL and API key
- Ensure auto-start permissions

### Server Issues
- Monitor server logs
- Check database connectivity
- Verify API endpoints

### Sync Issues
- Check offline queue size
- Verify network connectivity
- Review sync timestamps

## Next Steps

1. Deploy server infrastructure
2. Configure client deployment
3. Set up monitoring dashboards
4. Train IT staff on management
5. Roll out to pilot group
6. Full enterprise deployment