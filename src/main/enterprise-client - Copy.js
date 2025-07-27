// src/main/enterprise-client.js - Enterprise Client Configuration
const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const https = require('https');

class EnterpriseClient {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.config = {
      serverUrl: process.env.MONITOR_SERVER_URL || 'https://monitor-server.company.com',
      apiKey: process.env.MONITOR_API_KEY || '',
      syncInterval: 8 * 60 * 60 * 1000, // 8 hours (3 times daily)
      offlineQueuePath: path.join(app.getPath('userData'), 'offline-queue.json'),
      clientId: os.hostname(),
      department: process.env.DEPARTMENT || 'Unknown',
      autoStart: true
    };
    
    this.syncTimer = null;
    this.offlineQueue = [];
    this.isOnline = true;
  }

  async init() {
    // Load offline queue
    await this.loadOfflineQueue();
    
    // Set up auto-start
    if (this.config.autoStart) {
      this.setupAutoStart();
    }
    
    // Start sync timer
    this.startSyncTimer();
    
    // Check connectivity
    this.checkConnectivity();
    
    // Initial sync attempt
    setTimeout(() => this.syncData(), 5000);
  }

  setupAutoStart() {
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe'),
        args: ['--hidden']
      });
    } else if (process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true
      });
    }
  }

  startSyncTimer() {
    // Clear existing timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    // Sync 3 times daily (every 8 hours)
    this.syncTimer = setInterval(() => {
      this.syncData();
    }, this.config.syncInterval);
  }

  async syncData() {
    console.log('Starting enterprise data sync...');
    
    try {
      const usageData = this.dataManager.getUsageData();
      const syncPayload = {
        clientId: this.config.clientId,
        department: this.config.department,
        hostname: os.hostname(),
        platform: os.platform(),
        timestamp: new Date().toISOString(),
        data: {
          applications: usageData.applications,
          plugins: usageData.plugins,
          costs: usageData.costs,
          systemInfo: await this.getSystemInfo()
        }
      };
      
      if (this.isOnline) {
        // Try to sync online
        const success = await this.sendToServer(syncPayload);
        
        if (success) {
          // Also process offline queue if any
          await this.processOfflineQueue();
          console.log('Data sync completed successfully');
        } else {
          // Add to offline queue
          await this.addToOfflineQueue(syncPayload);
        }
      } else {
        // Add to offline queue
        await this.addToOfflineQueue(syncPayload);
      }
    } catch (error) {
      console.error('Sync error:', error);
      await this.addToOfflineQueue(syncPayload);
    }
  }

  async sendToServer(payload) {
    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      const url = new URL(`${this.config.serverUrl}/api/usage-data`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Key': this.config.apiKey
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(true);
          } else {
            console.error('Server response:', res.statusCode, responseData);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('Request error:', error);
        this.isOnline = false;
        resolve(false);
      });
      
      req.write(data);
      req.end();
    });
  }

  async addToOfflineQueue(payload) {
    this.offlineQueue.push(payload);
    await this.saveOfflineQueue();
    console.log('Data added to offline queue');
  }

  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`Processing ${this.offlineQueue.length} offline entries...`);
    const failedItems = [];
    
    for (const payload of this.offlineQueue) {
      const success = await this.sendToServer(payload);
      if (!success) {
        failedItems.push(payload);
      }
    }
    
    this.offlineQueue = failedItems;
    await this.saveOfflineQueue();
  }

  async loadOfflineQueue() {
    try {
      const data = await fs.readFile(this.config.offlineQueuePath, 'utf8');
      this.offlineQueue = JSON.parse(data);
    } catch (error) {
      this.offlineQueue = [];
    }
  }

  async saveOfflineQueue() {
    try {
      await fs.writeFile(
        this.config.offlineQueuePath, 
        JSON.stringify(this.offlineQueue, null, 2)
      );
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  checkConnectivity() {
    // Check connectivity every 5 minutes
    setInterval(() => {
      https.get(this.config.serverUrl, (res) => {
        this.isOnline = true;
        if (this.offlineQueue.length > 0) {
          this.processOfflineQueue();
        }
      }).on('error', () => {
        this.isOnline = false;
      });
    }, 5 * 60 * 1000);
  }

  async getSystemInfo() {
    const MonitoringService = require('./monitoring');
    const monitor = new MonitoringService();
    return await monitor.getSystemInfo();
  }

  // Get sync status for UI
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      lastSync: this.lastSyncTime,
      queuedItems: this.offlineQueue.length,
      nextSync: this.getNextSyncTime(),
      clientId: this.config.clientId,
      department: this.config.department
    };
  }

  getNextSyncTime() {
    if (!this.syncTimer) return null;
    
    const now = Date.now();
    const nextSync = new Date(now + this.config.syncInterval);
    return nextSync.toISOString();
  }
}

module.exports = EnterpriseClient;