// Storage Access Monitoring
class StorageMonitor {
  constructor(eventCallback) {
    this.eventCallback = eventCallback;
    this.sensitiveKeys = ['token', 'auth', 'session', 'jwt', 'password', 'secret'];
  }

  start() {
    this.monitorLocalStorage();
    this.monitorSessionStorage();
    return this;
  }

  monitorLocalStorage() {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;

    localStorage.getItem = function(key) {
      const value = originalGetItem.apply(this, arguments);
      this.detectStorageAccess('localstorage_read', key, value);
      return value;
    }.bind(this);

    localStorage.setItem = function(key, value) {
      this.detectStorageAccess('localstorage_write', key, value);
      return originalSetItem.apply(this, arguments);
    }.bind(this);
  }

  monitorSessionStorage() {
    const originalGetItem = sessionStorage.getItem;
    const originalSetItem = sessionStorage.setItem;

    sessionStorage.getItem = function(key) {
      const value = originalGetItem.apply(this, arguments);
      this.detectStorageAccess('sessionstorage_read', key, value);
      return value;
    }.bind(this);

    sessionStorage.setItem = function(key, value) {
      this.detectStorageAccess('sessionstorage_write', key, value);
      return originalSetItem.apply(this, arguments);
    }.bind(this);
  }

  detectStorageAccess(accessType, key, value) {
    const keyLower = key.toLowerCase();
    let severity = 'low';

    // Check if key contains sensitive terms
    if (this.sensitiveKeys.some(sensitiveKey => keyLower.includes(sensitiveKey))) {
      severity = 'high';
    }

    // Only log sensitive or write operations
    if (severity === 'high' || accessType.includes('write')) {
      const eventData = {
        type: accessType,
        key: key,
        valueLength: value?.length || 0,
        valuePreview: this.truncateValue(value),
        severity: severity,
        timestamp: new Date().toISOString()
      };

      this.eventCallback(eventData);
    }
  }

  truncateValue(value) {
    if (!value) return '';
    const str = String(value);
    return str.length > 30 ? str.substring(0, 30) + '...' : str;
  }

  stop() {
    // Restore originals if needed
    localStorage.getItem = localStorage.getItem?.original || localStorage.getItem;
    localStorage.setItem = localStorage.setItem?.original || localStorage.setItem;
    sessionStorage.getItem = sessionStorage.getItem?.original || sessionStorage.getItem;
    sessionStorage.setItem = sessionStorage.setItem?.original || sessionStorage.setItem;
  }
}

export default StorageMonitor;