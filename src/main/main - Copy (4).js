// src/main/main.js - Main Electron Process (Fixed for Trends)
const { app, BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const MonitoringService = require('./monitoring');
const DataManager = require('./data-manager');
const EnterpriseClient = require('./enterprise-client');

// ========= ENVIRONMENT LOADER =========
// Load environment variables from .env file if it exists
const loadEnvFile = () => {
    try {
        const envPath = path.join(__dirname, '../../.env');
        if (require('fs').existsSync(envPath)) {
            const envContent = require('fs').readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                // Skip comments and empty lines
                if (line.trim() && !line.trim().startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    const value = valueParts.join('=').trim();
                    if (key && value) {
                        process.env[key.trim()] = value;
                    }
                }
            });
            console.log('Loaded environment configuration from .env file');
        } else {
            console.log('No .env file found - enterprise features disabled');
        }
    } catch (error) {
        console.log('No .env file found or error loading it:', error.message);
    }
};

// Call this before initializing the app
loadEnvFile();
// ========= END OF ENVIRONMENT LOADER =========

class SoftwareMonitor {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.monitoringService = new MonitoringService();
    this.dataManager = new DataManager();
    this.enterpriseClient = null;
    this.isMonitoring = false;
  }

  async init() {
    // Load saved data
    await this.dataManager.loadData();
    
    // Initialize enterprise client if configured
    if (this.dataManager.usageData?.metadata?.isEnterprise) {
      this.enterpriseClient = new EnterpriseClient(this.dataManager);
      await this.enterpriseClient.init();
    }
    
    // Set up IPC handlers
    this.setupIpcHandlers();
    
    // Create application window
    this.createWindow();
    
    // Create system tray
    this.createTray();
    
    // Set up monitoring service callbacks
    this.monitoringService.on('usage-update', (data) => {
      console.log('Monitoring update received:', {
        applications: data.applications.size,
        plugins: data.plugins.size,
        processes: data.allProcesses?.length || 0
      });
      
      // Update data manager with monitoring data
      this.dataManager.updateUsageData(data);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Get the full usage data including sessions for trends
        const fullUsageData = this.dataManager.getUsageData();
        
        // Prepare update data with full application and plugin data including sessions
        const updateData = {
          // Send the full applications and plugins data with sessions
          applications: fullUsageData.applications,
          plugins: fullUsageData.plugins,
          // Include monitoring-specific data
          allProcesses: data.allProcesses,
          timestamp: data.timestamp,
          systemInfo: data.systemInfo,
          currentUser: data.currentUser,
          // Include metadata for enterprise features
          metadata: fullUsageData.metadata
        };
        
        console.log('Sending usage update to renderer with full data');
        this.mainWindow.webContents.send('usage-update', updateData);
      }
    });
    
    // Auto-start monitoring if configured
    const settings = this.dataManager.getSettings();
    if (settings.autoStart) {
      this.startMonitoring();
    }
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer/preload.js')
      },
      icon: path.join(__dirname, '../../assets/icon.png'),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#0a0a0a',
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Prevent window from closing to tray
    this.mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  createTray() {
    const trayIcon = path.join(__dirname, '../../assets/tray-icon.png');
    
    // Check if tray icon exists, if not, create a default one
    if (!require('fs').existsSync(trayIcon)) {
      console.warn('Tray icon not found, skipping tray creation. Please add tray-icon.png to assets folder.');
      return;
    }
    
    try {
      this.tray = new Tray(trayIcon);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Monitor',
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
              this.mainWindow.focus();
            }
          }
        },
        {
          label: 'Monitoring Status',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Start Monitoring',
          click: () => this.startMonitoring(),
          enabled: !this.isMonitoring
        },
        {
          label: 'Stop Monitoring',
          click: () => this.stopMonitoring(),
          enabled: this.isMonitoring
        },
        { type: 'separator' },
        {
          label: 'Export Data',
          submenu: [
            {
              label: 'Export as CSV',
              click: () => this.exportData('csv')
            },
            {
              label: 'Export as JSON',
              click: () => this.exportData('json')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      
      this.tray.setToolTip('Software Usage Monitor');
      this.tray.setContextMenu(contextMenu);
      
      // Double-click to show window
      this.tray.on('double-click', () => {
        if (this.mainWindow) {
          this.mainWindow.show();
        }
      });
    } catch (error) {
      console.error('Error creating tray:', error);
    }
  }

  setupIpcHandlers() {
    // Data operations - Fixed to return full usage data with sessions
    ipcMain.handle('get-usage-data', async () => {
      const data = this.dataManager.getUsageData();
      console.log('Sending full usage data to renderer including sessions');
      return data;
    });

    ipcMain.handle('start-monitoring', async () => {
      console.log('Start monitoring requested');
      return this.startMonitoring();
    });

    ipcMain.handle('stop-monitoring', async () => {
      console.log('Stop monitoring requested');
      return this.stopMonitoring();
    });

    ipcMain.handle('get-monitoring-status', async () => {
      return this.isMonitoring;
    });

    ipcMain.handle('export-data', async (event, format) => {
      return this.exportData(format);
    });

    ipcMain.handle('reset-data', async () => {
      return this.dataManager.resetData();
    });

    ipcMain.handle('get-settings', async () => {
      return this.dataManager.getSettings();
    });

    ipcMain.handle('save-settings', async (event, settings) => {
      return this.dataManager.saveSettings(settings);
    });

    ipcMain.handle('get-recommendations', async () => {
      return this.dataManager.getRecommendations();
    });

    ipcMain.handle('get-system-info', async () => {
      return this.monitoringService.getSystemInfo();
    });

    ipcMain.handle('confirm-savings', async (event, item) => {
      return this.dataManager.trackSavingsConfirmation(item);
    });

    ipcMain.handle('get-confirmed-savings', async () => {
      return this.dataManager.getConfirmedSavings();
    });

    ipcMain.handle('generate-analytics', async () => {
      return this.dataManager.generateAnalytics();
    });

    ipcMain.handle('get-all-processes', async () => {
      return this.monitoringService.getAllProcesses();
    });

    // Cost management
    ipcMain.handle('update-cost', async (event, type, name, vendor, cost) => {
      return this.dataManager.updateCost(type, name, vendor, cost);
    });

    // Enterprise sync handlers (if enterprise is enabled)
    ipcMain.handle('get-sync-status', async () => {
      if (this.enterpriseClient) {
        return this.enterpriseClient.getSyncStatus();
      }
      return { isOnline: false, queuedItems: 0, message: 'Enterprise sync not configured' };
    });

    ipcMain.handle('sync-now', async () => {
      if (this.enterpriseClient) {
        await this.enterpriseClient.syncData();
        return { success: true };
      }
      return { success: false, message: 'Enterprise sync not configured' };
    });
  }

  startMonitoring() {
    if (!this.isMonitoring) {
      console.log('Starting monitoring from main process');
      const started = this.monitoringService.start();
      if (started) {
        this.isMonitoring = true;
        this.updateTrayMenu();
        console.log('Monitoring started successfully');
        
        // Send initial full data update after a short delay
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const fullUsageData = this.dataManager.getUsageData();
            const updateData = {
              applications: fullUsageData.applications,
              plugins: fullUsageData.plugins,
              allProcesses: this.monitoringService.getAllProcesses(),
              timestamp: new Date(),
              systemInfo: null,
              currentUser: require('os').userInfo().username,
              metadata: fullUsageData.metadata
            };
            
            console.log('Sending initial full data update to renderer');
            this.mainWindow.webContents.send('usage-update', updateData);
          }
        }, 1000);
        
        return { success: true, message: 'Monitoring started' };
      }
      return { success: false, message: 'Failed to start monitoring' };
    }
    return { success: false, message: 'Already monitoring' };
  }

  stopMonitoring() {
    if (this.isMonitoring) {
      this.monitoringService.stop();
      this.isMonitoring = false;
      this.updateTrayMenu();
      return { success: true, message: 'Monitoring stopped' };
    }
    return { success: false, message: 'Not currently monitoring' };
  }

  updateTrayMenu() {
    if (!this.tray) {
      console.warn('Tray not initialized');
      return;
    }
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Monitor',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }
      },
      {
        label: `Monitoring: ${this.isMonitoring ? 'Active' : 'Stopped'}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Start Monitoring',
        click: () => this.startMonitoring(),
        enabled: !this.isMonitoring
      },
      {
        label: 'Stop Monitoring',
        click: () => this.stopMonitoring(),
        enabled: this.isMonitoring
      },
      { type: 'separator' },
      {
        label: 'Export Data',
        submenu: [
          {
            label: 'Export as CSV',
            click: () => this.exportData('csv')
          },
          {
            label: 'Export as JSON',
            click: () => this.exportData('json')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
  }

  async exportData(format) {
    const result = await this.dataManager.exportData(format);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('export-complete', result);
    }
    return result;
  }
}

// Initialize app
const monitor = new SoftwareMonitor();

app.whenReady().then(() => {
  monitor.init();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app running in tray on Windows/Linux
  }
});

app.on('activate', () => {
  if (monitor.mainWindow === null) {
    monitor.createWindow();
  }
});

app.on('before-quit', async () => {
  await monitor.dataManager.saveData();
});