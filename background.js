// Background Service Worker - Fixed Version
console.log('🚀 ExfilGuard background script starting...');

let detectedEvents = [];

// Initialize on startup
self.addEventListener('install', () => {
    console.log('📦 Extension installed');
});

self.addEventListener('activate', () => {
    console.log('✅ Extension activated');
    loadStoredEvents();
});

// Load stored events on startup
async function loadStoredEvents() {
    try {
        const result = await chrome.storage.local.get(['detectedEvents']);
        if (result.detectedEvents) {
            detectedEvents = result.detectedEvents;
            console.log(`📂 Loaded ${detectedEvents.length} stored events`);
            updateBadge();
        } else {
            console.log('📂 No stored events found');
        }
    } catch (error) {
        console.error('❌ Error loading events:', error);
    }
}

// Load on install/update as well
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔧 Extension installed/updated');
    loadStoredEvents();
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message.type);
    
    // Handle async responses properly
    handleMessage(message, sender, sendResponse);
    
    // Return true to indicate we'll respond asynchronously
    return true;
});

async function handleMessage(message, sender, sendResponse) {
    try {
        switch (message.type) {
            case "DETECTION_EVENT":
                await handleDetectionEvent(message.data, sender.tab);
                sendResponse({ received: true });
                break;
                
            case "GET_EVENTS":
                const filter = message.filter || {};
                let filteredEvents = [...detectedEvents];
                
                // Apply filters
                if (filter.severity) {
                    filteredEvents = filteredEvents.filter(e => e.severity === filter.severity);
                }
                if (filter.type) {
                    filteredEvents = filteredEvents.filter(e => e.type === filter.type);
                }
                if (filter.limit) {
                    filteredEvents = filteredEvents.slice(-filter.limit);
                }
                
                // Calculate high risk count
                const highRiskCount = detectedEvents.filter(e => 
                    e.severity === 'high' || e.severity === 'critical'
                ).length;
                
                console.log(`📊 Sending ${filteredEvents.length} events to popup`);
                sendResponse({ 
                    events: filteredEvents, 
                    total: detectedEvents.length,
                    highRisk: highRiskCount
                });
                break;
                
            case "CLEAR_EVENTS":
                detectedEvents = [];
                await chrome.storage.local.set({ 
                    'detectedEvents': [],
                    'lastUpdate': new Date().toISOString()
                });
                updateBadge();
                console.log('🗑️ All events cleared');
                sendResponse({ success: true });
                break;
                
            case "GET_STATS":
                const stats = {
                    totalEvents: detectedEvents.length,
                    highRiskEvents: detectedEvents.filter(e => 
                        e.severity === 'high' || e.severity === 'critical'
                    ).length,
                    uniqueDomains: getUniqueDomains(),
                    eventsToday: getEventsToday()
                };
                sendResponse({ stats });
                break;
                
            default:
                console.warn('⚠️ Unknown message type:', message.type);
                sendResponse({ error: "Unknown message type" });
        }
    } catch (error) {
        console.error('❌ Error handling message:', error);
        sendResponse({ error: error.message });
    }
}

// Handle incoming detection events
async function handleDetectionEvent(eventData, tab) {
    console.log('🔍 Handling detection event:', eventData.type);
    
    try {
        // Add tab info
        eventData.tabId = tab?.id;
        eventData.tabUrl = tab?.url;
        eventData.timestamp = eventData.timestamp || new Date().toISOString();
        eventData.id = Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Ensure severity is set
        if (!eventData.severity) {
            eventData.severity = determineSeverity(eventData);
        }
        
        // Store event
        detectedEvents.push(eventData);
        
        // Keep only last 1000 events
        if (detectedEvents.length > 1000) {
            detectedEvents = detectedEvents.slice(-1000);
        }
        
        // Save to storage
        await chrome.storage.local.set({ 
            'detectedEvents': detectedEvents,
            'lastUpdate': new Date().toISOString()
        });
        
        // Update badge
        updateBadge();
        
        // Send notification for high severity events
        if (eventData.severity === 'high' || eventData.severity === 'critical') {
            showNotification(eventData);
        }
        
        console.log('✅ Detection logged:', eventData.type);
    } catch (error) {
        console.error('❌ Error handling detection event:', error);
    }
}

// Determine severity based on event type and data
function determineSeverity(eventData) {
    const { type, fieldName, value } = eventData;
    
    // High severity for sensitive data
    if (fieldName) {
        const sensitiveFields = ['password', 'credit', 'card', 'ssn', 'cvv', 'secret', 'token', 'auth'];
        const fieldLower = fieldName.toLowerCase();
        if (sensitiveFields.some(field => fieldLower.includes(field))) {
            return 'high';
        }
    }
    
    if (type === 'password') {
        return 'high';
    }
    
    if (type === 'clipboard_copy' || type === 'clipboard_paste') {
        return 'medium';
    }
    
    if (type === 'fetch_request' || type === 'xhr_request') {
        const body = JSON.stringify(eventData);
        if (body.includes('password') || body.includes('credit_card')) {
            return 'high';
        }
        return 'medium';
    }
    
    return 'low';
}

// Update extension badge
function updateBadge() {
    try {
        const highSeverityCount = detectedEvents.filter(e => 
            e.severity === 'high' || e.severity === 'critical'
        ).length;
        
        if (highSeverityCount > 0) {
            chrome.action.setBadgeText({ 
                text: highSeverityCount > 99 ? '99+' : highSeverityCount.toString() 
            });
            chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
        
        console.log(`🏷️ Badge updated: ${highSeverityCount} high-risk events`);
    } catch (error) {
        console.error('❌ Error updating badge:', error);
    }
}

// Show notification for high severity events
function showNotification(eventData) {
    try {
        const notificationId = 'exfilguard-' + Date.now();
        
        let title = 'ExfilGuard Alert';
        let message = `${eventData.type} detected`;
        
        switch (eventData.type) {
            case 'form_input':
                title = 'Sensitive Input Detected';
                message = `Field: ${eventData.fieldName || 'Unknown'}`;
                break;
            case 'fetch_request':
            case 'xhr_request':
                title = 'Data Transmission Detected';
                message = 'Sensitive data being sent';
                break;
            case 'clipboard_copy':
            case 'clipboard_paste':
                title = 'Clipboard Access';
                message = `Clipboard ${eventData.type === 'clipboard_copy' ? 'copy' : 'paste'} detected`;
                break;
        }
        
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: title,
            message: message,
            priority: 2
        });
        
        console.log('🔔 Notification sent:', notificationId);
    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
}

// Helper function to get unique domains from events
function getUniqueDomains() {
    const domains = new Set();
    detectedEvents.forEach(event => {
        if (event.url || event.tabUrl) {
            try {
                const url = new URL(event.url || event.tabUrl);
                domains.add(url.hostname);
            } catch (error) {
                // Invalid URL, skip
            }
        }
    });
    return domains.size;
}

// Helper function to get events from today
function getEventsToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return detectedEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= today;
    }).length;
}

// Periodic cleanup of old events (older than 7 days)
setInterval(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const initialCount = detectedEvents.length;
    detectedEvents = detectedEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= sevenDaysAgo;
    });
    
    if (detectedEvents.length < initialCount) {
        console.log(`🧹 Cleaned up ${initialCount - detectedEvents.length} old events`);
        chrome.storage.local.set({ 
            'detectedEvents': detectedEvents,
            'lastUpdate': new Date().toISOString()
        });
        updateBadge();
    }
}, 3600000); // Run every hour

// Keep service worker alive
setInterval(() => {
    console.log('💓 Service worker heartbeat');
}, 20000); // Every 20 seconds

console.log('✅ Background script fully loaded and ready!');