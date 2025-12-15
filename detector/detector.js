// Enhanced detector.js with external rules support
class DetectionEngine {
  constructor() {
    this.rules = [];
    this.suspiciousEvents = [];
    this.initialized = false;
    this.ruleConfig = null; // Store full rules config
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Load rules from external JSON file
      const response = await fetch(chrome.runtime.getURL('rules/rules.json'));
      this.ruleConfig = await response.json();
      this.rules = this.ruleConfig.rules.filter(rule => rule.enabled);
      this.initialized = true;
      console.log('ExfilGuard rules loaded:', this.rules.length, 'rules');
    } catch (error) {
      console.error('Failed to load rules, using defaults:', error);
      this.rules = this.getDefaultRules();
      this.initialized = true;
    }
  }

  getDefaultRules() {
    // Fallback to hardcoded rules if JSON fails
    return [
      {
        id: "form_sniffing",
        name: "Form Field Monitoring",
        description: "Detects scripts accessing form input values",
        type: "script_analysis",
        patterns: ["\\.value\\s*=", "getElementById.*\\.value", "querySelector.*input.*value"],
        severity: "medium",
        enabled: true
      },
      {
        id: "clipboard_access",
        name: "Clipboard Access",
        description: "Detects attempts to read clipboard data",
        type: "script_analysis", 
        patterns: ["clipboardData", "execCommand.*copy", "execCommand.*paste", "navigator\\.clipboard"],
        severity: "high",
        enabled: true
      },
      {
        id: "storage_access",
        name: "Local Storage Access",
        description: "Detects reading from local/session storage",
        type: "script_analysis",
        patterns: ["localStorage\\.getItem", "sessionStorage\\.getItem"],
        severity: "low",
        enabled: true
      },
      {
        id: "data_exfiltration",
        name: "Data Exfiltration",
        description: "Detects sensitive data being sent externally",
        type: "script_analysis",
        patterns: ["fetch.*password", "XMLHttpRequest.*send.*credit", "postMessage.*token"],
        severity: "critical",
        enabled: true
      }
    ];
  }

  async analyzeScript(scriptContent, url) {
    if (!this.initialized) await this.init();
    
    const findings = [];
    
    for (const rule of this.rules) {
      if (rule.type !== 'script_analysis') continue;
      
      // Check each pattern in the rule
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = scriptContent.match(regex);
          if (matches) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              matches: matches.length,
              pattern: pattern,
              description: rule.description,
              url: url,
              timestamp: new Date().toISOString(),
              type: 'script_analysis'
            });
          }
        } catch (error) {
          console.error('Invalid regex pattern:', pattern, error);
        }
      }
    }
    
    return findings;
  }

  analyzeNetworkRequest(url, requestBody) {
    const findings = [];
    
    // Convert body to string for pattern matching
    const bodyString = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody || '');
    const fullText = url + ' ' + bodyString;
    
    for (const rule of this.rules) {
      if (rule.type !== 'network') continue;
      
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(fullText)) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              pattern: pattern,
              url: url,
              timestamp: new Date().toISOString(),
              type: 'network'
            });
          }
        } catch (error) {
          console.error('Invalid regex pattern:', pattern, error);
        }
      }
    }
    
    // Special handling for external domain requests
    const externalRule = this.rules.find(r => r.id === 'external_domain_request');
    if (externalRule && externalRule.enabled && this.checkExternalDomain(url)) {
      findings.push({
        ruleId: externalRule.id,
        ruleName: externalRule.name,
        severity: externalRule.severity,
        description: `Request to external domain: ${this.getDomainFromUrl(url)}`,
        url: url,
        timestamp: new Date().toISOString(),
        type: 'network'
      });
    }
    
    return findings;
  }

  analyzeFormInput(fieldName, fieldType, value) {
    const findings = [];
    const fieldNameLower = fieldName.toLowerCase();
    const fullText = fieldNameLower + ' ' + value;
    
    for (const rule of this.rules) {
      if (rule.type !== 'form_input') continue;
      
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(fullText)) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              fieldName: fieldName,
              fieldType: fieldType,
              pattern: pattern,
              timestamp: new Date().toISOString(),
              type: 'form_input'
            });
          }
        } catch (error) {
          console.error('Invalid regex pattern:', pattern, error);
        }
      }
    }
    
    // Special handling for password fields
    if (fieldType === 'password') {
      const passwordRule = this.rules.find(r => r.id === 'password_detection');
      if (passwordRule && passwordRule.enabled) {
        findings.push({
          ruleId: passwordRule.id,
          ruleName: passwordRule.name,
          severity: passwordRule.severity,
          fieldName: fieldName,
          fieldType: fieldType,
          timestamp: new Date().toISOString(),
          type: 'form_input'
        });
      }
    }
    
    return findings;
  }

  analyzeClipboard(action, dataLength, dataPreview) {
    const findings = [];
    
    // Check for large clipboard data
    const clipboardRule = this.rules.find(r => r.id === 'clipboard_large_data');
    if (clipboardRule && clipboardRule.enabled && dataLength > clipboardRule.threshold) {
      findings.push({
        ruleId: clipboardRule.id,
        ruleName: clipboardRule.name,
        severity: clipboardRule.severity,
        action: action,
        dataLength: dataLength,
        dataPreview: dataPreview,
        threshold: clipboardRule.threshold,
        timestamp: new Date().toISOString(),
        type: 'clipboard'
      });
    }
    
    return findings;
  }

  analyzeStorage(accessType, key, value) {
    const findings = [];
    const keyLower = key.toLowerCase();
    
    for (const rule of this.rules) {
      if (rule.type !== 'storage') continue;
      
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(keyLower)) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              accessType: accessType,
              key: key,
              pattern: pattern,
              timestamp: new Date().toISOString(),
              type: 'storage'
            });
          }
        } catch (error) {
          console.error('Invalid regex pattern:', pattern, error);
        }
      }
    }
    
    return findings;
  }

  // Helper methods
  checkExternalDomain(url) {
    try {
      const currentDomain = window.location.hostname;
      const requestDomain = this.getDomainFromUrl(url);
      
      // Check if domain is in ignore list
      if (this.ruleConfig?.ignoreDomains?.includes(requestDomain)) {
        return false;
      }
      
      // Check ignore patterns
      if (this.ruleConfig?.ignorePatterns?.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(url);
      })) {
        return false;
      }
      
      // Check if it's an external domain (not same origin)
      return currentDomain !== requestDomain && 
             !requestDomain.endsWith('.' + currentDomain) &&
             !currentDomain.endsWith('.' + requestDomain);
    } catch (error) {
      return false;
    }
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  getSeverityColor(severity) {
    return this.ruleConfig?.severityColors?.[severity] || '#4CAF50';
  }

  getSeverityLabel(severity) {
    return this.ruleConfig?.severityLabels?.[severity] || severity;
  }

  getEventTypeLabel(type) {
    return this.ruleConfig?.eventTypes?.[type] || type;
  }

  shouldIgnoreDomain(domain) {
    return this.ruleConfig?.ignoreDomains?.includes(domain) || false;
  }

  logEvent(event) {
    this.suspiciousEvents.push(event);
    console.log("ExfilGuard Detection:", event);
    
    // Send to background script for storage
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "DETECTION_EVENT",
        data: event
      });
    }
    
    return event;
  }
}

// Initialize when injected
const detector = new DetectionEngine();

// Auto-initialize
setTimeout(() => {
  detector.init().then(() => {
    console.log('ExfilGuard Detector ready');
  });
}, 100);

window.ExfilGuardDetector = detector;

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetectionEngine;
}