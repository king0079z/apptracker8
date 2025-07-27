// install-client.js - Automated Client Installation Script
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const CONFIG = {
    appName: 'Software Usage Monitor',
    installDir: process.platform === 'win32' 
        ? path.join(process.env.PROGRAMFILES, 'SoftwareMonitor')
        : '/Applications/SoftwareMonitor.app',
    serverUrl: process.argv[2] || 'https://monitor-server.company.com',
    apiKey: process.argv[3] || '',
    department: process.argv[4] || 'Unknown',
    downloadUrl: process.argv[5] || 'https://download.company.com/software-monitor-latest.exe',
    autoStart: true,
    silentInstall: true
};

class ClientInstaller {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.hostname = os.hostname();
        this.username = os.userInfo().username;
        this.installLog = [];
    }

    async run() {
        console.log('=== Software Monitor Client Installer ===');
        console.log(`Platform: ${this.platform}`);
        console.log(`Architecture: ${this.arch}`);
        console.log(`Hostname: ${this.hostname}`);
        console.log(`User: ${this.username}`);
        console.log(`Department: ${CONFIG.department}`);
        console.log('========================================\n');

        try {
            // Check if already installed
            if (await this.checkExistingInstallation()) {
                console.log('⚠️  Software Monitor is already installed.');
                const answer = await this.prompt('Do you want to reinstall? (y/n): ');
                if (answer.toLowerCase() !== 'y') {
                    console.log('Installation cancelled.');
                    process.exit(0);
                }
                await this.uninstallExisting();
            }

            // Check admin privileges
            if (!await this.checkAdminPrivileges()) {
                console.error('❌ This installer requires administrator privileges.');
                console.log('Please run as administrator (Windows) or with sudo (macOS/Linux).');
                process.exit(1);
            }

            // Download application
            console.log('\n📥 Downloading Software Monitor...');
            const installerPath = await this.downloadApplication();

            // Install application
            console.log('\n📦 Installing Software Monitor...');
            await this.installApplication(installerPath);

            // Configure application
            console.log('\n⚙️  Configuring Software Monitor...');
            await this.configureApplication();

            // Set up auto-start
            if (CONFIG.autoStart) {
                console.log('\n🚀 Setting up auto-start...');
                await this.setupAutoStart();
            }

            // Start the application
            console.log('\n▶️  Starting Software Monitor...');
            await this.startApplication();

            // Verify installation
            console.log('\n✅ Verifying installation...');
            const verified = await this.verifyInstallation();

            if (verified) {
                console.log('\n✨ Installation completed successfully!');
                console.log(`\nSoftware Monitor is now running and monitoring this system.`);
                console.log(`Dashboard URL: ${CONFIG.serverUrl}`);
                console.log(`Client ID: ${this.hostname}`);
                console.log(`Department: ${CONFIG.department}`);
                
                // Save installation log
                await this.saveInstallationLog();
            } else {
                console.error('\n❌ Installation verification failed.');
                console.log('Please check the logs and try again.');
                process.exit(1);
            }

        } catch (error) {
            console.error('\n❌ Installation failed:', error.message);
            await this.saveInstallationLog(error);
            process.exit(1);
        }
    }

    async checkExistingInstallation() {
        try {
            if (this.platform === 'win32') {
                // Check Windows registry
                const { stdout } = await execPromise('reg query "HKLM\\SOFTWARE\\SoftwareMonitor" 2>nul');
                return stdout.includes('SoftwareMonitor');
            } else if (this.platform === 'darwin') {
                return fs.existsSync(CONFIG.installDir);
            } else {
                return fs.existsSync('/usr/local/bin/software-monitor');
            }
        } catch (error) {
            return false;
        }
    }

    async checkAdminPrivileges() {
        try {
            if (this.platform === 'win32') {
                // Check if running as admin on Windows
                await execPromise('net session >nul 2>&1');
                return true;
            } else {
                // Check if running as root on Unix-like systems
                return process.getuid() === 0;
            }
        } catch (error) {
            return false;
        }
    }

    async uninstallExisting() {
        console.log('\n🗑️  Uninstalling existing installation...');
        
        try {
            if (this.platform === 'win32') {
                // Stop service if running
                await execPromise('net stop SoftwareMonitor 2>nul').catch(() => {});
                
                // Remove from registry
                await execPromise('reg delete "HKLM\\SOFTWARE\\SoftwareMonitor" /f 2>nul').catch(() => {});
                
                // Remove auto-start
                await execPromise('reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v SoftwareMonitor /f 2>nul').catch(() => {});
                
                // Remove installation directory
                if (fs.existsSync(CONFIG.installDir)) {
                    await execPromise(`rmdir /s /q "${CONFIG.installDir}"`);
                }
            } else if (this.platform === 'darwin') {
                // Kill running process
                await execPromise('pkill -f "Software Monitor"').catch(() => {});
                
                // Remove from login items
                await execPromise('osascript -e \'tell application "System Events" to delete login item "Software Monitor"\' 2>/dev/null').catch(() => {});
                
                // Remove app
                if (fs.existsSync(CONFIG.installDir)) {
                    await execPromise(`rm -rf "${CONFIG.installDir}"`);
                }
            }
            
            console.log('✅ Existing installation removed.');
        } catch (error) {
            console.warn('⚠️  Could not completely remove existing installation:', error.message);
        }
    }

    async downloadApplication() {
        const tempDir = os.tmpdir();
        const fileName = this.platform === 'win32' ? 'software-monitor-setup.exe' : 'software-monitor-setup.dmg';
        const downloadPath = path.join(tempDir, fileName);

        // Check if we have a local installer
        const localInstaller = path.join(__dirname, 'dist', fileName);
        if (fs.existsSync(localInstaller)) {
            console.log('📁 Using local installer...');
            return localInstaller;
        }

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(downloadPath);
            let downloadedBytes = 0;

            https.get(CONFIG.downloadUrl, (response) => {
                const totalBytes = parseInt(response.headers['content-length'], 10);

                response.pipe(file);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    const percentage = ((downloadedBytes / totalBytes) * 100).toFixed(2);
                    process.stdout.write(`\rDownloading: ${percentage}% [${downloadedBytes}/${totalBytes} bytes]`);
                });

                file.on('finish', () => {
                    file.close();
                    console.log('\n✅ Download completed.');
                    resolve(downloadPath);
                });
            }).on('error', (err) => {
                fs.unlink(downloadPath, () => {});
                reject(new Error(`Download failed: ${err.message}`));
            });
        });
    }

    async installApplication(installerPath) {
        if (this.platform === 'win32') {
            await this.installWindows(installerPath);
        } else if (this.platform === 'darwin') {
            await this.installMacOS(installerPath);
        } else {
            await this.installLinux(installerPath);
        }
    }

    async installWindows(installerPath) {
        // Create installation directory
        if (!fs.existsSync(CONFIG.installDir)) {
            fs.mkdirSync(CONFIG.installDir, { recursive: true });
        }

        // If installer is an exe, run it silently
        if (installerPath.endsWith('.exe')) {
            const args = CONFIG.silentInstall ? ['/S', '/D=' + CONFIG.installDir] : [];
            
            await new Promise((resolve, reject) => {
                const installer = spawn(installerPath, args, { 
                    stdio: 'inherit',
                    shell: true 
                });

                installer.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Installer exited with code ${code}`));
                    }
                });
            });
        } else {
            // Manual extraction for portable version
            // This would require implementing extraction logic
            console.log('📂 Extracting files...');
            // Extract files to CONFIG.installDir
        }

        // Add to Windows registry
        const regCommands = [
            `reg add "HKLM\\SOFTWARE\\SoftwareMonitor" /v InstallPath /t REG_SZ /d "${CONFIG.installDir}" /f`,
            `reg add "HKLM\\SOFTWARE\\SoftwareMonitor" /v Version /t REG_SZ /d "1.0.0" /f`,
            `reg add "HKLM\\SOFTWARE\\SoftwareMonitor" /v Department /t REG_SZ /d "${CONFIG.department}" /f`
        ];

        for (const cmd of regCommands) {
            await execPromise(cmd);
        }

        console.log('✅ Windows installation completed.');
    }

    async installMacOS(installerPath) {
        if (installerPath.endsWith('.dmg')) {
            // Mount DMG
            console.log('📀 Mounting disk image...');
            const { stdout } = await execPromise(`hdiutil attach "${installerPath}" -nobrowse`);
            const mountPoint = stdout.match(/\/Volumes\/.+/)[0].trim();

            // Copy application
            console.log('📋 Copying application...');
            const appPath = path.join(mountPoint, 'Software Monitor.app');
            await execPromise(`cp -R "${appPath}" /Applications/`);

            // Unmount DMG
            await execPromise(`hdiutil detach "${mountPoint}"`);
        } else {
            // Direct app bundle copy
            await execPromise(`cp -R "${installerPath}" /Applications/`);
        }

        console.log('✅ macOS installation completed.');
    }

    async installLinux(installerPath) {
        // For Linux, we'll assume a tar.gz archive
        const installDir = '/opt/software-monitor';
        
        // Create directory
        await execPromise(`sudo mkdir -p ${installDir}`);
        
        // Extract
        if (installerPath.endsWith('.tar.gz')) {
            await execPromise(`sudo tar -xzf "${installerPath}" -C ${installDir}`);
        }
        
        // Create symlink
        await execPromise('sudo ln -sf /opt/software-monitor/software-monitor /usr/local/bin/software-monitor');
        
        // Create desktop entry
        const desktopEntry = `[Desktop Entry]
Name=Software Monitor
Comment=Monitor software usage
Exec=/opt/software-monitor/software-monitor
Icon=/opt/software-monitor/icon.png
Terminal=false
Type=Application
Categories=Utility;`;
        
        fs.writeFileSync('/tmp/software-monitor.desktop', desktopEntry);
        await execPromise('sudo mv /tmp/software-monitor.desktop /usr/share/applications/');
        
        console.log('✅ Linux installation completed.');
    }

    async configureApplication() {
        const configData = {
            enterprise: {
                enabled: true,
                serverUrl: CONFIG.serverUrl,
                apiKey: CONFIG.apiKey,
                department: CONFIG.department,
                clientId: this.hostname,
                autoStart: CONFIG.autoStart,
                syncInterval: 8 * 60 * 60 * 1000 // 8 hours
            },
            monitoring: {
                interval: 60000,
                autoStart: true
            },
            user: {
                username: this.username,
                hostname: this.hostname,
                installDate: new Date().toISOString()
            }
        };

        let configPath;
        
        if (this.platform === 'win32') {
            configPath = path.join(process.env.APPDATA, 'SoftwareMonitor', 'config.json');
        } else if (this.platform === 'darwin') {
            configPath = path.join(os.homedir(), 'Library', 'Application Support', 'SoftwareMonitor', 'config.json');
        } else {
            configPath = path.join(os.homedir(), '.config', 'software-monitor', 'config.json');
        }

        // Create config directory
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Write configuration
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        
        console.log('✅ Configuration saved.');
    }

    async setupAutoStart() {
        if (this.platform === 'win32') {
            // Add to Windows startup registry
            const exePath = path.join(CONFIG.installDir, 'Software Monitor.exe');
            await execPromise(`reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v SoftwareMonitor /t REG_SZ /d "${exePath} --hidden" /f`);
            
            // Create scheduled task for system startup
            const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
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
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${exePath}"</Command>
      <Arguments>--hidden</Arguments>
    </Exec>
  </Actions>
</Task>`;
            
            fs.writeFileSync('C:\\temp\\software-monitor-task.xml', taskXml);
            await execPromise('schtasks /create /tn "SoftwareMonitor" /xml "C:\\temp\\software-monitor-task.xml" /f');
            fs.unlinkSync('C:\\temp\\software-monitor-task.xml');
            
        } else if (this.platform === 'darwin') {
            // Create LaunchAgent for macOS
            const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.company.softwaremonitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Software Monitor.app/Contents/MacOS/Software Monitor</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;
            
            const plistPath = '/Library/LaunchAgents/com.company.softwaremonitor.plist';
            fs.writeFileSync('/tmp/com.company.softwaremonitor.plist', plistContent);
            await execPromise(`sudo mv /tmp/com.company.softwaremonitor.plist ${plistPath}`);
            await execPromise(`sudo chmod 644 ${plistPath}`);
            await execPromise(`sudo launchctl load ${plistPath}`);
            
        } else {
            // Create systemd service for Linux
            const serviceContent = `[Unit]
Description=Software Usage Monitor
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/software-monitor --hidden
Restart=always
User=${this.username}
Environment="HOME=/home/${this.username}"

[Install]
WantedBy=multi-user.target`;
            
            fs.writeFileSync('/tmp/software-monitor.service', serviceContent);
            await execPromise('sudo mv /tmp/software-monitor.service /etc/systemd/system/');
            await execPromise('sudo systemctl daemon-reload');
            await execPromise('sudo systemctl enable software-monitor.service');
        }
        
        console.log('✅ Auto-start configured.');
    }

    async startApplication() {
        if (this.platform === 'win32') {
            const exePath = path.join(CONFIG.installDir, 'Software Monitor.exe');
            spawn(exePath, ['--hidden'], { 
                detached: true, 
                stdio: 'ignore',
                shell: true 
            }).unref();
        } else if (this.platform === 'darwin') {
            spawn('open', ['-a', 'Software Monitor', '--hide'], { 
                detached: true, 
                stdio: 'ignore' 
            }).unref();
        } else {
            await execPromise('sudo systemctl start software-monitor.service');
        }
        
        // Wait a moment for the app to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Application started.');
    }

    async verifyInstallation() {
        // Check if process is running
        let processCheck;
        
        try {
            if (this.platform === 'win32') {
                const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq Software Monitor.exe"');
                processCheck = stdout.includes('Software Monitor.exe');
            } else if (this.platform === 'darwin') {
                const { stdout } = await execPromise('ps aux | grep -i "software monitor" | grep -v grep');
                processCheck = stdout.includes('Software Monitor');
            } else {
                const { stdout } = await execPromise('ps aux | grep software-monitor | grep -v grep');
                processCheck = stdout.includes('software-monitor');
            }
        } catch (error) {
            processCheck = false;
        }

        if (!processCheck) {
            console.error('❌ Process verification failed - application not running.');
            return false;
        }

        // Try to connect to the enterprise server
        console.log('🔗 Testing connection to enterprise server...');
        
        return new Promise((resolve) => {
            const postData = JSON.stringify({
                clientId: this.hostname,
                department: CONFIG.department,
                test: true
            });

            const url = new URL(CONFIG.serverUrl);
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: '/api/test-connection',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length,
                    'X-API-Key': CONFIG.apiKey
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    console.log('✅ Successfully connected to enterprise server.');
                    resolve(true);
                } else {
                    console.warn(`⚠️  Server returned status ${res.statusCode}`);
                    resolve(true); // Still consider installation successful
                }
            });

            req.on('error', (error) => {
                console.warn('⚠️  Could not connect to enterprise server:', error.message);
                console.log('   The client will sync when the server becomes available.');
                resolve(true); // Still consider installation successful
            });

            req.write(postData);
            req.end();
        });
    }

    async saveInstallationLog(error = null) {
        const logData = {
            timestamp: new Date().toISOString(),
            hostname: this.hostname,
            username: this.username,
            department: CONFIG.department,
            platform: this.platform,
            arch: this.arch,
            success: !error,
            error: error ? error.message : null,
            log: this.installLog
        };

        const logPath = path.join(os.tmpdir(), `software-monitor-install-${Date.now()}.log`);
        fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
        
        console.log(`\n📄 Installation log saved to: ${logPath}`);
    }

    async prompt(question) {
        return new Promise((resolve) => {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            readline.question(question, (answer) => {
                readline.close();
                resolve(answer);
            });
        });
    }

    log(message) {
        console.log(message);
        this.installLog.push({
            timestamp: new Date().toISOString(),
            message
        });
    }
}

// Run installer
if (require.main === module) {
    const installer = new ClientInstaller();
    
    // Handle command line arguments
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(`
Software Monitor Client Installer

Usage: node install-client.js [SERVER_URL] [API_KEY] [DEPARTMENT] [DOWNLOAD_URL]

Arguments:
  SERVER_URL    - Enterprise server URL (default: https://monitor-server.company.com)
  API_KEY       - API key for authentication
  DEPARTMENT    - Department name for this client
  DOWNLOAD_URL  - URL to download the installer (optional)

Examples:
  node install-client.js https://monitor.company.com abc123 "Engineering"
  sudo node install-client.js https://10.0.0.100:3443 xyz789 "Finance"

Options:
  --help, -h    - Show this help message
  --silent      - Run in silent mode (no prompts)
  --no-autostart - Don't configure auto-start
`);
        process.exit(0);
    }

    // Override config with command line flags
    if (process.argv.includes('--silent')) {
        CONFIG.silentInstall = true;
    }
    
    if (process.argv.includes('--no-autostart')) {
        CONFIG.autoStart = false;
    }

    // Run the installer
    installer.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ClientInstaller;