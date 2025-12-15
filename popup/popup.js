console.log('🚀 Popup script starting...');
        
        // Button handlers - defined first
        function openDashboard() {
            console.log('📊 Dashboard button clicked');
            try {
                const url = chrome.runtime.getURL('dashboard/dashboard.html');
                console.log('Opening:', url);
                chrome.tabs.create({ url: url }, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        alert('Error: ' + chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Opened tab:', tab.id);
                    }
                });
            } catch (error) {
                console.error('❌ Exception:', error);
                alert('Error: ' + error.message);
            }
        }
        
        function clearEvents() {
            console.log('🗑️ Clear button clicked');
            if (confirm('Clear all logged events?')) {
                chrome.runtime.sendMessage({ type: "CLEAR_EVENTS" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        alert('Error clearing events');
                    } else {
                        console.log('✅ Events cleared');
                        loadEvents();
                    }
                });
            }
        }
        
        function refreshData() {
            console.log('🔄 Refresh button clicked');
            loadEvents();
        }
        
        // Load events from background
        function loadEvents() {
            console.log('📡 Loading events...');
            
            chrome.runtime.sendMessage(
                { type: "GET_EVENTS", filter: { limit: 10 } },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Error:', chrome.runtime.lastError);
                        showError('Failed to load events');
                        return;
                    }
                    
                    if (response && response.events) {
                        console.log('✅ Received', response.events.length, 'events');
                        updateStats(response);
                        displayEvents(response.events);
                        document.getElementById('lastUpdate').textContent = 
                            'Last updated: ' + new Date().toLocaleTimeString();
                    } else {
                        console.warn('⚠️ No response data');
                        showError('No data received');
                    }
                }
            );
        }
        
        function updateStats(response) {
            document.getElementById('totalEvents').textContent = response.total || 0;
            document.getElementById('highRiskEvents').textContent = response.highRisk || 0;
            
            const events = response.events || [];
            const lastHour = new Date(Date.now() - 3600000);
            const activeSites = new Set(
                events
                    .filter(e => new Date(e.timestamp) > lastHour)
                    .map(e => e.url || e.tabUrl)
                    .filter(url => url)
            ).size;
            
            document.getElementById('activeSites').textContent = activeSites;
        }
        
        function displayEvents(events) {
            const container = document.getElementById('eventsList');
            
            if (!events || events.length === 0) {
                container.innerHTML = '<div class="empty-state">No threats detected yet<br>Browsing safely!</div>';
                return;
            }
            
            container.innerHTML = '';
            
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            events.slice(0, 5).forEach(event => {
                const div = document.createElement('div');
                div.className = `event-item ${event.severity || 'low'}`;
                
                const time = formatTime(event.timestamp);
                const type = getEventLabel(event.type);
                const detail = event.fieldName || event.url || '';
                
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong>${type}</strong>
                        <span style="font-size: 10px; opacity: 0.7;">${time}</span>
                    </div>
                    <div style="font-size: 11px; opacity: 0.8;">${detail}</div>
                `;
                
                container.appendChild(div);
            });
        }
        
        function getEventLabel(type) {
            const labels = {
                'form_input': '🔐 Form Input',
                'clipboard_copy': '📋 Clipboard Copy',
                'clipboard_paste': '📋 Clipboard Paste',
                'fetch_request': '🌐 Network Request',
                'xhr_request': '📡 XHR Request',
                'localstorage_read': '💾 Storage Read',
                'localstorage_write': '💾 Storage Write'
            };
            return labels[type] || type;
        }
        
        function formatTime(timestamp) {
            try {
                const date = new Date(timestamp);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                
                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins}m ago`;
                if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
                return date.toLocaleDateString();
            } catch (e) {
                return 'Unknown';
            }
        }
        
        function showError(message) {
            console.error('Error:', message);
            document.getElementById('eventsList').innerHTML = 
                `<div class="empty-state" style="color: #ff6b6b;">⚠️ ${message}</div>`;
        }
        
        // Attach button listeners when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('✅ DOM ready, attaching listeners...');
            
            const dashboardBtn = document.getElementById('dashboardBtn');
            const clearBtn = document.getElementById('clearBtn');
            const refreshBtn = document.getElementById('refreshBtn');
            
            if (dashboardBtn) {
                dashboardBtn.onclick = openDashboard;
                console.log('✅ Dashboard button attached');
            } else {
                console.error('❌ Dashboard button not found!');
            }
            
            if (clearBtn) {
                clearBtn.onclick = clearEvents;
                console.log('✅ Clear button attached');
            } else {
                console.error('❌ Clear button not found!');
            }
            
            if (refreshBtn) {
                refreshBtn.onclick = refreshData;
                console.log('✅ Refresh button attached');
            } else {
                console.error('❌ Refresh button not found!');
            }
            
            // Load initial data
            loadEvents();
            
            // Auto-refresh every 5 seconds
            setInterval(loadEvents, 5000);
            
            console.log('✅ Popup fully initialized!');
        });
        
        // Also try immediate attachment (backup)
        window.onload = function() {
            console.log('Window loaded');
            if (!document.getElementById('dashboardBtn').onclick) {
                console.log('Attaching backup listeners...');
                document.getElementById('dashboardBtn').onclick = openDashboard;
                document.getElementById('clearBtn').onclick = clearEvents;
                document.getElementById('refreshBtn').onclick = refreshData;
            }
        };
        
        console.log('✅ Script loaded, waiting for DOM...');
