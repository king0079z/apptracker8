// src/main/network-scanner.js
const { EventEmitter } = require('events');
const net = require('net');
const http = require('http');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class NetworkScanner extends EventEmitter {
  constructor() {
    super();
    this.scanInterval = null;
    this.scanFrequency = 300000; // 5 minutes
    this.clientPort = 9876; // Port where clients listen
    this.discoveredClients = new Map();
    this.isScanning = false;
  }

  async start(frequency = 300000) {
    this.scanFrequency = frequency;
    this.isScanning = true;
    
    // Initial scan
    await this.performNetworkScan();
    
    // Set up periodic scanning
    this.scanInterval = setInterval(() => {
      this.performNetworkScan();
    }, this.scanFrequency);
    
    console.log('Network scanner started');
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    console.log('Network scanner stopped');
  }

  async performNetworkScan() {
    console.log('Starting network scan...');
    this.emit('scan-started');
    
    try {
      // Get local network information
      const networkInfo = this.getLocalNetworkInfo();
      
      // Scan each network interface
      for (const network of networkInfo) {
        await this.scanNetwork(network);
      }
      
      // Update discovered clients data
      await this.updateClientsData();
      
      this.emit('scan-completed', {
        clientsFound: this.discoveredClients.size,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Network scan error:', error);
      this.emit('scan-error', error);
    }
  }

  getLocalNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networks = [];
    
    Object.keys(interfaces).forEach(name => {
      interfaces[name].forEach(iface => {
        if (!iface.internal && iface.family === 'IPv4') {
          const subnet = this.calculateSubnet(iface.address, iface.netmask);
          networks.push({
            interface: name,
            address: iface.address,
            netmask: iface.netmask,
            subnet: subnet
          });
        }
      });
    });
    
    return networks;
  }

  calculateSubnet(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    const networkParts = ipParts.map((part, i) => part & maskParts[i]);
    const baseIp = networkParts.join('.');
    
    // Calculate CIDR
    let cidr = 0;
    maskParts.forEach(part => {
      cidr += part.toString(2).split('1').length - 1;
    });
    
    return { baseIp, cidr, networkParts };
  }

  async scanNetwork(network) {
    console.log(`Scanning network: ${network.address} (${network.interface})`);
    
    // Method 1: ARP scan (most reliable for local network)
    const arpHosts = await this.performArpScan(network);
    
    // Method 2: Port scan on discovered hosts
    for (const host of arpHosts) {
      await this.checkClientOnHost(host);
    }
    
    // Method 3: Subnet scan (fallback)
    if (arpHosts.length === 0) {
      await this.performSubnetScan(network);
    }
  }

  async performArpScan(network) {
    const hosts = [];
    
    try {
      const platform = os.platform();
      let arpCommand;
      
      if (platform === 'win32') {
        arpCommand = 'arp -a';
      } else if (platform === 'darwin' || platform === 'linux') {
        arpCommand = 'arp -n';
      }
      
      const { stdout } = await execPromise(arpCommand);
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        let ip;
        if (platform === 'win32') {
          // Windows format: 192.168.1.100    aa-bb-cc-dd-ee-ff    dynamic
          const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]+)\s+/);
          if (match) ip = match[1];
        } else {
          // Unix format: 192.168.1.100  ether  aa:bb:cc:dd:ee:ff  C  eth0
          const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+/);
          if (match) ip = match[1];
        }
        
        if (ip && this.isInSubnet(ip, network)) {
          hosts.push(ip);
        }
      });
      
    } catch (error) {
      console.error('ARP scan error:', error);
    }
    
    return hosts;
  }

  isInSubnet(ip, network) {
    const ipParts = ip.split('.').map(Number);
    const { networkParts } = network.subnet;
    
    // Simple check - in production, would properly validate against netmask
    return ipParts[0] === networkParts[0] && 
           ipParts[1] === networkParts[1] &&
           ipParts[2] === networkParts[2];
  }

  async performSubnetScan(network) {
    const { networkParts } = network.subnet;
    const baseIp = networkParts.slice(0, 3).join('.');
    
    // Scan common range (1-254)
    const scanPromises = [];
    
    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIp}.${i}`;
      scanPromises.push(this.checkClientOnHost(ip));
      
      // Limit concurrent connections
      if (scanPromises.length >= 50) {
        await Promise.allSettled(scanPromises);
        scanPromises.length = 0;
      }
    }
    
    // Check remaining hosts
    if (scanPromises.length > 0) {
      await Promise.allSettled(scanPromises);
    }
  }

  async checkClientOnHost(host) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000); // 2 second timeout
      
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        
        // Port is open, check if it's our client
        this.verifyClient(host).then(isClient => {
          if (isClient) {
            console.log(`Found client at ${host}`);
          }
          resolve(isClient);
        });
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      
      socket.connect(this.clientPort, host);
    });
  }

  async verifyClient(host) {
    try {
      const response = await this.makeHttpRequest(host, '/api/status');
      
      if (response && response.clientId) {
        // Valid client found
        this.discoveredClients.set(host, {
          ip: host,
          clientId: response.clientId,
          department: response.department,
          lastSeen: new Date(),
          isOnline: true,
          isMonitoring: response.isMonitoring
        });
        
        this.emit('client-discovered', {
          ip: host,
          clientId: response.clientId,
          department: response.department
        });
        
        return true;
      }
    } catch (error) {
      // Not a valid client
    }
    
    return false;
  }

  async updateClientsData() {
    const updatePromises = [];
    
    for (const [ip, client] of this.discoveredClients) {
      updatePromises.push(this.updateClientData(ip, client));
    }
    
    await Promise.allSettled(updatePromises);
  }

  async updateClientData(ip, client) {
    try {
      // Get latest data from client
      const latestData = await this.makeHttpRequest(ip, '/api/latest');
      
      if (latestData) {
        client.lastUpdate = new Date();
        client.latestData = latestData;
        client.isOnline = true;
        
        this.emit('client-updated', {
          ip,
          clientId: client.clientId,
          data: latestData
        });
      } else {
        client.isOnline = false;
      }
    } catch (error) {
      client.isOnline = false;
      console.error(`Failed to update client ${client.clientId}:`, error.message);
    }
  }

  async makeHttpRequest(host, path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: this.clientPort,
        path: path,
        method: 'GET',
        timeout: 5000,
        headers: {
          'X-API-Key': 'internal-scanner'
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  async getClientData(clientIp, endpoint = '/api/latest') {
    try {
      return await this.makeHttpRequest(clientIp, endpoint);
    } catch (error) {
      console.error(`Failed to get data from ${clientIp}:`, error);
      return null;
    }
  }

  async getClientApplications(clientIp) {
    return this.getClientData(clientIp, '/api/applications');
  }

  async getClientPlugins(clientIp) {
    return this.getClientData(clientIp, '/api/plugins');
  }

  async getClientSystemInfo(clientIp) {
    return this.getClientData(clientIp, '/api/system-info');
  }

  async getClientUsageHistory(clientIp, days = 7) {
    return this.getClientData(clientIp, `/api/usage/${days}`);
  }

  getDiscoveredClients() {
    return Array.from(this.discoveredClients.values());
  }

  getOnlineClients() {
    return Array.from(this.discoveredClients.values()).filter(client => client.isOnline);
  }

  getClientByIp(ip) {
    return this.discoveredClients.get(ip);
  }

  getClientById(clientId) {
    for (const [ip, client] of this.discoveredClients) {
      if (client.clientId === clientId) {
        return { ...client, ip };
      }
    }
    return null;
  }

  // Manual client addition (for cases where auto-discovery fails)
  async addManualClient(ip, clientId) {
    const isValid = await this.verifyClient(ip);
    if (isValid) {
      return true;
    }
    
    // Still add it but mark as offline
    this.discoveredClients.set(ip, {
      ip,
      clientId: clientId || `manual-${ip}`,
      department: 'Unknown',
      lastSeen: new Date(),
      isOnline: false,
      isManual: true
    });
    
    return false;
  }

  removeClient(ip) {
    return this.discoveredClients.delete(ip);
  }

  async exportClientsData() {
    const clientsData = [];
    
    for (const [ip, client] of this.discoveredClients) {
      const fullData = await this.getClientData(ip);
      clientsData.push({
        ...client,
        ip,
        data: fullData
      });
    }
    
    return clientsData;
  }
}

module.exports = NetworkScanner;