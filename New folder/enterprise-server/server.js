// enterprise-server/server.js - Enterprise Monitoring Server
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

class EnterpriseMonitoringServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3443;
    this.apiKey = process.env.API_KEY || 'your-secure-api-key';
    this.dbPath = path.join(__dirname, 'data', 'monitoring.db');
    
    this.setupDatabase();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupDatabase() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath);
    
    // Create tables
    this.db.serialize(() => {
      // Clients table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT UNIQUE NOT NULL,
          hostname TEXT NOT NULL,
          department TEXT,
          platform TEXT,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Usage data table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS usage_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          applications TEXT,
          plugins TEXT,
          costs TEXT,
          system_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients(client_id)
        )
      `);

      // Create indexes
      this.db.run('CREATE INDEX IF NOT EXISTS idx_client_id ON usage_data(client_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_data(timestamp)');
    });

    // Promisify database methods
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // API Key validation middleware
    this.app.use('/api', (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== this.apiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  }

  setupRoutes() {
    // Receive usage data from clients
    this.app.post('/api/usage-data', async (req, res) => {
      try {
        const { clientId, department, hostname, platform, timestamp, data } = req.body;
        
        // Update or insert client
        await this.dbRun(`
          INSERT OR REPLACE INTO clients (client_id, hostname, department, platform, last_seen)
          VALUES (?, ?, ?, ?, datetime('now'))
        `, [clientId, hostname, department, platform]);
        
        // Insert usage data
        await this.dbRun(`
          INSERT INTO usage_data (client_id, timestamp, applications, plugins, costs, system_info)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          clientId,
          timestamp,
          JSON.stringify(data.applications),
          JSON.stringify(data.plugins),
          JSON.stringify(data.costs),
          JSON.stringify(data.systemInfo)
        ]);
        
        res.status(201).json({ success: true, message: 'Data received' });
      } catch (error) {
        console.error('Error storing data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get all clients
    this.app.get('/api/clients', async (req, res) => {
      try {
        const clients = await this.dbAll(`
          SELECT c.*, 
                 COUNT(u.id) as data_points,
                 MAX(u.timestamp) as last_update
          FROM clients c
          LEFT JOIN usage_data u ON c.client_id = u.client_id
          GROUP BY c.client_id
          ORDER BY c.last_seen DESC
        `);
        
        res.json(clients);
      } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get client details
    this.app.get('/api/clients/:clientId', async (req, res) => {
      try {
        const { clientId } = req.params;
        
        const client = await this.dbGet(
          'SELECT * FROM clients WHERE client_id = ?',
          [clientId]
        );
        
        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }
        
        // Get latest usage data
        const latestUsage = await this.dbGet(`
          SELECT * FROM usage_data 
          WHERE client_id = ? 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, [clientId]);
        
        // Get usage history (last 30 days)
        const history = await this.dbAll(`
          SELECT timestamp, applications, plugins
          FROM usage_data
          WHERE client_id = ?
          AND timestamp > datetime('now', '-30 days')
          ORDER BY timestamp DESC
        `, [clientId]);
        
        res.json({
          client,
          latestUsage: latestUsage ? {
            ...latestUsage,
            applications: JSON.parse(latestUsage.applications || '{}'),
            plugins: JSON.parse(latestUsage.plugins || '{}'),
            costs: JSON.parse(latestUsage.costs || '{}'),
            system_info: JSON.parse(latestUsage.system_info || '{}')
          } : null,
          history
        });
      } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get aggregated statistics
    this.app.get('/api/statistics', async (req, res) => {
      try {
        const stats = await this.dbGet(`
          SELECT 
            COUNT(DISTINCT client_id) as total_clients,
            COUNT(*) as total_data_points,
            MIN(timestamp) as first_data,
            MAX(timestamp) as last_data
          FROM usage_data
        `);
        
        // Get department breakdown
        const departments = await this.dbAll(`
          SELECT department, COUNT(*) as count
          FROM clients
          GROUP BY department
        `);
        
        // Get platform breakdown
        const platforms = await this.dbAll(`
          SELECT platform, COUNT(*) as count
          FROM clients
          GROUP BY platform
        `);
        
        res.json({
          overview: stats,
          departments,
          platforms
        });
      } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  start() {
    // Create HTTPS server with self-signed certificate for development
    const httpsOptions = this.getHttpsOptions();
    
    if (httpsOptions) {
      https.createServer(httpsOptions, this.app).listen(this.port, () => {
        console.log(`Enterprise Monitoring Server running on https://localhost:${this.port}`);
        console.log(`API Key: ${this.apiKey}`);
      });
    } else {
      // Fallback to HTTP for development
      this.app.listen(this.port, () => {
        console.log(`Enterprise Monitoring Server running on http://localhost:${this.port}`);
        console.log(`API Key: ${this.apiKey}`);
      });
    }
  }

  getHttpsOptions() {
    const certPath = path.join(__dirname, 'certs');
    
    try {
      return {
        key: fs.readFileSync(path.join(certPath, 'server.key')),
        cert: fs.readFileSync(path.join(certPath, 'server.cert'))
      };
    } catch (error) {
      console.log('HTTPS certificates not found, using HTTP');
      return null;
    }
  }
}

// Start server
const server = new EnterpriseMonitoringServer();
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.db.close();
  process.exit(0);
});