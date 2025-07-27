// enterprise-server/server.js - Main Enterprise Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/software-monitor', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schemas
const UsageDataSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  hostname: String,
  platform: String,
  timestamp: { type: Date, default: Date.now, index: true },
  data: {
    applications: Object,
    plugins: Object,
    costs: Object,
    systemInfo: Object
  }
});

const AggregatedDataSchema = new mongoose.Schema({
  department: { type: String, index: true },
  date: { type: Date, index: true },
  summary: {
    totalApplications: Number,
    activeApplications: Number,
    totalPlugins: Number,
    activePlugins: Number,
    totalCost: Number,
    totalUsageHours: Number,
    topApplications: Array,
    topPlugins: Array,
    unusedLicenses: Array
  }
});

const UsageData = mongoose.model('UsageData', UsageDataSchema);
const AggregatedData = mongoose.model('AggregatedData', AggregatedDataSchema);

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Receive usage data from clients
app.post('/api/usage-data', async (req, res) => {
  try {
    const { clientId, department, hostname, platform, timestamp, data } = req.body;
    
    // Validate API key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Save usage data
    const usageData = new UsageData({
      clientId,
      department,
      hostname,
      platform,
      timestamp: new Date(timestamp),
      data
    });
    
    await usageData.save();
    
    // Trigger aggregation for this department
    setTimeout(() => aggregateDepartmentData(department), 1000);
    
    res.json({ success: true, id: usageData._id });
  } catch (error) {
    console.error('Error saving usage data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get enterprise summary
app.get('/api/reports/summary', async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    const query = {};
    if (department) query.department = department;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const data = await UsageData.find(query).sort('-timestamp').limit(1000);
    
    // Calculate summary
    const summary = calculateEnterpriseSummary(data);
    
    res.json(summary);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cost analysis
app.get('/api/reports/costs', async (req, res) => {
  try {
    const { department, groupBy = 'department' } = req.query;
    
    const pipeline = [
      { $match: department ? { department } : {} },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: {
            clientId: '$clientId',
            department: '$department'
          },
          latestData: { $first: '$data' }
        }
      }
    ];
    
    const results = await UsageData.aggregate(pipeline);
    
    const costAnalysis = calculateCostAnalysis(results, groupBy);
    
    res.json(costAnalysis);
  } catch (error) {
    console.error('Error generating cost analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unused licenses
app.get('/api/reports/unused', async (req, res) => {
  try {
    const { threshold = 30 } = req.query; // Days
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - threshold);
    
    const pipeline = [
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$clientId',
          latestData: { $first: '$data' },
          department: { $first: '$department' }
        }
      }
    ];
    
    const results = await UsageData.aggregate(pipeline);
    
    const unusedLicenses = findUnusedLicenses(results, thresholdDate);
    
    res.json(unusedLicenses);
  } catch (error) {
    console.error('Error finding unused licenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get department details
app.get('/api/departments/:department', async (req, res) => {
  try {
    const { department } = req.params;
    
    // Get latest data for all clients in department
    const clients = await UsageData.aggregate([
      { $match: { department } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$clientId',
          latestData: { $first: '$$ROOT' }
        }
      }
    ]);
    
    res.json({
      department,
      totalClients: clients.length,
      clients: clients.map(c => ({
        clientId: c.latestData.clientId,
        hostname: c.latestData.hostname,
        lastSync: c.latestData.timestamp,
        platform: c.latestData.platform
      }))
    });
  } catch (error) {
    console.error('Error getting department details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function calculateEnterpriseSummary(data) {
  const summary = {
    totalClients: new Set(data.map(d => d.clientId)).size,
    departments: [...new Set(data.map(d => d.department))],
    totalApplications: 0,
    totalPlugins: 0,
    totalMonthlyCost: 0,
    topApplications: {},
    topPlugins: {},
    platformBreakdown: {}
  };
  
  // Aggregate data
  data.forEach(record => {
    if (record.data.applications) {
      Object.entries(record.data.applications).forEach(([app, usage]) => {
        if (!summary.topApplications[app]) {
          summary.topApplications[app] = { 
            totalUsage: 0, 
            userCount: new Set(),
            cost: record.data.costs?.applications?.[app] || 0
          };
        }
        summary.topApplications[app].totalUsage += usage.totalUsage || 0;
        summary.topApplications[app].userCount.add(record.clientId);
      });
    }
    
    // Count platforms
    summary.platformBreakdown[record.platform] = 
      (summary.platformBreakdown[record.platform] || 0) + 1;
  });
  
  // Calculate totals
  summary.totalApplications = Object.keys(summary.topApplications).length;
  
  // Convert sets to counts
  Object.keys(summary.topApplications).forEach(app => {
    const appData = summary.topApplications[app];
    summary.totalMonthlyCost += appData.cost * appData.userCount.size;
    summary.topApplications[app].userCount = appData.userCount.size;
  });
  
  // Sort and limit top applications
  summary.topApplications = Object.entries(summary.topApplications)
    .sort((a, b) => b[1].totalUsage - a[1].totalUsage)
    .slice(0, 10)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
  
  return summary;
}

function calculateCostAnalysis(results, groupBy) {
  const analysis = {
    totalMonthlyCost: 0,
    totalAnnualCost: 0,
    byDepartment: {},
    byApplication: {},
    potentialSavings: 0
  };
  
  results.forEach(({ _id, latestData }) => {
    const dept = _id.department;
    if (!analysis.byDepartment[dept]) {
      analysis.byDepartment[dept] = {
        monthlyCost: 0,
        applications: {},
        plugins: {},
        clientCount: 0
      };
    }
    
    analysis.byDepartment[dept].clientCount++;
    
    // Calculate application costs
    if (latestData.applications) {
      Object.entries(latestData.applications).forEach(([app, usage]) => {
        const cost = latestData.costs?.applications?.[app] || 50;
        analysis.byDepartment[dept].monthlyCost += cost;
        analysis.totalMonthlyCost += cost;
        
        if (!analysis.byApplication[app]) {
          analysis.byApplication[app] = {
            totalLicenses: 0,
            activeLicenses: 0,
            monthlyCost: cost,
            departments: new Set()
          };
        }
        
        analysis.byApplication[app].totalLicenses++;
        if (usage.lastUsed && new Date(usage.lastUsed) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
          analysis.byApplication[app].activeLicenses++;
        }
        analysis.byApplication[app].departments.add(dept);
      });
    }
  });
  
  // Calculate potential savings
  Object.values(analysis.byApplication).forEach(app => {
    const unusedLicenses = app.totalLicenses - app.activeLicenses;
    analysis.potentialSavings += unusedLicenses * app.monthlyCost;
  });
  
  analysis.totalAnnualCost = analysis.totalMonthlyCost * 12;
  
  // Convert sets to arrays
  Object.keys(analysis.byApplication).forEach(app => {
    analysis.byApplication[app].departments = Array.from(analysis.byApplication[app].departments);
  });
  
  return analysis;
}

function findUnusedLicenses(results, thresholdDate) {
  const unused = [];
  
  results.forEach(({ _id, latestData, department }) => {
    // Check applications
    if (latestData.applications) {
      Object.entries(latestData.applications).forEach(([app, usage]) => {
        if (!usage.lastUsed || new Date(usage.lastUsed) < thresholdDate) {
          unused.push({
            type: 'application',
            name: app,
            clientId: _id,
            department,
            lastUsed: usage.lastUsed,
            totalUsage: usage.totalUsage,
            monthlyCost: latestData.costs?.applications?.[app] || 50
          });
        }
      });
    }
    
    // Check plugins
    if (latestData.plugins) {
      Object.entries(latestData.plugins).forEach(([vendor, products]) => {
        Object.entries(products).forEach(([product, data]) => {
          if (data.totalUsage !== undefined) {
            if (!data.lastUsed || new Date(data.lastUsed) < thresholdDate) {
              unused.push({
                type: 'plugin',
                name: product,
                vendor,
                clientId: _id,
                department,
                lastUsed: data.lastUsed,
                totalUsage: data.totalUsage,
                monthlyCost: data.cost || 25
              });
            }
          }
        });
      });
    }
  });
  
  return unused;
}

// Aggregation job
async function aggregateDepartmentData(department) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const data = await UsageData.find({
      department,
      timestamp: { $gte: today }
    });
    
    if (data.length > 0) {
      const summary = calculateEnterpriseSummary(data);
      
      await AggregatedData.findOneAndUpdate(
        { department, date: today },
        { summary },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error('Error aggregating data:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Enterprise Monitor Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Set up periodic aggregation
  setInterval(() => {
    console.log('Running periodic aggregation...');
    // Aggregate all departments
    UsageData.distinct('department').then(departments => {
      departments.forEach(dept => aggregateDepartmentData(dept));
    });
  }, 60 * 60 * 1000); // Every hour
});

module.exports = app;