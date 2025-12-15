// Network Request Monitoring
class NetworkMonitor {
  constructor(eventCallback) {
    this.eventCallback = eventCallback;
    this.sensitivePatterns = [
      /password=/i,
      /credit.?card=/i,
      /ssn=/i,
      /token=/i,
      /secret=/i,
      /api.?key=/i
    ];
  }

  start() {
    this.interceptFetch();
    this.interceptXHR();
    return this;
  }

  interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      
      // Log before sending
      this.analyzeRequest({
        method: options.method || 'GET',
        url: url,
        body: options.body,
        type: 'fetch_request'
      });

      // Execute original fetch
      return originalFetch.apply(this, args);
    };
  }

  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._exfilguardData = { method, url };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      if (body && this._exfilguardData) {
        this.analyzeRequest({
          method: this._exfilguardData.method,
          url: this._exfilguardData.url,
          body: body,
          type: 'xhr_request'
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  analyzeRequest(request) {
    const { method, url, body, type } = request;
    let severity = 'low';
    let sensitiveDataFound = null;

    // Check URL for sensitive patterns
    if (this.sensitivePatterns.some(pattern => pattern.test(url))) {
      severity = 'high';
      sensitiveDataFound = 'URL contains sensitive pattern';
    }

    // Check body for sensitive data
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || '');
      this.sensitivePatterns.forEach(pattern => {
        if (pattern.test(bodyStr)) {
          severity = 'high';
          sensitiveDataFound = `Body contains: ${pattern.source}`;
        }
      });
    }

    if (severity !== 'low' || method !== 'GET') {
      const eventData = {
        type: type,
        method: method,
        url: url,
        sensitiveDataFound: sensitiveDataFound,
        severity: severity,
        timestamp: new Date().toISOString()
      };

      this.eventCallback(eventData);
    }
  }

  stop() {
    // Restore originals if needed
    window.fetch = window.fetch?.original || window.fetch;
  }
}

export default NetworkMonitor;