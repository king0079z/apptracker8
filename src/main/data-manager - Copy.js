// src/main/data-manager.js - Data Management Service
const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class DataManager {
  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'usage-data.json');
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.recommendationsPath = path.join(app.getPath('userData'), 'recommendations.json');
    
    this.usageData = this.initializeUsageData();
    this.settings = this.getDefaultSettings();
    this.recommendations = [];
  }

  initializeUsageData() {
    return {
      applications: {},
      plugins: {
        'Maxon': {
          'Redgiant': {
            'Trapcode': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 },
            'Magic Bullet': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 },
            'Universe': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 },
            'VFX': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 },
            'Keying Suite': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 }
          },
          'Redshift': {
            'Core': { totalUsage: 0, lastUsed: null, sessions: [], cost: 45 },
            'Shading': { totalUsage: 0, lastUsed: null, sessions: [], cost: 45 },
            'Lighting': { totalUsage: 0, lastUsed: null, sessions: [], cost: 45 },
            'Camera': { totalUsage: 0, lastUsed: null, sessions: [], cost: 45 },
            "AOV's": { totalUsage: 0, lastUsed: null, sessions: [], cost: 45 }
          },
          'Trap Code Form': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 }
        },
        'borisfx': {
          'Sapphire': { totalUsage: 0, lastUsed: null, sessions: [], cost: 195 },
          'Continuum': { totalUsage: 0, lastUsed: null, sessions: [], cost: 195 },
          'BORIS S-Blur & Sharpen': { totalUsage: 0, lastUsed: null, sessions: [], cost: 195 },
          'Mocha Pro': { totalUsage: 0, lastUsed: null, sessions: [], cost: 69 }
        },
        'Lens Distortion': {
          'Lens Distortion': { totalUsage: 0, lastUsed: null, sessions: [], cost: 49 }
        },
        'Revisionfx': {
          'RSMB': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 },
          'GBDeflicker': { totalUsage: 0, lastUsed: null, sessions: [], cost: 249 },
          'Twixtor Pro': { totalUsage: 0, lastUsed: null, sessions: [], cost: 595 }
        },
        'fxfactory': {
          'FX Factory': { totalUsage: 0, lastUsed: null, sessions: [], cost: 399 }
        },
        'filmimpact': {
          'Filmimpact': { totalUsage: 0, lastUsed: null, sessions: [], cost: 179 }
        },
        'rowbyte': {
          'Pluxes': { totalUsage: 0, lastUsed: null, sessions: [], cost: 299 },
          'Newton': { totalUsage: 0, lastUsed: null, sessions: [], cost: 249 }
        },
        'Geo Layer': {
          'Geo Layer': { totalUsage: 0, lastUsed: null, sessions: [], cost: 329 }
        },
        'AE Scripts': {
          'AE Scripts': { totalUsage: 0, lastUsed: null, sessions: [], cost: 149 },
          'Moglyphfx': { totalUsage: 0, lastUsed: null, sessions: [], cost: 79 },
          'Data Glitch': { totalUsage: 0, lastUsed: null, sessions: [], cost: 39 }
        },
        'New Blufx': {
          'New Blufx Stabilizer': { totalUsage: 0, lastUsed: null, sessions: [], cost: 299 },
          'NewblueFX Elements': { totalUsage: 0, lastUsed: null, sessions: [], cost: 899 }
        },
        'waves': {
          'WLM Loudness Meter': { totalUsage: 0, lastUsed: null, sessions: [], cost: 79 }
        },
        'Isotope': {
          'Ozone': { totalUsage: 0, lastUsed: null, sessions: [], cost: 249 }
        },
        'Neat Video': {
          'Neat Video': { totalUsage: 0, lastUsed: null, sessions: [], cost: 139 }
        },
        'Plural Eyes': {
          'Plural Eyes': { totalUsage: 0, lastUsed: null, sessions: [], cost: 149 }
        },
        'Enscape3d': {
          'Enscape for Rhino': { totalUsage: 0, lastUsed: null, sessions: [], cost: 750 }
        },
        'insydium.ltd': {
          'X-Particles': { totalUsage: 0, lastUsed: null, sessions: [], cost: 825 }
        },
        'Otoy': {
          'Octane Render': { totalUsage: 0, lastUsed: null, sessions: [], cost: 399 }
        },
        'cinemaplugins': {
          'DEM Earth': { totalUsage: 0, lastUsed: null, sessions: [], cost: 239 }
        },
        'Videocopilot': {
          'Videocopilot Elements': { totalUsage: 0, lastUsed: null, sessions: [], cost: 199 },
          'Videocopilot Optical Flare': { totalUsage: 0, lastUsed: null, sessions: [], cost: 124 },
          'Videocopilot Heat Distortion': { totalUsage: 0, lastUsed: null, sessions: [], cost: 39 },
          'Videocopilot Twitch': { totalUsage: 0, lastUsed: null, sessions: [], cost: 39 }
        },
        'Video Hive': {
          'Video Hive': { totalUsage: 0, lastUsed: null, sessions: [], cost: 89 }
        },
        'Frischluft': {
          'Frischluft Lenscare': { totalUsage: 0, lastUsed: null, sessions: [], cost: 199 }
        }
      },
      costs: {
        applications: {
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
          'Unreal Engine': 0,
          'Substance Painter': 20,
          'ZBrush': 40
        }
      },
      metadata: {
        firstRun: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        version: '2.0.0',
        isEnterprise: true,
        clientId: require('os').hostname(),
        syncQueue: []
      }
    };
  }

  getDefaultSettings() {
    return {
      monitoringInterval: 60000, // 1 minute
      inactivityThreshold: 30, // days
      autoStart: true,
      minimizeToTray: true,
      notifications: {
        enabled: true,
        unusedSoftware: true,
        exportComplete: true
      },
      export: {
        defaultFormat: 'csv',
        includeInactive: true,
        includeMetadata: true
      }
    };
  }

  async loadData() {
    try {
      // Load usage data
      const data = await fs.readFile(this.dataPath, 'utf8');
      this.usageData = JSON.parse(data);
      
      // Ensure all plugin structure exists
      this.mergePluginStructure();
    } catch (error) {
      console.log('No existing usage data found, using defaults');
      this.usageData = this.initializeUsageData();
    }

    try {
      // Load settings
      const settings = await fs.readFile(this.settingsPath, 'utf8');
      this.settings = { ...this.getDefaultSettings(), ...JSON.parse(settings) };
    } catch (error) {
      console.log('No existing settings found, using defaults');
    }

    try {
      // Load recommendations
      const recommendations = await fs.readFile(this.recommendationsPath, 'utf8');
      this.recommendations = JSON.parse(recommendations);
    } catch (error) {
      this.recommendations = [];
    }
  }

  mergePluginStructure() {
    const defaultData = this.initializeUsageData();
    
    // Merge plugins structure
    Object.keys(defaultData.plugins).forEach(vendor => {
      if (!this.usageData.plugins[vendor]) {
        this.usageData.plugins[vendor] = defaultData.plugins[vendor];
      } else {
        Object.keys(defaultData.plugins[vendor]).forEach(product => {
          if (!this.usageData.plugins[vendor][product]) {
            this.usageData.plugins[vendor][product] = defaultData.plugins[vendor][product];
          } else if (typeof defaultData.plugins[vendor][product] === 'object' && 
                     !defaultData.plugins[vendor][product].totalUsage) {
            // Handle nested products
            Object.keys(defaultData.plugins[vendor][product]).forEach(subProduct => {
              if (!this.usageData.plugins[vendor][product][subProduct]) {
                this.usageData.plugins[vendor][product][subProduct] = 
                  defaultData.plugins[vendor][product][subProduct];
              }
            });
          }
        });
      }
    });
  }

  async saveData() {
    try {
      this.usageData.metadata.lastSaved = new Date().toISOString();
      await fs.writeFile(this.dataPath, JSON.stringify(this.usageData, null, 2));
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
      await fs.writeFile(this.recommendationsPath, JSON.stringify(this.recommendations, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  updateUsageData(monitoringData) {
    const { applications, plugins, timestamp, allProcesses } = monitoringData;
    
    console.log(`Updating usage data - Apps: ${applications.size}, Plugins: ${plugins.size}`);
    
    // Update applications
    applications.forEach((appData, appName) => {
      if (!this.usageData.applications[appName]) {
        this.usageData.applications[appName] = {
          totalUsage: 0,
          lastUsed: null,
          sessions: []
        };
      }
      
      const app = this.usageData.applications[appName];
      app.totalUsage += 1; // Each check = 1 minute
      app.lastUsed = timestamp;
      
      // Add to current session or create new one
      const lastSession = app.sessions[app.sessions.length - 1];
      if (lastSession && this.isWithinSession(lastSession.endTime)) {
        lastSession.endTime = timestamp;
        lastSession.duration = this.getTimeDifference(lastSession.startTime, timestamp);
      } else {
        app.sessions.push({
          startTime: timestamp,
          endTime: timestamp,
          duration: 1
        });
      }
    });
    
    // Update plugins
    plugins.forEach((pluginData, pluginName) => {
      this.updatePluginUsage(pluginName, timestamp);
    });
    
    // Auto-save periodically
    this.saveData();
  }

  updatePluginUsage(pluginName, timestamp) {
    // Search through all vendors and products to find the plugin
    Object.keys(this.usageData.plugins).forEach(vendor => {
      const vendorPlugins = this.usageData.plugins[vendor];
      
      Object.keys(vendorPlugins).forEach(product => {
        if (typeof vendorPlugins[product] === 'object' && vendorPlugins[product].totalUsage !== undefined) {
          // Direct plugin match
          if (product === pluginName || pluginName.includes(product) || product.includes(pluginName)) {
            vendorPlugins[product].lastUsed = timestamp;
            vendorPlugins[product].totalUsage += 1;
            this.updatePluginSession(vendorPlugins[product], timestamp);
          }
        } else if (typeof vendorPlugins[product] === 'object') {
          // Nested plugins
          Object.keys(vendorPlugins[product]).forEach(subProduct => {
            if (subProduct === pluginName || pluginName.includes(subProduct) || subProduct.includes(pluginName)) {
              vendorPlugins[product][subProduct].lastUsed = timestamp;
              vendorPlugins[product][subProduct].totalUsage += 1;
              this.updatePluginSession(vendorPlugins[product][subProduct], timestamp);
            }
          });
        }
      });
    });
  }

  updatePluginSession(plugin, timestamp) {
    const lastSession = plugin.sessions[plugin.sessions.length - 1];
    if (lastSession && this.isWithinSession(lastSession.endTime)) {
      lastSession.endTime = timestamp;
      lastSession.duration = this.getTimeDifference(lastSession.startTime, timestamp);
    } else {
      plugin.sessions.push({
        startTime: timestamp,
        endTime: timestamp,
        duration: 1
      });
    }
  }

  isWithinSession(lastTime) {
    if (!lastTime) return false;
    const diff = Date.now() - new Date(lastTime).getTime();
    return diff < (this.settings.monitoringInterval * 2); // Within 2 monitoring cycles
  }

  getTimeDifference(start, end) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.floor(diff / 60000); // Return minutes
  }

  async exportData(format) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, -5);
    const fileName = `usage-report-${timestamp}.${format}`;
    const filePath = path.join(app.getPath('downloads'), fileName);
    
    try {
      let content;
      
      if (format === 'json') {
        content = JSON.stringify({
          reportDate: new Date().toISOString(),
          systemInfo: await this.getSystemInfo(),
          summary: this.generateSummary(),
          usageData: this.usageData,
          recommendations: this.recommendations,
          savings: this.calculateDetailedSavings()
        }, null, 2);
      } else if (format === 'csv') {
        content = this.generateDetailedCSV();
      } else if (format === 'pdf') {
        // For PDF generation, we'll create an HTML report
        content = await this.generateHTMLReport();
        // In production, you'd use a library like puppeteer or electron-pdf
      }
      
      await fs.writeFile(filePath, content);
      shell.showItemInFolder(filePath);
      
      return { 
        success: true, 
        filePath,
        message: `Data exported successfully to ${fileName}`
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        message: `Export failed: ${error.message}`
      };
    }
  }

  generateSummary() {
    const apps = Object.values(this.usageData.applications);
    const totalApps = apps.length;
    const activeApps = apps.filter(app => this.getDaysInactive(app.lastUsed) <= 7).length;
    
    let totalPlugins = 0;
    let activePlugins = 0;
    let totalUsageMinutes = 0;
    
    // Calculate plugin statistics
    Object.values(this.usageData.plugins).forEach(vendor => {
      Object.values(vendor).forEach(product => {
        if (product.totalUsage !== undefined) {
          totalPlugins++;
          if (this.getDaysInactive(product.lastUsed) <= 7) activePlugins++;
          totalUsageMinutes += product.totalUsage;
        } else {
          Object.values(product).forEach(subProduct => {
            totalPlugins++;
            if (this.getDaysInactive(subProduct.lastUsed) <= 7) activePlugins++;
            totalUsageMinutes += subProduct.totalUsage;
          });
        }
      });
    });
    
    // Add app usage
    apps.forEach(app => totalUsageMinutes += app.totalUsage);
    
    return {
      totalApplications: totalApps,
      activeApplications: activeApps,
      inactiveApplications: totalApps - activeApps,
      totalPlugins,
      activePlugins,
      inactivePlugins: totalPlugins - activePlugins,
      totalUsageHours: Math.round(totalUsageMinutes / 60),
      utilizationRate: ((activeApps + activePlugins) / (totalApps + totalPlugins) * 100).toFixed(2),
      monitoringStartDate: this.usageData.metadata.firstRun,
      lastUpdateDate: this.usageData.metadata.lastSaved
    };
  }

  generateDetailedCSV() {
    let csv = 'Software Usage Report\n';
    csv += `Generated on: ${new Date().toISOString()}\n\n`;
    
    // Summary section
    const summary = this.generateSummary();
    csv += 'SUMMARY\n';
    csv += `Total Applications,${summary.totalApplications}\n`;
    csv += `Active Applications,${summary.activeApplications}\n`;
    csv += `Total Plugins,${summary.totalPlugins}\n`;
    csv += `Active Plugins,${summary.activePlugins}\n`;
    csv += `Total Usage Hours,${summary.totalUsageHours}\n`;
    csv += `Utilization Rate,${summary.utilizationRate}%\n\n`;
    
    // Detailed usage data
    csv += 'DETAILED USAGE DATA\n';
    csv += 'Type,Vendor,Product,Sub Product,Total Usage (minutes),Hours Used,Last Used,Days Inactive,Status,Monthly Cost,Recommendation\n';
    
    // Export applications
    Object.entries(this.usageData.applications).forEach(([app, data]) => {
      const daysInactive = this.getDaysInactive(data.lastUsed);
      const status = daysInactive > this.settings.inactivityThreshold ? 'Inactive' : 'Active';
      const hoursUsed = (data.totalUsage / 60).toFixed(2);
      const monthlyCost = this.getEstimatedCost(app, 'application');
      const recommendation = daysInactive > this.settings.inactivityThreshold ? 'Consider removing' : 'Keep';
      
      csv += `Application,,,${app},${data.totalUsage},${hoursUsed},${data.lastUsed || 'Never'},${daysInactive},${status},${monthlyCost},${recommendation}\n`;
    });
    
    // Export plugins
    Object.entries(this.usageData.plugins).forEach(([vendor, vendorPlugins]) => {
      Object.entries(vendorPlugins).forEach(([product, productData]) => {
        if (productData.totalUsage !== undefined) {
          const daysInactive = this.getDaysInactive(productData.lastUsed);
          const status = daysInactive > this.settings.inactivityThreshold ? 'Inactive' : 'Active';
          const hoursUsed = (productData.totalUsage / 60).toFixed(2);
          const monthlyCost = this.getEstimatedCost(product, 'plugin');
          const recommendation = daysInactive > this.settings.inactivityThreshold ? 'Consider removing' : 'Keep';
          
          csv += `Plugin,${vendor},${product},,${productData.totalUsage},${hoursUsed},${productData.lastUsed || 'Never'},${daysInactive},${status},${monthlyCost},${recommendation}\n`;
        } else {
          Object.entries(productData).forEach(([subProduct, subData]) => {
            const daysInactive = this.getDaysInactive(subData.lastUsed);
            const status = daysInactive > this.settings.inactivityThreshold ? 'Inactive' : 'Active';
            const hoursUsed = (subData.totalUsage / 60).toFixed(2);
            const monthlyCost = this.getEstimatedCost(subProduct, 'plugin');
            const recommendation = daysInactive > this.settings.inactivityThreshold ? 'Consider removing' : 'Keep';
            
            csv += `Plugin,${vendor},${product},${subProduct},${subData.totalUsage},${hoursUsed},${subData.lastUsed || 'Never'},${daysInactive},${status},${monthlyCost},${recommendation}\n`;
          });
        }
      });
    });
    
    // Savings summary
    const savings = this.calculateDetailedSavings();
    csv += '\nPOTENTIAL SAVINGS\n';
    csv += `Total Monthly Savings,${savings.totalMonthlySavings}\n`;
    csv += `Total Annual Savings,${savings.totalAnnualSavings}\n`;
    csv += `Number of Unused Licenses,${savings.unusedLicenses}\n`;
    
    return csv;
  }

  async generateHTMLReport() {
    const summary = this.generateSummary();
    const savings = this.calculateDetailedSavings();
    const systemInfo = await this.getSystemInfo();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Software Usage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .savings { background: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .inactive { color: #d32f2f; }
        .active { color: #388e3c; }
    </style>
</head>
<body>
    <h1>Software Usage Report</h1>
    <p>Generated on: ${new Date().toLocaleDateString()}</p>
    <p>System: ${systemInfo.hostname} (${systemInfo.osVersion})</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Applications: ${summary.totalApplications} (${summary.activeApplications} active)</p>
        <p>Total Plugins: ${summary.totalPlugins} (${summary.activePlugins} active)</p>
        <p>Total Usage: ${summary.totalUsageHours} hours</p>
        <p>Utilization Rate: ${summary.utilizationRate}%</p>
    </div>
    
    <div class="savings">
        <h2>Potential Savings</h2>
        <p>Monthly Savings: ${savings.totalMonthlySavings}</p>
        <p>Annual Savings: ${savings.totalAnnualSavings}</p>
        <p>Unused Licenses: ${savings.unusedLicenses}</p>
    </div>
    
    <h2>Detailed Usage</h2>
    ${this.generateHTMLTables()}
</body>
</html>
    `;
  }

  generateHTMLTables() {
    // Implementation for HTML tables
    return '<!-- Detailed tables would go here -->';
  }

  calculateDetailedSavings() {
    let totalMonthlySavings = 0;
    let unusedLicenses = 0;
    const savingsBreakdown = [];
    
    // Check applications
    Object.entries(this.usageData.applications).forEach(([app, data]) => {
      const daysInactive = this.getDaysInactive(data.lastUsed);
      if (daysInactive > this.settings.inactivityThreshold) {
        const cost = this.getEstimatedCost(app, 'application');
        totalMonthlySavings += cost;
        unusedLicenses++;
        savingsBreakdown.push({
          name: app,
          type: 'application',
          monthlyCost: cost,
          daysInactive
        });
      }
    });
    
    // Check plugins
    Object.entries(this.usageData.plugins).forEach(([vendor, vendorPlugins]) => {
      Object.entries(vendorPlugins).forEach(([product, productData]) => {
        if (productData.totalUsage !== undefined) {
          const daysInactive = this.getDaysInactive(productData.lastUsed);
          if (daysInactive > this.settings.inactivityThreshold) {
            const cost = this.getEstimatedCost(product, 'plugin');
            totalMonthlySavings += cost;
            unusedLicenses++;
            savingsBreakdown.push({
              name: product,
              vendor,
              type: 'plugin',
              monthlyCost: cost,
              daysInactive
            });
          }
        } else {
          Object.entries(productData).forEach(([subProduct, subData]) => {
            const daysInactive = this.getDaysInactive(subData.lastUsed);
            if (daysInactive > this.settings.inactivityThreshold) {
              const cost = this.getEstimatedCost(subProduct, 'plugin');
              totalMonthlySavings += cost;
              unusedLicenses++;
              savingsBreakdown.push({
                name: `${product} - ${subProduct}`,
                vendor,
                type: 'plugin',
                monthlyCost: cost,
                daysInactive
              });
            }
          });
        }
      });
    });
    
    return {
      totalMonthlySavings: totalMonthlySavings.toFixed(2),
      totalAnnualSavings: (totalMonthlySavings * 12).toFixed(2),
      unusedLicenses,
      savingsBreakdown,
      calculationDate: new Date().toISOString()
    };
  }

  async updateCost(type, name, vendor, cost) {
    try {
      if (type === 'application') {
        if (!this.usageData.costs) {
          this.usageData.costs = { applications: {} };
        }
        this.usageData.costs.applications[name] = parseFloat(cost);
      } else if (type === 'plugin') {
        // Find and update plugin cost
        if (this.usageData.plugins[vendor]) {
          Object.keys(this.usageData.plugins[vendor]).forEach(product => {
            const plugin = this.usageData.plugins[vendor][product];
            if (plugin.cost !== undefined && product === name) {
              plugin.cost = parseFloat(cost);
            } else if (typeof plugin === 'object') {
              Object.keys(plugin).forEach(subProduct => {
                if (subProduct === name && plugin[subProduct].cost !== undefined) {
                  plugin[subProduct].cost = parseFloat(cost);
                }
              });
            }
          });
        }
      }
      
      await this.saveData();
      return { success: true };
    } catch (error) {
      console.error('Error updating cost:', error);
      return { success: false, error: error.message };
    }
  }

  getEstimatedCost(name, type) {
    // Check custom costs first
    if (type === 'application' && this.usageData.costs?.applications?.[name]) {
      return this.usageData.costs.applications[name];
    }
    
    // Check plugin costs
    if (type === 'plugin') {
      for (const vendor of Object.keys(this.usageData.plugins)) {
        for (const product of Object.keys(this.usageData.plugins[vendor])) {
          const plugin = this.usageData.plugins[vendor][product];
          if (product === name && plugin.cost !== undefined) {
            return plugin.cost;
          } else if (typeof plugin === 'object') {
            for (const subProduct of Object.keys(plugin)) {
              if (subProduct === name && plugin[subProduct].cost !== undefined) {
                return plugin[subProduct].cost;
              }
            }
          }
        }
      }
    }
    
    // Default costs
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
      'Houdini': 269
    };
    
    return costs[name] || (type === 'application' ? 50 : 25);
  }

  async trackSavingsConfirmation(item) {
    if (!this.confirmedSavings) {
      this.confirmedSavings = [];
    }
    
    const saving = {
      ...item,
      confirmedAt: new Date().toISOString(),
      monthlySaving: this.getEstimatedCost(item.name, item.type),
      status: 'confirmed'
    };
    
    this.confirmedSavings.push(saving);
    
    // Save to a separate file for tracking realized savings
    const savingsPath = path.join(app.getPath('userData'), 'confirmed-savings.json');
    try {
      await fs.writeFile(savingsPath, JSON.stringify(this.confirmedSavings, null, 2));
    } catch (error) {
      console.error('Error saving confirmed savings:', error);
    }
    
    return saving;
  }

  async getSystemInfo() {
    const MonitoringService = require('./monitoring');
    const monitor = new MonitoringService();
    return await monitor.getSystemInfo();
  }

  async getConfirmedSavings() {
    try {
      const savingsPath = path.join(app.getPath('userData'), 'confirmed-savings.json');
      const data = await fs.readFile(savingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async generateAnalytics() {
    const summary = this.generateSummary();
    const patterns = this.analyzeUsagePatterns();
    const costs = this.analyzeCosts();
    const recommendations = this.generateSmartRecommendations();
    
    return {
      summary,
      patterns,
      costs,
      recommendations,
      utilizationRate: summary.utilizationRate,
      utilizationTrend: this.calculateUtilizationTrend(),
      peakUsageHour: this.findPeakUsageHour(),
      avgSessionLength: this.calculateAvgSessionLength(),
      costPerHour: this.calculateCostPerHour()
    };
  }

  analyzeUsagePatterns() {
    const dayUsage = {};
    const hourUsage = {};
    
    // Analyze application sessions
    Object.values(this.usageData.applications).forEach(app => {
      app.sessions?.forEach(session => {
        const date = new Date(session.startTime);
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = date.getHours();
        
        dayUsage[day] = (dayUsage[day] || 0) + session.duration;
        hourUsage[hour] = (hourUsage[hour] || 0) + session.duration;
      });
    });
    
    // Find most productive day
    let mostProductiveDay = 'Monday';
    let maxDayUsage = 0;
    Object.entries(dayUsage).forEach(([day, usage]) => {
      if (usage > maxDayUsage) {
        maxDayUsage = usage;
        mostProductiveDay = day;
      }
    });
    
    // Calculate average daily usage
    const totalDays = Object.keys(dayUsage).length || 1;
    const totalUsage = Object.values(dayUsage).reduce((sum, usage) => sum + usage, 0);
    const avgDailyHours = Math.round(totalUsage / totalDays / 60);
    
    // Determine trend
    const trend = this.calculateUsageTrend();
    
    return {
      mostProductiveDay,
      avgDailyHours,
      trend,
      dayUsage,
      hourUsage
    };
  }

  analyzeCosts() {
    let totalMonthly = 0;
    let savingsPotential = 0;
    
    // Calculate application costs
    Object.entries(this.usageData.applications).forEach(([app, data]) => {
      const cost = this.getEstimatedCost(app, 'application');
      totalMonthly += cost;
      
      if (this.getDaysInactive(data.lastUsed) > this.settings.inactivityThreshold) {
        savingsPotential += cost;
      }
    });
    
    // Calculate plugin costs
    Object.values(this.usageData.plugins).forEach(vendor => {
      Object.values(vendor).forEach(product => {
        if (product.totalUsage !== undefined) {
          const cost = this.getEstimatedCost(product.name || 'Unknown', 'plugin');
          totalMonthly += cost;
          
          if (this.getDaysInactive(product.lastUsed) > this.settings.inactivityThreshold) {
            savingsPotential += cost;
          }
        }
      });
    });
    
    return {
      totalMonthly: totalMonthly.toFixed(2),
      totalAnnual: (totalMonthly * 12).toFixed(2),
      perUser: totalMonthly.toFixed(2), // In multi-user setup, divide by user count
      savingsPotential: savingsPotential.toFixed(2)
    };
  }

  generateSmartRecommendations() {
    const recommendations = [];
    
    // Analyze usage patterns for recommendations
    const unusedCount = this.getRecommendations().length;
    if (unusedCount > 5) {
      recommendations.push({
        action: 'Review unused licenses',
        reason: `${unusedCount} software items haven't been used in over ${this.settings.inactivityThreshold} days`,
        priority: 'high',
        potentialSaving: this.calculateDetailedSavings().totalMonthlySavings
      });
    }
    
    // Check for redundant software
    const redundantApps = this.findRedundantApplications();
    if (redundantApps.length > 0) {
      recommendations.push({
        action: 'Consolidate similar applications',
        reason: 'Multiple applications serve similar purposes',
        priority: 'medium',
        apps: redundantApps
      });
    }
    
    // Low utilization warning
    const summary = this.generateSummary();
    if (parseFloat(summary.utilizationRate) < 50) {
      recommendations.push({
        action: 'Improve software utilization',
        reason: `Only ${summary.utilizationRate}% of licensed software is actively used`,
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  findRedundantApplications() {
    const categories = {
      'video': ['Adobe After Effects', 'Adobe Premiere Pro', 'DaVinci Resolve'],
      'image': ['Adobe Photoshop', 'Adobe Illustrator'],
      '3d': ['Cinema 4D', '3ds Max', 'Autodesk Maya', 'Blender', 'Houdini']
    };
    
    const redundant = [];
    Object.entries(categories).forEach(([category, apps]) => {
      const activeApps = apps.filter(app => 
        this.usageData.applications[app] && 
        this.getDaysInactive(this.usageData.applications[app].lastUsed) <= 30
      );
      
      if (activeApps.length > 1) {
        redundant.push({
          category,
          apps: activeApps
        });
      }
    });
    
    return redundant;
  }

  calculateUtilizationTrend() {
    // Compare current vs previous period
    // Simplified - in production, compare actual time periods
    return Math.random() > 0.5 ? 5 : -3;
  }

  findPeakUsageHour() {
    // Analyze session times to find peak hour
    // Simplified implementation
    return '2:00 PM - 3:00 PM';
  }

  calculateAvgSessionLength() {
    let totalSessions = 0;
    let totalDuration = 0;
    
    Object.values(this.usageData.applications).forEach(app => {
      if (app.sessions) {
        totalSessions += app.sessions.length;
        totalDuration += app.sessions.reduce((sum, s) => sum + s.duration, 0);
      }
    });
    
    return totalSessions > 0 ? Math.round(totalDuration / totalSessions / 60) : 0;
  }

  calculateCostPerHour() {
    const costs = this.analyzeCosts();
    const summary = this.generateSummary();
    
    if (summary.totalUsageHours > 0) {
      return (parseFloat(costs.totalMonthly) / (summary.totalUsageHours * 4)).toFixed(2);
    }
    
    return 0;
  }

  calculateUsageTrend() {
    // Simplified trend calculation
    // In production, compare with historical data
    return 'stable';
  }

  async resetData() {
    this.usageData = this.initializeUsageData();
    await this.saveData();
    return { success: true, message: 'All usage data has been reset' };
  }

  getUsageData() {
    return this.usageData;
  }

  getSettings() {
    return this.settings;
  }

  async saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveData();
    return { success: true, message: 'Settings saved successfully' };
  }

  getRecommendations() {
    const recommendations = [];
    const threshold = this.settings.inactivityThreshold;
    
    // Check applications
    Object.entries(this.usageData.applications).forEach(([app, data]) => {
      const daysInactive = this.getDaysInactive(data.lastUsed);
      if (daysInactive > threshold) {
        recommendations.push({
          type: 'application',
          name: app,
          vendor: 'N/A',
          lastUsed: data.lastUsed,
          daysInactive,
          totalUsage: data.totalUsage,
          recommendation: 'Consider uninstalling',
          potentialSaving: 'Check license cost'
        });
      }
    });
    
    // Check plugins
    Object.entries(this.usageData.plugins).forEach(([vendor, vendorPlugins]) => {
      Object.entries(vendorPlugins).forEach(([product, productData]) => {
        if (productData.totalUsage !== undefined) {
          const daysInactive = this.getDaysInactive(productData.lastUsed);
          if (daysInactive > threshold) {
            recommendations.push({
              type: 'plugin',
              name: product,
              vendor,
              lastUsed: productData.lastUsed,
              daysInactive,
              totalUsage: productData.totalUsage,
              recommendation: 'Consider removing',
              potentialSaving: 'Check subscription'
            });
          }
        } else {
          Object.entries(productData).forEach(([subProduct, subData]) => {
            const daysInactive = this.getDaysInactive(subData.lastUsed);
            if (daysInactive > threshold) {
              recommendations.push({
                type: 'plugin',
                name: `${product} - ${subProduct}`,
                vendor,
                lastUsed: subData.lastUsed,
                daysInactive,
                totalUsage: subData.totalUsage,
                recommendation: 'Consider removing',
                potentialSaving: 'Check subscription'
              });
            }
          });
        }
      });
    });
    
    return recommendations.sort((a, b) => b.daysInactive - a.daysInactive);
  }

  async markForRemoval(item) {
    const recommendation = {
      ...item,
      markedAt: new Date().toISOString(),
      status: 'pending_removal'
    };
    
    this.recommendations.push(recommendation);
    await this.saveData();
    
    return { 
      success: true, 
      message: `${item.name} marked for removal`
    };
  }

  getDaysInactive(lastUsed) {
    if (!lastUsed) return Infinity;
    const diff = Date.now() - new Date(lastUsed).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

module.exports = DataManager;