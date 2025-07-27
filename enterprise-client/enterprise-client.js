// enterprise-client/client-monitor.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const express = require('express');

class EnterpriseClientMonitor {
  constructor() {
    this.db = null;
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.localServer = null;
    this.port = 9876; // Local port for data access
    this.dbPath = path.join(app.getPath('userData'), 'monitoring.db');
    this.configPath = path.join(app.getPath('userData'), 'client-config.json');
    this.config = {
      department: '',
      clientId: os.hostname(),
      monitoringInterval: 60000, // 1 minute
      dataRetentionDays: 30,
      allowNetworkAccess: true
    };
  }

  async init() {
    // Load configuration
    await this.loadConfig();
    
    // Initialize database
    await this.initDatabase();
    
    // Set up local server for data access
    await this.setupLocalServer();
    
    // Start monitoring
    await this.startMonitoring();
    
    // Create system tray
    this.createSystemTray();
    
    // Clean old data periodically
    setInterval(() => this.cleanOldData(), 24 * 60 * 60 * 1000); // Daily
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = { ...this.config, ...JSON.parse(configData) };
    } catch (error) {
      // Use defaults and save
      await this.saveConfig();
    }
  }

  async saveConfig() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create tables
        this.db.serialize(() => {
          // Usage data table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS usage_data (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              data_type TEXT,
              data JSON,
              client_id TEXT,
              department TEXT
            )
          `);
          
          // Applications table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS applications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE,
              total_usage INTEGER DEFAULT 0,
              last_used DATETIME,
              first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
              sessions JSON
            )
          `);
          
          // Plugins table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS plugins (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              vendor TEXT,
              name TEXT,
              total_usage INTEGER DEFAULT 0,
              last_used DATETIME,
              first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
              sessions JSON,
              UNIQUE(vendor, name)
            )
          `);
          
          // System info table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS system_info (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              info JSON
            )
          `);
          
          // Create indexes
          this.db.run('CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_data(timestamp)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_apps_name ON applications(name)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_plugins_vendor ON plugins(vendor)');
          
          resolve();
        });
      });
    });
  }

  async setupLocalServer() {
    const app = express();
    
    // Enable CORS for local network access
    app.use((req, res, next) => {
      const clientIp = req.ip || req.connection.remoteAddress;
      
      // Only allow local network access
      if (this.isLocalNetwork(clientIp) && this.config.allowNetworkAccess) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
        next();
      } else {
        res.status(403).json({ error: 'Access denied' });
      }
    });
    
    app.use(express.json());
    
    // Endpoints
    app.get('/api/status', (req, res) => {
      res.json({
        clientId: this.config.clientId,
        department: this.config.department,
        isMonitoring: this.isMonitoring,
        lastUpdate: new Date()
      });
    });
    
    app.get('/api/latest', async (req, res) => {
      try {
        const data = await this.getLatestData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/usage/:days', async (req, res) => {
      try {
        const days = parseInt(req.params.days) || 7;
        const data = await this.getUsageData(days);
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/applications', async (req, res) => {
      try {
        const apps = await this.getApplicationsData();
        res.json(apps);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/plugins', async (req, res) => {
      try {
        const plugins = await this.getPluginsData();
        res.json(plugins);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/system-info', async (req, res) => {
      try {
        const info = await this.getLatestSystemInfo();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start server
    this.localServer = app.listen(this.port, '0.0.0.0', () => {
      console.log(`Client monitor API listening on port ${this.port}`);
    });
  }

  isLocalNetwork(ip) {
    // Check if IP is from local network
    const localRanges = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fe80::/
    ];
    
    return localRanges.some(range => range.test(ip));
  }

  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Initial check
    await this.performMonitoringCheck();
    
    // Set interval
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, this.config.monitoringInterval);
  }

  async performMonitoringCheck() {
    try {
      const timestamp = new Date();
      
      // Get running processes
      const processes = await this.getRunningProcesses();
      
      // Detect applications and plugins
      const { applications, plugins } = this.detectSoftware(processes);
      
      // Get system info
      const systemInfo = await this.getSystemInfo();
      
      // Store in database
      await this.storeMonitoringData({
        timestamp,
        applications,
        plugins,
        systemInfo,
        processes: processes.length
      });
      
      console.log(`Monitoring check complete: ${applications.size} apps, ${plugins.size} plugins`);
      
    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }

  async getRunningProcesses() {
    const platform = os.platform();
    let processes = [];
    
    try {
      if (platform === 'win32') {
        const { stdout } = await execPromise('tasklist /fo csv');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        lines.slice(1).forEach(line => {
          const parts = line.split('","').map(p => p.replace(/"/g, ''));
          if (parts.length >= 5) {
            processes.push({
              name: parts[0],
              pid: parts[1],
              memory: parseInt(parts[4].replace(/[^\d]/g, '')) || 0
            });
          }
        });
      } else if (platform === 'darwin' || platform === 'linux') {
        const { stdout } = await execPromise('ps aux');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        lines.slice(1).forEach(line => {
          const parts = line.split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              name: parts.slice(10).join(' '),
              pid: parts[1],
              memory: parseFloat(parts[3]) || 0
            });
          }
        });
      }
    } catch (error) {
      console.error('Error getting processes:', error);
    }
    
    return processes;
  }

  detectSoftware(processes) {
    const applications = new Map();
    const plugins = new Map();
    
    // Target applications to monitor
    const targetApps = {
      'AfterFX.exe': 'Adobe After Effects',
      'Premiere Pro.exe': 'Adobe Premiere Pro',
      'Photoshop.exe': 'Adobe Photoshop',
      'Illustrator.exe': 'Adobe Illustrator',
      'Cinema 4D.exe': 'Cinema 4D',
      'Rhino.exe': 'Rhinoceros',
      '3dsmax.exe': '3ds Max',
      'Maya.exe': 'Autodesk Maya',
      'Blender.exe': 'Blender',
      'Resolve.exe': 'DaVinci Resolve',
      'Unity.exe': 'Unity Editor',
      'Code.exe': 'Visual Studio Code'
    };
    
    // Check processes
    processes.forEach(process => {
      const processName = process.name.toLowerCase();
      
      // Check applications
      Object.entries(targetApps).forEach(([exe, appName]) => {
        if (processName.includes(exe.toLowerCase())) {
          applications.set(appName, {
            processName: process.name,
            pid: process.pid,
            detected: true
          });
        }
      });
      
      // Check for plugin processes
      const pluginIndicators = ['trapcode', 'sapphire', 'redgiant', 'borisfx', 'redshift'];
      pluginIndicators.forEach(indicator => {
        if (processName.includes(indicator)) {
          plugins.set(indicator, {
            processName: process.name,
            detected: true
          });
        }
      });
    });
    
    return { applications, plugins };
  }

  async getSystemInfo() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const networkInterfaces = os.networkInterfaces();
    
    const ipAddresses = [];
    Object.keys(networkInterfaces).forEach(iface => {
      networkInterfaces[iface].forEach(addr => {
        if (!addr.internal && addr.family === 'IPv4') {
          ipAddresses.push({
            interface: iface,
            address: addr.address
          });
        }
      });
    });
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      osVersion: os.release(),
      arch: os.arch(),
      cpus: {
        model: cpus[0].model,
        cores: cpus.length,
        speed: cpus[0].speed
      },
      memory: {
        total: Math.round(totalMemory / (1024 * 1024 * 1024)),
        free: Math.round(freeMemory / (1024 * 1024 * 1024)),
        used: Math.round((totalMemory - freeMemory) / (1024 * 1024 * 1024))
      },
      uptime: Math.round(os.uptime() / 3600),
      ipAddresses,
      user: {
        username: os.userInfo().username,
        homedir: os.userInfo().homedir
      }
    };
  }

  async storeMonitoringData(data) {
    const { timestamp, applications, plugins, systemInfo } = data;
    
    // Store usage data
    await this.runQuery(
      'INSERT INTO usage_data (timestamp, data_type, data, client_id, department) VALUES (?, ?, ?, ?, ?)',
      [timestamp, 'monitoring_snapshot', JSON.stringify(data), this.config.clientId, this.config.department]
    );
    
    // Update applications
    for (const [appName, appData] of applications) {
      await this.updateApplication(appName, timestamp);
    }
    
    // Update plugins
    for (const [pluginName, pluginData] of plugins) {
      await this.updatePlugin(pluginName, timestamp);
    }
    
    // Store system info
    await this.runQuery(
      'INSERT INTO system_info (timestamp, info) VALUES (?, ?)',
      [timestamp, JSON.stringify(systemInfo)]
    );
  }

  async updateApplication(name, timestamp) {
    // Check if exists
    const existing = await this.getQuery(
      'SELECT * FROM applications WHERE name = ?',
      [name]
    );
    
    if (existing) {
      // Update existing
      const sessions = JSON.parse(existing.sessions || '[]');
      const lastSession = sessions[sessions.length - 1];
      
      // Update or create session
      if (lastSession && this.isWithinSession(lastSession.endTime)) {
        lastSession.endTime = timestamp;
        lastSession.duration = this.getTimeDifference(lastSession.startTime, timestamp);
      } else {
        sessions.push({
          startTime: timestamp,
          endTime: timestamp,
          duration: 1
        });
      }
      
      await this.runQuery(
        'UPDATE applications SET total_usage = total_usage + 1, last_used = ?, sessions = ? WHERE name = ?',
        [timestamp, JSON.stringify(sessions), name]
      );
    } else {
      // Insert new
      const sessions = [{
        startTime: timestamp,
        endTime: timestamp,
        duration: 1
      }];
      
      await this.runQuery(
        'INSERT INTO applications (name, total_usage, last_used, sessions) VALUES (?, ?, ?, ?)',
        [name, 1, timestamp, JSON.stringify(sessions)]
      );
    }
  }

  async updatePlugin(name, timestamp) {
    // Simplified - in production, would detect vendor properly
    const vendor = 'Unknown';
    
    const existing = await this.getQuery(
      'SELECT * FROM plugins WHERE vendor = ? AND name = ?',
      [vendor, name]
    );
    
    if (existing) {
      const sessions = JSON.parse(existing.sessions || '[]');
      const lastSession = sessions[sessions.length - 1];
      
      if (lastSession && this.isWithinSession(lastSession.endTime)) {
        lastSession.endTime = timestamp;
        lastSession.duration = this.getTimeDifference(lastSession.startTime, timestamp);
      } else {
        sessions.push({
          startTime: timestamp,
          endTime: timestamp,
          duration: 1
        });
      }
      
      await this.runQuery(
        'UPDATE plugins SET total_usage = total_usage + 1, last_used = ?, sessions = ? WHERE vendor = ? AND name = ?',
        [timestamp, JSON.stringify(sessions), vendor, name]
      );
    } else {
      const sessions = [{
        startTime: timestamp,
        endTime: timestamp,
        duration: 1
      }];
      
      await this.runQuery(
        'INSERT INTO plugins (vendor, name, total_usage, last_used, sessions) VALUES (?, ?, ?, ?, ?)',
        [vendor, name, 1, timestamp, JSON.stringify(sessions)]
      );
    }
  }

  isWithinSession(lastTime) {
    if (!lastTime) return false;
    const diff = Date.now() - new Date(lastTime).getTime();
    return diff < (this.config.monitoringInterval * 2);
  }

  getTimeDifference(start, end) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.floor(diff / 60000); // minutes
  }

  // Database helper methods
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // API methods
  async getLatestData() {
    const latestUsage = await this.getQuery(
      'SELECT * FROM usage_data ORDER BY timestamp DESC LIMIT 1'
    );
    
    const applications = await this.allQuery(
      'SELECT * FROM applications ORDER BY total_usage DESC'
    );
    
    const plugins = await this.allQuery(
      'SELECT * FROM plugins ORDER BY total_usage DESC'
    );
    
    const systemInfo = await this.getQuery(
      'SELECT * FROM system_info ORDER BY timestamp DESC LIMIT 1'
    );
    
    return {
      clientId: this.config.clientId,
      department: this.config.department,
      timestamp: latestUsage?.timestamp,
      applications: applications.map(app => ({
        ...app,
        sessions: JSON.parse(app.sessions || '[]')
      })),
      plugins: plugins.map(plugin => ({
        ...plugin,
        sessions: JSON.parse(plugin.sessions || '[]')
      })),
      systemInfo: systemInfo ? JSON.parse(systemInfo.info) : null
    };
  }

  async getUsageData(days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const data = await this.allQuery(
      'SELECT * FROM usage_data WHERE timestamp > ? ORDER BY timestamp DESC',
      [startDate.toISOString()]
    );
    
    return data.map(row => ({
      ...row,
      data: JSON.parse(row.data)
    }));
  }

  async getApplicationsData() {
    const apps = await this.allQuery(
      'SELECT * FROM applications ORDER BY total_usage DESC'
    );
    
    return apps.map(app => ({
      ...app,
      sessions: JSON.parse(app.sessions || '[]')
    }));
  }

  async getPluginsData() {
    const plugins = await this.allQuery(
      'SELECT * FROM plugins ORDER BY total_usage DESC'
    );
    
    return plugins.map(plugin => ({
      ...plugin,
      sessions: JSON.parse(plugin.sessions || '[]')
    }));
  }

  async getLatestSystemInfo() {
    const info = await this.getQuery(
      'SELECT * FROM system_info ORDER BY timestamp DESC LIMIT 1'
    );
    
    return info ? JSON.parse(info.info) : null;
  }

  async cleanOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);
    
    await this.runQuery(
      'DELETE FROM usage_data WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );
    
    await this.runQuery(
      'DELETE FROM system_info WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );
    
    console.log('Old data cleaned');
  }

  createSystemTray() {
    // Simplified - in production, would create actual system tray
    console.log('Client monitor running in background');
  }

  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.localServer) {
      this.localServer.close();
    }
    
    if (this.db) {
      this.db.close();
    }
  }
}

// Run as background service
const monitor = new EnterpriseClientMonitor();

app.whenReady().then(() => {
  monitor.init();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep running in background
});

app.on('before-quit', async () => {
  await monitor.shutdown();
});

module.exports = EnterpriseClientMonitor;