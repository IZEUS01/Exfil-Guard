// Content Script - Working Version
console.log('🛡️ ExfilGuard content script loaded on:', window.location.href);

// Initialize monitoring immediately
(function() {
    'use strict';
    
    // Monitor form inputs
    document.addEventListener('input', function(e) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            console.log('📝 Input detected:', target.type, target.name || target.id);
            
            const eventData = {
                type: 'form_input',
                fieldType: target.type,
                fieldName: target.name || target.id || 'unnamed',
                value: target.value.substring(0, 50), // Only first 50 chars
                url: window.location.href,
                timestamp: new Date().toISOString()
            };
            
            // Check if it's sensitive data
            const sensitivePatterns = ['password', 'credit', 'card', 'ssn', 'cvv', 'secret', 'token'];
            const fieldName = (target.name || target.id || '').toLowerCase();
            const fieldType = target.type.toLowerCase();
            
            const isSensitive = sensitivePatterns.some(pattern => 
                fieldName.includes(pattern) || fieldType === 'password'
            );
            
            if (isSensitive) {
                eventData.severity = 'high';
                console.log('🚨 SENSITIVE INPUT DETECTED:', fieldName);
                logDetection(eventData);
                showAlert(`Sensitive input detected: ${eventData.fieldName}`, 'high');
            } else if (target.value.length > 10) {
                // Log any significant input
                eventData.severity = 'low';
                logDetection(eventData);
            }
        }
    }, true);
    
    // Monitor clipboard events
    document.addEventListener('copy', function(e) {
        console.log('📋 Copy event detected');
        const selection = window.getSelection().toString();
        if (selection.length > 20) {
            const eventData = {
                type: 'clipboard_copy',
                data: selection.substring(0, 100),
                length: selection.length,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                severity: selection.length > 100 ? 'medium' : 'low'
            };
            console.log('📋 Clipboard copy logged:', selection.length, 'chars');
            logDetection(eventData);
            showAlert('Clipboard copy detected', 'medium');
        }
    }, true);
    
    document.addEventListener('paste', function(e) {
        console.log('📋 Paste event detected');
        try {
            const pastedData = e.clipboardData.getData('text');
            if (pastedData.length > 10) {
                const eventData = {
                    type: 'clipboard_paste',
                    data: pastedData.substring(0, 100),
                    length: pastedData.length,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    severity: 'medium'
                };
                console.log('📋 Clipboard paste logged:', pastedData.length, 'chars');
                logDetection(eventData);
                showAlert('Clipboard paste detected', 'medium');
            }
        } catch (error) {
            console.log('Could not access clipboard data');
        }
    }, true);
    
    // Monitor localStorage access
    const originalSetItem = localStorage.setItem;
    const originalGetItem = localStorage.getItem;
    
    localStorage.setItem = function(key, value) {
        console.log('💾 localStorage write:', key);
        const eventData = {
            type: 'localstorage_write',
            key: key,
            value: typeof value === 'string' ? value.substring(0, 50) : String(value).substring(0, 50),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            severity: key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') ? 'medium' : 'low'
        };
        logDetection(eventData);
        return originalSetItem.apply(this, arguments);
    };
    
    localStorage.getItem = function(key) {
        console.log('💾 localStorage read:', key);
        const value = originalGetItem.apply(this, arguments);
        const eventData = {
            type: 'localstorage_read',
            key: key,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            severity: key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') ? 'medium' : 'low'
        };
        logDetection(eventData);
        return value;
    };
    
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options] = args;
        console.log('🌐 Fetch request:', url);
        
        if (options && options.body) {
            const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            const eventData = {
                type: 'fetch_request',
                url: url,
                method: options.method || 'GET',
                body: bodyStr.substring(0, 200),
                timestamp: new Date().toISOString(),
                severity: 'medium'
            };
            
            // Check for sensitive data
            if (bodyStr.match(/password|credit_card|token|ssn/i)) {
                eventData.severity = 'high';
                console.log('🚨 SENSITIVE DATA in fetch request!');
                showAlert('Sensitive data being sent via network', 'high');
            }
            
            logDetection(eventData);
        }
        
        return originalFetch.apply(this, args);
    };
    
    // Monitor XHR requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._exfilguardData = { method, url };
        console.log('📡 XHR request opened:', method, url);
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        if (body && this._exfilguardData) {
            console.log('📡 XHR request sent');
            const bodyStr = typeof body === 'string' ? body : String(body);
            const eventData = {
                type: 'xhr_request',
                ...this._exfilguardData,
                body: bodyStr.substring(0, 200),
                timestamp: new Date().toISOString(),
                severity: 'medium'
            };
            
            // Check for sensitive data
            if (bodyStr.match(/password|credit_card|token|ssn/i)) {
                eventData.severity = 'high';
                console.log('🚨 SENSITIVE DATA in XHR request!');
                showAlert('Sensitive data being sent via XHR', 'high');
            }
            
            logDetection(eventData);
        }
        return originalXHRSend.apply(this, arguments);
    };
    
    // Send detection to background script
    function logDetection(eventData) {
        console.log('📤 Sending event to background:', eventData);
        try {
            chrome.runtime.sendMessage({
                type: "DETECTION_EVENT",
                data: eventData
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Error sending to background:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Event logged successfully:', response);
                }
            });
        } catch (error) {
            console.error('❌ Failed to send message:', error);
        }
    }
    
    // Show visual alert on page
    function showAlert(message, severity = 'info') {
        console.log('🔔 Showing alert:', message);
        
        // Remove old alerts first
        const oldAlerts = document.querySelectorAll('.exfilguard-alert');
        oldAlerts.forEach(alert => alert.remove());
        
        const severityColors = {
            critical: '#dc3545',
            high: '#ff6b6b',
            medium: '#ffa726',
            low: '#4CAF50',
            info: '#17a2b8'
        };
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'exfilguard-alert';
        alertDiv.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
            border-left: 5px solid ${severityColors[severity]} !important;
            color: white !important;
            padding: 15px 20px !important;
            border-radius: 10px !important;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3) !important;
            z-index: 2147483647 !important;
            max-width: 350px !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            animation: slideInAlert 0.5s ease-out !important;
            backdrop-filter: blur(10px) !important;
        `;
        
        alertDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong style="color: ${severityColors[severity]}; display: block; margin-bottom: 8px;">
                        ${severity.toUpperCase()} ALERT
                    </strong>
                    <div>${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0 0 0 10px;">
                    ×
                </button>
            </div>
            <div style="margin-top: 10px; font-size: 10px; opacity: 0.6;">
                ExfilGuard • ${new Date().toLocaleTimeString()}
            </div>
        `;
        
        // Add animation styles
        if (!document.getElementById('exfilguard-styles')) {
            const style = document.createElement('style');
            style.id = 'exfilguard-styles';
            style.textContent = `
                @keyframes slideInAlert {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.style.animation = 'slideInAlert 0.5s ease-out reverse';
                setTimeout(() => alertDiv.remove(), 500);
            }
        }, 5000);
    }
    
    console.log('✅ ExfilGuard monitoring active - all listeners registered');
    
    // Show initial notification that monitoring is active
    setTimeout(() => {
        showAlert('ExfilGuard monitoring active on this page', 'info');
    }, 1000);
    
})();