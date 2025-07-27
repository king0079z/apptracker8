// src/main/enterprise-pull-client.js
const NetworkScanner = require('./network-scanner');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

class EnterprisePullClient extends EventEmitter {
  constructor(dataManager) {
    super();
    this.dataManager = dataManager;
    this.scanner = new NetworkScanner();
    this.isRunning = false;
    this.syncInterval = null;
    this.config = {
      scanInterval: 300000, // 5 minutes
      syncToServer: false, // Optional: sync to central server
      serverUrl: process.env.ENTERPRISE_SERVER_URL,
      apiKey: process.env.ENTERPRISE_API_KEY
    };
    
    // Set up scanner event handlers
    this.setupScannerEvents();
  }

  async init() {
    // Load enterprise configuration
    await this.loadConfig();
    
    // Start network scanning
    this.start();
  }

  async loadConfig() {
    try {
      const configPath = path.join(require('electron').app.getPath('userData'), 'enterprise-config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = { ...this.config, ...JSON.parse(configData) };
    } catch (error) {
      // Use defaults
      console.log('Using default enterprise configuration');
    }
  }

  setupScannerEvents() {
    this.scanner.on('scan-started', () => {
      console.log('Network scan started');
      this.emit('scan-started');
    });
    
    this.scanner.on('scan-completed', (result) => {
      console.log(`Network scan completed: ${result.clientsFound} clients found`);
      this.emit('scan-completed', result);
    });
    
    this.scanner.on('client-discovered', (client) => {
      console.log(`New client discovered: ${client.clientId} at ${client.ip}`);
      this.emit('client-discovered', client);
    });
    
    this.scanner.on('client-updated', async (update) => {
      console.log(`Client updated: ${update.clientId}`);
      
      // Store client data locally
      await this.storeClientData(update);
      
      this.emit('client-updated', update);
    });
    
    this.scanner.on('scan-error', (error) => {
      console.error('Network scan error:', error);
      this.emit('scan-error', error);
    });
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scanner.start(this.config.scanInterval);
    
    // If configured, sync to central server periodically
    if (this.config.syncToServer && this.config.serverUrl) {
      this.syncInterval = setInterval(() => {
        this.syncToServer();
      }, 600000); // 10 minutes
    }
  }

  stop() {
    this.isRunning = false;
    this.scanner.stop();
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async storeClientData(update) {
    // Store client data in the main app's data manager
    const { clientId, data } = update;
    
    if (!data) return;
    
    // Store in enterprise section of usage data
    if (!this.dataManager.usageData.enterpriseClients) {
      this.dataManager.usageData.enterpriseClients = {};
    }
    
    this.dataManager.usageData.enterpriseClients[clientId] = {
      ...data,
      lastUpdate: new Date().toISOString(),
      ip: update.ip
    };
    
    // Save data
    await this.dataManager.saveData();
  }

  async syncToServer() {
    if (!this.config.serverUrl || !this.config.apiKey) return;
    
    try {
      const clients = this.scanner.getDiscoveredClients();
      
      // Send aggregated data to central server
      for (const client of clients) {
        if (client.latestData) {
          await this.sendToServer(client);
        }
      }
      
      console.log('Data synced to enterprise server');
    } catch (error) {
      console.error('Failed to sync to server:', error);
    }
  }

  async sendToServer(client) {
    const fetch = require('node-fetch');
    
    try {
      await fetch(`${this.config.serverUrl}/api/usage-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          clientId: client.clientId,
          department: client.department,
          hostname: client.latestData.systemInfo?.hostname,
          platform: client.latestData.systemInfo?.platform,
          data: client.latestData
        })
      });
    } catch (error) {
      console.error(`Failed to send data for ${client.clientId}:`, error);
    }
  }

  // API Methods for Enterprise Dashboard
  async getAllClients() {
    const clients = this.scanner.getDiscoveredClients();
    const enrichedClients = [];
    
    for (const client of clients) {
      const enriched = {
        client_id: client.clientId,
        hostname: client.latestData?.systemInfo?.hostname || client.clientId,
        department: client.department || 'Unknown',
        platform: client.latestData?.systemInfo?.platform || 'Unknown',
        last_seen: client.lastUpdate || client.lastSeen,
        first_seen: client.firstSeen || client.lastSeen,
        data_points: 1,
        latest_usage: this.formatClientData(client.latestData),
        ip_address: client.ip,
        is_online: client.isOnline
      };
      
      enrichedClients.push(enriched);
    }
    
    return enrichedClients;
  }

  formatClientData(data) {
    if (!data) return null;
    
    // Convert client data format to expected format
    const formatted = {
      applications: {},
      plugins: {},
      system_info: data.systemInfo,
      timestamp: data.timestamp
    };
    
    // Format applications
    if (data.applications) {
      data.applications.forEach(app => {
        formatted.applications[app.name] = {
          totalUsage: app.total_usage || app.totalUsage,
          lastUsed: app.last_used || app.lastUsed,
          sessions: app.sessions || []
        };
      });
    }
    
    // Format plugins
    if (data.plugins) {
      data.plugins.forEach(plugin => {
        if (!formatted.plugins[plugin.vendor]) {
          formatted.plugins[plugin.vendor] = {};
        }
        formatted.plugins[plugin.vendor][plugin.name] = {
          totalUsage: plugin.total_usage || plugin.totalUsage,
          lastUsed: plugin.last_used || plugin.lastUsed,
          sessions: plugin.sessions || [],
          cost: plugin.cost || 25
        };
      });
    }
    
    return formatted;
  }

  async getClientById(clientId) {
    const client = this.scanner.getClientById(clientId);
    if (!client) return null;
    
    // Get fresh data
    const latestData = await this.scanner.getClientData(client.ip);
    
    return {
      client,
      latestUsage: this.formatClientData(latestData),
      history: await this.getClientHistory(client.ip)
    };
  }

  async getClientHistory(clientIp) {
    try {
      const history = await this.scanner.getClientUsageHistory(clientIp, 7);
      return history || [];
    } catch (error) {
      return [];
    }
  }

  async getStatistics() {
    const clients = await this.getAllClients();
    const onlineClients = clients.filter(c => c.is_online).length;
    
    // Calculate aggregated statistics
    let totalApps = new Set();
    let totalPlugins = new Set();
    let totalCost = 0;
    
    clients.forEach(client => {
      if (client.latest_usage) {
        // Count unique applications
        Object.keys(client.latest_usage.applications || {}).forEach(app => {
          totalApps.add(app);
        });
        
        // Count unique plugins
        Object.values(client.latest_usage.plugins || {}).forEach(vendor => {
          Object.keys(vendor).forEach(plugin => {
            totalPlugins.add(plugin);
          });
        });
      }
    });
    
    return {
      total_clients: clients.length,
      online_clients: onlineClients,
      unique_applications: totalApps.size,
      unique_plugins: totalPlugins.size,
      total_monthly_cost: totalCost,
      last_scan: this.scanner.lastScanTime || new Date()
    };
  }

  async scanNow() {
    await this.scanner.performNetworkScan();
  }

  async addManualClient(ip, clientId) {
    return await this.scanner.addManualClient(ip, clientId);
  }

  removeClient(ip) {
    return this.scanner.removeClient(ip);
  }

  getConfig() {
    return this.config;
  }

  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Save config
    const configPath = path.join(require('electron').app.getPath('userData'), 'enterprise-config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    
    // Restart scanner with new interval if changed
    if (newConfig.scanInterval) {
      this.stop();
      this.start();
    }
  }

  async exportReport() {
    const clients = await this.getAllClients();
    const statistics = await this.getStatistics();
    
    return {
      generated_at: new Date().toISOString(),
      statistics,
      clients,
      network_info: this.scanner.getLocalNetworkInfo()
    };
  }
}

module.exports = EnterprisePullClient;