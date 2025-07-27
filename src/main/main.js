// src/main/main.js - Fixed version with proper error handling
const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const DataManager = require('./data-manager');
const MonitoringService = require('./monitoring');
const EnterprisePullClient = require('./enterprise-pull-client');
const EnterpriseServer = require('./enterprise-server');

// Keep a global reference of the window object
let mainWindow;
let tray;
let dataManager;
let monitoringService;
let enterprisePullClient;
let enterpriseServer;
let isQuitting = false;

// Enable live reload for Electron in development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.log('electron-reload not found, skipping...');
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'renderer', 'preload.js')
    },
    icon: getIconPath(),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin'
  });

  // Load the index.html
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function getIconPath() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  return undefined; // Let Electron use default
}

function getTrayIconPath() {
  const iconName = process.platform === 'win32' ? 'tray-icon.png' : 'tray-icon@2x.png';
  const iconPath = path.join(__dirname, '..', '..', 'assets', iconName);
  
  // Return path if exists, otherwise return null
  return fs.existsSync(iconPath) ? iconPath : null;
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Data',
          submenu: [
            {
              label: 'As CSV',
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.send('menu-export', 'csv');
                }
              }
            },
            {
              label: 'As JSON',
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.send('menu-export', 'json');
                }
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Enterprise Mode',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            toggleEnterpriseMode(menuItem.checked);
          }
        },
        {
          label: 'Network Scanner',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-open-view', 'enterprise');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-open-settings');
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => require('electron').shell.openExternal('https://docs.example.com')
        },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates()
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => showAboutDialog()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  try {
    const trayIconPath = getTrayIconPath();
    
    if (!trayIconPath) {
      console.warn('Tray icon not found, creating default icon');
      // Create a default icon programmatically
      const icon = nativeImage.createEmpty();
      const size = { width: 16, height: 16 };
      
      // Create a simple colored square as icon
      icon.addRepresentation({
        width: size.width,
        height: size.height,
        buffer: Buffer.alloc(size.width * size.height * 4, 255)
      });
      
      tray = new Tray(icon);
    } else {
      tray = new Tray(trayIconPath);
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          }
        }
      },
      {
        label: 'Monitoring',
        submenu: [
          {
            label: 'Start',
            click: () => startMonitoring()
          },
          {
            label: 'Stop',
            click: () => stopMonitoring()
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Enterprise Software Monitor');
    tray.setContextMenu(contextMenu);

    // Click to show/hide window
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
    // Continue without tray
  }
}

// Initialize services
async function initializeServices() {
  try {
    // Initialize data manager
    dataManager = new DataManager();
    await dataManager.loadData();

    // Initialize monitoring service
    monitoringService = new MonitoringService();
    
    // Set up monitoring event handlers
    monitoringService.on('usage-update', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usage-update', data);
      }
      // Update usage data
      dataManager.updateUsageData(data);
    });

    // Initialize enterprise pull client
    enterprisePullClient = new EnterprisePullClient(dataManager);
    await enterprisePullClient.init();

    // Initialize enterprise server only if pull client is available
    if (enterprisePullClient) {
      enterpriseServer = new EnterpriseServer(enterprisePullClient, dataManager);
      await enterpriseServer.start();
    }

    // Auto-start monitoring if configured
    if (dataManager.settings.autoStart) {
      await startMonitoring();
    }

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    // Continue with limited functionality
  }
}

// Monitoring control functions
async function startMonitoring() {
  try {
    if (!monitoringService) {
      throw new Error('Monitoring service not initialized');
    }
    
    const interval = dataManager?.settings?.monitoringInterval || 60000;
    const started = monitoringService.start(interval);
    
    if (started) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('monitoring-started');
      }
      return { success: true };
    } else {
      return { success: false, error: 'Monitoring already running' };
    }
  } catch (error) {
    console.error('Failed to start monitoring:', error);
    return { success: false, error: error.message };
  }
}

async function stopMonitoring() {
  try {
    if (!monitoringService) {
      throw new Error('Monitoring service not initialized');
    }
    
    monitoringService.stop();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('monitoring-stopped');
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to stop monitoring:', error);
    return { success: false, error: error.message };
  }
}

// IPC Handlers - Setup before window creation
function setupIpcHandlers() {
  // Data operations
  ipcMain.handle('get-usage-data', async () => {
    if (!dataManager) {
      return {
        applications: {},
        plugins: {},
        metadata: { firstRun: new Date().toISOString() }
      };
    }
    return dataManager.getUsageData();
  });

  ipcMain.handle('export-data', async (event, format) => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    const result = await dataManager.exportData(format);
    if (result.success && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('export-complete', result);
    }
    return result;
  });

  ipcMain.handle('reset-data', async () => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    return await dataManager.resetData();
  });

  // Monitoring controls
  ipcMain.handle('start-monitoring', async () => {
    return await startMonitoring();
  });

  ipcMain.handle('stop-monitoring', async () => {
    return await stopMonitoring();
  });

  ipcMain.handle('get-monitoring-status', async () => {
    return monitoringService ? monitoringService.isMonitoring : false;
  });

  // Settings
  ipcMain.handle('get-settings', async () => {
    if (!dataManager) {
      return {
        monitoringInterval: 60000,
        inactivityThreshold: 30,
        autoStart: true,
        minimizeToTray: true,
        notifications: { enabled: true }
      };
    }
    return dataManager.getSettings();
  });

  ipcMain.handle('save-settings', async (event, settings) => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    return await dataManager.saveSettings(settings);
  });

  // Recommendations
  ipcMain.handle('get-recommendations', async () => {
    if (!dataManager) return [];
    return dataManager.getRecommendations();
  });

  ipcMain.handle('mark-for-removal', async (event, item) => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    return await dataManager.markForRemoval(item);
  });

  // Cost management
  ipcMain.handle('update-cost', async (event, type, name, vendor, cost) => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    return await dataManager.updateCost(type, name, vendor, cost);
  });

  // Enterprise sync
  ipcMain.handle('get-sync-status', async () => {
    if (!enterprisePullClient) {
      return {
        isEnabled: false,
        lastSync: null,
        clientsFound: 0
      };
    }
    return {
      isEnabled: enterprisePullClient.isRunning,
      lastSync: new Date(),
      clientsFound: enterprisePullClient.scanner.getDiscoveredClients().length
    };
  });

  ipcMain.handle('sync-now', async () => {
    if (!enterprisePullClient) {
      return { success: false, error: 'Enterprise client not initialized' };
    }
    await enterprisePullClient.scanner.performNetworkScan();
    return { success: true };
  });

  // Process monitoring
  ipcMain.handle('get-all-processes', async () => {
    if (!monitoringService) return [];
    return monitoringService.getAllProcesses();
  });

  // System information
  ipcMain.handle('get-system-info', async () => {
    if (!monitoringService) {
      return {
        hostname: require('os').hostname(),
        platform: process.platform,
        arch: process.arch,
        cpus: { cores: require('os').cpus().length },
        memory: { total: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)) }
      };
    }
    return await monitoringService.getSystemInfo();
  });

  // Savings tracking
  ipcMain.handle('confirm-savings', async (event, item) => {
    if (!dataManager) {
      return { success: false, error: 'Data manager not initialized' };
    }
    return await dataManager.trackSavingsConfirmation(item);
  });

  ipcMain.handle('get-confirmed-savings', async () => {
    if (!dataManager) return [];
    return await dataManager.getConfirmedSavings();
  });

  // Analytics
  ipcMain.handle('generate-analytics', async () => {
    if (!dataManager) {
      return {
        summary: {},
        patterns: {},
        costs: {},
        recommendations: []
      };
    }
    return await dataManager.generateAnalytics();
  });
}

// Enterprise mode toggle
function toggleEnterpriseMode(enabled) {
  if (enabled) {
    if (enterprisePullClient) enterprisePullClient.start();
    if (enterpriseServer) enterpriseServer.start();
  } else {
    if (enterprisePullClient) enterprisePullClient.stop();
    if (enterpriseServer) enterpriseServer.stop();
  }
}

// Auto-updater
function checkForUpdates() {
  try {
    const AutoUpdater = require('./auto-updater');
    const autoUpdater = new AutoUpdater();
    autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Auto-updater error:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates.',
      buttons: ['OK']
    });
  }
}

// About dialog
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Enterprise Software Monitor',
    message: 'Enterprise Software Monitor',
    detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\n\nMonitor and optimize software usage across your enterprise.`,
    buttons: ['OK']
  });
}

// App event handlers
app.whenReady().then(async () => {
  // Setup IPC handlers first
  setupIpcHandlers();
  
  // Create window
  createWindow();
  
  // Create tray (optional - don't fail if it doesn't work)
  createTray();
  
  // Initialize services
  await initializeServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  
  // Cleanup services
  if (monitoringService) {
    monitoringService.stop();
  }
  if (enterprisePullClient) {
    enterprisePullClient.stop();
  }
  if (enterpriseServer) {
    enterpriseServer.stop();
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In production, you should verify the certificate
  event.preventDefault();
  callback(true);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Export for testing
module.exports = {
  createWindow,
  dataManager,
  monitoringService
};