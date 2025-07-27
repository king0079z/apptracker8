// src/renderer/preload.js - Preload Script for Renderer Process
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to use the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Data operations
  getUsageData: () => ipcRenderer.invoke('get-usage-data'),
  exportData: (format) => ipcRenderer.invoke('export-data', format),
  resetData: () => ipcRenderer.invoke('reset-data'),
  
  // Monitoring controls
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Recommendations
  getRecommendations: () => ipcRenderer.invoke('get-recommendations'),
  markForRemoval: (item) => ipcRenderer.invoke('mark-for-removal', item),
  
  // Cost management
  updateCost: (type, name, vendor, cost) => ipcRenderer.invoke('update-cost', type, name, vendor, cost),
  
  // Enterprise sync
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  
  // Process monitoring
  getAllProcesses: () => ipcRenderer.invoke('get-all-processes'),
  
  // System information
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Savings tracking
  confirmSavings: (item) => ipcRenderer.invoke('confirm-savings', item),
  getConfirmedSavings: () => ipcRenderer.invoke('get-confirmed-savings'),
  
  // Analytics
  generateAnalytics: () => ipcRenderer.invoke('generate-analytics'),
  
  // Event listeners
  onUsageUpdate: (callback) => {
    ipcRenderer.on('usage-update', (event, data) => callback(data));
  },
  
  onExportComplete: (callback) => {
    ipcRenderer.on('export-complete', (event, result) => callback(result));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});