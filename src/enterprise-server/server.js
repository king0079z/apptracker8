// enterprise-server/server.js - Enterprise Monitoring Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/software-monitor', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schema
const UsageDataSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  department: { type: String, required: true },
  hostname: String,
  platform: String,
  timestamp: { type: Date, default: Date.now },
  applications: Object,
  plugins: Object,
  costs: Object,
  systemInfo: Object
});

const UsageData = mongoose.model('UsageData', UsageDataSchema);

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKeys = (process.env.API_KEYS || '').split(',');
  
  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Routes

// Receive usage data from clients
app.post('/api/usage-data', validateApiKey, async (req, res) => {
  try {
    const { clientId, department, hostname, platform, data } = req.body;
    
    // Save or update usage data
    await UsageData.findOneAndUpdate(
      { clientId },
      {
        clientId,
        department,
        hostname,
        platform,
        timestamp: new Date(),
        applications: data.applications,
        plugins: data.plugins,
        costs: data.costs,
        systemInfo: data.systemInfo
      },
      { upsert: true, new: true }
    );
    
    console.log(`Received data from ${clientId} (${department})`);
    res.json({ success: true, message: 'Data received successfully' });
  } catch (error) {
    console.error('Error saving usage data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get enterprise summary
app.get('/api/reports/summary', validateApiKey, async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    
    const query = {};
    if (department) query.department = department;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const data = await UsageData.find(query);
    
    // Calculate summary
    const summary = {
      totalClients: new Set(data.map(d => d.clientId)).size,
      departments: [...new Set(data.map(d => d.department))],
      totalApplications: 0,
      totalPlugins: 0,
      mostUsedApplications: {},
      mostUsedPlugins: {},
      totalCost: 0,
      lastUpdate: data.length > 0 ? Math.max(...data.map(d => d.timestamp)) : null
    };
    
    // Aggregate usage data
    data.forEach(record => {
      // Count applications
      if (record.applications) {
        Object.entries(record.applications).forEach(([app, usage]) => {
          if (!summary.mostUsedApplications[app]) {
            summary.mostUsedApplications[app] = {
              totalUsage: 0,
              users: new Set(),
              cost: 0
            };
          }
          summary.mostUsedApplications[app].totalUsage += usage.totalUsage || 0;
          summary.mostUsedApplications[app].users.add(record.clientId);
          
          // Add cost
          if (record.costs?.applications?.[app]) {
            summary.mostUsedApplications[app].cost = record.costs.applications[app];
            summary.totalCost += record.costs.applications[app];
          }
        });
        summary.totalApplications = Object.keys(summary.mostUsedApplications).length;
      }
      
      // Count plugins
      if (record.plugins) {
        Object.entries(record.plugins).forEach(([vendor, products]) => {
          Object.entries(products).forEach(([product, data]) => {
            const key = `${vendor} - ${product}`;
            if (!summary.mostUsedPlugins[key]) {
              summary.mostUsedPlugins[key] = {
                totalUsage: 0,
                users: new Set(),
                cost: 0
              };
            }
            
            if (data.totalUsage !== undefined) {
              summary.mostUsedPlugins[key].totalUsage += data.totalUsage || 0;
              summary.mostUsedPlugins[key].users.add(record.clientId);
              if (data.cost) {
                summary.mostUsedPlugins[key].cost = data.cost;
                summary.totalCost += data.cost;
              }
            }
          });
        });
        summary.totalPlugins = Object.keys(summary.mostUsedPlugins).length;
      }
    });
    
    // Convert Sets to counts
    Object.values(summary.mostUsedApplications).forEach(app => {
      app.userCount = app.users.size;
      delete app.users;
    });
    Object.values(summary.mostUsedPlugins).forEach(plugin => {
      plugin.userCount = plugin.users.size;
      delete plugin.users;
    });
    
    res.json(summary);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get savings opportunities
app.get('/api/reports/savings', validateApiKey, async (req, res) => {
  try {
    const { threshold = 30 } = req.query; // Days of inactivity
    const data = await UsageData.find({});
    
    const savings = {
      unusedApplications: [],
      unusedPlugins: [],
      totalPotentialSavings: 0,
      recommendations: []
    };
    
    // Analyze each client's data
    data.forEach(record => {
      // Check applications
      if (record.applications) {
        Object.entries(record.applications).forEach(([app, usage]) => {
          const lastUsed = usage.lastUsed ? new Date(usage.lastUsed) : null;
          const daysInactive = lastUsed ? 
            Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24)) : 
            Infinity;
          
          if (daysInactive > threshold) {
            const cost = record.costs?.applications?.[app] || 50;
            savings.unusedApplications.push({
              application: app,
              clientId: record.clientId,
              department: record.department,
              daysInactive,
              monthlyCost: cost,
              lastUsed: usage.lastUsed
            });
            savings.totalPotentialSavings += cost;
          }
        });
      }
      
      // Check plugins
      if (record.plugins) {
        Object.entries(record.plugins).forEach(([vendor, products]) => {
          Object.entries(products).forEach(([product, data]) => {
            if (data.lastUsed !== undefined) {
              const lastUsed = data.lastUsed ? new Date(data.lastUsed) : null;
              const daysInactive = lastUsed ? 
                Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24)) : 
                Infinity;
              
              if (daysInactive > threshold) {
                const cost = data.cost || 25;
                savings.unusedPlugins.push({
                  plugin: product,
                  vendor,
                  clientId: record.clientId,
                  department: record.department,
                  daysInactive,
                  monthlyCost: cost,
                  lastUsed: data.lastUsed
                });
                savings.totalPotentialSavings += cost;
              }
            }
          });
        });
      }
    });
    
    // Generate recommendations
    const appCounts = {};
    savings.unusedApplications.forEach(item => {
      if (!appCounts[item.application]) appCounts[item.application] = 0;
      appCounts[item.application]++;
    });
    
    Object.entries(appCounts).forEach(([app, count]) => {
      if (count > 1) {
        savings.recommendations.push({
          type: 'bulk_removal',
          software: app,
          affectedUsers: count,
          message: `${app} is unused by ${count} users - consider enterprise-wide removal`
        });
      }
    });
    
    res.json(savings);
  } catch (error) {
    console.error('Error calculating savings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get department breakdown
app.get('/api/reports/departments', validateApiKey, async (req, res) => {
  try {
    const data = await UsageData.find({});
    const departments = {};
    
    data.forEach(record => {
      if (!departments[record.department]) {
        departments[record.department] = {
          clients: new Set(),
          totalCost: 0,
          applications: {},
          plugins: {}
        };
      }
      
      departments[record.department].clients.add(record.clientId);
      
      // Calculate costs
      if (record.costs?.applications) {
        Object.values(record.costs.applications).forEach(cost => {
          departments[record.department].totalCost += cost;
        });
      }
      
      // Count software
      if (record.applications) {
        Object.keys(record.applications).forEach(app => {
          departments[record.department].applications[app] = 
            (departments[record.department].applications[app] || 0) + 1;
        });
      }
    });
    
    // Convert sets to counts
    Object.keys(departments).forEach(dept => {
      departments[dept].clientCount = departments[dept].clients.size;
      delete departments[dept].clients;
    });
    
    res.json(departments);
  } catch (error) {
    console.error('Error getting department data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Web dashboard (optional)
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Software Monitor - Enterprise Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
          code { background: #e0e0e0; padding: 2px 5px; }
        </style>
      </head>
      <body>
        <h1>Software Monitor - Enterprise Server</h1>
        <p>Enterprise monitoring server is running.</p>
        
        <h2>API Endpoints:</h2>
        <div class="endpoint">
          <strong>POST /api/usage-data</strong> - Receive client usage data
        </div>
        <div class="endpoint">
          <strong>GET /api/reports/summary</strong> - Enterprise usage summary
        </div>
        <div class="endpoint">
          <strong>GET /api/reports/savings</strong> - Potential savings report
        </div>
        <div class="endpoint">
          <strong>GET /api/reports/departments</strong> - Department breakdown
        </div>
        
        <p>All endpoints require <code>X-API-Key</code> header.</p>
      </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Enterprise monitoring server running on port ${PORT}`);
  console.log(`MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});