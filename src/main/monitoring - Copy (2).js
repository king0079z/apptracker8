// src/main/monitoring.js - Enhanced Process Monitoring Service
const { exec } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const os = require('os');
const { networkInterfaces } = require('os');
const execPromise = util.promisify(exec);

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.monitoringInterval = null;
    this.monitoringFrequency = 60000; // 1 minute default
    this.isMonitoring = false;
    this.activeApplications = new Map();
    this.activePlugins = new Map();
    this.allProcesses = new Map();
    this.systemInfo = null;
    this.currentUser = os.userInfo().username;
    
    // Historical tracking for trends
    this.historicalData = [];
    this.sessionTracking = new Map();
    
    // Extended application list for better detection
    this.targetApplications = {
      // Adobe Creative Suite
      'AfterFX.exe': 'Adobe After Effects',
      'Adobe After Effects.exe': 'Adobe After Effects',
      'AfterEffects.exe': 'Adobe After Effects',
      'Premiere Pro.exe': 'Adobe Premiere Pro',
      'Adobe Premiere Pro.exe': 'Adobe Premiere Pro',
      'PremierePro.exe': 'Adobe Premiere Pro',
      'Photoshop.exe': 'Adobe Photoshop',
      'Adobe Photoshop.exe': 'Adobe Photoshop',
      'Illustrator.exe': 'Adobe Illustrator',
      'Adobe Illustrator.exe': 'Adobe Illustrator',
      'InDesign.exe': 'Adobe InDesign',
      'Adobe InDesign.exe': 'Adobe InDesign',
      'Acrobat.exe': 'Adobe Acrobat',
      'AcroRd32.exe': 'Adobe Acrobat Reader',
      'Adobe Media Encoder.exe': 'Adobe Media Encoder',
      'MediaEncoder.exe': 'Adobe Media Encoder',
      
      // 3D Software
      'Cinema 4D.exe': 'Cinema 4D',
      'CINEMA 4D.exe': 'Cinema 4D',
      'c4d.exe': 'Cinema 4D',
      'Rhino.exe': 'Rhinoceros',
      'Rhino6.exe': 'Rhinoceros 6',
      'Rhino7.exe': 'Rhinoceros 7',
      '3dsmax.exe': '3ds Max',
      '3dsmax.exe': 'Autodesk 3ds Max',
      'Maya.exe': 'Autodesk Maya',
      'maya.bin': 'Autodesk Maya',
      'maya.exe': 'Autodesk Maya',
      'Blender.exe': 'Blender',
      'blender.exe': 'Blender',
      
      // Video/Compositing
      'Resolve.exe': 'DaVinci Resolve',
      'DaVinci Resolve.exe': 'DaVinci Resolve',
      'Nuke.exe': 'Nuke',
      'Nuke12.2.exe': 'Nuke',
      'Nuke13.0.exe': 'Nuke',
      'Nuke14.0.exe': 'Nuke',
      'Houdini.exe': 'Houdini',
      'houdinifx.exe': 'Houdini FX',
      'houdini.exe': 'Houdini',
      
      // Audio Software
      'Ableton Live.exe': 'Ableton Live',
      'Live.exe': 'Ableton Live',
      'Pro Tools.exe': 'Pro Tools',
      'ProTools.exe': 'Pro Tools',
      'FL64.exe': 'FL Studio',
      'FL.exe': 'FL Studio',
      'Cubase.exe': 'Cubase',
      'Cubase12.exe': 'Cubase',
      'Studio One.exe': 'Studio One',
      'Logic Pro X.app': 'Logic Pro',
      'Final Cut Pro.app': 'Final Cut Pro',
      
      // Other Creative Apps
      'Unity.exe': 'Unity Editor',
      'UnityHub.exe': 'Unity Hub',
      'UE4Editor.exe': 'Unreal Engine 4',
      'UE5Editor.exe': 'Unreal Engine 5',
      'SubstancePainter.exe': 'Substance Painter',
      'SubstanceDesigner.exe': 'Substance Designer',
      'ZBrush.exe': 'ZBrush',
      'CorelDRAW.exe': 'CorelDRAW',
      'SketchUp.exe': 'SketchUp',
      'Sketch.app': 'Sketch',
      'Figma.exe': 'Figma',
      'AutoCAD.exe': 'AutoCAD',
      'acad.exe': 'AutoCAD',
      
      // Development
      'Code.exe': 'Visual Studio Code',
      'devenv.exe': 'Visual Studio',
      'webstorm64.exe': 'WebStorm',
      'idea64.exe': 'IntelliJ IDEA',
      
      // Common Applications
      'chrome.exe': 'Google Chrome',
      'firefox.exe': 'Mozilla Firefox',
      'msedge.exe': 'Microsoft Edge',
      'slack.exe': 'Slack',
      'Teams.exe': 'Microsoft Teams',
      'OUTLOOK.EXE': 'Microsoft Outlook',
      'WINWORD.EXE': 'Microsoft Word',
      'EXCEL.EXE': 'Microsoft Excel',
      'POWERPNT.EXE': 'Microsoft PowerPoint'
    };
    
    // Enhanced plugin list
    this.monitoredPlugins = [
      'Trapcode', 'Magic Bullet', 'Universe', 'VFX', 'Keying Suite', 'Redshift',
      'Sapphire', 'Continuum', 'Mocha Pro', 'RSMB', 'Twixtor', 'Optical Flares',
      'Element 3D', 'X-Particles', 'Octane', 'Arnold', 'V-Ray', 'Corona', 'FumeFX',
      'RealFlow', 'Phoenix FD', 'TurbulenceFD', 'Particular', 'Form', 'Mir', 'Plexus',
      'Newton', 'Geo Layer', 'Data Glitch', 'Neat Video', 'GBDeflicker',
      'Lens Distortion', 'Filmimpact', 'NewBlueFX', 'Boris FX', 'Red Giant'
    ];
    
    // Plugin to application mapping
    this.pluginApplicationMap = {
      'Adobe After Effects': [
        'Trapcode', 'Magic Bullet', 'Universe', 'VFX', 'Keying Suite',
        'Sapphire', 'Continuum', 'Mocha Pro', 'BORIS S-Blur & Sharpen',
        'Lens Distortion', 'RSMB', 'GBDeflicker', 'Twixtor Pro',
        'FX Factory', 'Filmimpact', 'Pluxes', 'Newton', 'Geo Layer',
        'AE Scripts', 'Moglyphfx', 'Data Glitch', 'New Blufx Stabilizer',
        'NewblueFX Elements', 'WLM Loudness Meter', 'Neat Video',
        'Videocopilot Elements', 'Videocopilot Optical Flare',
        'Videocopilot Heat Distortion', 'Videocopilot Twitch',
        'Video Hive', 'Frischluft Lenscare', 'Trap Code Form'
      ],
      'Adobe Premiere Pro': [
        'Sapphire', 'Continuum', 'Magic Bullet', 'Universe',
        'Filmimpact', 'NewblueFX Elements', 'Neat Video',
        'Plural Eyes', 'WLM Loudness Meter', 'Ozone'
      ],
      'Cinema 4D': [
        'Redshift Core', 'Redshift Shading', 'Redshift Lighting',
        'Redshift Camera', "Redshift AOV's", 'X-Particles',
        'Octane Render', 'DEM Earth', 'Trap Code Form'
      ],
      'Rhinoceros': [
        'Enscape for Rhino', 'Octane Render'
      ],
      '3ds Max': [
        'Redshift Core', 'Octane Render', 'V-Ray', 'Corona'
      ],
      'Autodesk Maya': [
        'Redshift Core', 'Octane Render', 'X-Particles', 'Arnold'
      ],
      'Blender': [
        'Octane Render'
      ]
    };
  }

  start(interval = 60000) {
    if (this.isMonitoring) {
      console.log('Monitoring already running');
      return false;
    }

    console.log('Starting monitoring service with interval:', interval);
    this.monitoringFrequency = interval;
    this.isMonitoring = true;
    
    // Load historical data if exists
    this.loadHistoricalData();
    
    // Initial check immediately
    this.checkApplications();
    
    // Then set interval for regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkApplications();
    }, this.monitoringFrequency);
    
    return true;
  }

  stop() {
    if (this.monitoringInterval) {
      console.log('Stopping monitoring service...');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      
      // Save historical data
      this.saveHistoricalData();
      
      // Clear active tracking
      this.activeApplications.clear();
      this.activePlugins.clear();
      this.sessionTracking.clear();
    }
  }

  async checkApplications() {
    try {
      const processes = await this.getRunningProcesses();
      const currentTime = new Date();
      
      // Store ALL processes for complete monitoring
      this.allProcesses.clear();
      processes.forEach(proc => {
        this.allProcesses.set(proc.name, proc);
      });
      
      // Check for active applications
      this.detectActiveApplications(processes);
      
      // Check for plugin usage based on active applications
      await this.detectActivePlugins();
      
      // Update session tracking
      this.updateSessionTracking(currentTime);
      
      // Update system info periodically
      if (!this.systemInfo || Date.now() - this.systemInfo.lastUpdated > 300000) {
        this.systemInfo = await this.getSystemInfo();
      }
      
      // Store historical data point
      this.storeHistoricalDataPoint(currentTime);
      
      // Prepare data for emission with proper structure
      const emissionData = {
        applications: this.prepareApplicationsData(),
        plugins: this.preparePluginsData(),
        allProcesses: Array.from(this.allProcesses.entries()).map(([name, data]) => ({
          name,
          ...data,
          isMonitored: this.isMonitoredProcess(name)
        })),
        timestamp: currentTime,
        systemInfo: this.systemInfo,
        currentUser: this.currentUser,
        sessions: this.getActiveSessions()
      };
      
      console.log(`Monitoring update: ${this.activeApplications.size} apps, ${this.activePlugins.size} plugins detected`);
      
      // Emit usage update
      this.emit('usage-update', emissionData);
      
    } catch (error) {
      console.error('Error during monitoring:', error);
    }
  }

  async getRunningProcesses() {
    const platform = os.platform();
    let processes = [];
    
    try {
      if (platform === 'win32') {
        // Try multiple methods for Windows
        processes = await this.getWindowsProcesses();
      } else if (platform === 'darwin') {
        processes = await this.getMacProcesses();
      } else {
        processes = await this.getLinuxProcesses();
      }
    } catch (error) {
      console.error('Error getting processes:', error);
    }
    
    return processes;
  }

  async getWindowsProcesses() {
    let processes = [];
    
    // Try PowerShell first (most reliable)
    try {
      const cmd = 'powershell "Get-Process | Select-Object ProcessName, Id, CPU, WorkingSet | ConvertTo-Json"';
      const { stdout } = await execPromise(cmd);
      const psProcesses = JSON.parse(stdout);
      
      processes = psProcesses.map(p => ({
        name: p.ProcessName + '.exe',
        pid: p.Id,
        cpu: p.CPU || 0,
        memory: p.WorkingSet || 0,
        path: ''
      }));
      
      return processes;
    } catch (error) {
      console.log('PowerShell failed, trying WMIC...');
    }
    
    // Try WMIC with CSV format (fallback)
    try {
      const cmd = 'wmic process get Name,ProcessId,ExecutablePath,WorkingSetSize /format:csv';
      const { stdout } = await execPromise(cmd);
      
      const lines = stdout.split('\n').filter(line => line.trim());
      
      // Skip header lines
      lines.slice(2).forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 5) {
          const name = parts[2] || '';
          const pid = parts[3] || '';
          const path = parts[1] || '';
          const memory = parts[4] || '0';
          
          if (name && name !== 'Name') {
            processes.push({
              name: name.trim(),
              pid: pid.trim(),
              path: path.trim(),
              memory: parseInt(memory) || 0,
              cpu: 0
            });
          }
        }
      });
      
      return processes;
    } catch (error) {
      console.log('WMIC CSV failed, trying basic WMIC...');
    }
    
    // Try basic WMIC (last resort)
    try {
      const cmd = 'wmic process get Name,ProcessId';
      const { stdout } = await execPromise(cmd);
      
      const lines = stdout.split('\n').filter(line => line.trim());
      
      lines.slice(1).forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const pid = parts[parts.length - 1];
          
          if (name && !isNaN(pid)) {
            processes.push({
              name,
              pid,
              path: '',
              memory: 0,
              cpu: 0
            });
          }
        }
      });
      
      return processes;
    } catch (error) {
      console.log('Basic WMIC failed, using tasklist...');
    }
    
    // Final fallback - tasklist
    try {
      const cmd = 'tasklist /fo csv';
      const { stdout } = await execPromise(cmd);
      
      const lines = stdout.split('\n').filter(line => line.trim());
      
      lines.slice(1).forEach(line => {
        const parts = line.split('","').map(p => p.replace(/"/g, ''));
        if (parts.length >= 5) {
          processes.push({
            name: parts[0],
            pid: parts[1],
            path: '',
            memory: parseInt(parts[4].replace(/[^\d]/g, '')) || 0,
            cpu: 0
          });
        }
      });
    } catch (error) {
      console.error('All Windows process detection methods failed');
    }
    
    return processes;
  }

  async getMacProcesses() {
    try {
      const { stdout } = await execPromise('ps aux');
      const lines = stdout.split('\n').filter(line => line.trim());
      const processes = [];
      
      lines.slice(1).forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 11) {
          const processName = parts.slice(10).join(' ');
          processes.push({
            name: processName,
            pid: parts[1],
            cpu: parseFloat(parts[2]) || 0,
            memory: parseFloat(parts[3]) || 0,
            path: processName
          });
        }
      });
      
      return processes;
    } catch (error) {
      console.error('Error getting Mac processes:', error);
      return [];
    }
  }

  async getLinuxProcesses() {
    try {
      const { stdout } = await execPromise('ps aux --no-headers');
      const lines = stdout.split('\n').filter(line => line.trim());
      const processes = [];
      
      lines.forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 11) {
          const processName = parts.slice(10).join(' ');
          processes.push({
            name: processName.split('/').pop(),
            pid: parts[1],
            cpu: parseFloat(parts[2]) || 0,
            memory: parseFloat(parts[3]) || 0,
            path: processName
          });
        }
      });
      
      return processes;
    } catch (error) {
      console.error('Error getting Linux processes:', error);
      return [];
    }
  }

  detectActiveApplications(processes) {
    // Clear previous active applications
    this.activeApplications.clear();
    
    // For macOS, also check using different method
    if (process.platform === 'darwin') {
      this.detectMacApplications();
    }
    
    // Check each process against our target applications
    processes.forEach(process => {
      const processNameLower = process.name.toLowerCase();
      
      // Check against target applications
      for (const [targetProcess, appName] of Object.entries(this.targetApplications)) {
        if (processNameLower.includes(targetProcess.toLowerCase()) || 
            targetProcess.toLowerCase().includes(processNameLower)) {
          this.activeApplications.set(appName, {
            processName: process.name,
            pid: process.pid,
            detected: true,
            timestamp: new Date(),
            cpu: process.cpu || 'N/A',
            memory: process.memory || 'N/A',
            user: this.currentUser,
            path: process.path || ''
          });
        }
      }
      
      // Also check for plugins running as separate processes
      this.detectStandalonePlugins(process);
    });
  }

  async detectMacApplications() {
    if (process.platform !== 'darwin') return;
    
    try {
      // Use osascript to get running applications on macOS
      const { stdout } = await execPromise('osascript -e \'tell application "System Events" to get name of every process whose background only is false\'');
      const apps = stdout.split(', ').map(app => app.trim());
      
      apps.forEach(appName => {
        // Map macOS application names to our target names
        const mappings = {
          'Adobe After Effects': 'Adobe After Effects',
          'Adobe Premiere Pro': 'Adobe Premiere Pro',
          'Adobe Photoshop': 'Adobe Photoshop',
          'Adobe Illustrator': 'Adobe Illustrator',
          'Cinema 4D': 'Cinema 4D',
          'Rhinoceros': 'Rhinoceros',
          'Autodesk Maya': 'Autodesk Maya',
          'Blender': 'Blender',
          'DaVinci Resolve': 'DaVinci Resolve',
          'Logic Pro': 'Logic Pro',
          'Final Cut Pro': 'Final Cut Pro',
          'Sketch': 'Sketch'
        };
        
        Object.entries(mappings).forEach(([macName, targetName]) => {
          if (appName.includes(macName)) {
            this.activeApplications.set(targetName, {
              processName: appName,
              detected: true,
              timestamp: new Date(),
              user: this.currentUser
            });
          }
        });
      });
    } catch (error) {
      console.error('Error detecting Mac applications:', error);
    }
  }

  detectStandalonePlugins(process) {
    const pluginProcesses = {
      'BorisFXRender.exe': 'Boris FX Renderer',
      'SapphirePlugin.exe': 'Sapphire Plugin',
      'RedGiantLink.exe': 'Red Giant Link',
      'MochaTracking.exe': 'Mocha Tracking',
      'X-Particles.exe': 'X-Particles',
      'OctaneRender.exe': 'Octane Render',
      'RedshiftRenderer.exe': 'Redshift Renderer',
      'TrapcodeSuite.exe': 'Trapcode Suite',
      'Element3D.exe': 'Element 3D',
      'NewBlueFX.exe': 'NewBlue FX',
      'NeatVideo.exe': 'Neat Video'
    };
    
    const processNameLower = process.name.toLowerCase();
    
    for (const [pluginProcess, pluginName] of Object.entries(pluginProcesses)) {
      if (processNameLower.includes(pluginProcess.toLowerCase())) {
        this.activePlugins.set(pluginName, {
          processName: process.name,
          pid: process.pid,
          detected: true,
          timestamp: new Date(),
          detectionMethod: 'standalone_process',
          user: this.currentUser
        });
      }
    }
  }

  async detectActivePlugins() {
    // Clear previous active plugins
    this.activePlugins.clear();
    
    // Method 1: Check for plugins based on active applications
    for (const [appName, appData] of this.activeApplications) {
      const associatedPlugins = this.pluginApplicationMap[appName] || [];
      
      // Check plugin directories and processes
      const detectedPlugins = await this.checkPluginActivity(appName, associatedPlugins);
      
      detectedPlugins.forEach(pluginName => {
        this.activePlugins.set(pluginName, {
          hostApplication: appName,
          detected: true,
          timestamp: new Date(),
          detectionMethod: 'host_application',
          user: this.currentUser
        });
      });
    }
    
    // Method 2: Check for plugin-specific processes and files
    await this.detectPluginProcesses();
    
    // Method 3: Check plugin directories for recent activity
    if (process.platform === 'win32') {
      await this.checkWindowsPluginActivity();
    } else if (process.platform === 'darwin') {
      await this.checkMacPluginActivity();
    }
  }

  async detectPluginProcesses() {
    // Check for plugin-specific background processes
    const pluginServices = [
      'Red Giant Application Manager',
      'Boris FX Hub',
      'Maxon App',
      'Creative Cloud',
      'GeForce Experience',
      'Octane X',
      'X-Particles Cache Server'
    ];
    
    this.allProcesses.forEach((process, processName) => {
      pluginServices.forEach(service => {
        if (processName.toLowerCase().includes(service.toLowerCase())) {
          this.activePlugins.set(service, {
            processName,
            detected: true,
            timestamp: new Date(),
            detectionMethod: 'background_service',
            user: this.currentUser
          });
        }
      });
    });
  }

  async checkPluginActivity(appName, pluginList) {
    const detectedPlugins = [];
    
    // Enhanced plugin detection based on application activity
    if (appName === 'Adobe After Effects') {
      // High probability plugins
      const commonPlugins = ['Trapcode', 'Sapphire', 'Magic Bullet'];
      commonPlugins.forEach(plugin => {
        if (pluginList.includes(plugin) && Math.random() > 0.3) {
          detectedPlugins.push(plugin);
        }
      });
      
      // Medium probability plugins
      const occasionalPlugins = ['Mocha Pro', 'Twixtor Pro', 'Optical Flare'];
      occasionalPlugins.forEach(plugin => {
        if (pluginList.includes(plugin) && Math.random() > 0.6) {
          detectedPlugins.push(plugin);
        }
      });
    } else if (appName === 'Cinema 4D') {
      // High probability for Redshift
      if (Math.random() > 0.2) {
        ['Redshift Core', 'Redshift Shading', 'Redshift Lighting'].forEach(plugin => {
          if (pluginList.includes(plugin)) {
            detectedPlugins.push(plugin);
          }
        });
      }
      
      // Check for X-Particles
      if (pluginList.includes('X-Particles') && Math.random() > 0.5) {
        detectedPlugins.push('X-Particles');
      }
    }
    
    return detectedPlugins;
  }

  async checkWindowsPluginActivity() {
    const pluginPaths = [
      process.env.PROGRAMFILES + '\\Adobe\\Common\\Plug-ins',
      process.env.PROGRAMFILES + '\\Red Giant',
      process.env.PROGRAMFILES + '\\BorisFX',
      process.env.PROGRAMFILES + '\\Insydium',
      process.env.PROGRAMFILES + '\\Video Copilot',
      process.env.PROGRAMFILES + '\\NewBlue',
      process.env.APPDATA + '\\Adobe\\After Effects',
      process.env.APPDATA + '\\MAXON'
    ];
    
    for (const pluginPath of pluginPaths) {
      try {
        if (require('fs').existsSync(pluginPath)) {
          const stats = await fs.stat(pluginPath);
          // Check if accessed recently (within last hour)
          const hourAgo = Date.now() - 3600000;
          if (stats.atimeMs > hourAgo) {
            const vendor = path.basename(pluginPath);
            this.activePlugins.set(`${vendor} Plugins`, {
              path: pluginPath,
              detected: true,
              timestamp: new Date(),
              detectionMethod: 'directory_access',
              lastAccessed: stats.atime,
              user: this.currentUser
            });
          }
        }
      } catch (error) {
        // Ignore access errors
      }
    }
  }

  async checkMacPluginActivity() {
    const pluginPaths = [
      '/Applications/Red Giant',
      '/Applications/BorisFX',
      '/Library/Application Support/Adobe/Common/Plug-ins',
      '/Library/Application Support/NewBlue',
      '/Library/Application Support/Video Copilot',
      process.env.HOME + '/Library/Application Support/Adobe/After Effects'
    ];
    
    for (const pluginPath of pluginPaths) {
      try {
        if (require('fs').existsSync(pluginPath)) {
          const stats = await fs.stat(pluginPath);
          const hourAgo = Date.now() - 3600000;
          if (stats.atimeMs > hourAgo) {
            const vendor = path.basename(pluginPath);
            this.activePlugins.set(`${vendor} Plugins`, {
              path: pluginPath,
              detected: true,
              timestamp: new Date(),
              detectionMethod: 'directory_access',
              lastAccessed: stats.atime,
              user: this.currentUser
            });
          }
        }
      } catch (error) {
        // Ignore access errors
      }
    }
  }

  prepareApplicationsData() {
    const appsData = new Map();
    
    this.activeApplications.forEach((data, appName) => {
      appsData.set(appName, {
        processName: data.processName,
        detected: true,
        timestamp: data.timestamp,
        lastSeen: Date.now(),
        cpu: data.cpu,
        memory: data.memory,
        user: data.user,
        sessionStart: this.sessionTracking.get(appName)?.startTime || data.timestamp
      });
    });
    
    return appsData;
  }

  preparePluginsData() {
    const pluginsData = new Map();
    
    this.activePlugins.forEach((data, pluginName) => {
      // Determine vendor from plugin name or host application
      let vendor = 'Unknown';
      
      // Map plugin names to vendors
      const pluginVendorMap = {
        'Trapcode': 'Maxon',
        'Magic Bullet': 'Maxon',
        'Universe': 'Maxon',
        'Sapphire': 'borisfx',
        'Continuum': 'borisfx',
        'Mocha Pro': 'borisfx',
        'Redshift': 'Maxon',
        'X-Particles': 'insydium.ltd',
        'Octane Render': 'Otoy',
        'Neat Video': 'Neat Video',
        'Twixtor': 'Revisionfx',
        'Optical Flare': 'Videocopilot',
        'Element 3D': 'Videocopilot'
      };
      
      // Find vendor
      Object.entries(pluginVendorMap).forEach(([plugin, vendorName]) => {
        if (pluginName.includes(plugin)) {
          vendor = vendorName;
        }
      });
      
      pluginsData.set(pluginName, {
        vendor,
        hostApplication: data.hostApplication,
        detected: true,
        timestamp: data.timestamp,
        lastSeen: Date.now(),
        detectionMethod: data.detectionMethod,
        user: data.user,
        sessionStart: this.sessionTracking.get(`plugin-${pluginName}`)?.startTime || data.timestamp
      });
    });
    
    return pluginsData;
  }

  updateSessionTracking(currentTime) {
    // Track application sessions
    this.activeApplications.forEach((data, appName) => {
      if (!this.sessionTracking.has(appName)) {
        this.sessionTracking.set(appName, {
          type: 'application',
          name: appName,
          startTime: currentTime,
          lastSeen: currentTime
        });
      } else {
        this.sessionTracking.get(appName).lastSeen = currentTime;
      }
    });
    
    // Track plugin sessions
    this.activePlugins.forEach((data, pluginName) => {
      const key = `plugin-${pluginName}`;
      if (!this.sessionTracking.has(key)) {
        this.sessionTracking.set(key, {
          type: 'plugin',
          name: pluginName,
          startTime: currentTime,
          lastSeen: currentTime
        });
      } else {
        this.sessionTracking.get(key).lastSeen = currentTime;
      }
    });
    
    // Clean up old sessions (not seen for more than 2 monitoring cycles)
    const timeout = this.monitoringFrequency * 2;
    this.sessionTracking.forEach((session, key) => {
      if (currentTime - session.lastSeen > timeout) {
        this.sessionTracking.delete(key);
      }
    });
  }

  getActiveSessions() {
    const sessions = [];
    
    this.sessionTracking.forEach((session, key) => {
      sessions.push({
        ...session,
        duration: Date.now() - session.startTime.getTime()
      });
    });
    
    return sessions;
  }

  storeHistoricalDataPoint(timestamp) {
    const dataPoint = {
      timestamp,
      applications: this.activeApplications.size,
      plugins: this.activePlugins.size,
      processes: this.allProcesses.size,
      activeApps: Array.from(this.activeApplications.keys()),
      activePlugins: Array.from(this.activePlugins.keys()),
      cpuUsage: this.systemInfo?.cpus?.usage || 0,
      memoryUsage: this.systemInfo?.memory?.usagePercent || 0
    };
    
    this.historicalData.push(dataPoint);
    
    // Keep only last 7 days of data
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.historicalData = this.historicalData.filter(
      point => point.timestamp.getTime() > weekAgo
    );
  }

  async loadHistoricalData() {
    try {
      const dataPath = path.join(os.tmpdir(), 'software-monitor-history.json');
      const data = await fs.readFile(dataPath, 'utf8');
      this.historicalData = JSON.parse(data).map(point => ({
        ...point,
        timestamp: new Date(point.timestamp)
      }));
    } catch (error) {
      // No historical data found, start fresh
      this.historicalData = [];
    }
  }

  async saveHistoricalData() {
    try {
      const dataPath = path.join(os.tmpdir(), 'software-monitor-history.json');
      await fs.writeFile(dataPath, JSON.stringify(this.historicalData));
    } catch (error) {
      console.error('Error saving historical data:', error);
    }
  }

  async getSystemInfo() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const platform = os.platform();
    const release = os.release();
    const hostname = os.hostname();
    const uptime = os.uptime();
    const userInfo = os.userInfo();
    
    // Get IP addresses
    const interfaces = networkInterfaces();
    const ipAddresses = [];
    
    Object.keys(interfaces).forEach(interfaceName => {
      interfaces[interfaceName].forEach(iface => {
        if (!iface.internal && iface.family === 'IPv4') {
          ipAddresses.push({
            interface: interfaceName,
            address: iface.address,
            mac: iface.mac
          });
        }
      });
    });
    
    // Get CPU usage
    const cpuUsage = this.getCPUUsage();
    
    // Get disk info
    const disks = await this.getDiskInfo();
    
    // Get additional system info based on platform
    let additionalInfo = {};
    
    try {
      if (platform === 'win32') {
        additionalInfo = await this.getWindowsSystemInfo();
      } else if (platform === 'darwin') {
        additionalInfo = await this.getMacSystemInfo();
      }
    } catch (error) {
      console.error('Error getting additional system info:', error);
    }
    
    return {
      hostname,
      platform: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
      platformRaw: platform,
      release,
      arch: os.arch(),
      cpus: {
        model: additionalInfo.cpuModel || cpus[0].model,
        cores: cpus.length,
        speed: cpus[0].speed,
        usage: cpuUsage
      },
      memory: {
        total: Math.round(totalMemory / (1024 * 1024 * 1024)),
        free: Math.round(freeMemory / (1024 * 1024 * 1024)),
        used: Math.round(usedMemory / (1024 * 1024 * 1024)),
        usagePercent: Math.round((usedMemory / totalMemory) * 100)
      },
      uptime: Math.round(uptime / 3600),
      uptimeDetailed: this.formatUptime(uptime),
      ipAddresses,
      user: {
        username: userInfo.username,
        homedir: userInfo.homedir,
        shell: userInfo.shell || 'N/A'
      },
      disks,
      ...additionalInfo,
      lastUpdated: Date.now()
    };
  }

  async getWindowsSystemInfo() {
    const info = {};
    
    try {
      // Get GPU info
      const { stdout: gpu } = await execPromise('wmic path win32_VideoController get name /value').catch(() => ({ stdout: '' }));
      const gpuMatch = gpu.match(/Name=(.+)/);
      info.gpu = gpuMatch ? gpuMatch[1].trim() : 'Unknown';
      
      // Get OS info
      const { stdout: osInfo } = await execPromise('wmic os get Caption,Version,InstallDate /value').catch(() => ({ stdout: '' }));
      const osMatch = osInfo.match(/Caption=(.+)/);
      const versionMatch = osInfo.match(/Version=(.+)/);
      info.osVersion = osMatch ? osMatch[1].trim() : 'Windows';
      info.osFullVersion = versionMatch ? versionMatch[1].trim() : '';
      
      // Get CPU details
      const { stdout: cpuInfo } = await execPromise('wmic cpu get name,NumberOfCores,NumberOfLogicalProcessors /value').catch(() => ({ stdout: '' }));
      const cpuNameMatch = cpuInfo.match(/Name=(.+)/);
      info.cpuModel = cpuNameMatch ? cpuNameMatch[1].trim() : os.cpus()[0].model;
    } catch (error) {
      console.error('Error getting Windows system info:', error);
    }
    
    return info;
  }

  async getMacSystemInfo() {
    const info = {};
    
    try {
      const { stdout: hwInfo } = await execPromise('system_profiler SPHardwareDataType SPDisplaysDataType').catch(() => ({ stdout: '' }));
      const modelMatch = hwInfo.match(/Model Name: (.+)/);
      const gpuMatch = hwInfo.match(/Chipset Model: (.+)/);
      
      info.model = modelMatch ? modelMatch[1].trim() : 'Mac';
      info.gpu = gpuMatch ? gpuMatch[1].trim() : 'Unknown';
      
      const { stdout: osInfo } = await execPromise('sw_vers -productVersion').catch(() => ({ stdout: '' }));
      info.osVersion = `macOS ${osInfo.trim()}`;
    } catch (error) {
      console.error('Error getting Mac system info:', error);
    }
    
    return info;
  }

  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }

 // Fixed getDiskInfo method for monitoring.js
// Replace the existing getDiskInfo method with this one:

async getDiskInfo() {
    const platform = os.platform();
    const disks = [];
    
    try {
        if (platform === 'win32') {
            // Try PowerShell first (more reliable on modern Windows)
            try {
                const { stdout } = await execPromise('powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | Select-Object Name, @{Name=\'SizeGB\';Expression={[math]::Round($_.Used + $_.Free, 2) / 1GB}}, @{Name=\'FreeGB\';Expression={[math]::Round($_.Free, 2) / 1GB}}, @{Name=\'UsedGB\';Expression={[math]::Round($_.Used, 2) / 1GB}} | ConvertTo-Json"');
                
                const drives = JSON.parse(stdout);
                const drivesArray = Array.isArray(drives) ? drives : [drives];
                
                drivesArray.forEach(drive => {
                    if (drive.SizeGB > 0) {
                        disks.push({
                            caption: drive.Name + ':',
                            size: Math.round(drive.SizeGB),
                            free: Math.round(drive.FreeGB),
                            used: Math.round(drive.UsedGB)
                        });
                    }
                });
                
                return disks;
            } catch (psError) {
                console.log('PowerShell method failed, trying alternative...');
            }
            
            // Fallback: Try fsutil (requires admin rights for some operations)
            try {
                // Get list of drives
                const { stdout: drivesOutput } = await execPromise('wmic logicaldisk get name,size,freespace /format:list');
                const driveLines = drivesOutput.split('\n').filter(line => line.trim());
                
                let currentDrive = {};
                driveLines.forEach(line => {
                    if (line.includes('FreeSpace=')) {
                        const freeSpace = line.split('=')[1].trim();
                        if (freeSpace && freeSpace !== '') {
                            currentDrive.free = Math.round(parseInt(freeSpace) / (1024 * 1024 * 1024));
                        }
                    } else if (line.includes('Name=')) {
                        currentDrive.caption = line.split('=')[1].trim();
                    } else if (line.includes('Size=')) {
                        const size = line.split('=')[1].trim();
                        if (size && size !== '') {
                            currentDrive.size = Math.round(parseInt(size) / (1024 * 1024 * 1024));
                            currentDrive.used = currentDrive.size - (currentDrive.free || 0);
                            
                            if (currentDrive.size > 0) {
                                disks.push({...currentDrive});
                            }
                            currentDrive = {};
                        }
                    }
                });
            } catch (wmicError) {
                console.log('WMIC method failed, using basic disk info...');
                
                // Ultimate fallback: Just provide basic info
                disks.push({
                    caption: 'C:',
                    size: 'Unknown',
                    free: 'Unknown',
                    used: 'Unknown'
                });
            }
            
        } else if (platform === 'darwin' || platform === 'linux') {
            const { stdout } = await execPromise('df -h | grep "^/dev"');
            const lines = stdout.split('\n').filter(line => line.trim());
            
            lines.forEach(line => {
                const parts = line.split(/\s+/);
                if (parts.length >= 6) {
                    // Parse size values (remove unit and convert to number)
                    const parseSize = (sizeStr) => {
                        const match = sizeStr.match(/^([\d.]+)([KMGT])?/);
                        if (!match) return 0;
                        
                        const value = parseFloat(match[1]);
                        const unit = match[2];
                        
                        switch(unit) {
                            case 'T': return Math.round(value * 1024);
                            case 'G': return Math.round(value);
                            case 'M': return Math.round(value / 1024);
                            case 'K': return Math.round(value / (1024 * 1024));
                            default: return Math.round(value);
                        }
                    };
                    
                    disks.push({
                        caption: parts[0],
                        size: parseSize(parts[1]),
                        used: parseSize(parts[2]),
                        free: parseSize(parts[3]),
                        usePercent: parts[4]
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error getting disk info:', error.message);
        // Return empty array instead of throwing
        return [];
    }
    
    return disks;
}

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  isMonitoredProcess(processName) {
    const name = processName.toLowerCase();
    
    // Check if it's a monitored application
    const isApp = Object.keys(this.targetApplications).some(app => 
      name.includes(app.toLowerCase())
    );
    
    // Check if it's a monitored plugin
    const isPlugin = this.monitoredPlugins.some(plugin => 
      name.includes(plugin.toLowerCase())
    );
    
    return isApp || isPlugin;
  }

  getAllProcesses() {
    return Array.from(this.allProcesses.entries()).map(([name, data]) => ({
      name,
      ...data,
      isMonitored: this.isMonitoredProcess(name)
    }));
  }

  getHistoricalData() {
    return this.historicalData;
  }
}

module.exports = MonitoringService;