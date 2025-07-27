// client-installer/setup-wizard.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const sudo = require('sudo-prompt');

class ClientSetupWizard {
  constructor() {
    this.window = null;
    this.config = {
      department: '',
      clientId: require('os').hostname(),
      serverUrl: '',
      autoStart: true,
      monitoringInterval: 60000,
      allowNetworkAccess: true
    };
  }

  async show() {
    this.window = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js')
      },
      icon: path.join(__dirname, 'assets', 'installer-icon.png')
    });

    this.window.loadFile(path.join(__dirname, 'setup-wizard.html'));
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    ipcMain.handle('get-default-config', () => {
      return this.config;
    });

    ipcMain.handle('validate-config', async (event, config) => {
      // Validate configuration
      const errors = [];
      
      if (!config.department || config.department.trim() === '') {
        errors.push('Department is required');
      }
      
      if (config.serverUrl && !this.isValidUrl(config.serverUrl)) {
        errors.push('Invalid server URL format');
      }
      
      return { valid: errors.length === 0, errors };
    });

    ipcMain.handle('install-client', async (event, config) => {
      try {
        this.config = config;
        
        // Update progress
        this.window.webContents.send('install-progress', {
          stage: 'preparing',
          progress: 10,
          message: 'Preparing installation...'
        });

        // Create installation directory
        const installPath = this.getInstallPath();
        await fs.mkdir(installPath, { recursive: true });

        // Copy client files
        await this.copyClientFiles(installPath);
        
        this.window.webContents.send('install-progress', {
          stage: 'files',
          progress: 40,
          message: 'Installing client files...'
        });

        // Save configuration
        await this.saveConfiguration(installPath);
        
        this.window.webContents.send('install-progress', {
          stage: 'config',
          progress: 60,
          message: 'Configuring client...'
        });

        // Register as service
        if (config.autoStart) {
          await this.registerAsService();
        }
        
        this.window.webContents.send('install-progress', {
          stage: 'service',
          progress: 80,
          message: 'Setting up auto-start...'
        });

        // Create firewall rule for incoming connections
        await this.createFirewallRule();
        
        this.window.webContents.send('install-progress', {
          stage: 'complete',
          progress: 100,
          message: 'Installation complete!'
        });

        return { success: true };
      } catch (error) {
        console.error('Installation error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('close-wizard', () => {
      if (this.window) {
        this.window.close();
      }
    });
  }

  getInstallPath() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      return 'C:\\Program Files\\EnterpriseMonitorClient';
    } else if (platform === 'darwin') {
      return '/Applications/EnterpriseMonitorClient.app';
    } else {
      return '/opt/enterprise-monitor-client';
    }
  }

  async copyClientFiles(installPath) {
    const sourceDir = path.join(__dirname, '..', 'client-build');
    
    // Copy all client files
    await this.copyDirectory(sourceDir, installPath);
  }

  async copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  async saveConfiguration(installPath) {
    const configPath = path.join(installPath, 'config', 'client-config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  async registerAsService() {
    const platform = process.platform;
    const installPath = this.getInstallPath();
    
    if (platform === 'win32') {
      // Windows Service
      const serviceName = 'EnterpriseMonitorClient';
      const displayName = 'Enterprise Monitor Client';
      const exePath = path.join(installPath, 'enterprise-client.exe');
      
      return new Promise((resolve, reject) => {
        const command = `sc create "${serviceName}" binPath= "${exePath}" DisplayName= "${displayName}" start= auto`;
        
        sudo.exec(command, { name: 'Enterprise Monitor Client Setup' }, (error) => {
          if (error) {
            console.error('Service registration error:', error);
            // Try alternative method
            this.createWindowsTask(exePath)
              .then(resolve)
              .catch(reject);
          } else {
            resolve();
          }
        });
      });
      
    } else if (platform === 'darwin') {
      // macOS LaunchAgent
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.enterprise.monitor.client</string>
    <key>ProgramArguments</key>
    <array>
        <string>${installPath}/Contents/MacOS/enterprise-client</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/var/log/enterprise-monitor-client.err</string>
    <key>StandardOutPath</key>
    <string>/var/log/enterprise-monitor-client.log</string>
</dict>
</plist>`;
      
      const plistPath = '/Library/LaunchAgents/com.enterprise.monitor.client.plist';
      
      return new Promise((resolve, reject) => {
        sudo.exec(
          `echo '${plistContent}' > ${plistPath} && launchctl load ${plistPath}`,
          { name: 'Enterprise Monitor Client Setup' },
          (error) => {
            if (error) reject(error);
            else resolve();
          }
        );
      });
      
    } else {
      // Linux systemd service
      const serviceContent = `[Unit]
Description=Enterprise Monitor Client
After=network.target

[Service]
Type=simple
ExecStart=${installPath}/enterprise-client
Restart=always
User=root

[Install]
WantedBy=multi-user.target`;
      
      const servicePath = '/etc/systemd/system/enterprise-monitor-client.service';
      
      return new Promise((resolve, reject) => {
        sudo.exec(
          `echo '${serviceContent}' > ${servicePath} && systemctl enable enterprise-monitor-client && systemctl start enterprise-monitor-client`,
          { name: 'Enterprise Monitor Client Setup' },
          (error) => {
            if (error) reject(error);
            else resolve();
          }
        );
      });
    }
  }

  async createWindowsTask(exePath) {
    const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Enterprise Monitor Client - Monitors software usage</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${exePath}</Command>
    </Exec>
  </Actions>
</Task>`;

    const tempFile = path.join(require('os').tmpdir(), 'monitor-task.xml');
    await fs.writeFile(tempFile, taskXml);

    return new Promise((resolve, reject) => {
      const command = `schtasks /create /tn "Enterprise Monitor Client" /xml "${tempFile}" /f`;
      
      sudo.exec(command, { name: 'Enterprise Monitor Client Setup' }, (error) => {
        fs.unlink(tempFile).catch(() => {}); // Clean up temp file
        
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async createFirewallRule() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows Firewall
      const command = `netsh advfirewall firewall add rule name="Enterprise Monitor Client" dir=in action=allow protocol=TCP localport=9876`;
      
      return new Promise((resolve) => {
        sudo.exec(command, { name: 'Enterprise Monitor Client Setup' }, (error) => {
          // Don't fail installation if firewall rule fails
          if (error) console.error('Firewall rule error:', error);
          resolve();
        });
      });
    }
    // For macOS and Linux, firewall configuration is more complex and often requires manual setup
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Run setup wizard
const wizard = new ClientSetupWizard();

app.whenReady().then(() => {
  wizard.show();
});

app.on('window-all-closed', () => {
  app.quit();
});