// tests/unit/network-scanner.test.js
const NetworkScanner = require('../../src/main/network-scanner');
const { EventEmitter } = require('events');

describe('NetworkScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = new NetworkScanner();
  });

  afterEach(() => {
    scanner.stop();
  });

  describe('constructor', () => {
    test('should create instance with default values', () => {
      expect(scanner).toBeInstanceOf(NetworkScanner);
      expect(scanner).toBeInstanceOf(EventEmitter);
      expect(scanner.scanInterval).toBeNull();
      expect(scanner.scanFrequency).toBe(300000);
      expect(scanner.clientPort).toBe(9876);
      expect(scanner.discoveredClients).toBeInstanceOf(Map);
      expect(scanner.isScanning).toBe(false);
    });
  });

  describe('getLocalNetworkInfo', () => {
    test('should return network interfaces', () => {
      const networks = scanner.getLocalNetworkInfo();
      
      expect(Array.isArray(networks)).toBe(true);
      
      if (networks.length > 0) {
        expect(networks[0]).toHaveProperty('interface');
        expect(networks[0]).toHaveProperty('address');
        expect(networks[0]).toHaveProperty('netmask');
        expect(networks[0]).toHaveProperty('subnet');
      }
    });
  });

  describe('calculateSubnet', () => {
    test('should calculate subnet correctly', () => {
      const result = scanner.calculateSubnet('192.168.1.100', '255.255.255.0');
      
      expect(result).toHaveProperty('baseIp');
      expect(result).toHaveProperty('cidr');
      expect(result).toHaveProperty('networkParts');
      expect(result.baseIp).toBe('192.168.1.0');
      expect(result.cidr).toBe(24);
      expect(result.networkParts).toEqual([192, 168, 1, 0]);
    });
  });

  describe('isInSubnet', () => {
    test('should correctly identify IPs in subnet', () => {
      const network = {
        subnet: {
          networkParts: [192, 168, 1, 0]
        }
      };
      
      expect(scanner.isInSubnet('192.168.1.50', network)).toBe(true);
      expect(scanner.isInSubnet('192.168.1.255', network)).toBe(true);
      expect(scanner.isInSubnet('192.168.2.50', network)).toBe(false);
      expect(scanner.isInSubnet('10.0.0.1', network)).toBe(false);
    });
  });

  describe('client management', () => {
    test('should add manual client', async () => {
      const mockClient = {
        ip: '192.168.1.100',
        clientId: 'test-client',
        department: 'Test',
        lastSeen: new Date(),
        isOnline: false,
        isManual: true
      };
      
      // Mock the verifyClient method
      scanner.verifyClient = jest.fn().mockResolvedValue(false);
      
      const result = await scanner.addManualClient(mockClient.ip, mockClient.clientId);
      
      expect(result).toBe(false);
      expect(scanner.discoveredClients.has(mockClient.ip)).toBe(true);
      
      const client = scanner.getClientByIp(mockClient.ip);
      expect(client.clientId).toBe(mockClient.clientId);
      expect(client.isManual).toBe(true);
    });

    test('should remove client', () => {
      const ip = '192.168.1.100';
      scanner.discoveredClients.set(ip, { clientId: 'test' });
      
      const result = scanner.removeClient(ip);
      
      expect(result).toBe(true);
      expect(scanner.discoveredClients.has(ip)).toBe(false);
    });

    test('should get client by ID', () => {
      const client = {
        ip: '192.168.1.100',
        clientId: 'test-client-123',
        department: 'Engineering'
      };
      
      scanner.discoveredClients.set(client.ip, client);
      
      const found = scanner.getClientById(client.clientId);
      
      expect(found).toBeTruthy();
      expect(found.clientId).toBe(client.clientId);
      expect(found.ip).toBe(client.ip);
    });

    test('should get online clients only', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 20 * 60 * 1000); // 20 minutes ago
      
      scanner.discoveredClients.set('192.168.1.100', {
        clientId: 'online-client',
        isOnline: true
      });
      
      scanner.discoveredClients.set('192.168.1.101', {
        clientId: 'offline-client',
        isOnline: false
      });
      
      const onlineClients = scanner.getOnlineClients();
      
      expect(onlineClients).toHaveLength(1);
      expect(onlineClients[0].clientId).toBe('online-client');
    });
  });

  describe('start/stop', () => {
    test('should start scanning', async () => {
      scanner.performNetworkScan = jest.fn().mockResolvedValue();
      
      await scanner.start(60000);
      
      expect(scanner.scanFrequency).toBe(60000);
      expect(scanner.isScanning).toBe(true);
      expect(scanner.scanInterval).toBeTruthy();
      expect(scanner.performNetworkScan).toHaveBeenCalled();
    });

    test('should stop scanning', () => {
      scanner.scanInterval = setInterval(() => {}, 1000);
      scanner.isScanning = true;
      
      scanner.stop();
      
      expect(scanner.scanInterval).toBeNull();
      expect(scanner.isScanning).toBe(false);
    });
  });

  describe('events', () => {
    test('should emit scan-started event', (done) => {
      scanner.on('scan-started', () => {
        done();
      });
      
      scanner.emit('scan-started');
    });

    test('should emit client-discovered event', (done) => {
      const client = {
        ip: '192.168.1.100',
        clientId: 'test-client',
        department: 'Test'
      };
      
      scanner.on('client-discovered', (discoveredClient) => {
        expect(discoveredClient).toEqual(client);
        done();
      });
      
      scanner.emit('client-discovered', client);
    });
  });
});