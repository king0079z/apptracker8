// tests/setup.js
// Jest test setup file

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      const paths = {
        userData: '/tmp/test-user-data',
        appData: '/tmp/test-app-data',
        downloads: '/tmp/test-downloads',
        temp: '/tmp'
      };
      return paths[name] || '/tmp';
    }),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'Enterprise Software Monitor'),
    quit: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve())
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn()
    },
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isVisible: jest.fn(() => true)
  })),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn()
  },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn()
  })),
  dialog: {
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
    showErrorBox: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  shell: {
    openExternal: jest.fn(),
    showItemInFolder: jest.fn()
  }
}));

// Mock fs promises
jest.mock('fs').promises = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
  copyFile: jest.fn(),
  rm: jest.fn()
};

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' })),
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  })),
  execSync: jest.fn(() => '')
}));

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn(function(path, callback) {
      this.serialize = jest.fn((cb) => cb());
      this.run = jest.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          params();
        } else if (callback) {
          callback();
        }
      });
      this.get = jest.fn((sql, params, callback) => {
        callback(null, {});
      });
      this.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });
      this.close = jest.fn((callback) => callback && callback());
      
      if (callback) callback();
    })
  })
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  transports: {
    file: { level: 'info' }
  }
}));

// Mock electron-updater
jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
    on: jest.fn(),
    logger: null,
    autoDownload: false,
    autoInstallOnAppQuit: true
  }
}));

// Mock sudo-prompt
jest.mock('sudo-prompt', () => ({
  exec: jest.fn((cmd, options, callback) => {
    callback(null, 'Success');
  })
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENTERPRISE_PORT = '3443';
process.env.ENTERPRISE_API_KEY = 'test-api-key';

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};