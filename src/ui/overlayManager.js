// Overlay and Alert Management
class OverlayManager {
  constructor() {
    this.alertContainer = null;
    this.alertCount = 0;
    this.maxAlerts = 3;
  }

  init() {
    this.createAlertContainer();
    this.createStatusIndicator();
    return this;
  }

  createAlertContainer() {
    this.alertContainer = document.createElement('div');
    this.alertContainer.id = 'exfilguard-alerts';
    this.alertContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      max-width: 350px;
      pointer-events: none;
    `;
    document.body.appendChild(this.alertContainer);
  }

  createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'exfilguard-status';
    indicator.style.cssText = `
      position: fixed;
      bottom: 15px;
      right: 15px;
      width: 12px;
      height: 12px;
      background: #4CAF50;
      border-radius: 50%;
      box-shadow: 0 0 10px #4CAF50;
      z-index: 999998;
      animation: pulse 2s infinite;
    `;
    document.body.appendChild(indicator);

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }

  showAlert(event, severity = 'info') {
    if (!this.alertContainer) return null;

    // Clean old alerts if too many
    if (this.alertCount >= this.maxAlerts) {
      this.cleanOldAlerts();
    }

    const alertId = 'exfilguard-alert-' + Date.now();
    const severityColors = {
      critical: '#dc3545',
      high: '#ff6b6b',
      medium: '#ffa726',
      low: '#4CAF50',
      info: '#17a2b8'
    };

    const color = severityColors[severity] || severityColors.info;
    
    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = 'exfilguard-alert';
    alert.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-left: 4px solid ${color};
      padding: 15px;
      margin: 8px 0;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      max-width: 320px;
    `;

    const title = this.getEventTitle(event.type, severity);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    alert.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></div>
          <strong style="color: ${color}; font-size: 12px;">${title}</strong>
        </div>
        <span style="font-size: 11px; opacity: 0.7;">${time}</span>
      </div>
      <div style="font-size: 12px; margin-bottom: 8px;">${this.getEventMessage(event)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 10px; opacity: 0.6;">ExfilGuard</span>
        <button onclick="document.getElementById('${alertId}').style.animation='slideOut 0.3s ease-out forwards'; setTimeout(()=>document.getElementById('${alertId}')?.remove(), 300)" 
                style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">
          Dismiss
        </button>
      </div>
    `;

    this.alertContainer.appendChild(alert);
    this.alertCount++;

    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (document.getElementById(alertId)) {
        alert.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
          if (document.getElementById(alertId)) {
            document.getElementById(alertId).remove();
            this.alertCount--;
          }
        }, 300);
      }
    }, 6000);

    // Add animations
    if (!document.getElementById('exfilguard-animations')) {
      const animationStyle = document.createElement('style');
      animationStyle.id = 'exfilguard-animations';
      animationStyle.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(animationStyle);
    }

    return alertId;
  }

  getEventTitle(eventType, severity) {
    const titles = {
      'form_input': 'Form Input',
      'clipboard_copy': 'Clipboard Copy',
      'clipboard_paste': 'Clipboard Paste',
      'fetch_request': 'Network Request',
      'xhr_request': 'XHR Request',
      'localstorage_read': 'Storage Read',
      'localstorage_write': 'Storage Write'
    };
    return `${titles[eventType] || eventType} - ${severity.toUpperCase()}`;
  }

  getEventMessage(event) {
    if (event.fieldName) {
      return `Field: <code>${event.fieldName}</code>`;
    }
    if (event.url) {
      const url = new URL(event.url);
      return `To: <code>${url.hostname}</code>`;
    }
    if (event.key) {
      return `Key: <code>${event.key}</code>`;
    }
    return 'Security event detected';
  }

  cleanOldAlerts() {
    const alerts = this.alertContainer.querySelectorAll('.exfilguard-alert');
    if (alerts.length > this.maxAlerts) {
      const oldest = alerts[0];
      oldest.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => {
        oldest.remove();
        this.alertCount--;
      }, 300);
    }
  }

  updateStatusIndicator(level = 'safe') {
    const indicator = document.getElementById('exfilguard-status');
    if (indicator) {
      const colors = {
        safe: '#4CAF50',
        warning: '#ffa726',
        danger: '#ff6b6b'
      };
      indicator.style.background = colors[level] || colors.safe;
      indicator.style.boxShadow = `0 0 10px ${colors[level] || colors.safe}`;
    }
  }
}

export default OverlayManager;