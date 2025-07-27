// enterprise-server/install-service.js - Service Installation Script
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ServiceInstaller {
  constructor() {
    this.serviceName = 'SoftwareMonitorServer';
    this.platform = os.platform();
  }

  async install() {
    console.log('Installing Software Monitor Enterprise Server...\n');

    // Create necessary directories
    this.createDirectories();

    // Generate self-signed certificates
    await this.generateCertificates();

    // Create environment file
    this.createEnvFile();

    // Install as system service
    if (this.platform === 'win32') {
      await this.installWindowsService();
    } else if (this.platform === 'linux') {
      await this.installLinuxService();
    } else if (this.platform === 'darwin') {
      await this.installMacService();
    }

    console.log('\nInstallation complete!');
    console.log('Server will run on https://localhost:3443');
    console.log(`API Key: ${this.apiKey}`);
  }

  createDirectories() {
    const dirs = ['data', 'logs', 'certs'];
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dir}/`);
      }
    });
  }

  async generateCertificates() {
    const certPath = path.join(__dirname, 'certs');
    const keyFile = path.join(certPath, 'server.key');
    const certFile = path.join(certPath, 'server.cert');

    if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
      console.log('Certificates already exist');
      return;
    }

    console.log('Generating self-signed certificates...');

    return new Promise((resolve, reject) => {
      const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
      
      exec(cmd, (error) => {
        if (error) {
          console.warn('Could not generate certificates, will use HTTP');
          resolve();
        } else {
          console.log('Certificates generated successfully');
          resolve();
        }
      });
    });
  }

  createEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      console.log('.env file already exists');
      return;
    }

    this.apiKey = this.generateApiKey();
    const envContent = `# Enterprise Server Configuration
PORT=3443
API_KEY=${this.apiKey}
NODE_ENV=production
`;

    fs.writeFileSync(envPath, envContent);
    console.log('Created .env configuration file');
  }

  generateApiKey() {
    return 'sm_' + Buffer.from(Math.random().toString(36).substring(2) + Date.now().toString(36)).toString('base64');
  }

  async installWindowsService() {
    console.log('Installing Windows service...');

    // Create service wrapper script
    const wrapperScript = `
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: '${this.serviceName}',
  description: 'Software Monitor Enterprise Server',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

svc.on('install', () => {
  console.log('Service installed successfully');
  svc.start();
});

svc.install();
`;

    fs.writeFileSync(path.join(__dirname, 'windows-service.js'), wrapperScript);

    console.log('To complete installation:');
    console.log('1. Run: npm install node-windows');
    console.log('2. Run as Administrator: node windows-service.js');
  }

  async installLinuxService() {
    console.log('Creating systemd service...');

    const servicePath = `/etc/systemd/system/${this.serviceName.toLowerCase()}.service`;
    const serviceContent = `[Unit]
Description=Software Monitor Enterprise Server
After=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${__dirname}
ExecStart=/usr/bin/node ${path.join(__dirname, 'server.js')}
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${this.serviceName}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

    fs.writeFileSync('software-monitor-server.service', serviceContent);

    console.log('To complete installation:');
    console.log(`1. Run: sudo cp software-monitor-server.service ${servicePath}`);
    console.log('2. Run: sudo systemctl daemon-reload');
    console.log('3. Run: sudo systemctl enable software-monitor-server');
    console.log('4. Run: sudo systemctl start software-monitor-server');
  }

  async installMacService() {
    console.log('Creating launchd plist...');

    const plistPath = `~/Library/LaunchAgents/com.${this.serviceName.toLowerCase()}.plist`;
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${this.serviceName.toLowerCase()}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${path.join(__dirname, 'server.js')}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>${__dirname}</string>
    <key>StandardOutPath</key>
    <string>${path.join(__dirname, 'logs', 'server.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(__dirname, 'logs', 'error.log')}</string>
</dict>
</plist>`;

    fs.writeFileSync('software-monitor-server.plist', plistContent);

    console.log('To complete installation:');
    console.log(`1. Run: cp software-monitor-server.plist ${plistPath}`);
    console.log(`2. Run: launchctl load ${plistPath}`);
  }
}

// Run installer
const installer = new ServiceInstaller();
installer.install().catch(console.error);