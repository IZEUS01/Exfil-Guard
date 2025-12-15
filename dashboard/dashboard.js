// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loaded');
    
    // Load initial data
    loadDashboardData();
    
    // Setup event listeners
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('clearBtn').addEventListener('click', clearEvents);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Auto-refresh every 30 seconds
    setInterval(refreshData, 30000);
});

// Add configuration section
function loadUserSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['exfilguard_config', 'detectedEvents'], (result) => {
      const config = result.exfilguard_config || {};
      const stats = {
        totalEvents: result.detectedEvents?.length || 0,
        config: config
      };
      resolve(stats);
    });
  });
}

// Update dashboard with config info
async function updateConfigPanel() {
  const stats = await loadUserSettings();
  const configHtml = `
    <div class="config-panel">
      <h3>Monitoring Settings</h3>
      <div>DOM Monitoring: ${stats.config.dom_monitoring ? '✅ On' : '❌ Off'}</div>
      <div>Network Monitoring: ${stats.config.network_monitoring ? '✅ On' : '❌ Off'}</div>
      <div>Alert Level: ${stats.config.min_severity || 'medium'}+</div>
    </div>
  `;
  
  // Add to dashboard
  const container = document.querySelector('.dashboard-container');
  const panel = document.createElement('div');
  panel.innerHTML = configHtml;
  container.appendChild(panel);
}

async function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    try {
        // Get events from background script
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: "GET_EVENTS" }, resolve);
        });
        
        console.log('Received response:', response);
        
        if (response && response.events) {
            updateStats(response);
            updateEventsTable(response.events);
        } else {
            console.error('No events in response:', response);
            showError('No data received from extension');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Error loading data: ' + error.message);
    }
}

function updateStats(response) {
    document.getElementById('totalEvents').textContent = response.total;
    
    const highRiskCount = response.events.filter(e => 
        e.severity === 'high' || e.severity === 'critical'
    ).length;
    document.getElementById('highRiskEvents').textContent = highRiskCount;
    
    // Calculate unique websites
    const uniqueSites = new Set();
    response.events.forEach(event => {
        const url = event.url || event.tabUrl;
        if (url && url !== 'Unknown' && url !== 'Current Page') {
            try {
                const urlObj = new URL(url);
                uniqueSites.add(urlObj.hostname);
            } catch (error) {
                uniqueSites.add(url);
            }
        }
    });
    document.getElementById('protectedSites').textContent = Math.max(1, uniqueSites.size);
}

function updateEventsTable(events) {
    const tbody = document.getElementById('eventsTableBody');
    
    if (!events || events.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <div style="opacity: 0.6;">No security events detected yet</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    tbody.innerHTML = events.slice(0, 10).map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const date = new Date(event.timestamp).toLocaleDateString();
        
        return `
            <tr>
                <td>${date} ${time}</td>
                <td>${getEventTypeLabel(event.type)}</td>
                <td><span class="severity-badge ${event.severity || 'low'}">${event.severity?.toUpperCase() || 'LOW'}</span></td>
                <td>${getHostname(event.url || event.tabUrl)}</td>
                <td>${event.fieldName || event.details || '—'}</td>
            </tr>
        `;
    }).join('');
}

function getEventTypeLabel(type) {
    const labels = {
        'form_input': 'Form Input',
        'clipboard_copy': 'Clipboard Copy',
        'clipboard_paste': 'Clipboard Paste',
        'fetch_request': 'Network Request',
        'xhr_request': 'XHR Request',
        'localstorage_read': 'Storage Read',
        'localstorage_write': 'Storage Write'
    };
    return labels[type] || type || 'Unknown';
}

function getHostname(url) {
    if (!url || url === 'Unknown' || url === 'Current Page') {
        return 'Current Page';
    }
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        return url.length > 20 ? url.substring(0, 20) + '...' : url;
    }
}

function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.style.animation = 'spin 1s linear';
    
    loadDashboardData();
    
    setTimeout(() => {
        btn.style.animation = '';
    }, 1000);
}

function clearEvents() {
    if (confirm('Clear all logged events? This cannot be undone.')) {
        chrome.runtime.sendMessage({ type: "CLEAR_EVENTS" }, (response) => {
            if (response && response.success) {
                loadDashboardData();
                showNotification('All events cleared successfully');
            } else {
                showError('Failed to clear events');
            }
        });
    }
}

function exportData() {
    chrome.runtime.sendMessage({ type: "GET_EVENTS" }, (response) => {
        if (response && response.events) {
            const dataStr = JSON.stringify(response.events, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = `exfilguard-report-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
            
            showNotification('Report exported successfully');
        } else {
            showError('No data to export');
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshData();
        }
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportData();
        }
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            clearEvents();
        }
    });
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(76, 175, 80, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showError(message) {
    // Create error notification
    const error = document.createElement('div');
    error.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(220, 53, 69, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    error.textContent = message;
    
    document.body.appendChild(error);
    
    setTimeout(() => {
        error.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => {
            if (error.parentNode) {
                error.parentNode.removeChild(error);
            }
        }, 300);
    }, 5000);
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);