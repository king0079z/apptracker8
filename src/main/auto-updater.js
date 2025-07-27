// src/main/auto-updater.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

class AutoUpdater {
  constructor() {
    // Configure logging
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
    
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      log.info('Update not available');
      
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates',
        message: 'You are running the latest version.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('error', (err) => {
      log.error('Update error:', err);
      
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'An error occurred while checking for updates. Please try again later.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      log.info(`Download progress: ${progress.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update has been downloaded. The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  }

  checkForUpdatesInBackground() {
    autoUpdater.checkForUpdates();
  }

  setFeedURL(url) {
    autoUpdater.setFeedURL(url);
  }
}

module.exports = AutoUpdater;