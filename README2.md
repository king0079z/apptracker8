# Updated Software Monitor Application Structure

## Directory Structure

```
software-usage-monitor/
├── src/
│   ├── main/
│   │   ├── main.js                    # Main Electron process
│   │   ├── monitoring.js              # Enhanced monitoring service with historical data
│   │   ├── data-manager.js            # Data persistence and management
│   │   └── enterprise-client.js       # Enterprise client for data sync
│   │
│   └── renderer/
│       ├── index.html                 # Enhanced UI with enterprise nav
│       ├── renderer.js                # Enhanced with enterprise dashboard
│       ├── styles.css                 # Enhanced styles for enterprise UI
│       └── preload.js                 # Electron preload script
│
├── enterprise-server/                 # NEW: Enterprise Server Application
│   ├── server.js                      # Express server with SQLite
│   ├── package.json                   # Server dependencies
│   ├── install-service.js             # Auto-installation script
│   ├── .env                           # Environment configuration
│   ├── data/                          # SQLite database storage
│   ├── logs/                          # Server logs
│   └── certs/                         # SSL certificates
│
├── assets/
│   ├── icon.png
│   └── tray-icon.png
│
├── package.json
├── package-lock.json
└── README.md
```

## New Features Added

### 1. **Enterprise Server** (`enterprise-server/`)
- Standalone Node.js/Express server
- SQLite database for data persistence
- RESTful API endpoints:
  - `POST /api/usage-data` - Receive client data
  - `GET /api/clients` - List all clients
  - `GET /api/clients/:id` - Get client details
  - `GET /api/statistics` - Aggregated statistics
- HTTPS support with self-signed certificates
- API key authentication
- Automatic service installation for Windows/Linux/macOS

### 2. **Enhanced Client Application**
- **New Enterprise Dashboard View**:
  - Overview of all connected clients
  - Department and platform distribution
  - Total cost calculations
  - Client status monitoring
  - Detailed client information modal
  
- **Enhanced Monitoring Service**:
  - Historical data tracking
  - Session duration tracking
  - Real-time process monitoring
  - Improved data structure for trends

### 3. **Installation & Deployment**

#### Server Installation:
```bash
# Clone or copy enterprise-server folder
cd enterprise-server
npm install
npm run install-service
```

The installer will:
- Create necessary directories
- Generate SSL certificates
- Create .env configuration
- Set up system service (Windows/Linux/macOS)

#### Client Configuration:
Update `data-manager.js` to include enterprise server URL:
```javascript
metadata: {
  isEnterprise: true,
  enterpriseServer: 'https://your-server:3443',
  enterpriseApiKey: 'your-api-key'
}
```

### 4. **Key Improvements**

#### Real-time Monitor (Fixed):
- Live process tracking with session durations
- Process activity timeline
- Real-time statistics
- Auto-refresh every 5 seconds

#### Trends Page (Fixed):
- Actual data from historical tracking
- Time period selection (7/30/90 days)
- Visual charts for usage patterns
- Application trend analysis

#### Cost Editor (Enhanced):
- Search functionality
- Visual change indicators
- Usage statistics display
- Reset individual changes
- Organized by applications/plugins

### 5. **Enterprise Features**

#### Server Features:
- Multi-client support
- Department-based organization
- Platform statistics
- Historical data retention
- Offline queue handling

#### Client Features:
- Automatic data sync (3 times daily)
- Offline data queuing
- System information collection
- Cost tracking across organization

### 6. **Security**
- API key authentication
- HTTPS encryption
- Environment-based configuration
- Service-level isolation

## Running the Applications

### Enterprise Server:
```bash
cd enterprise-server
npm start  # Development
# OR
# Service will auto-start if installed
```

### Client Application:
```bash
npm start  # Development
npm run build  # Production build
```

## Environment Variables

### Server (.env):
```
PORT=3443
API_KEY=your-secure-api-key
NODE_ENV=production
```

### Client (configure in data-manager.js):
```javascript
metadata: {
  isEnterprise: true,
  enterpriseServer: 'https://server-ip:3443',
  enterpriseApiKey: 'your-secure-api-key'
}
```

## Database Schema

### Clients Table:
- `client_id` - Unique identifier
- `hostname` - Computer name
- `department` - Organization department
- `platform` - Operating system
- `last_seen` - Last contact time

### Usage Data Table:
- `client_id` - Foreign key to clients
- `timestamp` - Data timestamp
- `applications` - JSON application usage
- `plugins` - JSON plugin usage
- `costs` - JSON cost data
- `system_info` - JSON system information

## API Endpoints

- `POST /api/usage-data` - Submit client data
- `GET /api/clients` - List all clients
- `GET /api/clients/:clientId` - Get specific client
- `GET /api/statistics` - Get aggregated stats

All endpoints require `X-API-Key` header.