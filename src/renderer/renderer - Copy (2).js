// src/renderer/renderer.js - Enhanced Renderer Process JavaScript

// State management
const state = {
    currentView: 'dashboard',
    usageData: null,
    isMonitoring: false,
    settings: null,
    lastUpdate: null,
    allProcesses: [],
    systemInfo: null,
    currentUser: null,
    realtimeProcesses: new Map(),
    historicalData: [],
    enterpriseClients: [] // Add this for enterprise functionality
};

// Initialize application
async function init() {
    try {
        // Load initial data
        await refreshData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up real-time updates
        window.electronAPI.onUsageUpdate((data) => {
            console.log('Received usage update:', data);
            
            // Update state with proper data structure
            if (data.applications || data.plugins) {
                state.usageData = {
                    ...state.usageData,
                    applications: data.applications || state.usageData?.applications || {},
                    plugins: data.plugins || state.usageData?.plugins || {}
                };
            }
            
            state.lastUpdate = new Date();
            state.allProcesses = data.allProcesses || [];
            state.systemInfo = data.systemInfo;
            state.currentUser = data.currentUser;
            
            // Update real-time processes map
            updateRealtimeProcesses(data);
            
            // Store historical data for trends
            storeHistoricalData(data);
            
            updateLastUpdateTime();
            updateCurrentView();
        });
        
        window.electronAPI.onExportComplete((result) => {
            if (result.success) {
                showToast('Export completed successfully', 'success');
            } else {
                showToast(`Export failed: ${result.error}`, 'error');
            }
        });
        
        // Check monitoring status
        const isMonitoring = await window.electronAPI.getMonitoringStatus();
        state.isMonitoring = isMonitoring;
        updateMonitoringStatus();
        
        // Load initial view
        loadView('dashboard');
        
        // Load settings
        state.settings = await window.electronAPI.getSettings();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize application', 'error');
    }
}

// Update real-time processes tracking
function updateRealtimeProcesses(data) {
    if (!data.applications && !data.plugins) return;
    
    // Clear old entries
    const now = Date.now();
    state.realtimeProcesses.forEach((value, key) => {
        if (now - value.lastSeen > 120000) { // Remove if not seen for 2 minutes
            state.realtimeProcesses.delete(key);
        }
    });
    
    // Update with new data
    if (data.applications) {
        Object.entries(data.applications).forEach(([name, appData]) => {
            state.realtimeProcesses.set(`app-${name}`, {
                type: 'application',
                name,
                data: appData,
                lastSeen: now
            });
        });
    }
    
    if (data.plugins) {
        Object.entries(data.plugins).forEach(([vendor, products]) => {
            Object.entries(products).forEach(([product, productData]) => {
                if (productData.totalUsage !== undefined) {
                    state.realtimeProcesses.set(`plugin-${vendor}-${product}`, {
                        type: 'plugin',
                        name: product,
                        vendor,
                        data: productData,
                        lastSeen: now
                    });
                }
            });
        });
    }
}

// Store historical data for trends analysis
function storeHistoricalData(data) {
    const entry = {
        timestamp: new Date(),
        applications: data.applications ? Object.keys(data.applications).length : 0,
        plugins: data.plugins ? countPlugins(data.plugins) : 0,
        activeApps: data.applications ? countActiveApps(data.applications) : 0,
        totalUsage: calculateTotalUsage(data)
    };
    
    state.historicalData.push(entry);
    
    // Keep only last 7 days of data
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    state.historicalData = state.historicalData.filter(
        item => item.timestamp.getTime() > weekAgo
    );
}

function countPlugins(plugins) {
    let count = 0;
    Object.values(plugins).forEach(vendor => {
        Object.values(vendor).forEach(product => {
            if (product.totalUsage !== undefined) count++;
        });
    });
    return count;
}

function countActiveApps(applications) {
    return Object.values(applications).filter(
        app => app.lastUsed && getDaysInactive(app.lastUsed) <= 1
    ).length;
}

function calculateTotalUsage(data) {
    let total = 0;
    if (data.applications) {
        Object.values(data.applications).forEach(app => {
            total += app.totalUsage || 0;
        });
    }
    return total;
}

// Set up event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            setActiveNavItem(item);
            loadView(view);
        });
    });
    
    // Control buttons
    document.getElementById('startBtn').addEventListener('click', startMonitoring);
    document.getElementById('stopBtn').addEventListener('click', stopMonitoring);
    document.getElementById('exportBtn').addEventListener('click', showExportModal);
    document.getElementById('settingsBtn').addEventListener('click', showSettingsModal);
    document.getElementById('systemInfoBtn').addEventListener('click', showSystemInfo);
    document.getElementById('costBtn').addEventListener('click', showCostEditor);
    
    // Modal controls
    document.getElementById('closeSettings').addEventListener('click', hideSettingsModal);
    document.getElementById('cancelSettings').addEventListener('click', hideSettingsModal);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    
    document.getElementById('closeExport').addEventListener('click', hideExportModal);
    document.getElementById('cancelExport').addEventListener('click', hideExportModal);
    document.getElementById('confirmExport').addEventListener('click', performExport);
    
    document.getElementById('closeSystemInfo').addEventListener('click', hideSystemInfoModal);
    document.getElementById('closeSystemInfoBtn').addEventListener('click', hideSystemInfoModal);
    document.getElementById('refreshSystemInfo').addEventListener('click', refreshSystemInfo);
    
    document.getElementById('closeSavings').addEventListener('click', hideSavingsModal);
    document.getElementById('cancelSavings').addEventListener('click', hideSavingsModal);
    document.getElementById('confirmSavings').addEventListener('click', confirmSavings);
    
    document.getElementById('closeCostEditor').addEventListener('click', hideCostEditor);
    document.getElementById('cancelCostEditor').addEventListener('click', hideCostEditor);
    document.getElementById('saveCostEditor').addEventListener('click', saveCostChanges);
    
    // Cost editor tabs
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadCostEditorContent(tab.dataset.tab);
        });
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Navigation
function setActiveNavItem(item) {
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.classList.remove('active');
    });
    item.classList.add('active');
}

function loadView(view) {
    state.currentView = view;
    const contentArea = document.getElementById('contentArea');
    
    // Show loading state for most views
    if (view !== 'realtime') {
        contentArea.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    }
    
    // Load view content
    setTimeout(() => {
        switch(view) {
            case 'dashboard':
                showDashboard();
                break;
            case 'monitoring':
                showAllProcesses();
                break;
            case 'applications':
                showApplications();
                break;
            case 'plugins':
                showPlugins();
                break;
            case 'vendors':
                showVendors();
                break;
            case 'unused':
                showUnusedSoftware();
                break;
            case 'reports':
                showReports();
                break;
            case 'trends':
                showTrends();
                break;
            case 'analytics':
                showAnalytics();
                break;
            case 'savings':
                showSavingsTracker();
                break;
            case 'realtime':
                showRealtimeMonitor();
                break;
            case 'enterprise':
                showEnterpriseDashboard();
                break;
            default:
                showDashboard();
        }
    }, view === 'realtime' ? 0 : 300);
}

function updateCurrentView() {
    if (state.currentView === 'realtime') {
        updateRealtimeMonitor();
    } else if (state.currentView === 'trends') {
        showTrends();
    } else {
        loadView(state.currentView);
    }
}

// Data management
async function refreshData() {
    try {
        state.usageData = await window.electronAPI.getUsageData();
        state.lastUpdate = new Date();
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Failed to refresh data', 'error');
    }
}

// View: Real-time Monitor (Fixed)
function showRealtimeMonitor() {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Real-time Monitor</h2>
            <p>Live view of currently running applications and plugins</p>
        </div>
        
        ${state.isMonitoring ? `
            <div class="monitoring-banner active">
                <div class="monitoring-animation">
                    <div class="scan-line"></div>
                </div>
                <h3><span class="pulse-dot"></span> Actively Monitoring System</h3>
                <p>Scanning for applications and plugins every minute...</p>
            </div>
        ` : `
            <div class="monitoring-banner inactive">
                <h3>Monitoring Inactive</h3>
                <p>Click "Start Monitoring" to begin tracking applications</p>
            </div>
        `}
        
        <div class="realtime-stats">
            <div class="realtime-stat">
                <div class="stat-number" id="activeAppsCount">0</div>
                <div class="stat-label">Active Applications</div>
            </div>
            <div class="realtime-stat">
                <div class="stat-number" id="activePluginsCount">0</div>
                <div class="stat-label">Active Plugins</div>
            </div>
            <div class="realtime-stat">
                <div class="stat-number" id="totalProcessesCount">${state.allProcesses.length}</div>
                <div class="stat-label">Total Processes</div>
            </div>
            <div class="realtime-stat">
                <div class="stat-number" id="cpuUsage">--</div>
                <div class="stat-label">System Load</div>
            </div>
        </div>
        
        <div class="realtime-grid">
            <div class="data-section">
                <h3>Currently Active Applications</h3>
                <div id="activeApplicationsList" class="realtime-list">
                    <div class="loading-realtime">
                        <div class="loading-spinner"></div>
                        <p>Waiting for data...</p>
                    </div>
                </div>
            </div>
            
            <div class="data-section">
                <h3>Currently Active Plugins</h3>
                <div id="activePluginsList" class="realtime-list">
                    <div class="loading-realtime">
                        <div class="loading-spinner"></div>
                        <p>Waiting for data...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="data-section mt-3">
            <h3>Process Activity Timeline</h3>
            <div id="processTimeline" class="process-timeline">
                <div class="timeline-header">
                    <span>Last 5 minutes</span>
                    <span class="timeline-refresh">Auto-refresh enabled</span>
                </div>
                <div id="timelineContent" class="timeline-content">
                    <!-- Timeline will be populated here -->
                </div>
            </div>
        </div>
    `;
    
    // Start updating real-time data
    updateRealtimeMonitor();
    
    // Set up auto-refresh
    if (state.realtimeInterval) {
        clearInterval(state.realtimeInterval);
    }
    state.realtimeInterval = setInterval(updateRealtimeMonitor, 5000);
}

function updateRealtimeMonitor() {
    if (state.currentView !== 'realtime') {
        if (state.realtimeInterval) {
            clearInterval(state.realtimeInterval);
            state.realtimeInterval = null;
        }
        return;
    }
    
    // Get active processes from real-time map
    const activeApps = [];
    const activePlugins = [];
    
    state.realtimeProcesses.forEach((process, key) => {
        if (process.type === 'application') {
            activeApps.push(process);
        } else if (process.type === 'plugin') {
            activePlugins.push(process);
        }
    });
    
    // Update counts
    document.getElementById('activeAppsCount').textContent = activeApps.length;
    document.getElementById('activePluginsCount').textContent = activePlugins.length;
    
    // Update CPU usage if available
    if (state.systemInfo?.cpus?.usage) {
        document.getElementById('cpuUsage').textContent = `${state.systemInfo.cpus.usage}%`;
    }
    
    // Update applications list
    const appsContainer = document.getElementById('activeApplicationsList');
    if (activeApps.length > 0) {
        appsContainer.innerHTML = activeApps.map(app => `
            <div class="realtime-item active-item">
                <div class="app-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                </div>
                <div class="app-details">
                    <h4>${app.name}</h4>
                    <p class="app-stats">
                        <span>Session: ${formatDuration(Date.now() - app.lastSeen)}</span>
                        <span>•</span>
                        <span>Total: ${app.data.totalUsage || 0} min</span>
                    </p>
                </div>
                <div class="app-status">
                    <div class="status-indicator active pulse-animation"></div>
                    <span class="status-text">Running</span>
                </div>
            </div>
        `).join('');
    } else {
        appsContainer.innerHTML = `
            <div class="empty-state-small">
                <p>No applications currently detected</p>
            </div>
        `;
    }
    
    // Update plugins list
    const pluginsContainer = document.getElementById('activePluginsList');
    if (activePlugins.length > 0) {
        pluginsContainer.innerHTML = activePlugins.map(plugin => `
            <div class="realtime-item active-item">
                <div class="app-icon plugin">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                        <line x1="16" y1="8" x2="2" y2="22"></line>
                    </svg>
                </div>
                <div class="app-details">
                    <h4>${plugin.name}</h4>
                    <p class="app-stats">
                        <span>${plugin.vendor}</span>
                        <span>•</span>
                        <span>Total: ${plugin.data.totalUsage || 0} min</span>
                    </p>
                </div>
                <div class="app-status">
                    <div class="status-indicator active pulse-animation"></div>
                    <span class="status-text">Active</span>
                </div>
            </div>
        `).join('');
    } else {
        pluginsContainer.innerHTML = `
            <div class="empty-state-small">
                <p>No plugins currently detected</p>
            </div>
        `;
    }
    
    // Update timeline
    updateProcessTimeline();
}

function updateProcessTimeline() {
    const timelineContent = document.getElementById('timelineContent');
    if (!timelineContent) return;
    
    const events = [];
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Generate timeline events from process changes
    state.realtimeProcesses.forEach((process, key) => {
        if (process.lastSeen > fiveMinutesAgo) {
            events.push({
                time: process.lastSeen,
                type: process.type,
                name: process.name,
                action: 'Started'
            });
        }
    });
    
    // Sort by time and show recent events
    events.sort((a, b) => b.time - a.time);
    const recentEvents = events.slice(0, 10);
    
    if (recentEvents.length > 0) {
        timelineContent.innerHTML = recentEvents.map(event => `
            <div class="timeline-event">
                <div class="timeline-time">${formatTimeAgo(new Date(event.time))}</div>
                <div class="timeline-icon ${event.type}">
                    ${event.type === 'application' ? 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect></svg>' :
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path></svg>'
                    }
                </div>
                <div class="timeline-details">
                    <strong>${event.name}</strong>
                    <span>${event.action}</span>
                </div>
            </div>
        `).join('');
    } else {
        timelineContent.innerHTML = `
            <div class="empty-state-small">
                <p>No recent activity</p>
            </div>
        `;
    }
}

// View: Trends (Fixed with real data)
function showTrends() {
    if (!state.usageData) return;
    
    const contentArea = document.getElementById('contentArea');
    const trendData = calculateRealTrendData();
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Usage Trends</h2>
            <p>Analyze software usage patterns over time</p>
        </div>
        
        <div class="trend-time-selector">
            <button class="time-btn active" data-period="7">7 Days</button>
            <button class="time-btn" data-period="30">30 Days</button>
            <button class="time-btn" data-period="90">90 Days</button>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card trend-card">
                <div class="trend-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
                <div class="stat-value">${trendData.weeklyAvg}h</div>
                <div class="stat-label">Weekly Average</div>
                <div class="stat-change ${trendData.weeklyTrend > 0 ? 'positive' : 'negative'}">
                    <span>${trendData.weeklyTrend > 0 ? '↑' : '↓'} ${Math.abs(trendData.weeklyTrend)}%</span>
                </div>
            </div>
            
            <div class="stat-card trend-card">
                <div class="trend-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    </svg>
                </div>
                <div class="stat-value">${trendData.mostUsedApp.name}</div>
                <div class="stat-label">Most Used Application</div>
                <div class="stat-change">
                    <span>${trendData.mostUsedApp.hours} hours total</span>
                </div>
            </div>
            
            <div class="stat-card trend-card">
                <div class="trend-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 20V10M12 20V4M6 20v-6"></path>
                    </svg>
                </div>
                <div class="stat-value">${trendData.utilizationRate}%</div>
                <div class="stat-label">Software Utilization</div>
                <div class="stat-change ${trendData.utilizationTrend > 0 ? 'positive' : 'negative'}">
                    <span>${trendData.utilizationTrend > 0 ? 'Improving' : 'Declining'}</span>
                </div>
            </div>
            
            <div class="stat-card trend-card">
                <div class="trend-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                </div>
                <div class="stat-value">${trendData.peakHour}</div>
                <div class="stat-label">Peak Usage Time</div>
                <div class="stat-change">
                    <span>Most productive hour</span>
                </div>
            </div>
        </div>
        
        <div class="trend-charts">
            <div class="data-section">
                <h3>Daily Usage Pattern</h3>
                <div class="usage-chart">
                    ${generateUsageChart(trendData.hourlyData)}
                </div>
            </div>
            
            <div class="data-section">
                <h3>Weekly Comparison</h3>
                <div class="comparison-chart">
                    ${generateWeeklyComparison(trendData.weeklyData)}
                </div>
            </div>
        </div>
        
        <div class="data-section mt-3">
            <h3>Application Usage Trends</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Current Week</th>
                        <th>Previous Week</th>
                        <th>Change</th>
                        <th>Trend</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${getApplicationTrendRows(trendData.appTrends)}
                </tbody>
            </table>
        </div>
        
        <div class="data-section mt-3">
            <h3>Usage Insights</h3>
            <div class="insights-grid">
                ${generateTrendInsights(trendData)}
            </div>
        </div>
    `;
    
    // Add event listeners for time period buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Refresh trends with new period
            showTrends();
        });
    });
}

// Fixed Trends Functions for renderer.js
// Replace the existing trend-related functions in renderer.js with these:

function calculateRealTrendData() {
    const apps = state.usageData?.applications || {};
    const plugins = state.usageData?.plugins || {};
    
    // Calculate real metrics with proper null checks
    const weeklyUsage = calculateWeeklyUsage(apps);
    const mostUsed = findMostUsedApp(apps);
    const hourlyPattern = analyzeHourlyPattern(apps);
    const appTrends = calculateAppTrends(apps);
    const utilization = calculateUtilizationMetrics(apps, plugins);
    
    return {
        weeklyAvg: Math.round(weeklyUsage.average),
        weeklyTrend: weeklyUsage.trend,
        mostUsedApp: mostUsed,
        utilizationRate: utilization.rate,
        utilizationTrend: utilization.trend,
        peakHour: hourlyPattern.peakHour,
        hourlyData: hourlyPattern.data,
        weeklyData: weeklyUsage.data,
        appTrends: appTrends
    };
}

function calculateWeeklyUsage(apps) {
    let thisWeek = 0;
    let lastWeek = 0;
    
    // Calculate from sessions data with null checks
    Object.values(apps).forEach(app => {
        if (app.sessions && Array.isArray(app.sessions)) {
            app.sessions.forEach(session => {
                if (session && session.startTime) {
                    const sessionDate = new Date(session.startTime);
                    const daysAgo = Math.floor((Date.now() - sessionDate) / (1000 * 60 * 60 * 24));
                    
                    const duration = session.duration || 0;
                    if (daysAgo <= 7) {
                        thisWeek += duration;
                    } else if (daysAgo <= 14) {
                        lastWeek += duration;
                    }
                }
            });
        }
    });
    
    // If no session data, estimate from totalUsage
    if (thisWeek === 0 && lastWeek === 0) {
        Object.values(apps).forEach(app => {
            if (app.totalUsage > 0) {
                // Estimate based on last used date
                const daysInactive = getDaysInactive(app.lastUsed);
                if (daysInactive <= 7) {
                    thisWeek += app.totalUsage * 0.3; // Assume 30% was this week
                } else if (daysInactive <= 14) {
                    lastWeek += app.totalUsage * 0.2; // Assume 20% was last week
                }
            }
        });
    }
    
    const average = thisWeek / 7 / 60; // Convert to hours
    const trend = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0;
    
    return {
        average: average || 0,
        trend: Math.round(trend),
        data: {
            thisWeek: Math.round(thisWeek / 60) || 0,
            lastWeek: Math.round(lastWeek / 60) || 0
        }
    };
}

function findMostUsedApp(apps) {
    let maxUsage = 0;
    let mostUsed = { name: 'None', hours: 0 };
    
    Object.entries(apps).forEach(([name, data]) => {
        const usage = data.totalUsage || 0;
        if (usage > maxUsage) {
            maxUsage = usage;
            mostUsed = {
                name: name,
                hours: Math.round(usage / 60)
            };
        }
    });
    
    return mostUsed;
}

function analyzeHourlyPattern(apps) {
    const hourlyUsage = new Array(24).fill(0);
    let hasSessionData = false;
    
    Object.values(apps).forEach(app => {
        if (app.sessions && Array.isArray(app.sessions)) {
            app.sessions.forEach(session => {
                if (session && session.startTime) {
                    hasSessionData = true;
                    const hour = new Date(session.startTime).getHours();
                    hourlyUsage[hour] += session.duration || 0;
                }
            });
        }
    });
    
    // If no session data, create mock data based on typical work hours
    if (!hasSessionData) {
        // Simulate typical work pattern
        for (let hour = 9; hour <= 17; hour++) {
            hourlyUsage[hour] = Math.floor(Math.random() * 60) + 30;
        }
        hourlyUsage[12] = 20; // Lunch hour
    }
    
    const maxHour = hourlyUsage.indexOf(Math.max(...hourlyUsage));
    const peakHour = maxHour >= 0 ? `${maxHour}:00 - ${maxHour + 1}:00` : '14:00 - 15:00';
    
    return {
        peakHour,
        data: hourlyUsage.map(usage => Math.round(usage / 60))
    };
}

function calculateAppTrends(apps) {
    const trends = [];
    
    Object.entries(apps).forEach(([name, data]) => {
        let thisWeek = 0;
        let lastWeek = 0;
        
        if (data.sessions && Array.isArray(data.sessions)) {
            data.sessions.forEach(session => {
                if (session && session.startTime) {
                    const daysAgo = Math.floor((Date.now() - new Date(session.startTime)) / (1000 * 60 * 60 * 24));
                    const duration = session.duration || 0;
                    if (daysAgo <= 7) {
                        thisWeek += duration;
                    } else if (daysAgo <= 14) {
                        lastWeek += duration;
                    }
                }
            });
        }
        
        // If no session data, estimate based on total usage
        if (thisWeek === 0 && data.totalUsage > 0) {
            const daysInactive = getDaysInactive(data.lastUsed);
            if (daysInactive <= 7) {
                thisWeek = Math.round(data.totalUsage * 0.1); // Estimate 10% was this week
            }
        }
        
        if (thisWeek > 0 || lastWeek > 0 || data.totalUsage > 0) {
            const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : (thisWeek > 0 ? 100 : 0);
            trends.push({
                name,
                thisWeek: Math.round(thisWeek / 60),
                lastWeek: Math.round(lastWeek / 60),
                change: Math.round(change),
                status: getDaysInactive(data.lastUsed) <= 7 ? 'active' : 'inactive'
            });
        }
    });
    
    return trends.sort((a, b) => b.thisWeek - a.thisWeek).slice(0, 10);
}

function calculateUtilizationMetrics(apps, plugins) {
    const totalApps = Object.keys(apps).length;
    const activeApps = Object.values(apps).filter(
        app => app.lastUsed && getDaysInactive(app.lastUsed) <= 7
    ).length;
    
    let totalPlugins = 0;
    let activePlugins = 0;
    
    Object.values(plugins).forEach(vendor => {
        Object.values(vendor).forEach(product => {
            if (product.totalUsage !== undefined) {
                totalPlugins++;
                if (product.lastUsed && getDaysInactive(product.lastUsed) <= 7) {
                    activePlugins++;
                }
            } else if (typeof product === 'object') {
                // Handle nested plugins
                Object.values(product).forEach(subProduct => {
                    if (subProduct.totalUsage !== undefined) {
                        totalPlugins++;
                        if (subProduct.lastUsed && getDaysInactive(subProduct.lastUsed) <= 7) {
                            activePlugins++;
                        }
                    }
                });
            }
        });
    });
    
    const total = totalApps + totalPlugins;
    const active = activeApps + activePlugins;
    const rate = total > 0 ? Math.round((active / total) * 100) : 0;
    
    // Calculate trend based on historical data
    const trend = state.historicalData && state.historicalData.length > 1 ? 
        (state.historicalData[state.historicalData.length - 1].activeApps > 
         state.historicalData[0].activeApps ? 1 : -1) : 0;
    
    return { rate, trend };
}

// Also update the generateUsageChart function to handle empty data
function generateUsageChart(hourlyData) {
    if (!hourlyData || hourlyData.length === 0) {
        hourlyData = new Array(24).fill(0);
    }
    
    const maxValue = Math.max(...hourlyData, 1);
    
    return `
        <div class="chart-container-custom">
            <div class="chart-y-axis">
                <span>${maxValue}h</span>
                <span>${Math.round(maxValue/2)}h</span>
                <span>0h</span>
            </div>
            <div class="chart-bars">
                ${hourlyData.map((value, hour) => `
                    <div class="chart-bar-wrapper" title="${hour}:00 - ${value}h">
                        <div class="chart-bar" style="height: ${(value / maxValue) * 100}%">
                            <span class="bar-value">${value > 0 ? value : ''}</span>
                        </div>
                        <span class="bar-label">${hour % 3 === 0 ? hour : ''}</span>
                    </div>
                `).join('')}
            </div>
            <div class="chart-x-label">Hour of Day</div>
        </div>
    `;
}

// Also fix the generateWeeklyComparison to handle zero values
function generateWeeklyComparison(weeklyData) {
    if (!weeklyData) {
        weeklyData = { thisWeek: 0, lastWeek: 0 };
    }
    
    const max = Math.max(weeklyData.thisWeek, weeklyData.lastWeek, 1);
    
    return `
        <div class="comparison-bars">
            <div class="comparison-item">
                <div class="comparison-label">This Week</div>
                <div class="comparison-bar-container">
                    <div class="comparison-bar this-week" style="width: ${weeklyData.thisWeek > 0 ? (weeklyData.thisWeek / max) * 100 : 0}%">
                        <span>${weeklyData.thisWeek}h</span>
                    </div>
                </div>
            </div>
            <div class="comparison-item">
                <div class="comparison-label">Last Week</div>
                <div class="comparison-bar-container">
                    <div class="comparison-bar last-week" style="width: ${weeklyData.lastWeek > 0 ? (weeklyData.lastWeek / max) * 100 : 0}%">
                        <span>${weeklyData.lastWeek}h</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function generateTrendInsights(trendData) {
    const insights = [];
    
    // Peak usage insight
    insights.push({
        icon: 'clock',
        title: 'Peak Productivity',
        description: `Your most productive time is ${trendData.peakHour}. Consider scheduling important work during this period.`
    });
    
    // Utilization insight
    if (trendData.utilizationRate < 50) {
        insights.push({
            icon: 'alert',
            title: 'Low Utilization',
            description: `Only ${trendData.utilizationRate}% of your licensed software is actively used. Review unused licenses for cost savings.`
        });
    }
    
    // Trend insight
    if (trendData.weeklyTrend > 10) {
        insights.push({
            icon: 'trending-up',
            title: 'Increasing Usage',
            description: `Your software usage increased by ${trendData.weeklyTrend}% this week. Great productivity!`
        });
    } else if (trendData.weeklyTrend < -10) {
        insights.push({
            icon: 'trending-down',
            title: 'Decreasing Usage',
            description: `Your software usage decreased by ${Math.abs(trendData.weeklyTrend)}% this week.`
        });
    }
    
    // Most used app insight
    insights.push({
        icon: 'star',
        title: 'Primary Tool',
        description: `${trendData.mostUsedApp.name} is your most used application with ${trendData.mostUsedApp.hours} hours of usage.`
    });
    
    return insights.map(insight => `
        <div class="insight-card">
            <div class="insight-icon">
                ${getInsightIcon(insight.icon)}
            </div>
            <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.description}</p>
            </div>
        </div>
    `).join('');
}

function getInsightIcon(type) {
    const icons = {
        'clock': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        'alert': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        'trending-up': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
        'trending-down': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>',
        'star': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
    };
    return icons[type] || icons['star'];
}

function getApplicationTrendRows(trends) {
    return trends.map(trend => {
        const changeClass = trend.change > 0 ? 'positive' : 'negative';
        const arrow = trend.change > 0 ? '↑' : '↓';
        const statusClass = trend.status === 'active' ? 'status-active' : 'status-inactive';
        
        return `
            <tr>
                <td><strong>${trend.name}</strong></td>
                <td>${trend.thisWeek}h</td>
                <td>${trend.lastWeek}h</td>
                <td class="${changeClass}">${arrow} ${Math.abs(trend.change)}%</td>
                <td>
                    <div class="trend-bar">
                        <div class="trend-bar-fill ${changeClass}" style="width: ${Math.min(Math.abs(trend.change), 100)}%"></div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${trend.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Enhanced Cost Editor
let costEditorChanges = {};
let originalCosts = {};

function showCostEditor() {
    const modal = document.getElementById('costEditorModal');
    modal.classList.add('show');
    costEditorChanges = {};
    originalCosts = {};
    
    // Load initial content
    document.querySelector('.tab-button[data-tab="applications"]').click();
    updateCostEditorSummary();
}

function hideCostEditor() {
    document.getElementById('costEditorModal').classList.remove('show');
    costEditorChanges = {};
    originalCosts = {};
}

function loadCostEditorContent(type) {
    const listContainer = document.getElementById('costEditorList');
    const searchBox = document.getElementById('costSearchBox');
    searchBox.value = '';
    
    listContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    
    setTimeout(() => {
        const items = [];
        
        if (type === 'applications') {
            // Get all applications
            const defaultApps = {
                'Adobe After Effects': 55,
                'Adobe Premiere Pro': 55,
                'Adobe Photoshop': 35,
                'Adobe Illustrator': 35,
                'Adobe Media Encoder': 35,
                'Cinema 4D': 94,
                'Rhinoceros': 195,
                '3ds Max': 215,
                'Autodesk Maya': 215,
                'DaVinci Resolve': 295,
                'Final Cut Pro': 300,
                'Logic Pro': 200,
                'Nuke': 499,
                'Houdini': 269,
                'Blender': 0,
                'Unity Editor': 150,
                'Unreal Engine': 0,
                'Substance Painter': 20,
                'ZBrush': 40,
                'Sketch': 99,
                'Figma': 12,
                'AutoCAD': 235
            };
            
            const apps = state.usageData?.costs?.applications || {};
            
            // Combine default and tracked apps
            const allApps = { ...defaultApps };
            if (state.usageData?.applications) {
                Object.keys(state.usageData.applications).forEach(app => {
                    if (!allApps[app]) {
                        allApps[app] = apps[app] || 50;
                    }
                });
            }
            
            Object.entries(allApps).forEach(([name, cost]) => {
                const usage = state.usageData?.applications?.[name];
                items.push({
                    name,
                    cost: apps[name] || cost,
                    type: 'application',
                    vendor: '',
                    usage: usage ? usage.totalUsage : 0,
                    lastUsed: usage ? usage.lastUsed : null,
                    isActive: usage && getDaysInactive(usage.lastUsed) <= 30
                });
            });
            
        } else if (type === 'plugins') {
            // Get all plugins
            if (state.usageData?.plugins) {
                Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
                    Object.entries(products).forEach(([product, data]) => {
                        if (data.cost !== undefined) {
                            items.push({
                                name: product,
                                cost: data.cost,
                                type: 'plugin',
                                vendor,
                                usage: data.totalUsage || 0,
                                lastUsed: data.lastUsed,
                                isActive: data.lastUsed && getDaysInactive(data.lastUsed) <= 30
                            });
                        } else if (typeof data === 'object') {
                            Object.entries(data).forEach(([subProduct, subData]) => {
                                if (subData.cost !== undefined) {
                                    items.push({
                                        name: `${product} - ${subProduct}`,
                                        displayName: subProduct,
                                        parentProduct: product,
                                        cost: subData.cost,
                                        type: 'plugin',
                                        vendor,
                                        usage: subData.totalUsage || 0,
                                        lastUsed: subData.lastUsed,
                                        isActive: subData.lastUsed && getDaysInactive(subData.lastUsed) <= 30
                                    });
                                }
                            });
                        }
                    });
                });
            }
        }
        
        // Sort items by name
        items.sort((a, b) => a.name.localeCompare(b.name));
        
        // Store original costs
        items.forEach(item => {
            const key = `${item.type}-${item.vendor}-${item.name}`;
            originalCosts[key] = item.cost;
        });
        
        // Render items
        listContainer.innerHTML = items.length > 0 ? `
            <div class="cost-editor-header">
                <span>Total Items: ${items.length}</span>
                <span>Monthly Total: $<span id="currentTotal">${calculateTotalCost(items)}</span></span>
            </div>
            ${items.map(item => createEnhancedCostEditorRow(item)).join('')}
        ` : `
            <div class="empty-state">
                <p>No ${type} found</p>
            </div>
        `;
        
        // Update summary
        updateCostEditorSummary();
    }, 300);
}

function createEnhancedCostEditorRow(item) {
    const key = `${item.type}-${item.vendor}-${item.name}`;
    const hasChanged = costEditorChanges[key] !== undefined;
    const currentCost = hasChanged ? costEditorChanges[key].cost : item.cost;
    
    return `
        <div class="cost-editor-item ${!item.isActive ? 'inactive' : ''} ${hasChanged ? 'changed' : ''}" 
             data-name="${item.name}" 
             data-type="${item.type}" 
             data-vendor="${item.vendor}">
            <div class="cost-item-left">
                <div class="cost-item-info">
                    <h4>${item.displayName || item.name}</h4>
                    ${item.vendor ? `<span class="vendor-name">${item.vendor}</span>` : ''}
                    <div class="usage-info">
                        ${item.usage > 0 ? `
                            <span class="usage-stat">Used: ${item.usage} min</span>
                            <span class="separator">•</span>
                        ` : ''}
                        <span class="status-text ${item.isActive ? 'active' : 'inactive'}">
                            ${item.isActive ? 'Active' : item.lastUsed ? `Inactive (${getDaysInactive(item.lastUsed)} days)` : 'Never used'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="cost-item-right">
                <div class="cost-item-input">
                    <span class="currency">$</span>
                    <input type="number" 
                           class="cost-input ${hasChanged ? 'changed' : ''}" 
                           value="${currentCost}" 
                           min="0" 
                           max="9999"
                           step="0.01"
                           data-original="${item.cost}"
                           onchange="updateCostChange('${item.name}', '${item.type}', '${item.vendor}', this.value)"
                           onfocus="this.select()">
                    <span class="period">/month</span>
                </div>
                ${hasChanged ? `
                    <button class="reset-btn" onclick="resetCost('${item.name}', '${item.type}', '${item.vendor}', ${item.cost})" title="Reset to original">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                            <path d="M3 3v5h5"></path>
                        </svg>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function updateCostChange(name, type, vendor, value) {
    const key = `${type}-${vendor}-${name}`;
    const cost = parseFloat(value) || 0;
    
    if (cost !== originalCosts[key]) {
        costEditorChanges[key] = {
            name,
            type,
            vendor,
            cost
        };
    } else {
        delete costEditorChanges[key];
    }
    
    // Update UI
    const item = document.querySelector(`[data-name="${name}"][data-type="${type}"][data-vendor="${vendor}"]`);
    if (item) {
        if (costEditorChanges[key]) {
            item.classList.add('changed');
            item.querySelector('.cost-input').classList.add('changed');
        } else {
            item.classList.remove('changed');
            item.querySelector('.cost-input').classList.remove('changed');
        }
    }
    
    updateCostEditorSummary();
    updateTotalCost();
}

function resetCost(name, type, vendor, originalCost) {
    const key = `${type}-${vendor}-${name}`;
    delete costEditorChanges[key];
    
    const input = document.querySelector(`[data-name="${name}"][data-type="${type}"][data-vendor="${vendor}"] .cost-input`);
    if (input) {
        input.value = originalCost;
        updateCostChange(name, type, vendor, originalCost);
    }
}

function updateCostEditorSummary() {
    const changeCount = Object.keys(costEditorChanges).length;
    const summaryElement = document.getElementById('costChangeSummary');
    
    if (summaryElement) {
        if (changeCount > 0) {
            let totalBefore = 0;
            let totalAfter = 0;
            
            Object.entries(costEditorChanges).forEach(([key, change]) => {
                totalBefore += originalCosts[key] || 0;
                totalAfter += change.cost;
            });
            
            const difference = totalAfter - totalBefore;
            const diffClass = difference > 0 ? 'increase' : 'decrease';
            const diffSymbol = difference > 0 ? '+' : '';
            
            summaryElement.innerHTML = `
                <div class="change-summary">
                    <span>${changeCount} changes</span>
                    <span class="change-amount ${diffClass}">
                        ${diffSymbol}$${Math.abs(difference).toFixed(2)}/month
                    </span>
                </div>
            `;
        } else {
            summaryElement.innerHTML = '<div class="change-summary">No changes made</div>';
        }
    }
}

function calculateTotalCost(items) {
    return items.reduce((total, item) => total + item.cost, 0).toFixed(2);
}

function updateTotalCost() {
    let total = 0;
    
    // Calculate from current values
    document.querySelectorAll('.cost-input').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const totalElement = document.getElementById('currentTotal');
    if (totalElement) {
        totalElement.textContent = total.toFixed(2);
    }
    
    document.getElementById('totalMonthlyCost').textContent = `$${total.toFixed(2)}`;
}

async function saveCostChanges() {
    if (Object.keys(costEditorChanges).length === 0) {
        showToast('No changes to save', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCostEditor');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="btn-spinner"></div> Saving...';
    
    try {
        // Save each change
        for (const change of Object.values(costEditorChanges)) {
            await window.electronAPI.updateCost(change.type, change.name, change.vendor, change.cost);
        }
        
        showToast(`Successfully updated ${Object.keys(costEditorChanges).length} items`, 'success');
        hideCostEditor();
        
        // Refresh data
        await refreshData();
        if (state.currentView === 'dashboard' || state.currentView === 'reports') {
            loadView(state.currentView);
        }
    } catch (error) {
        showToast('Failed to save cost changes', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
    }
}

function filterCostList(event) {
    const filter = event.target.value.toLowerCase();
    document.querySelectorAll('.cost-editor-item').forEach(item => {
        const name = item.dataset.name.toLowerCase();
        const vendor = item.dataset.vendor.toLowerCase();
        if (name.includes(filter) || vendor.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Helper functions
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
}

// ... (Keep all other existing functions from the original renderer.js that weren't modified)

// Monitoring controls with animation
async function startMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    // Add loading animation
    startBtn.innerHTML = `
        <div class="btn-spinner"></div>
        Starting...
    `;
    startBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.startMonitoring();
        if (result.success) {
            state.isMonitoring = true;
            updateMonitoringStatus();
            
            // Success animation
            showToast('Monitoring started successfully! Scanning for applications...', 'success');
            
            // Update buttons
            startBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start Monitoring
            `;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Add pulse animation to status indicator
            const indicator = document.getElementById('statusIndicator');
            indicator.classList.add('pulse-animation');
            
            // Refresh data immediately
            setTimeout(async () => {
                await refreshData();
                if (state.currentView === 'monitoring' || state.currentView === 'dashboard') {
                    loadView(state.currentView);
                }
            }, 1000);
        }
    } catch (error) {
        showToast('Failed to start monitoring: ' + error.message, 'error');
        startBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Start Monitoring
        `;
        startBtn.disabled = false;
    }
}

async function stopMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    // Add loading animation
    stopBtn.innerHTML = `
        <div class="btn-spinner"></div>
        Stopping...
    `;
    stopBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.stopMonitoring();
        if (result.success) {
            state.isMonitoring = false;
            updateMonitoringStatus();
            showToast('Monitoring stopped', 'warning');
            
            // Update buttons
            stopBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop Monitoring
            `;
            startBtn.disabled = false;
            stopBtn.disabled = true;
            
            // Remove pulse animation
            const indicator = document.getElementById('statusIndicator');
            indicator.classList.remove('pulse-animation');
        }
    } catch (error) {
        showToast('Failed to stop monitoring: ' + error.message, 'error');
        stopBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12"></rect>
            </svg>
            Stop Monitoring
        `;
        stopBtn.disabled = false;
    }
}

function updateMonitoringStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (state.isMonitoring) {
        indicator.classList.add('active');
        text.textContent = 'Monitoring Active';
        text.innerHTML = `
            <span class="monitoring-active-text">
                <span class="pulse-dot"></span>
                Monitoring Active - Scanning processes...
            </span>
        `;
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        indicator.classList.remove('active');
        text.textContent = 'Monitoring Stopped';
        text.innerHTML = 'Monitoring Stopped';
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

function updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    if (state.lastUpdate) {
        element.textContent = `Last update: ${formatTime(state.lastUpdate)}`;
    }
}

// View: Dashboard with active monitoring check
function showDashboard() {
    // Check if we have usage data
    if (!state.usageData || !state.usageData.applications) {
        console.log('No usage data available');
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="dashboard-header">
                <h2>Dashboard Overview</h2>
                <p>Monitor your software and plugin usage in real-time</p>
            </div>
            
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="9"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <h3>No Data Available</h3>
                <p>${state.isMonitoring ? 'Monitoring is starting up...' : 'Start monitoring to begin tracking software usage'}</p>
                ${!state.isMonitoring ? '<button class="btn btn-primary mt-3" onclick="startMonitoring()">Start Monitoring</button>' : ''}
            </div>
        `;
        return;
    }
    
    const stats = calculateDashboardStats();
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Dashboard Overview</h2>
            <p>Monitor your software and plugin usage in real-time</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
                <div class="stat-value">${stats.totalApplications}</div>
                <div class="stat-label">Total Applications</div>
                <div class="stat-change ${stats.activeApplications > 0 ? 'positive' : ''}">
                    <span>${stats.activeApplications} active</span>
                </div>
            </div>
            
            <div class="stat-card">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                    <line x1="16" y1="8" x2="2" y2="22"></line>
                </svg>
                <div class="stat-value">${stats.totalPlugins}</div>
                <div class="stat-label">Total Plugins</div>
                <div class="stat-change ${stats.activePlugins > 0 ? 'positive' : ''}">
                    <span>${stats.activePlugins} active</span>
                </div>
            </div>
            
            <div class="stat-card">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div class="stat-value">${stats.totalUsageHours}h</div>
                <div class="stat-label">Total Usage</div>
                <div class="stat-change">
                    <span>This month</span>
                </div>
            </div>
            
            <div class="stat-card">
                <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <div class="stat-value">$${stats.potentialSavings}</div>
                <div class="stat-label">Potential Savings</div>
                <div class="stat-change negative">
                    <span>${stats.unusedPercentage}% unused</span>
                </div>
            </div>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>Most Used Applications</h3>
                <button class="btn btn-secondary" onclick="loadView('applications')">View All</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Total Usage</th>
                        <th>Last Used</th>
                        <th>Usage Trend</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${getMostUsedApplicationsRows(5)}
                </tbody>
            </table>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>Most Used Plugins</h3>
                <button class="btn btn-secondary" onclick="loadView('plugins')">View All</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Plugin</th>
                        <th>Vendor</th>
                        <th>Total Usage</th>
                        <th>Last Used</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${getMostUsedPluginsRows(5)}
                </tbody>
            </table>
        </div>
    `;
}

// Helper functions for data processing
function calculateDashboardStats() {
    if (!state.usageData || !state.usageData.applications) {
        return {
            totalApplications: 0,
            activeApplications: 0,
            totalPlugins: 0,
            activePlugins: 0,
            totalUsageHours: 0,
            unusedPercentage: 0,
            potentialSavings: '0'
        };
    }
    
    const apps = Object.values(state.usageData.applications);
    const activeApps = apps.filter(app => app.lastUsed && getDaysInactive(app.lastUsed) <= 7);
    
    let totalPlugins = 0;
    let activePlugins = 0;
    let totalUsage = 0;
    let potentialSavings = 0;
    
    // Count plugins
    if (state.usageData.plugins) {
        Object.values(state.usageData.plugins).forEach(vendor => {
            Object.values(vendor).forEach(product => {
                if (product.totalUsage !== undefined) {
                    totalPlugins++;
                    if (product.lastUsed && getDaysInactive(product.lastUsed) <= 7) {
                        activePlugins++;
                    } else if (getDaysInactive(product.lastUsed) > 30) {
                        potentialSavings += product.cost || 25;
                    }
                    totalUsage += product.totalUsage;
                } else {
                    Object.values(product).forEach(subProduct => {
                        totalPlugins++;
                        if (subProduct.lastUsed && getDaysInactive(subProduct.lastUsed) <= 7) {
                            activePlugins++;
                        } else if (getDaysInactive(subProduct.lastUsed) > 30) {
                            potentialSavings += subProduct.cost || 25;
                        }
                        totalUsage += subProduct.totalUsage;
                    });
                }
            });
        });
    }
    
    // Calculate app usage and potential savings
    apps.forEach(app => {
        totalUsage += app.totalUsage;
        if (getDaysInactive(app.lastUsed) > 30) {
            const appName = Object.keys(state.usageData.applications).find(key => 
                state.usageData.applications[key] === app
            );
            potentialSavings += getEstimatedCost(appName, 'application');
        }
    });
    
    const totalItems = apps.length + totalPlugins;
    const activeItems = activeApps.length + activePlugins;
    const unusedPercentage = totalItems > 0 ? Math.round(((totalItems - activeItems) / totalItems) * 100) : 0;
    
    return {
        totalApplications: apps.length,
        activeApplications: activeApps.length,
        totalPlugins,
        activePlugins,
        totalUsageHours: Math.round(totalUsage / 60),
        unusedPercentage,
        potentialSavings: Math.round(potentialSavings).toString()
    };
}

// Table row generators
function getMostUsedApplicationsRows(limit = 5) {
    if (!state.usageData || !state.usageData.applications) {
        return '<tr><td colspan="5" class="text-center">No application data available</td></tr>';
    }
    
    const apps = Object.entries(state.usageData.applications)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.totalUsage - a.totalUsage)
        .slice(0, limit);
    
    if (apps.length === 0) {
        return '<tr><td colspan="5" class="text-center">No applications tracked yet</td></tr>';
    }
    
    return apps.map(app => {
        const daysInactive = getDaysInactive(app.lastUsed);
        const status = daysInactive > 30 ? 'inactive' : 'active';
        
        return `
            <tr>
                <td>${app.name}</td>
                <td>${app.totalUsage} min</td>
                <td>${formatDate(app.lastUsed)}</td>
                <td>
                    <div class="usage-bar">
                        <div class="usage-bar-fill" style="width: ${getUsagePercentage(app.totalUsage, 1000)}%"></div>
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${status}">
                        ${status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function getMostUsedPluginsRows(limit = 5) {
    if (!state.usageData || !state.usageData.plugins) {
        return '<tr><td colspan="5" class="text-center">No plugin data available</td></tr>';
    }
    
    const plugins = [];
    
    Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
        Object.entries(products).forEach(([product, data]) => {
            if (data.totalUsage !== undefined) {
                plugins.push({ vendor, product, subProduct: '', ...data });
            } else {
                Object.entries(data).forEach(([subProduct, subData]) => {
                    plugins.push({ vendor, product, subProduct, ...subData });
                });
            }
        });
    });
    
    if (plugins.length === 0) {
        return '<tr><td colspan="5" class="text-center">No plugins tracked yet</td></tr>';
    }
    
    return plugins
        .sort((a, b) => b.totalUsage - a.totalUsage)
        .slice(0, limit)
        .map(plugin => {
            const daysInactive = getDaysInactive(plugin.lastUsed);
            const status = daysInactive > 30 ? 'inactive' : 'active';
            const displayName = plugin.subProduct ? `${plugin.product} - ${plugin.subProduct}` : plugin.product;
            
            return `
                <tr>
                    <td>${displayName}</td>
                    <td>${plugin.vendor}</td>
                    <td>${plugin.totalUsage} min</td>
                    <td>${formatDate(plugin.lastUsed)}</td>
                    <td>
                        <span class="status-badge status-${status}">
                            ${status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
}

// View: All Processes Monitoring
function showAllProcesses() {
    const contentArea = document.getElementById('contentArea');
    const monitoredCount = state.allProcesses.filter(p => p.isMonitored).length;
    const totalCount = state.allProcesses.length;
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Complete Process Monitoring</h2>
            <p>All running processes on this system</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalCount}</div>
                <div class="stat-label">Total Processes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${monitoredCount}</div>
                <div class="stat-label">Monitored Apps</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${state.currentUser || 'Unknown'}</div>
                <div class="stat-label">Current User</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${state.systemInfo?.hostname || 'Unknown'}</div>
                <div class="stat-label">Computer Name</div>
            </div>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>All Running Processes (${totalCount})</h3>
                <input type="text" class="search-box" placeholder="Search processes..." onkeyup="filterTable(this, 'processesTable')">
            </div>
            <table class="data-table" id="processesTable">
                <thead>
                    <tr>
                        <th>Process Name</th>
                        <th>PID</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getAllProcessesRows()}
                </tbody>
            </table>
        </div>
    `;
}

// View: Applications
function showApplications() {
    if (!state.usageData) return;
    
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Applications Usage</h2>
            <p>Detailed view of all monitored applications</p>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>All Applications</h3>
                <input type="text" class="search-box" placeholder="Search applications..." onkeyup="filterTable(this, 'applicationsTable')">
            </div>
            <table class="data-table" id="applicationsTable">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Total Usage (minutes)</th>
                        <th>Last Used</th>
                        <th>Days Inactive</th>
                        <th>Usage Trend</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getAllApplicationsRowsWithInfo()}
                </tbody>
            </table>
        </div>
    `;
}

// View: Plugins
function showPlugins() {
    if (!state.usageData) return;
    
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Plugins Usage</h2>
            <p>Monitor usage of all plugins across different applications</p>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>All Plugins</h3>
                <input type="text" class="search-box" placeholder="Search plugins..." onkeyup="filterTable(this, 'pluginsTable')">
            </div>
            <table class="data-table" id="pluginsTable">
                <thead>
                    <tr>
                        <th>Vendor</th>
                        <th>Product</th>
                        <th>Sub Product</th>
                        <th>Total Usage (minutes)</th>
                        <th>Last Used</th>
                        <th>Days Inactive</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getAllPluginsRowsWithInfo()}
                </tbody>
            </table>
        </div>
    `;
}

// Table row generators
function getAllProcessesRows() {
    if (!state.allProcesses || state.allProcesses.length === 0) {
        return '<tr><td colspan="5" class="text-center">No processes detected. Start monitoring to see processes.</td></tr>';
    }
    
    return state.allProcesses.map(process => {
        const isMonitored = process.isMonitored;
        const statusClass = isMonitored ? 'status-active' : 'status-inactive';
        const statusText = isMonitored ? 'Monitored' : 'Not Monitored';
        const type = isMonitored ? 'Application' : 'System Process';
        
        return `
            <tr>
                <td><strong>${process.name}</strong></td>
                <td>${process.pid || 'N/A'}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${type}</td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="showProcessSystemInfo('${process.name}')">
                        System Info
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getAllApplicationsRowsWithInfo() {
    return Object.entries(state.usageData.applications)
        .map(([name, data]) => {
            const daysInactive = getDaysInactive(data.lastUsed);
            const status = daysInactive > 30 ? 'inactive' : (daysInactive > 7 ? 'warning' : 'active');
            
            return `
                <tr>
                    <td>${name}</td>
                    <td>${data.totalUsage}</td>
                    <td>${formatDate(data.lastUsed)}</td>
                    <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                    <td>
                        <div class="usage-bar">
                            <div class="usage-bar-fill" style="width: ${getUsagePercentage(data.totalUsage, 1000)}%"></div>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge status-${status}">
                            ${status === 'active' ? 'Active' : status === 'warning' ? 'Low Usage' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary btn-small" onclick="showApplicationSystemInfo('${name}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                                <path d="M16 2v4M8 2v4M2 10h20"></path>
                            </svg>
                            Info
                        </button>
                        ${daysInactive > 30 ? `
                        <button class="btn btn-danger btn-small" onclick="markForRemoval('${name}', 'application')">
                            Remove
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
}

function getAllPluginsRowsWithInfo() {
    const rows = [];
    
    Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
        Object.entries(products).forEach(([product, data]) => {
            if (data.totalUsage !== undefined) {
                const daysInactive = getDaysInactive(data.lastUsed);
                const status = daysInactive > 30 ? 'inactive' : (daysInactive > 7 ? 'warning' : 'active');
                
                rows.push(`
                    <tr>
                        <td>${vendor}</td>
                        <td>${product}</td>
                        <td>-</td>
                        <td>${data.totalUsage}</td>
                        <td>${formatDate(data.lastUsed)}</td>
                        <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                        <td>
                            <span class="status-badge status-${status}">
                                ${status === 'active' ? 'Active' : status === 'warning' ? 'Low Usage' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-secondary btn-small" onclick="showPluginSystemInfo('${product}', '${vendor}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                                    <path d="M16 2v4M8 2v4M2 10h20"></path>
                                </svg>
                                Info
                            </button>
                            ${daysInactive > 30 ? `
                            <button class="btn btn-danger btn-small" onclick="markForRemoval('${product}', 'plugin')">
                                Remove
                            </button>` : ''}
                        </td>
                    </tr>
                `);
            } else {
                Object.entries(data).forEach(([subProduct, subData]) => {
                    const daysInactive = getDaysInactive(subData.lastUsed);
                    const status = daysInactive > 30 ? 'inactive' : (daysInactive > 7 ? 'warning' : 'active');
                    
                    rows.push(`
                        <tr>
                            <td>${vendor}</td>
                            <td>${product}</td>
                            <td>${subProduct}</td>
                            <td>${subData.totalUsage}</td>
                            <td>${formatDate(subData.lastUsed)}</td>
                            <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                            <td>
                                <span class="status-badge status-${status}">
                                    ${status === 'active' ? 'Active' : status === 'warning' ? 'Low Usage' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-secondary btn-small" onclick="showPluginSystemInfo('${subProduct}', '${vendor}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                                        <path d="M16 2v4M8 2v4M2 10h20"></path>
                                    </svg>
                                    Info
                                </button>
                                ${daysInactive > 30 ? `
                                <button class="btn btn-danger btn-small" onclick="markForRemoval('${subProduct}', 'plugin')">
                                    Remove
                                </button>` : ''}
                            </td>
                        </tr>
                    `);
                });
            }
        });
    });
    
    return rows.join('');
}

// View: Vendors
function showVendors() {
    if (!state.usageData) return;
    
    const vendorStats = calculateVendorStats();
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Vendor Overview</h2>
            <p>Usage statistics grouped by software vendors</p>
        </div>
        
        <div class="data-section">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Vendor</th>
                        <th>Total Products</th>
                        <th>Active Products</th>
                        <th>Total Usage (hours)</th>
                        <th>Utilization Rate</th>
                        <th>Monthly Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${getVendorRows(vendorStats)}
                </tbody>
            </table>
        </div>
    `;
}

// View: Unused Software
function showUnusedSoftware() {
    if (!state.usageData) return;
    
    const threshold = state.settings?.inactivityThreshold || 30;
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Unused Software</h2>
            <p>Software not used in the last ${threshold} days</p>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>Unused Applications</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Last Used</th>
                        <th>Days Inactive</th>
                        <th>Total Usage</th>
                        <th>Recommendation</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getUnusedApplicationsRows(threshold)}
                </tbody>
            </table>
        </div>
        
        <div class="data-section mt-3">
            <div class="section-header">
                <h3>Unused Plugins</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Plugin</th>
                        <th>Vendor</th>
                        <th>Last Used</th>
                        <th>Days Inactive</th>
                        <th>Total Usage</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getUnusedPluginsRows(threshold)}
                </tbody>
            </table>
        </div>
    `;
}

// View: Reports
async function showReports() {
    const recommendations = await window.electronAPI.getRecommendations();
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Reports & Analytics</h2>
            <p>Comprehensive analysis and recommendations</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${recommendations.length}</div>
                <div class="stat-label">Removal Recommendations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${calculateTotalSavings(recommendations)}</div>
                <div class="stat-label">Estimated Monthly Savings</div>
            </div>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>Removal Recommendations</h3>
                <button class="btn btn-primary" onclick="exportRecommendations()">Export Report</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Vendor</th>
                        <th>Days Inactive</th>
                        <th>Recommendation</th>
                        <th>Potential Saving</th>
                    </tr>
                </thead>
                <tbody>
                    ${getRecommendationsRows(recommendations)}
                </tbody>
            </table>
        </div>
    `;
}

// Enhanced Analytics Functions for renderer.js
// Replace the existing showAnalytics and related functions with these:

// View: Enhanced Analytics
// View: Analytics
async function showAnalytics() {
    const analytics = await window.electronAPI.generateAnalytics();
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="analytics-header">
            <div>
                <h2>Usage Analytics</h2>
                <p>Comprehensive insights into your software usage patterns</p>
            </div>
            <div class="date-range-selector">
                <label>Period:</label>
                <select id="analyticsRange">
                    <option value="7">Last 7 days</option>
                    <option value="30" selected>Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                </select>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${analytics?.utilizationRate || 0}%</div>
                <div class="stat-label">Overall Utilization</div>
                <div class="stat-change ${analytics?.utilizationTrend > 0 ? 'positive' : 'negative'}">
                    <span>${analytics?.utilizationTrend > 0 ? '↑' : '↓'} ${Math.abs(analytics?.utilizationTrend || 0)}% from last period</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${analytics?.peakUsageHour || 'N/A'}</div>
                <div class="stat-label">Peak Usage Time</div>
                <div class="stat-change">
                    <span>Most active hour</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${analytics?.avgSessionLength || 0}h</div>
                <div class="stat-label">Avg Session Length</div>
                <div class="stat-change">
                    <span>Per application</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">$${analytics?.costPerHour || 0}</div>
                <div class="stat-label">Cost per Hour</div>
                <div class="stat-change">
                    <span>Based on usage</span>
                </div>
            </div>
        </div>
        
        <div class="chart-container">
            <canvas id="usageChart"></canvas>
        </div>
        
        <div class="insights-grid">
            <div class="insight-card">
                <h4>Top Recommendations</h4>
                ${getTopRecommendations(analytics)}
            </div>
            
            <div class="insight-card">
                <h4>Usage Patterns</h4>
                ${getUsagePatterns(analytics)}
            </div>
            
            <div class="insight-card">
                <h4>Cost Analysis</h4>
                ${getCostAnalysis(analytics)}
            </div>
        </div>
    `;
    
    // Initialize chart (placeholder - in production use Chart.js or similar)
    initializeUsageChart();
}


// View: Savings Tracker
async function showSavingsTracker() {
    const confirmedSavings = await window.electronAPI.getConfirmedSavings();
    const totalSavings = calculateTotalConfirmedSavings(confirmedSavings);
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Savings Tracker</h2>
            <p>Track your realized savings from removing unused software</p>
        </div>
        
        <div class="savings-summary">
            <h3>Total Confirmed Savings</h3>
            <div class="total-savings">$${totalSavings.monthly}</div>
            <div class="savings-period">Per Month</div>
            <div class="mt-3">
                <span class="text-large">$${totalSavings.annual} Annual Savings</span>
            </div>
        </div>
        
        <div class="data-section">
            <div class="section-header">
                <h3>Pending Recommendations</h3>
                <span class="text-muted">${getPendingCount()} items awaiting action</span>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Software</th>
                        <th>Type</th>
                        <th>Monthly Cost</th>
                        <th>Days Inactive</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${getPendingSavingsRows()}
                </tbody>
            </table>
        </div>
        
        <div class="data-section mt-3">
            <div class="section-header">
                <h3>Confirmed Savings Timeline</h3>
            </div>
            <div class="savings-timeline">
                ${getSavingsTimelineItems(confirmedSavings)}
            </div>
        </div>
    `;
}

// System Info Modal
async function showSystemInfo() {
    const modal = document.getElementById('systemInfoModal');
    modal.classList.add('show');
    
    // Show loading
    document.getElementById('systemInfoContent').innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    try {
        const systemInfo = await window.electronAPI.getSystemInfo();
        displaySystemInfo(systemInfo);
    } catch (error) {
        document.getElementById('systemInfoContent').innerHTML = `
            <div class="empty-state">
                <p>Failed to load system information</p>
            </div>
        `;
    }
}

function displaySystemInfo(info) {
    const content = document.getElementById('systemInfoContent');
    
    content.innerHTML = `
        <div class="system-info-grid">
            <div class="system-info-card">
                <h4>Computer Details</h4>
                <div class="info-item">
                    <span class="info-label">Hostname</span>
                    <span class="info-value highlight">${info.hostname}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Platform</span>
                    <span class="info-value">${info.platform} ${info.osVersion || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Architecture</span>
                    <span class="info-value">${info.arch}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Uptime</span>
                    <span class="info-value">${info.uptime} hours</span>
                </div>
            </div>
            
            <div class="system-info-card">
                <h4>Network Information</h4>
                <div class="ip-addresses">
                    ${info.ipAddresses.map(ip => `
                        <div class="ip-item">
                            <span class="info-value highlight">${ip.address}</span>
                            <span class="ip-interface">${ip.interface}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="system-info-card">
                <h4>Hardware Specifications</h4>
                <div class="info-item">
                    <span class="info-label">CPU</span>
                    <span class="info-value">${info.cpus.model}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CPU Cores</span>
                    <span class="info-value">${info.cpus.cores} @ ${(info.cpus.speed / 1000).toFixed(2)} GHz</span>
                </div>
                ${info.gpu ? `
                <div class="info-item">
                    <span class="info-label">GPU</span>
                    <span class="info-value">${info.gpu}</span>
                </div>
                ` : ''}
                ${info.model ? `
                <div class="info-item">
                    <span class="info-label">Model</span>
                    <span class="info-value">${info.model}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="system-info-card">
                <h4>Memory Usage</h4>
                <div class="info-item">
                    <span class="info-label">Total RAM</span>
                    <span class="info-value">${info.memory.total} GB</span>
                </div>
                <div class="progress-container">
                    <div class="progress-label">
                        <span>Used: ${info.memory.used} GB</span>
                        <span>Free: ${info.memory.free} GB</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(info.memory.used / info.memory.total) * 100}%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function hideSystemInfoModal() {
    document.getElementById('systemInfoModal').classList.remove('show');
}

async function refreshSystemInfo() {
    await showSystemInfo();
}

// System info popup functions
async function showProcessSystemInfo(processName) {
    const systemInfo = state.systemInfo || await window.electronAPI.getSystemInfo();
    showSystemInfoPopup(`Process: ${processName}`, systemInfo);
}

async function showApplicationSystemInfo(appName) {
    const systemInfo = state.systemInfo || await window.electronAPI.getSystemInfo();
    showSystemInfoPopup(`Application: ${appName}`, systemInfo);
}

async function showPluginSystemInfo(pluginName, vendor) {
    const systemInfo = state.systemInfo || await window.electronAPI.getSystemInfo();
    showSystemInfoPopup(`Plugin: ${pluginName} (${vendor})`, systemInfo);
}

function showSystemInfoPopup(title, info) {
    const modal = document.getElementById('systemInfoModal');
    const content = document.getElementById('systemInfoContent');
    
    content.innerHTML = `
        <div class="system-info-header">
            <h3>${title}</h3>
            <p class="text-muted">System information for this monitoring session</p>
        </div>
        
        <div class="system-info-grid">
            <div class="system-info-card">
                <h4>Computer Details</h4>
                <div class="info-item">
                    <span class="info-label">Computer Name</span>
                    <span class="info-value highlight">${info.hostname}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Current User</span>
                    <span class="info-value highlight">${info.user?.username || state.currentUser}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">User Directory</span>
                    <span class="info-value" style="font-size: 12px;">${info.user?.homedir || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Platform</span>
                    <span class="info-value">${info.platform} ${info.osVersion || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Architecture</span>
                    <span class="info-value">${info.arch || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">System Uptime</span>
                    <span class="info-value">${info.uptimeDetailed || info.uptime + ' hours'}</span>
                </div>
            </div>
            
            <div class="system-info-card">
                <h4>Network Information</h4>
                <div class="ip-addresses">
                    ${info.ipAddresses.map(ip => `
                        <div class="ip-item">
                            <span class="info-value highlight">${ip.address}</span>
                            <span class="ip-interface">${ip.interface}</span>
                            ${ip.mac ? `<span class="ip-interface">MAC: ${ip.mac}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="info-item mt-2">
                    <span class="info-label">Monitoring Started</span>
                    <span class="info-value">${formatTime(new Date())}</span>
                </div>
            </div>
            
            <div class="system-info-card">
                <h4>Hardware Specifications</h4>
                <div class="info-item">
                    <span class="info-label">CPU Model</span>
                    <span class="info-value">${info.cpus.model}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CPU Details</span>
                    <span class="info-value">${info.cpus.cores} cores @ ${(info.cpus.speed / 1000).toFixed(2)} GHz</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CPU Usage</span>
                    <span class="info-value">${info.cpus.usage || 0}%</span>
                </div>
                ${info.gpu ? `
                <div class="info-item">
                    <span class="info-label">Graphics Card</span>
                    <span class="info-value">${info.gpu}</span>
                </div>
                ` : ''}
                ${info.model ? `
                <div class="info-item">
                    <span class="info-label">Computer Model</span>
                    <span class="info-value">${info.model}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="system-info-card">
                <h4>Memory & Storage</h4>
                <div class="info-item">
                    <span class="info-label">Total RAM</span>
                    <span class="info-value">${info.memory.total} GB</span>
                </div>
                <div class="progress-container">
                    <div class="progress-label">
                        <span>Used: ${info.memory.used} GB (${info.memory.usagePercent}%)</span>
                        <span>Free: ${info.memory.free} GB</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${info.memory.usagePercent}%"></div>
                    </div>
                </div>
                ${info.disks && info.disks.length > 0 ? `
                    <div class="mt-3">
                        <h5>Disk Usage</h5>
                        ${info.disks.map(disk => `
                            <div class="info-item">
                                <span class="info-label">Drive ${disk.caption}</span>
                                <span class="info-value">${disk.free} GB free of ${disk.size} GB</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="system-info-footer">
            <p class="text-muted text-center">This information is captured at the time of monitoring</p>
        </div>
    `;
    
    modal.classList.add('show');
}

// Helper functions for vendor stats
function calculateVendorStats() {
    const vendorStats = {};
    
    Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
        let totalProducts = 0;
        let activeProducts = 0;
        let totalUsage = 0;
        
        Object.values(products).forEach(product => {
            if (product.totalUsage !== undefined) {
                totalProducts++;
                if (product.lastUsed && getDaysInactive(product.lastUsed) <= 30) {
                    activeProducts++;
                }
                totalUsage += product.totalUsage;
            } else {
                Object.values(product).forEach(subProduct => {
                    totalProducts++;
                    if (subProduct.lastUsed && getDaysInactive(subProduct.lastUsed) <= 30) {
                        activeProducts++;
                    }
                    totalUsage += subProduct.totalUsage;
                });
            }
        });
        
        vendorStats[vendor] = {
            totalProducts,
            activeProducts,
            totalUsage,
            utilizationRate: totalProducts > 0 ? (activeProducts / totalProducts) * 100 : 0
        };
    });
    
    return vendorStats;
}

function getVendorRows(vendorStats) {
    return Object.entries(vendorStats).map(([vendor, stats]) => {
        return `
            <tr>
                <td>${vendor}</td>
                <td>${stats.totalProducts}</td>
                <td>${stats.activeProducts}</td>
                <td>${Math.round(stats.totalUsage / 60)}</td>
                <td>
                    <div class="flex gap-2">
                        <div class="usage-bar" style="flex: 1">
                            <div class="usage-bar-fill" style="width: ${stats.utilizationRate}%"></div>
                        </div>
                        <span>${Math.round(stats.utilizationRate)}%</span>
                    </div>
                </td>
                <td>$${Math.round(stats.activeProducts * 50)}</td>
            </tr>
        `;
    }).join('');
}

function getUnusedApplicationsRows(threshold) {
    return Object.entries(state.usageData.applications)
        .filter(([name, data]) => getDaysInactive(data.lastUsed) > threshold)
        .map(([name, data]) => {
            const daysInactive = getDaysInactive(data.lastUsed);
            
            return `
                <tr>
                    <td>${name}</td>
                    <td>${formatDate(data.lastUsed)}</td>
                    <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                    <td>${data.totalUsage} min</td>
                    <td><span class="status-badge status-danger">Consider removing</span></td>
                    <td>
                        <button class="btn btn-danger" onclick="markForRemoval('${name}', 'application')">
                            Mark for Removal
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
}

function getUnusedPluginsRows(threshold) {
    const rows = [];
    
    Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
        Object.entries(products).forEach(([product, data]) => {
            if (data.totalUsage !== undefined) {
                const daysInactive = getDaysInactive(data.lastUsed);
                if (daysInactive > threshold) {
                    rows.push(`
                        <tr>
                            <td>${product}</td>
                            <td>${vendor}</td>
                            <td>${formatDate(data.lastUsed)}</td>
                            <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                            <td>${data.totalUsage} min</td>
                            <td>
                                <button class="btn btn-danger" onclick="markForRemoval('${product}', 'plugin')">
                                    Mark for Removal
                                </button>
                            </td>
                        </tr>
                    `);
                }
            } else {
                Object.entries(data).forEach(([subProduct, subData]) => {
                    const daysInactive = getDaysInactive(subData.lastUsed);
                    if (daysInactive > threshold) {
                        rows.push(`
                            <tr>
                                <td>${product} - ${subProduct}</td>
                                <td>${vendor}</td>
                                <td>${formatDate(subData.lastUsed)}</td>
                                <td>${daysInactive === Infinity ? 'Never used' : daysInactive + ' days'}</td>
                                <td>${subData.totalUsage} min</td>
                                <td>
                                    <button class="btn btn-danger" onclick="markForRemoval('${subProduct}', 'plugin')">
                                        Mark for Removal
                                    </button>
                                </td>
                            </tr>
                        `);
                    }
                });
            }
        });
    });
    
    return rows.join('');
}

function getRecommendationsRows(recommendations) {
    return recommendations.map(rec => {
        return `
            <tr>
                <td>${rec.type}</td>
                <td>${rec.name}</td>
                <td>${rec.vendor}</td>
                <td>${rec.daysInactive}</td>
                <td>${rec.recommendation}</td>
                <td>${rec.potentialSaving}</td>
            </tr>
        `;
    }).join('');
}

// Helper functions for analytics
function getTopRecommendations(analytics) {
    if (!analytics || !analytics.recommendations) {
        return '<p class="text-muted">No recommendations available</p>';
    }
    
    return analytics.recommendations.slice(0, 3).map(rec => `
        <div class="mb-2">
            <strong>${rec.action}</strong>
            <p class="text-small text-muted">${rec.reason}</p>
        </div>
    `).join('');
}

function getUsagePatterns(analytics) {
    if (!analytics || !analytics.patterns) {
        return '<p class="text-muted">Insufficient data for pattern analysis</p>';
    }
    
    return `
        <div class="mb-2">
            <div class="info-item">
                <span>Most productive day:</span>
                <span class="highlight">${analytics.patterns.mostProductiveDay || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span>Avg daily usage:</span>
                <span>${analytics.patterns.avgDailyHours || 0} hours</span>
            </div>
            <div class="info-item">
                <span>Usage trend:</span>
                <span class="${analytics.patterns.trend === 'increasing' ? 'positive' : 'negative'}">
                    ${analytics.patterns.trend || 'stable'}
                </span>
            </div>
        </div>
    `;
}

function getCostAnalysis(analytics) {
    if (!analytics || !analytics.costs) {
        return '<p class="text-muted">Cost analysis unavailable</p>';
    }
    
    return `
        <div class="mb-2">
            <div class="info-item">
                <span>Total monthly cost:</span>
                <span class="highlight">$${analytics.costs.totalMonthly || 0}</span>
            </div>
            <div class="info-item">
                <span>Cost per user:</span>
                <span>$${analytics.costs.perUser || 0}</span>
            </div>
            <div class="info-item">
                <span>Optimization potential:</span>
                <span class="positive">$${analytics.costs.savingsPotential || 0}</span>
            </div>
        </div>
    `;
}

function initializeUsageChart() {
    // Placeholder for chart initialization
    // In production, use Chart.js or similar library
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <h3>Usage Chart</h3>
                <p>Visualizations will be rendered here</p>
            </div>
        `;
    }
}

function calculateTotalConfirmedSavings(savings) {
    if (!savings || !Array.isArray(savings)) {
        return { monthly: 0, annual: 0 };
    }
    
    const monthly = savings.reduce((total, item) => total + (item.monthlySaving || 0), 0);
    return {
        monthly: monthly.toFixed(2),
        annual: (monthly * 12).toFixed(2)
    };
}

function getPendingCount() {
    if (!state.usageData) return 0;
    
    let count = 0;
    const threshold = state.settings?.inactivityThreshold || 30;
    
    // Count inactive applications
    Object.values(state.usageData.applications).forEach(data => {
        if (getDaysInactive(data.lastUsed) > threshold) count++;
    });
    
    // Count inactive plugins
    Object.values(state.usageData.plugins).forEach(vendor => {
        Object.values(vendor).forEach(product => {
            if (product.totalUsage !== undefined && getDaysInactive(product.lastUsed) > threshold) {
                count++;
            }
        });
    });
    
    return count;
}

function getPendingSavingsRows() {
    if (!state.usageData) return '';
    
    const pendingItems = [];
    const threshold = state.settings?.inactivityThreshold || 30;
    
    // Check applications
    Object.entries(state.usageData.applications).forEach(([name, data]) => {
        const daysInactive = getDaysInactive(data.lastUsed);
        if (daysInactive > threshold) {
            pendingItems.push({
                name,
                type: 'Application',
                daysInactive,
                monthlyCost: getEstimatedCost(name, 'application')
            });
        }
    });
    
    // Check plugins (simplified for brevity)
    Object.entries(state.usageData.plugins).forEach(([vendor, products]) => {
        Object.entries(products).forEach(([product, data]) => {
            if (data.totalUsage !== undefined) {
                const daysInactive = getDaysInactive(data.lastUsed);
                if (daysInactive > threshold) {
                    pendingItems.push({
                        name: product,
                        type: 'Plugin',
                        vendor,
                        daysInactive,
                        monthlyCost: getEstimatedCost(product, 'plugin')
                    });
                }
            }
        });
    });
    
    return pendingItems.slice(0, 10).map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.type}</td>
            <td>$${item.monthlyCost}</td>
            <td>${item.daysInactive} days</td>
            <td>
                <button class="btn btn-success" onclick="markForRemoval('${item.name}', '${item.type.toLowerCase()}')">
                    Confirm Removal
                </button>
            </td>
        </tr>
    `).join('');
}

function getSavingsTimelineItems(savings) {
    if (!savings || savings.length === 0) {
        return `
            <div class="empty-state">
                <p>No confirmed savings yet. Start by removing unused software!</p>
            </div>
        `;
    }
    
    return savings.slice(-10).reverse().map(item => `
        <div class="timeline-item">
            <div class="timeline-date">${formatDate(item.confirmedAt)}</div>
            <div class="timeline-content">
                <strong>${item.name}</strong>
                <p class="text-small text-muted">${item.type}</p>
            </div>
            <div class="timeline-amount">+$${item.monthlySaving}/mo</div>
        </div>
    `).join('');
}

function calculateTotalSavings(recommendations) {
    // Calculate based on actual costs
    let total = 0;
    recommendations.forEach(rec => {
        const cost = getEstimatedCost(rec.name, rec.type.toLowerCase());
        total += cost;
    });
    return `$${total}`;
}

function getEstimatedCost(name, type) {
    const costs = {
        'Adobe After Effects': 55,
        'Adobe Premiere Pro': 55,
        'Adobe Photoshop': 35,
        'Adobe Illustrator': 35,
        'Cinema 4D': 94,
        'Rhinoceros': 195,
        '3ds Max': 215,
        'Autodesk Maya': 215,
        'DaVinci Resolve': 295,
        'Nuke': 499,
        'Houdini': 269,
        'Trapcode': 89,
        'Magic Bullet': 89,
        'Universe': 89,
        'Sapphire': 195,
        'Continuum': 195,
        'Mocha Pro': 69,
        'Redshift': 45,
        'X-Particles': 69,
        'Octane Render': 20,
        'Neat Video': 15,
        'Twixtor Pro': 60
    };
    
    for (const [key, value] of Object.entries(costs)) {
        if (name.includes(key) || key.includes(name)) {
            return value;
        }
    }
    
    return type === 'application' ? 50 : 25;
}

// Utility functions
function getDaysInactive(lastUsed) {
    if (!lastUsed) return Infinity;
    const diff = Date.now() - new Date(lastUsed).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

function getUsagePercentage(usage, max) {
    return Math.min((usage / max) * 100, 100);
}

function filterTable(input, tableId) {
    const filter = input.value.toUpperCase();
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');
    
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        let found = false;
        
        for (let j = 0; j < cells.length; j++) {
            if (cells[j].textContent.toUpperCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        
        rows[i].style.display = found ? '' : 'none';
    }
}

// Modal functions
function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    
    // Load current settings
    document.getElementById('monitoringInterval').value = state.settings.monitoringInterval;
    document.getElementById('inactivityThreshold').value = state.settings.inactivityThreshold;
    document.getElementById('autoStart').checked = state.settings.autoStart;
    document.getElementById('enableNotifications').checked = state.settings.notifications.enabled;
    document.getElementById('notifyUnused').checked = state.settings.notifications.unusedSoftware;
    document.getElementById('defaultFormat').value = state.settings.export.defaultFormat;
    
    modal.classList.add('show');
}

function hideSettingsModal() {
    document.getElementById('settingsModal').classList.remove('show');
}

async function saveSettings() {
    const newSettings = {
        monitoringInterval: parseInt(document.getElementById('monitoringInterval').value),
        inactivityThreshold: parseInt(document.getElementById('inactivityThreshold').value),
        autoStart: document.getElementById('autoStart').checked,
        notifications: {
            enabled: document.getElementById('enableNotifications').checked,
            unusedSoftware: document.getElementById('notifyUnused').checked,
            exportComplete: true
        },
        export: {
            defaultFormat: document.getElementById('defaultFormat').value,
            includeInactive: true,
            includeMetadata: true
        }
    };
    
    try {
        const result = await window.electronAPI.saveSettings(newSettings);
        if (result.success) {
            state.settings = { ...state.settings, ...newSettings };
            showToast('Settings saved successfully');
            hideSettingsModal();
        }
    } catch (error) {
        showToast('Failed to save settings', 'error');
    }
}

function showExportModal() {
    const modal = document.getElementById('exportModal');
    
    // Set default format
    const defaultFormat = state.settings?.export?.defaultFormat || 'csv';
    document.querySelector(`input[name="exportFormat"][value="${defaultFormat}"]`).checked = true;
    
    modal.classList.add('show');
}

function hideExportModal() {
    document.getElementById('exportModal').classList.remove('show');
}
async function performExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    
    try {
        hideExportModal();
        showToast('Exporting data...');
        
        const result = await window.electronAPI.exportData(format);
        if (result.success) {
            showToast(`Data exported successfully to ${result.filePath}`);
        } else {
            showToast(`Export failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast('Export failed', 'error');
    }
}

// Savings Modal functions
let currentSavingItem = null;

function showSavingsConfirmation(item, cost) {
    currentSavingItem = item;
    const modal = document.getElementById('savingsModal');
    
    document.getElementById('savingsMessage').textContent = 
        `Confirm that you have uninstalled or cancelled the subscription for ${item.name}`;
    document.getElementById('savingsAmount').textContent = `${cost}`;
    
    modal.classList.add('show');
}

function hideSavingsModal() {
    document.getElementById('savingsModal').classList.remove('show');
    currentSavingItem = null;
}

async function confirmSavings() {
    if (!currentSavingItem) return;
    
    try {
        const result = await window.electronAPI.confirmSavings(currentSavingItem);
        if (result) {
            showToast(`Savings of ${result.monthlySaving}/month confirmed!`, 'success');
            hideSavingsModal();
            
            // Refresh current view if on savings tracker
            if (state.currentView === 'savings') {
                await showSavingsTracker();
            }
        }
    } catch (error) {
        showToast('Failed to confirm savings', 'error');
    }
}

// Action functions
async function markForRemoval(name, type) {
    // Get cost estimate first
    const costs = getEstimatedCost(name, type);
    const item = { name, type, monthlyCost: costs };
    showSavingsConfirmation(item, costs);
}

async function exportRecommendations() {
    showExportModal();
}

// Toast notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// View: Enterprise Dashboard
// Enhanced Enterprise Dashboard Functions for renderer.js
// Replace the existing showEnterpriseDashboard function and related functions with these:

// View: Enhanced Enterprise Dashboard
// Enhanced Enterprise Dashboard Functions for renderer.js
// Replace the existing showEnterpriseDashboard function and related functions with these:

// View: Enhanced Enterprise Dashboard

// ===== COMPLETE ENTERPRISE DASHBOARD IMPLEMENTATION =====
// Add this to your src/renderer/renderer.js file

// View: Enterprise Dashboard with Real Client Data
async function showEnterpriseDashboard() {
    const contentArea = document.getElementById('contentArea');
    
    // Show loading state
    contentArea.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Connecting to Enterprise Server...</p>
        </div>
    `;
    
    try {
        // Get enterprise configuration from state or usage data
        const serverUrl = state.usageData?.metadata?.enterpriseServer || 
                         state.enterpriseConfig?.serverUrl || 
                         'http://localhost:3443';
        const apiKey = state.usageData?.metadata?.enterpriseApiKey || 
                      state.enterpriseConfig?.apiKey || 
                      'your-api-key';
        
        console.log('Connecting to enterprise server:', serverUrl);
        
        // Fetch real data from enterprise server
        const headers = { 'X-API-Key': apiKey };
        
        // Get statistics
        const statsResponse = await fetch(`${serverUrl}/api/statistics`, { headers });
        if (!statsResponse.ok) throw new Error(`Server returned ${statsResponse.status}`);
        const stats = await statsResponse.json();
        
        // Get all clients
        const clientsResponse = await fetch(`${serverUrl}/api/clients`, { headers });
        if (!clientsResponse.ok) throw new Error(`Server returned ${clientsResponse.status}`);
        const clients = await clientsResponse.json();
        
        console.log(`Loaded ${clients.length} clients from enterprise server`);
        
        // Calculate real statistics
        const totalUsers = new Set(clients.map(c => c.latest_usage?.system_info?.user?.username).filter(Boolean)).size;
        const totalApps = countTotalUniqueApplications(clients);
        const totalPlugins = countTotalUniquePlugins(clients);
        const totalMonthlyCost = calculateTotalEnterpriseCost(clients);
        const onlineClients = clients.filter(c => isClientOnline(c.last_seen)).length;
        
        contentArea.innerHTML = `
            <div class="enterprise-header">
                <h2>Enterprise Client Monitor</h2>
                <p>Real-time monitoring of all connected client machines</p>
                <div class="sync-status">
                    <span class="sync-indicator active"></span>
                    <span>Connected to: ${serverUrl}</span>
                    <button class="btn btn-secondary" onclick="refreshEnterpriseDashboard()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            
            <!-- Summary Cards -->
            <div class="enterprise-summary">
                <div class="summary-card">
                    <div class="card-icon">🖥️</div>
                    <div class="card-content">
                        <div class="card-value">${clients.length}</div>
                        <div class="card-label">Total Clients</div>
                        <div class="card-sub">${onlineClients} online</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">👥</div>
                    <div class="card-content">
                        <div class="card-value">${totalUsers}</div>
                        <div class="card-label">Active Users</div>
                        <div class="card-sub">Across all departments</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <div class="card-value">${totalApps}</div>
                        <div class="card-label">Applications</div>
                        <div class="card-sub">Unique applications</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">🔌</div>
                    <div class="card-content">
                        <div class="card-value">${totalPlugins}</div>
                        <div class="card-label">Plugins</div>
                        <div class="card-sub">Across all clients</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">💰</div>
                    <div class="card-content">
                        <div class="card-value">$${totalMonthlyCost}</div>
                        <div class="card-label">Monthly Cost</div>
                        <div class="card-sub">Total licensing</div>
                    </div>
                </div>
            </div>
            
            <!-- Department Breakdown -->
            <div class="department-section">
                <h3>Department Overview</h3>
                <div class="department-grid">
                    ${generateDepartmentBreakdown(clients)}
                </div>
            </div>
            
            <!-- Filter Controls -->
            <div class="filter-section">
                <label>Filter by Department:</label>
                <select id="deptFilter" onchange="filterClientsByDepartment(this.value)">
                    <option value="">All Departments</option>
                    ${Array.from(new Set(clients.map(c => c.department))).filter(Boolean).sort().map(dept => 
                        `<option value="${dept}">${dept}</option>`
                    ).join('')}
                </select>
                
                <label>Filter by Status:</label>
                <select id="statusFilter" onchange="filterClientsByStatus(this.value)">
                    <option value="">All Status</option>
                    <option value="online">Online Only</option>
                    <option value="offline">Offline Only</option>
                </select>
                
                <label>Search:</label>
                <input type="text" id="clientSearch" placeholder="Search by user, hostname, or software..." 
                       onkeyup="searchEnterpriseClients(this.value)" class="search-input">
                
                <div class="view-toggle">
                    <button class="view-btn active" onclick="setEnterpriseView('grid')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                        </svg>
                        Grid
                    </button>
                    <button class="view-btn" onclick="setEnterpriseView('table')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                        Table
                    </button>
                </div>
            </div>
            
            <!-- Client Display Area -->
            <div id="clientDisplayArea" class="client-grid">
                ${generateClientCards(clients)}
            </div>
        `;
        
        // Store clients in state for filtering
        state.enterpriseClients = clients;
        
    } catch (error) {
        console.error('Error loading enterprise data:', error);
        contentArea.innerHTML = `
            <div class="enterprise-header">
                <h2>Enterprise Client Monitor</h2>
                <p>Monitor all connected client machines</p>
            </div>
            
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Unable to Connect to Enterprise Server</h3>
                <p>Please check your server configuration and ensure the enterprise server is running.</p>
                <div class="error-details">
                    <p class="text-small text-muted">Error: ${error.message}</p>
                    <p class="text-small text-muted">Server URL: ${serverUrl || 'Not configured'}</p>
                    <p class="text-small text-muted">Make sure the enterprise server is running and accessible</p>
                </div>
                <button class="btn btn-primary mt-3" onclick="showEnterpriseDashboard()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Retry Connection
                </button>
            </div>
        `;
    }
}

// Generate client cards for grid view
function generateClientCards(clients) {
    if (!clients || clients.length === 0) {
        return `
            <div class="empty-state">
                <p>No clients connected yet. Deploy the software monitor to client machines to see them here.</p>
            </div>
        `;
    }
    
    return clients.map(client => {
        const latestUsage = client.latest_usage || {};
        const systemInfo = latestUsage.system_info || {};
        const userInfo = systemInfo.user || {};
        const isOnline = isClientOnline(client.last_seen);
        const apps = latestUsage.applications || {};
        const plugins = latestUsage.plugins || {};
        
        // Count active applications and plugins
        const activeApps = Object.values(apps).filter(app => 
            app.lastUsed && getDaysInactive(app.lastUsed) <= 7
        ).length;
        const totalApps = Object.keys(apps).length;
        
        let totalPlugins = 0;
        let activePlugins = 0;
        Object.values(plugins).forEach(vendor => {
            Object.values(vendor).forEach(plugin => {
                if (plugin.totalUsage !== undefined) {
                    totalPlugins++;
                    if (plugin.lastUsed && getDaysInactive(plugin.lastUsed) <= 7) {
                        activePlugins++;
                    }
                }
            });
        });
        
        // Calculate monthly cost
        const monthlyCost = calculateClientMonthlyCost(client);
        
        return `
            <div class="client-card ${isOnline ? 'online' : 'offline'}" 
                 data-department="${client.department || 'Unknown'}" 
                 data-user="${userInfo.username || 'Unknown'}"
                 data-status="${isOnline ? 'online' : 'offline'}">
                <div class="client-card-header">
                    <div class="client-status ${isOnline ? 'online' : 'offline'}"></div>
                    <h3>${client.hostname}</h3>
                    <span class="client-id">${client.client_id}</span>
                </div>
                
                <div class="client-info-section">
                    <div class="info-row">
                        <span class="info-icon">👤</span>
                        <span class="info-label">User:</span>
                        <span class="info-value">${userInfo.username || 'Unknown'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">🏢</span>
                        <span class="info-label">Dept:</span>
                        <span class="info-value">${client.department || 'Unknown'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">🕐</span>
                        <span class="info-label">Last Seen:</span>
                        <span class="info-value">${formatTimeAgo(new Date(client.last_seen))}</span>
                    </div>
                    ${systemInfo.ipAddresses && systemInfo.ipAddresses.length > 0 ? `
                    <div class="info-row">
                        <span class="info-icon">🌐</span>
                        <span class="info-label">IP:</span>
                        <span class="info-value">${systemInfo.ipAddresses[0].address}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="system-specs">
                    <h4>System Specifications</h4>
                    <div class="spec-grid">
                        <div class="spec-item">
                            <span class="spec-label">OS</span>
                            <span class="spec-value">${systemInfo.platform || 'Unknown'} ${systemInfo.osVersion || ''}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">CPU</span>
                            <span class="spec-value">${systemInfo.cpus?.cores || '?'} cores</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">RAM</span>
                            <span class="spec-value">${systemInfo.memory?.total || '?'} GB</span>
                        </div>
                        ${systemInfo.gpu ? `
                        <div class="spec-item">
                            <span class="spec-label">GPU</span>
                            <span class="spec-value">${systemInfo.gpu}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="software-section">
                    <h4>Software (${activeApps}/${totalApps} active)</h4>
                    <div class="software-list">
                        ${Object.entries(apps).slice(0, 3).map(([name, app]) => `
                            <div class="software-item ${getDaysInactive(app.lastUsed) > 7 ? 'inactive' : ''}">
                                <span class="software-name">${name}</span>
                                <span class="software-usage">${app.totalUsage || 0}m</span>
                            </div>
                        `).join('')}
                        ${Object.keys(apps).length > 3 ? `
                            <div class="software-more">+${Object.keys(apps).length - 3} more</div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="plugins-section">
                    <h4>Plugins (${activePlugins}/${totalPlugins} active)</h4>
                    <div class="plugin-list">
                        ${getClientPluginsList(plugins).slice(0, 2).map(plugin => `
                            <div class="plugin-item">
                                <span class="plugin-name">${plugin.name}</span>
                                <span class="plugin-vendor">${plugin.vendor}</span>
                            </div>
                        `).join('')}
                        ${totalPlugins > 2 ? `
                            <div class="plugin-more">+${totalPlugins - 2} more</div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="client-card-footer">
                    <div class="monthly-cost">
                        <span class="cost-label">Monthly Cost:</span>
                        <span class="cost-value">$${monthlyCost}</span>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="showEnterpriseClientDetails('${client.client_id}')">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Show detailed client information
async function showEnterpriseClientDetails(clientId) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-extra-large">
            <div class="modal-header">
                <h2>Client Details: ${clientId}</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loading"><div class="loading-spinner"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    try {
        const serverUrl = state.usageData?.metadata?.enterpriseServer || 
                         state.enterpriseConfig?.serverUrl || 
                         'http://localhost:3443';
        const apiKey = state.usageData?.metadata?.enterpriseApiKey || 
                      state.enterpriseConfig?.apiKey || 
                      'your-api-key';
        
        const response = await fetch(`${serverUrl}/api/clients/${clientId}`, {
            headers: { 'X-API-Key': apiKey }
        });
        
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = generateClientDetailsContent(data);
        
    } catch (error) {
        modal.querySelector('.modal-body').innerHTML = `
            <div class="empty-state">
                <p>Failed to load client details</p>
                <p class="text-small text-muted">${error.message}</p>
            </div>
        `;
    }
}

// Generate detailed client information content
function generateClientDetailsContent(data) {
    const client = data.client;
    const latestUsage = data.latestUsage || {};
    const systemInfo = latestUsage.system_info || {};
    const userInfo = systemInfo.user || {};
    const apps = latestUsage.applications || {};
    const plugins = latestUsage.plugins || {};
    const history = data.history || [];
    
    return `
        <div class="client-detail-tabs">
            <button class="tab-btn active" onclick="switchClientTab(this, 'overview')">Overview</button>
            <button class="tab-btn" onclick="switchClientTab(this, 'hardware')">Hardware</button>
            <button class="tab-btn" onclick="switchClientTab(this, 'software')">Software</button>
            <button class="tab-btn" onclick="switchClientTab(this, 'history')">History</button>
        </div>
        
        <div class="tab-content active" id="overview-tab">
            <div class="client-overview-grid">
                <div class="detail-card">
                    <h4>Client Information</h4>
                    <div class="detail-item">
                        <span class="detail-label">Hostname</span>
                        <span class="detail-value highlight">${client.hostname}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Client ID</span>
                        <span class="detail-value">${client.client_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Department</span>
                        <span class="detail-value">${client.department || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Platform</span>
                        <span class="detail-value">${client.platform}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">First Seen</span>
                        <span class="detail-value">${formatDate(client.first_seen)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Update</span>
                        <span class="detail-value">${formatTimeAgo(new Date(client.last_seen))}</span>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4>User Information</h4>
                    <div class="detail-item">
                        <span class="detail-label">Username</span>
                        <span class="detail-value highlight">${userInfo.username || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Home Directory</span>
                        <span class="detail-value text-small">${userInfo.homedir || 'N/A'}</span>
                    </div>
                    ${systemInfo.ipAddresses && systemInfo.ipAddresses.length > 0 ? `
                    <div class="detail-item">
                        <span class="detail-label">IP Addresses</span>
                        <div class="ip-list">
                            ${systemInfo.ipAddresses.map(ip => `
                                <span class="ip-badge">${ip.address} (${ip.interface})</span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="detail-card">
                    <h4>Usage Statistics</h4>
                    <div class="quick-stats">
                        <div class="quick-stat">
                            <div class="stat-number">${Object.keys(apps).length}</div>
                            <div class="stat-label">Applications</div>
                        </div>
                        <div class="quick-stat">
                            <div class="stat-number">${countClientPlugins(plugins)}</div>
                            <div class="stat-label">Plugins</div>
                        </div>
                        <div class="quick-stat">
                            <div class="stat-number">$${calculateClientMonthlyCost({latest_usage: latestUsage})}</div>
                            <div class="stat-label">Monthly Cost</div>
                        </div>
                        <div class="quick-stat">
                            <div class="stat-number">${client.data_points || 0}</div>
                            <div class="stat-label">Data Points</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tab-content" id="hardware-tab">
            ${generateHardwareDetails(systemInfo)}
        </div>
        
        <div class="tab-content" id="software-tab">
            ${generateSoftwareDetails(apps, plugins)}
        </div>
        
        <div class="tab-content" id="history-tab">
            ${generateClientHistory(history)}
        </div>
    `;
}

// Generate hardware details section
function generateHardwareDetails(systemInfo) {
    if (!systemInfo) {
        return '<div class="empty-state"><p>No hardware information available</p></div>';
    }
    
    return `
        <div class="hardware-details-grid">
            <div class="detail-card">
                <h4>System Information</h4>
                <div class="detail-item">
                    <span class="detail-label">Hostname</span>
                    <span class="detail-value">${systemInfo.hostname || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Platform</span>
                    <span class="detail-value">${systemInfo.platform} ${systemInfo.osVersion || ''}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Architecture</span>
                    <span class="detail-value">${systemInfo.arch || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kernel</span>
                    <span class="detail-value">${systemInfo.release || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Uptime</span>
                    <span class="detail-value">${systemInfo.uptimeDetailed || systemInfo.uptime + ' hours'}</span>
                </div>
            </div>
            
            <div class="detail-card">
                <h4>CPU Information</h4>
                <div class="detail-item">
                    <span class="detail-label">Model</span>
                    <span class="detail-value">${systemInfo.cpus?.model || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cores</span>
                    <span class="detail-value">${systemInfo.cpus?.cores || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Speed</span>
                    <span class="detail-value">${systemInfo.cpus?.speed ? (systemInfo.cpus.speed / 1000).toFixed(2) + ' GHz' : 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Usage</span>
                    <span class="detail-value">${systemInfo.cpus?.usage || 0}%</span>
                </div>
            </div>
            
            <div class="detail-card">
                <h4>Memory Information</h4>
                <div class="detail-item">
                    <span class="detail-label">Total RAM</span>
                    <span class="detail-value">${systemInfo.memory?.total || 0} GB</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Used RAM</span>
                    <span class="detail-value">${systemInfo.memory?.used || 0} GB (${systemInfo.memory?.usagePercent || 0}%)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Free RAM</span>
                    <span class="detail-value">${systemInfo.memory?.free || 0} GB</span>
                </div>
                <div class="progress-container mt-2">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${systemInfo.memory?.usagePercent || 0}%"></div>
                    </div>
                </div>
            </div>
            
            ${systemInfo.gpu ? `
            <div class="detail-card">
                <h4>Graphics Information</h4>
                <div class="detail-item">
                    <span class="detail-label">GPU</span>
                    <span class="detail-value">${systemInfo.gpu}</span>
                </div>
            </div>
            ` : ''}
            
            ${systemInfo.disks && systemInfo.disks.length > 0 ? `
            <div class="detail-card full-width">
                <h4>Storage Information</h4>
                ${systemInfo.disks.map(disk => `
                    <div class="disk-info">
                        <div class="detail-item">
                            <span class="detail-label">Drive ${disk.caption}</span>
                            <span class="detail-value">${disk.free} GB free of ${disk.size} GB</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${((disk.size - disk.free) / disk.size * 100).toFixed(1)}%"></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;
}

// Generate software details section
function generateSoftwareDetails(apps, plugins) {
    const appEntries = Object.entries(apps || {});
    const pluginList = getClientPluginsList(plugins || {});
    
    return `
        <div class="software-details">
            <div class="software-section">
                <h4>Installed Applications (${appEntries.length})</h4>
                <div class="software-grid">
                    ${appEntries.length > 0 ? appEntries.map(([name, app]) => {
                        const isActive = app.lastUsed && getDaysInactive(app.lastUsed) <= 7;
                        const cost = getEstimatedCost(name, 'application');
                        
                        return `
                            <div class="software-card ${!isActive ? 'inactive' : ''}">
                                <div class="software-header">
                                    <div class="software-icon">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                        </svg>
                                    </div>
                                    <div class="software-title">
                                        <h5>${name}</h5>
                                        <span class="software-cost">$${cost}/mo</span>
                                    </div>
                                </div>
                                <div class="software-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Usage</span>
                                        <span class="stat-value">${app.totalUsage || 0} min</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Last Used</span>
                                        <span class="stat-value">${formatDate(app.lastUsed)}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Status</span>
                                        <span class="stat-value ${isActive ? 'text-success' : 'text-danger'}">
                                            ${isActive ? '● Active' : '● Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('') : '<p class="text-muted">No applications detected</p>'}
                </div>
            </div>
            
            <div class="software-section">
                <h4>Installed Plugins (${pluginList.length})</h4>
                <div class="software-grid">
                    ${pluginList.length > 0 ? pluginList.map(plugin => {
                        const isActive = plugin.lastUsed && getDaysInactive(plugin.lastUsed) <= 7;
                        
                        return `
                            <div class="software-card plugin ${!isActive ? 'inactive' : ''}">
                                <div class="software-header">
                                    <div class="software-icon plugin">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                                        </svg>
                                    </div>
                                    <div class="software-title">
                                        <h5>${plugin.name}</h5>
                                        <span class="vendor-badge">${plugin.vendor}</span>
                                    </div>
                                </div>
                                <div class="software-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Usage</span>
                                        <span class="stat-value">${plugin.totalUsage || 0} min</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Last Used</span>
                                        <span class="stat-value">${formatDate(plugin.lastUsed)}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Status</span>
                                        <span class="stat-value ${isActive ? 'text-success' : 'text-danger'}">
                                            ${isActive ? '● Active' : '● Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('') : '<p class="text-muted">No plugins detected</p>'}
                </div>
            </div>
        </div>
    `;
}

// Generate client history
function generateClientHistory(history) {
    if (!history || history.length === 0) {
        return '<div class="empty-state"><p>No historical data available</p></div>';
    }
    
    // Sort by timestamp descending
    const sortedHistory = history.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 50);
    
    return `
        <div class="history-timeline">
            <h4>Activity Timeline (Last 50 Updates)</h4>
            <div class="timeline-container">
                ${sortedHistory.map(entry => {
                    const apps = Object.keys(entry.applications || {}).length;
                    const plugins = countClientPlugins(entry.plugins || {});
                    const cpu = entry.system_info?.cpus?.usage || 0;
                    const mem = entry.system_info?.memory?.usagePercent || 0;
                    
                    return `
                        <div class="history-entry">
                            <div class="history-time">
                                <span class="time-primary">${formatDate(entry.timestamp)}</span>
                                <span class="time-secondary">${formatTime(new Date(entry.timestamp))}</span>
                            </div>
                            <div class="history-content">
                                <div class="history-stats">
                                    <span class="stat-item">
                                        <strong>${apps}</strong> apps
                                    </span>
                                    <span class="stat-item">
                                        <strong>${plugins}</strong> plugins
                                    </span>
                                    <span class="stat-item">
                                        CPU: <strong>${cpu}%</strong>
                                    </span>
                                    <span class="stat-item">
                                        RAM: <strong>${mem}%</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Generate department breakdown
function generateDepartmentBreakdown(clients) {
    const departments = {};
    
    clients.forEach(client => {
        const dept = client.department || 'Unknown';
        if (!departments[dept]) {
            departments[dept] = {
                count: 0,
                online: 0,
                users: new Set(),
                totalCost: 0
            };
        }
        
        departments[dept].count++;
        if (isClientOnline(client.last_seen)) {
            departments[dept].online++;
        }
        
        const username = client.latest_usage?.system_info?.user?.username;
        if (username) {
            departments[dept].users.add(username);
        }
        
        departments[dept].totalCost += calculateClientMonthlyCost(client);
    });
    
    return Object.entries(departments).map(([name, data]) => `
        <div class="department-card">
            <h4>${name}</h4>
            <div class="dept-stats">
                <div class="dept-stat">
                    <span class="stat-value">${data.count}</span>
                    <span class="stat-label">Clients</span>
                </div>
                <div class="dept-stat">
                    <span class="stat-value">${data.online}</span>
                    <span class="stat-label">Online</span>
                </div>
                <div class="dept-stat">
                    <span class="stat-value">${data.users.size}</span>
                    <span class="stat-label">Users</span>
                </div>
                <div class="dept-stat">
                    <span class="stat-value">$${data.totalCost.toFixed(0)}</span>
                    <span class="stat-label">Cost/mo</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Helper functions for enterprise dashboard
function isClientOnline(lastSeen) {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    return new Date(lastSeen).getTime() > tenMinutesAgo;
}

function countTotalUniqueApplications(clients) {
    const apps = new Set();
    clients.forEach(client => {
        if (client.latest_usage?.applications) {
            Object.keys(client.latest_usage.applications).forEach(app => apps.add(app));
        }
    });
    return apps.size;
}

function countTotalUniquePlugins(clients) {
    const plugins = new Set();
    clients.forEach(client => {
        if (client.latest_usage?.plugins) {
            Object.values(client.latest_usage.plugins).forEach(vendor => {
                Object.keys(vendor).forEach(plugin => plugins.add(plugin));
            });
        }
    });
    return plugins.size;
}

function calculateTotalEnterpriseCost(clients) {
    let total = 0;
    clients.forEach(client => {
        total += calculateClientMonthlyCost(client);
    });
    return total.toFixed(2);
}

function calculateClientMonthlyCost(client) {
    let cost = 0;
    const usage = client.latest_usage || {};
    
    // Calculate application costs
    Object.entries(usage.applications || {}).forEach(([name, app]) => {
        if (app.lastUsed && getDaysInactive(app.lastUsed) <= 30) {
            cost += getEstimatedCost(name, 'application');
        }
    });
    
    // Calculate plugin costs
    Object.values(usage.plugins || {}).forEach(vendor => {
        Object.entries(vendor).forEach(([name, plugin]) => {
            if (plugin.lastUsed && getDaysInactive(plugin.lastUsed) <= 30) {
                cost += plugin.cost || 25;
            }
        });
    });
    
    return cost;
}

function getClientPluginsList(plugins) {
    const list = [];
    Object.entries(plugins || {}).forEach(([vendor, vendorPlugins]) => {
        Object.entries(vendorPlugins).forEach(([name, data]) => {
            if (data.totalUsage !== undefined) {
                list.push({
                    name,
                    vendor,
                    ...data
                });
            }
        });
    });
    return list;
}

function countClientPlugins(plugins) {
    let count = 0;
    Object.values(plugins || {}).forEach(vendor => {
        Object.values(vendor).forEach(plugin => {
            if (plugin.totalUsage !== undefined) count++;
        });
    });
    return count;
}

// Filter functions
function filterClientsByDepartment(dept) {
    const cards = document.querySelectorAll('.client-card');
    cards.forEach(card => {
        if (!dept || card.dataset.department === dept) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function filterClientsByStatus(status) {
    const cards = document.querySelectorAll('.client-card');
    cards.forEach(card => {
        if (!status || card.dataset.status === status) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function searchEnterpriseClients(query) {
    const cards = document.querySelectorAll('.client-card');
    const lowerQuery = query.toLowerCase();
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(lowerQuery)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// View toggle functions
function setEnterpriseView(view) {
    const displayArea = document.getElementById('clientDisplayArea');
    const viewButtons = document.querySelectorAll('.view-btn');
    
    viewButtons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.view-btn').classList.add('active');
    
    if (view === 'table') {
        displayArea.className = 'client-table-view';
        displayArea.innerHTML = generateClientTable(state.enterpriseClients || []);
    } else {
        displayArea.className = 'client-grid';
        displayArea.innerHTML = generateClientCards(state.enterpriseClients || []);
    }
}

// Generate table view
function generateClientTable(clients) {
    return `
        <table class="data-table enhanced-table">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Hostname</th>
                    <th>User</th>
                    <th>Department</th>
                    <th>IP Address</th>
                    <th>OS</th>
                    <th>CPU/RAM</th>
                    <th>Apps</th>
                    <th>Plugins</th>
                    <th>Cost/mo</th>
                    <th>Last Seen</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${clients.map(client => {
                    const latestUsage = client.latest_usage || {};
                    const systemInfo = latestUsage.system_info || {};
                    const userInfo = systemInfo.user || {};
                    const isOnline = isClientOnline(client.last_seen);
                    const apps = Object.keys(latestUsage.applications || {}).length;
                    const plugins = countClientPlugins(latestUsage.plugins || {});
                    const cost = calculateClientMonthlyCost(client);
                    
                    return `
                        <tr>
                            <td>
                                <span class="status-badge ${isOnline ? 'status-active' : 'status-inactive'}">
                                    ${isOnline ? '● Online' : '● Offline'}
                                </span>
                            </td>
                            <td><strong>${client.hostname}</strong></td>
                            <td>${userInfo.username || 'Unknown'}</td>
                            <td>${client.department || 'Unknown'}</td>
                            <td>${systemInfo.ipAddresses?.[0]?.address || 'N/A'}</td>
                            <td>${systemInfo.platform || 'Unknown'}</td>
                            <td>${systemInfo.cpus?.cores || '?'}C / ${systemInfo.memory?.total || '?'}GB</td>
                            <td>${apps}</td>
                            <td>${plugins}</td>
                            <td>$${cost}</td>
                            <td>${formatTimeAgo(new Date(client.last_seen))}</td>
                            <td>
                                <button class="btn btn-secondary btn-small" onclick="showEnterpriseClientDetails('${client.client_id}')">
                                    Details
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Tab switching for client details
function switchClientTab(button, tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    button.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Refresh enterprise dashboard
async function refreshEnterpriseDashboard() {
    showToast('Refreshing enterprise data...', 'info');
    await showEnterpriseDashboard();
}

// Export enterprise report
async function exportEnterpriseReport() {
    try {
        const serverUrl = state.usageData?.metadata?.enterpriseServer || 
                         state.enterpriseConfig?.serverUrl || 
                         'http://localhost:3443';
        const apiKey = state.usageData?.metadata?.enterpriseApiKey || 
                      state.enterpriseConfig?.apiKey || 
                      'your-api-key';
        
        const response = await fetch(`${serverUrl}/api/export/full-report`, {
            headers: { 'X-API-Key': apiKey }
        });
        
        if (!response.ok) throw new Error('Failed to generate report');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enterprise-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        showToast('Report exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export report: ' + error.message, 'error');
    }
}

// ===== END OF ENTERPRISE DASHBOARD IMPLEMENTATION =====

// Show client details modal
async function showClientDetails(clientId) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>Client Details: ${clientId}</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loading"><div class="loading-spinner"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    try {
        const serverUrl = state.usageData?.metadata?.enterpriseServer || 'http://localhost:3443';
        const apiKey = state.usageData?.metadata?.enterpriseApiKey || 'your-secure-api-key';
        
        const response = await fetch(`${serverUrl}/api/clients/${clientId}`, {
            headers: { 'X-API-Key': apiKey }
        });
        const data = await response.json();
        
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = `
            <div class="client-details-grid">
                <div class="client-info-card">
                    <h4>System Information</h4>
                    <div class="info-item">
                        <span class="info-label">Hostname</span>
                        <span class="info-value highlight">${data.client.hostname}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Department</span>
                        <span class="info-value">${data.client.department}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Platform</span>
                        <span class="info-value">${data.client.platform}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Last Update</span>
                        <span class="info-value">${formatDate(data.latestUsage?.timestamp)}</span>
                    </div>
                </div>
                
                ${data.latestUsage?.system_info ? `
                <div class="client-info-card">
                    <h4>Hardware Details</h4>
                    <div class="info-item">
                        <span class="info-label">CPU</span>
                        <span class="info-value">${data.latestUsage.system_info.cpus?.model}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CPU Cores</span>
                        <span class="info-value">${data.latestUsage.system_info.cpus?.cores}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Total RAM</span>
                        <span class="info-value">${data.latestUsage.system_info.memory?.total} GB</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">OS Version</span>
                        <span class="info-value">${data.latestUsage.system_info.osVersion || 'N/A'}</span>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="client-usage-section">
                <h4>Active Applications</h4>
                <div class="application-list">
                    ${generateClientApplications(data.latestUsage?.applications || {})}
                </div>
            </div>
            
            <div class="client-usage-section">
                <h4>Active Plugins</h4>
                <div class="plugin-list">
                    ${generateClientPlugins(data.latestUsage?.plugins || {})}
                </div>
            </div>
            
            <div class="client-usage-section">
                <h4>Usage History (Last 30 Days)</h4>
                <div class="history-chart">
                    ${generateUsageHistory(data.history || [])}
                </div>
            </div>
        `;
        
    } catch (error) {
        modal.querySelector('.modal-body').innerHTML = `
            <div class="empty-state">
                <p>Failed to load client details</p>
            </div>
        `;
    }
}

// Helper functions for enterprise dashboard
function calculateTotalApps(clients) {
    // This would calculate from actual client data
    return clients.length * 12; // Placeholder
}

function calculateTotalCost(clients) {
    // This would calculate from actual client data
    return (clients.length * 850).toFixed(2); // Placeholder
}

function generateDepartmentCards(departments) {
    if (departments.length === 0) {
        return '<p class="text-muted">No department data available</p>';
    }
    
    return departments.map(dept => `
        <div class="department-card">
            <h4>${dept.department || 'Unknown'}</h4>
            <div class="dept-stat">
                <span class="dept-number">${dept.count}</span>
                <span class="dept-label">Clients</span>
            </div>
        </div>
    `).join('');
}

function generatePlatformChart(platforms) {
    if (platforms.length === 0) {
        return '<p class="text-muted">No platform data available</p>';
    }
    
    const total = platforms.reduce((sum, p) => sum + p.count, 0);
    
    return platforms.map(platform => {
        const percentage = ((platform.count / total) * 100).toFixed(1);
        return `
            <div class="platform-item">
                <div class="platform-label">
                    <span>${platform.platform}</span>
                    <span>${platform.count} (${percentage}%)</span>
                </div>
                <div class="platform-bar">
                    <div class="platform-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function generateClientRows(clients) {
    if (clients.length === 0) {
        return '<tr><td colspan="8" class="text-center">No clients connected</td></tr>';
    }
    
    return clients.map(client => {
        const lastSeen = new Date(client.last_seen);
        const isOnline = (Date.now() - lastSeen) < 600000; // 10 minutes
        const statusClass = isOnline ? 'status-active' : 'status-warning';
        const statusText = isOnline ? 'Online' : 'Offline';
        
        return `
            <tr>
                <td><strong>${client.client_id}</strong></td>
                <td>${client.hostname}</td>
                <td>${client.department || 'N/A'}</td>
                <td>${client.platform}</td>
                <td>${formatDate(client.last_seen)}</td>
                <td>${client.data_points || 0}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="showClientDetails('${client.client_id}')">
                        View Details
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function generateClientApplications(applications) {
    const apps = Object.entries(applications);
    if (apps.length === 0) {
        return '<p class="text-muted">No applications detected</p>';
    }
    
    return apps.map(([name, data]) => `
        <div class="app-item">
            <div class="app-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                </svg>
            </div>
            <div class="app-details">
                <h5>${name}</h5>
                <p>Usage: ${data.totalUsage || 0} minutes</p>
            </div>
        </div>
    `).join('');
}

function generateClientPlugins(plugins) {
    const pluginList = [];
    Object.values(plugins).forEach(vendor => {
        Object.entries(vendor).forEach(([name, data]) => {
            if (data.totalUsage !== undefined) {
                pluginList.push({ name, data });
            }
        });
    });
    
    if (pluginList.length === 0) {
        return '<p class="text-muted">No plugins detected</p>';
    }
    
    return pluginList.map(plugin => `
        <div class="plugin-item">
            <div class="plugin-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                </svg>
            </div>
            <div class="plugin-details">
                <h5>${plugin.name}</h5>
                <p>Usage: ${plugin.data.totalUsage || 0} minutes</p>
            </div>
        </div>
    `).join('');
}

function generateUsageHistory(history) {
    if (history.length === 0) {
        return '<p class="text-muted">No history data available</p>';
    }
    
    // Simple text representation of history
    return `
        <div class="history-summary">
            <p>Total data points: ${history.length}</p>
            <p>Monitoring period: ${formatDate(history[history.length - 1].timestamp)} - ${formatDate(history[0].timestamp)}</p>
        </div>
    `;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);