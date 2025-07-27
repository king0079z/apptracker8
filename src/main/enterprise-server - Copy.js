// src/main/enterprise-server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();
const { app: electronApp } = require('electron');

class EnterpriseServer {
  constructor(pullClient, dataManager) {
    this.pullClient = pullClient;
    this.dataManager = dataManager;
    this.server = null;
    this.app = express();
    this.port = process.env.ENTERPRISE_PORT || 3443;
    this.dbPath = path.join(electronApp.getPath('userData'), 'enterprise.db');
    this.db = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initDatabase();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // API Key validation middleware
    this.app.use('/api', (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      const validKey = process.env.ENTERPRISE_API_KEY || 'your-secure-api-key';
      
      if (apiKey !== validKey) {
        return res.status(403).json({ error: 'Invalid API key' });
      }
      next();
    });
  }

  setupRoutes() {
    // Get all clients
    this.app.get('/api/clients', async (req, res) => {
      try {
        const clients = await this.pullClient.getAllClients();
        res.json(clients);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific client
    this.app.get('/api/clients/:clientId', async (req, res) => {
      try {
        const clientData = await this.pullClient.getClientById(req.params.clientId);
        if (!clientData) {
          return res.status(404).json({ error: 'Client not found' });
        }
        res.json(clientData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get statistics
    this.app.get('/api/statistics', async (req, res) => {
      try {
        const stats = await this.pullClient.getStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get department summary
    this.app.get('/api/departments', async (req, res) => {
      try {
        const clients = await this.pullClient.getAllClients();
        const departments = this.aggregateDepartmentData(clients);
        res.json(departments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get software inventory
    this.app.get('/api/software-inventory', async (req, res) => {
      try {
        const clients = await this.pullClient.getAllClients();
        const inventory = this.aggregateSoftwareInventory(clients);
        res.json(inventory);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get cost analysis
    this.app.get('/api/cost-analysis', async (req, res) => {
      try {
        const clients = await this.pullClient.getAllClients();
        const analysis = this.performCostAnalysis(clients);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Trigger network scan
    this.app.post('/api/scan', async (req, res) => {
      try {
        await this.pullClient.scanNow();
        res.json({ success: true, message: 'Network scan initiated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Export reports
    this.app.get('/api/export/:type', async (req, res) => {
      try {
        const report = await this.generateReport(req.params.type);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 
          `attachment; filename=enterprise-report-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        clients: this.pullClient.getDiscoveredClients().length
      });
    });
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create aggregated data tables
        this.db.serialize(() => {
          // Historical data table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS historical_data (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              client_id TEXT,
              department TEXT,
              data JSON
            )
          `);

          // Cost tracking table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS cost_tracking (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              month TEXT,
              department TEXT,
              total_cost REAL,
              active_licenses INTEGER,
              unused_licenses INTEGER
            )
          `);

          // Alerts table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS alerts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              client_id TEXT,
              alert_type TEXT,
              message TEXT,
              resolved BOOLEAN DEFAULT 0
            )
          `);

          resolve();
        });
      });
    });
  }

  async start() {
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`Enterprise server listening on port ${this.port}`);
    });

    // Start periodic data aggregation
    this.startDataAggregation();
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.db) {
      this.db.close();
    }
  }

  startDataAggregation() {
    // Aggregate data every 15 minutes
    setInterval(async () => {
      try {
        const clients = await this.pullClient.getAllClients();
        await this.aggregateAndStoreData(clients);
      } catch (error) {
        console.error('Data aggregation error:', error);
      }
    }, 15 * 60 * 1000);
  }

  async aggregateAndStoreData(clients) {
    for (const client of clients) {
      if (client.latest_usage) {
        await this.storeHistoricalData(client.client_id, client.department, client.latest_usage);
      }
    }

    // Update cost tracking
    const costAnalysis = this.performCostAnalysis(clients);
    await this.updateCostTracking(costAnalysis);

    // Check for alerts
    await this.checkForAlerts(clients);
  }

  async storeHistoricalData(clientId, department, data) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO historical_data (client_id, department, data) VALUES (?, ?, ?)',
        [clientId, department, JSON.stringify(data)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async updateCostTracking(costAnalysis) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    for (const dept of costAnalysis.byDepartment) {
      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT OR REPLACE INTO cost_tracking 
           (month, department, total_cost, active_licenses, unused_licenses) 
           VALUES (?, ?, ?, ?, ?)`,
          [month, dept.name, dept.totalCost, dept.activeLicenses, dept.unusedLicenses],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  async checkForAlerts(clients) {
    for (const client of clients) {
      // Check if client is offline
      const lastSeen = new Date(client.last_seen);
      const minutesOffline = (Date.now() - lastSeen) / 60000;
      
      if (minutesOffline > 30) {
        await this.createAlert(
          client.client_id,
          'offline',
          `Client ${client.hostname} has been offline for ${Math.round(minutesOffline)} minutes`
        );
      }

      // Check for high resource usage
      if (client.latest_usage?.system_info?.memory?.usagePercent > 90) {
        await this.createAlert(
          client.client_id,
          'high_memory',
          `Client ${client.hostname} is using ${client.latest_usage.system_info.memory.usagePercent}% memory`
        );
      }

      // Check for unused expensive software
      if (client.latest_usage?.applications) {
        for (const [app, data] of Object.entries(client.latest_usage.applications)) {
          if (data.cost > 100 && this.getDaysInactive(data.lastUsed) > 30) {
            await this.createAlert(
              client.client_id,
              'unused_software',
              `${app} ($${data.cost}/mo) unused for ${this.getDaysInactive(data.lastUsed)} days on ${client.hostname}`
            );
          }
        }
      }
    }
  }

  async createAlert(clientId, type, message) {
    // Check if similar alert already exists
    const existing = await new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM alerts WHERE client_id = ? AND alert_type = ? AND resolved = 0',
        [clientId, type],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!existing) {
      await new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO alerts (client_id, alert_type, message) VALUES (?, ?, ?)',
          [clientId, type, message],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  aggregateDepartmentData(clients) {
    const departments = {};
    
    clients.forEach(client => {
      const dept = client.department || 'Unknown';
      if (!departments[dept]) {
        departments[dept] = {
          department: dept,
          count: 0,
          online: 0,
          totalCost: 0,
          applications: new Set(),
          plugins: new Set()
        };
      }
      
      departments[dept].count++;
      
      if (this.isClientOnline(client.last_seen)) {
        departments[dept].online++;
      }
      
      if (client.latest_usage) {
        // Add applications
        Object.keys(client.latest_usage.applications || {}).forEach(app => {
          departments[dept].applications.add(app);
        });
        
        // Add plugins
        Object.values(client.latest_usage.plugins || {}).forEach(vendor => {
          Object.keys(vendor).forEach(plugin => {
            departments[dept].plugins.add(plugin);
          });
        });
        
        // Calculate cost
        departments[dept].totalCost += this.calculateClientCost(client.latest_usage);
      }
    });
    
    return Object.values(departments).map(dept => ({
      ...dept,
      applications: dept.applications.size,
      plugins: dept.plugins.size
    }));
  }

  aggregateSoftwareInventory(clients) {
    const inventory = {
      applications: {},
      plugins: {}
    };
    
    clients.forEach(client => {
      if (!client.latest_usage) return;
      
      // Aggregate applications
      Object.entries(client.latest_usage.applications || {}).forEach(([app, data]) => {
        if (!inventory.applications[app]) {
          inventory.applications[app] = {
            name: app,
            installations: 0,
            activeInstallations: 0,
            totalUsage: 0,
            estimatedCost: this.getAppCost(app)
          };
        }
        
        inventory.applications[app].installations++;
        if (this.getDaysInactive(data.lastUsed) <= 7) {
          inventory.applications[app].activeInstallations++;
        }
        inventory.applications[app].totalUsage += data.totalUsage || 0;
      });
      
      // Aggregate plugins
      Object.entries(client.latest_usage.plugins || {}).forEach(([vendor, plugins]) => {
        Object.entries(plugins).forEach(([plugin, data]) => {
          const key = `${vendor}:${plugin}`;
          if (!inventory.plugins[key]) {
            inventory.plugins[key] = {
              vendor,
              name: plugin,
              installations: 0,
              activeInstallations: 0,
              totalUsage: 0,
              estimatedCost: data.cost || 25
            };
          }
          
          inventory.plugins[key].installations++;
          if (this.getDaysInactive(data.lastUsed) <= 7) {
            inventory.plugins[key].activeInstallations++;
          }
          inventory.plugins[key].totalUsage += data.totalUsage || 0;
        });
      });
    });
    
    return {
      applications: Object.values(inventory.applications),
      plugins: Object.values(inventory.plugins)
    };
  }

  performCostAnalysis(clients) {
    const analysis = {
      totalMonthlyCost: 0,
      totalAnnualCost: 0,
      activeLicenses: 0,
      unusedLicenses: 0,
      potentialSavings: 0,
      byDepartment: [],
      topExpenses: []
    };
    
    const departmentCosts = {};
    const softwareCosts = [];
    
    clients.forEach(client => {
      if (!client.latest_usage) return;
      
      const dept = client.department || 'Unknown';
      if (!departmentCosts[dept]) {
        departmentCosts[dept] = {
          name: dept,
          totalCost: 0,
          activeLicenses: 0,
          unusedLicenses: 0
        };
      }
      
      // Calculate application costs
      Object.entries(client.latest_usage.applications || {}).forEach(([app, data]) => {
        const cost = this.getAppCost(app);
        const isActive = this.getDaysInactive(data.lastUsed) <= 30;
        
        if (isActive) {
          analysis.activeLicenses++;
          departmentCosts[dept].activeLicenses++;
          analysis.totalMonthlyCost += cost;
          departmentCosts[dept].totalCost += cost;
        } else {
          analysis.unusedLicenses++;
          departmentCosts[dept].unusedLicenses++;
          analysis.potentialSavings += cost;
        }
        
        softwareCosts.push({ name: app, cost, isActive, client: client.hostname });
      });
      
      // Calculate plugin costs
      Object.values(client.latest_usage.plugins || {}).forEach(vendor => {
        Object.entries(vendor).forEach(([plugin, data]) => {
          const cost = data.cost || 25;
          const isActive = this.getDaysInactive(data.lastUsed) <= 30;
          
          if (isActive) {
            analysis.activeLicenses++;
            departmentCosts[dept].activeLicenses++;
            analysis.totalMonthlyCost += cost;
            departmentCosts[dept].totalCost += cost;
          } else {
            analysis.unusedLicenses++;
            departmentCosts[dept].unusedLicenses++;
            analysis.potentialSavings += cost;
          }
          
          softwareCosts.push({ name: plugin, cost, isActive, client: client.hostname });
        });
      });
    });
    
    analysis.totalAnnualCost = analysis.totalMonthlyCost * 12;
    analysis.byDepartment = Object.values(departmentCosts);
    analysis.topExpenses = softwareCosts
      .filter(s => s.isActive)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);
    
    return analysis;
  }

  async generateReport(type) {
    const clients = await this.pullClient.getAllClients();
    
    switch (type) {
      case 'full-report':
        return this.generateFullReport(clients);
      case 'cost-analysis':
        return this.generateCostReport(clients);
      case 'unused-software':
        return this.generateUnusedSoftwareReport(clients);
      default:
        throw new Error('Invalid report type');
    }
  }

  generateFullReport(clients) {
    let csv = 'Enterprise Software Usage Report\n';
    csv += `Generated on: ${new Date().toISOString()}\n\n`;
    
    // Summary
    const stats = this.pullClient.getStatistics();
    csv += 'SUMMARY\n';
    csv += `Total Clients,${clients.length}\n`;
    csv += `Online Clients,${stats.online_clients}\n`;
    csv += `Total Applications,${stats.unique_applications}\n`;
    csv += `Total Plugins,${stats.unique_plugins}\n\n`;
    
    // Client details
    csv += 'CLIENT DETAILS\n';
    csv += 'Hostname,Department,Platform,User,IP Address,Last Seen,Applications,Plugins,Monthly Cost\n';
    
    clients.forEach(client => {
      const apps = Object.keys(client.latest_usage?.applications || {}).length;
      const plugins = this.countPlugins(client.latest_usage?.plugins || {});
      const cost = this.calculateClientCost(client.latest_usage || {});
      const ip = client.latest_usage?.system_info?.ipAddresses?.[0]?.address || 'N/A';
      const user = client.latest_usage?.system_info?.user?.username || 'Unknown';
      
      csv += `${client.hostname},${client.department || 'Unknown'},${client.platform},${user},${ip},${client.last_seen},${apps},${plugins},$${cost}\n`;
    });
    
    return csv;
  }

  generateCostReport(clients) {
    const analysis = this.performCostAnalysis(clients);
    
    let csv = 'Cost Analysis Report\n';
    csv += `Generated on: ${new Date().toISOString()}\n\n`;
    
    csv += 'SUMMARY\n';
    csv += `Total Monthly Cost,$${analysis.totalMonthlyCost.toFixed(2)}\n`;
    csv += `Total Annual Cost,$${analysis.totalAnnualCost.toFixed(2)}\n`;
    csv += `Active Licenses,${analysis.activeLicenses}\n`;
    csv += `Unused Licenses,${analysis.unusedLicenses}\n`;
    csv += `Potential Monthly Savings,$${analysis.potentialSavings.toFixed(2)}\n\n`;
    
    csv += 'DEPARTMENT BREAKDOWN\n';
    csv += 'Department,Monthly Cost,Active Licenses,Unused Licenses\n';
    analysis.byDepartment.forEach(dept => {
      csv += `${dept.name},$${dept.totalCost.toFixed(2)},${dept.activeLicenses},${dept.unusedLicenses}\n`;
    });
    
    csv += '\nTOP EXPENSES\n';
    csv += 'Software,Cost/Month,Client\n';
    analysis.topExpenses.forEach(expense => {
      csv += `${expense.name},$${expense.cost},${expense.client}\n`;
    });
    
    return csv;
  }

  generateUnusedSoftwareReport(clients) {
    let csv = 'Unused Software Report\n';
    csv += `Generated on: ${new Date().toISOString()}\n\n`;
    csv += 'Client,Department,Software,Type,Last Used,Days Inactive,Monthly Cost\n';
    
    clients.forEach(client => {
      if (!client.latest_usage) return;
      
      // Check applications
      Object.entries(client.latest_usage.applications || {}).forEach(([app, data]) => {
        const daysInactive = this.getDaysInactive(data.lastUsed);
        if (daysInactive > 30) {
          const cost = this.getAppCost(app);
          csv += `${client.hostname},${client.department || 'Unknown'},${app},Application,${data.lastUsed || 'Never'},${daysInactive},$${cost}\n`;
        }
      });
      
      // Check plugins
      Object.entries(client.latest_usage.plugins || {}).forEach(([vendor, plugins]) => {
        Object.entries(plugins).forEach(([plugin, data]) => {
          const daysInactive = this.getDaysInactive(data.lastUsed);
          if (daysInactive > 30) {
            const cost = data.cost || 25;
            csv += `${client.hostname},${client.department || 'Unknown'},${plugin},Plugin,${data.lastUsed || 'Never'},${daysInactive},$${cost}\n`;
          }
        });
      });
    });
    
    return csv;
  }

  // Helper methods
  isClientOnline(lastSeen) {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    return new Date(lastSeen).getTime() > tenMinutesAgo;
  }

  getDaysInactive(lastUsed) {
    if (!lastUsed) return Infinity;
    const diff = Date.now() - new Date(lastUsed).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  calculateClientCost(usage) {
    let cost = 0;
    
    // Add application costs
    Object.entries(usage.applications || {}).forEach(([app, data]) => {
      if (this.getDaysInactive(data.lastUsed) <= 30) {
        cost += this.getAppCost(app);
      }
    });
    
    // Add plugin costs
    Object.values(usage.plugins || {}).forEach(vendor => {
      Object.values(vendor).forEach(plugin => {
        if (this.getDaysInactive(plugin.lastUsed) <= 30) {
          cost += plugin.cost || 25;
        }
      });
    });
    
    return cost;
  }

  getAppCost(appName) {
    const costs = {
      'Adobe After Effects': 55,
      'Adobe Premiere Pro': 55,
      'Adobe Photoshop': 35,
      'Adobe Illustrator': 35,
      'Cinema 4D': 94,
      'Rhinoceros': 195,
      '3ds Max': 215,
      'Autodesk Maya': 215,
      'DaVinci Resolve': 295,
      'Nuke': 499,
      'Houdini': 269,
      'Blender': 0,
      'Unity Editor': 150,
      'Unreal Engine': 0
    };
    
    return costs[appName] || 50;
  }

  countPlugins(plugins) {
    let count = 0;
    Object.values(plugins).forEach(vendor => {
      count += Object.keys(vendor).length;
    });
    return count;
  }
}

module.exports = EnterpriseServer;