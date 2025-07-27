# Enterprise Software Monitor - Implementation Guide

## Overview

This enterprise software monitoring solution consists of:

1. **Main Application** - Central monitoring dashboard with network scanning
2. **Client Application** - Runs on each PC to monitor software usage
3. **Enterprise Server** - REST API server for data aggregation
4. **Network Scanner** - Discovers clients on the network
5. **Setup Wizards** - Automated installation for both components

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Application                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Dashboard  │  │   Network    │  │   Enterprise    │  │
│  │     UI      │  │   Scanner    │  │     Server      │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ Port 3443
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────▼────────┐        ┌─────────▼────────┐    │
│  Client PC 1   │        │   Client PC 2    │    ▼
│ ┌────────────┐ │        │ ┌────────────┐   │   ...
│ │   Client   │ │        │ │   Client   │   │
│ │  Monitor   │ │        │ │  Monitor   │   │
│ │ Port 9876  │ │        │ │ Port 9876  │   │
│ └────────────┘ │        │ └────────────┘   │
│ Local SQLite DB│        │ Local SQLite DB  │
└────────────────┘        └──────────────────┘
```

## Deployment Steps

### 1. Build the Applications

```bash
# Install dependencies
npm install

# Build main application
npm run build:win   # For Windows
npm run build:mac   # For macOS
npm run build:linux # For Linux

# Build client installer
cd client-installer
npm install
npm run build
```

### 2. Deploy the Main Application

The main application installer includes:
- Enterprise dashboard
- Network scanner
- Local monitoring
- Enterprise server (port 3443)

**Installation:**
1. Run the installer with administrator privileges
2. Configure enterprise settings during installation
3. The application will auto-start and create a system tray icon

### 3. Deploy Client Applications

The client installer includes:
- Background monitoring service
- Local SQLite database
- REST API server (port 9876)
- Auto-start configuration

**Mass Deployment Options:**

#### Option A: Group Policy (Windows)
```batch
@echo off
\\server\share\enterprise-monitor-client-setup.exe /S /D=C:\Program Files\EnterpriseMonitorClient
```

#### Option B: SCCM/Intune
Create an application package with:
- Silent install command: `setup.exe /S`
- Detection method: Registry key or file presence
- Requirements: Windows 7+ or macOS 10.12+

#### Option C: PowerShell Remote Installation
```powershell
$computers = Get-Content "computers.txt"
$installer = "\\server\share\enterprise-monitor-client-setup.exe"

foreach ($computer in $computers) {
    Invoke-Command -ComputerName $computer -ScriptBlock {
        Start-Process -FilePath $using:installer -ArgumentList "/S" -Wait
    }
}
```

### 4. Network Configuration

**Firewall Rules Required:**
- Main Application: TCP Port 3443 (inbound)
- Client Application: TCP Port 9876 (inbound)

**Windows Firewall:**
```batch
netsh advfirewall firewall add rule name="Enterprise Monitor Server" dir=in action=allow protocol=TCP localport=3443
netsh advfirewall firewall add rule name="Enterprise Monitor Client" dir=in action=allow protocol=TCP localport=9876
```

### 5. Configuration Files

**Main Application Config** (`%APPDATA%/enterprise-software-monitor/settings.json`):
```json
{
  "monitoringInterval": 60000,
  "autoStart": true,
  "enterprise": {
    "serverPort": 3443,
    "scanInterval": 300000,
    "apiKey": "your-secure-api-key"
  }
}
```

**Client Config** (`%PROGRAMFILES%/EnterpriseMonitorClient/config/client-config.json`):
```json
{
  "department": "Engineering",
  "clientId": "HOSTNAME",
  "monitoringInterval": 60000,
  "allowNetworkAccess": true
}
```

## Security Considerations

### 1. Network Security
- Use HTTPS for production deployments
- Implement proper API key authentication
- Restrict network access to local subnet only

### 2. Data Privacy
- All data is stored locally on client machines
- No data is sent outside the local network
- Implement data retention policies

### 3. Access Control
- Main application requires authentication
- Client API is read-only
- Implement role-based access for different departments

## Monitoring Features

### Data Collected:
1. **Applications**: Name, usage time, last used date
2. **Plugins**: Vendor, name, usage, associated applications
3. **System Info**: Hardware specs, OS version, IP addresses
4. **Usage Patterns**: Peak hours, session duration, trends

### Reports Available:
1. Software inventory across all clients
2. Unused license identification
3. Cost analysis by department
4. Usage trends and patterns
5. Compliance reports

## Troubleshooting

### Client Not Discovered
1. Check firewall rules (port 9876)
2. Verify client service is running
3. Ensure same network subnet
4. Check client logs at `%APPDATA%/EnterpriseMonitorClient/logs`

### High Resource Usage
1. Increase monitoring interval
2. Disable real-time scanning
3. Limit historical data retention

### Installation Issues
1. Ensure administrator privileges
2. Check antivirus exclusions
3. Verify .NET Framework 4.7.2+ installed
4. Check Windows Event Log for errors

## Maintenance

### Regular Tasks:
1. **Weekly**: Review unused software report
2. **Monthly**: Clean up old data (>90 days)
3. **Quarterly**: Update cost information
4. **Annually**: Review and optimize monitoring settings

### Backup:
- Main app database: `%APPDATA%/enterprise-software-monitor/`
- Client databases: `%APPDATA%/EnterpriseMonitorClient/`

### Updates:
- Enable auto-updates in the main application
- Deploy client updates via same mass deployment method

## API Reference

### Enterprise Server API

**Get All Clients**
```
GET http://localhost:3443/api/clients
Headers: X-API-Key: your-api-key
```

**Get Client Details**
```
GET http://localhost:3443/api/clients/{clientId}
Headers: X-API-Key: your-api-key
```

**Get Statistics**
```
GET http://localhost:3443/api/statistics
Headers: X-API-Key: your-api-key
```

### Client API

**Get Status**
```
GET http://client-ip:9876/api/status
```

**Get Latest Data**
```
GET http://client-ip:9876/api/latest
```

**Get Applications**
```
GET http://client-ip:9876/api/applications
```

## Support

For issues or questions:
1. Check logs in `%APPDATA%/enterprise-software-monitor/logs`
2. Review this documentation
3. Contact IT support team

## License

This software is proprietary and confidential. Unauthorized copying or distribution is prohibited.