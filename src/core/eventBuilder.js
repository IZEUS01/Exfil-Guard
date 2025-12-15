// Event Building and Normalization
class EventBuilder {
  constructor() {
    this.eventCount = 0;
  }

  build(eventData) {
    this.eventCount++;
    
    const baseEvent = {
      id: this.generateId(),
      timestamp: eventData.timestamp || new Date().toISOString(),
      url: eventData.url || window.location.href,
      domain: this.extractDomain(eventData.url || window.location.href),
      type: eventData.type || 'unknown',
      severity: eventData.severity || 'low',
      source: 'content_script'
    };

    // Merge with event-specific data
    const normalizedEvent = { ...baseEvent, ...eventData };
    
    // Remove large data fields for storage
    delete normalizedEvent.value;
    delete normalizedEvent.body;
    delete normalizedEvent.data;
    
    // Add metadata
    normalizedEvent.metadata = {
      processed: true,
      version: '1.0',
      sequence: this.eventCount
    };

    return normalizedEvent;
  }

  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `evt_${timestamp}_${random}`;
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  validateEvent(event) {
    const required = ['id', 'timestamp', 'type', 'severity'];
    const missing = required.filter(field => !event[field]);
    
    if (missing.length > 0) {
      console.warn('Event missing required fields:', missing);
      return false;
    }
    
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(event.severity)) {
      event.severity = 'low';
    }
    
    return true;
  }
}

export default EventBuilder;