// client-installer/setup-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDefaultConfig: () => ipcRenderer.invoke('get-default-config'),
  validateConfig: (config) => ipcRenderer.invoke('validate-config', config),
  installClient: (config) => ipcRenderer.invoke('install-client', config),
  closeWizard: () => ipcRenderer.invoke('close-wizard'),
  
  onInstallProgress: (callback) => {
    ipcRenderer.on('install-progress', (event, progress) => callback(progress));
  }
});