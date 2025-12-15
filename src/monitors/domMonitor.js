// DOM Event Monitoring
class DOMMonitor {
  constructor(eventCallback) {
    this.eventCallback = eventCallback;
    this.sensitivePatterns = ['password', 'credit', 'card', 'ssn', 'cvv', 'secret', 'token', 'auth'];
  }

  start() {
    this.monitorFormInputs();
    this.monitorClipboard();
    return this;
  }

  monitorFormInputs() {
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        this.handleInputEvent(target);
      }
    }, true);
  }

  handleInputEvent(target) {
    const fieldName = target.name || target.id || target.placeholder || 'unnamed_field';
    const fieldNameLower = fieldName.toLowerCase();
    
    let severity = 'low';
    let isSensitive = false;

    // Check for sensitive patterns
    if (this.sensitivePatterns.some(pattern => fieldNameLower.includes(pattern))) {
      severity = 'high';
      isSensitive = true;
    } else if (target.type === 'password') {
      severity = 'high';
      isSensitive = true;
    } else if (target.type === 'email' || target.type === 'tel') {
      severity = 'medium';
      isSensitive = true;
    }

    if (isSensitive) {
      const eventData = {
        type: 'form_input',
        subType: target.type,
        fieldName: fieldName,
        fieldId: target.id,
        fieldType: target.type,
        valueLength: target.value.length,
        url: window.location.href,
        severity: severity,
        timestamp: new Date().toISOString()
      };

      this.eventCallback(eventData);
    }
  }

  monitorClipboard() {
    document.addEventListener('copy', (e) => {
      const selection = window.getSelection().toString();
      if (selection.length > 20) {
        const eventData = {
          type: 'clipboard_copy',
          dataLength: selection.length,
          dataPreview: selection.substring(0, 50),
          url: window.location.href,
          severity: 'medium',
          timestamp: new Date().toISOString()
        };
        this.eventCallback(eventData);
      }
    });

    document.addEventListener('paste', (e) => {
      const pastedData = e.clipboardData?.getData('text') || '';
      if (pastedData.length > 20) {
        const eventData = {
          type: 'clipboard_paste',
          dataLength: pastedData.length,
          dataPreview: pastedData.substring(0, 50),
          url: window.location.href,
          severity: 'medium',
          timestamp: new Date().toISOString()
        };
        this.eventCallback(eventData);
      }
    });
  }

  stop() {
    // Cleanup if needed
    document.removeEventListener('input', this.handleInputEvent);
    document.removeEventListener('copy', this.handleCopyEvent);
    document.removeEventListener('paste', this.handlePasteEvent);
  }
}

export default DOMMonitor;