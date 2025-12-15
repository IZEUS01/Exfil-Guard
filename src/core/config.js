// Configuration Manager - src/core/config.js
const CONFIG = {
  // Monitoring settings
  MONITORING: {
    DOM: true,
    NETWORK: true,
    STORAGE: true,
    CLIPBOARD: true,
    SCRIPT_ANALYSIS: true
  },
  
  // Alert settings
  ALERTS: {
    ENABLED: true,
    MIN_SEVERITY: 'medium', // Show alerts for medium and above
    DESKTOP_NOTIFICATIONS: false,
    OVERLAY_TIMEOUT: 6000,
    SOUND_ALERTS: false
  },
  
  // Storage settings
  STORAGE: {
    MAX_EVENTS: 1000,
    MIN_SEVERITY: 'low', // Store events of this severity and above
    CLEANUP_DAYS: 7,
    AUTO_EXPORT: false
  },
  
  // Performance settings
  PERFORMANCE: {
    THROTTLE_DELAY: 100,
    BATCH_SIZE: 10,
    DEBOUNCE_MS: 500
  },
  
  // Feature flags
  FEATURES: {
    ADVANCED_DETECTION: true,
    ANIMATIONS: true,
    LIVE_UPDATES: true,
    RULE_BASED_DETECTION: true
  },
  
  // UI settings
  UI: {
    THEME: 'dark',
    ANIMATION_SPEED: 'normal',
    COMPACT_MODE: false
  }
};

// Export configuration with getters/setters
export default {
  get: (key) => {
    const keys = key.split('.');
    let value = CONFIG;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    return value;
  },
  
  set: (key, value) => {
    const keys = key.split('.');
    let config = CONFIG;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in config)) {
        config[keys[i]] = {};
      }
      config = config[keys[i]];
    }
    
    config[keys[keys.length - 1]] = value;
    
    // Save to storage
    chrome.storage.local.set({ 'exfilguard_config': CONFIG });
    
    return true;
  },
  
  getAll: () => ({ ...CONFIG }),
  
  // Load from storage
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['exfilguard_config'], (result) => {
        if (result.exfilguard_config) {
          Object.assign(CONFIG, result.exfilguard_config);
        }
        resolve(CONFIG);
      });
    });
  },
  
  // Save to storage
  save() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'exfilguard_config': CONFIG }, () => {
        resolve(true);
      });
    });
  },
  
  // Reset to defaults
  reset() {
    Object.keys(CONFIG).forEach(key => delete CONFIG[key]);
    Object.assign(CONFIG, {
      MONITORING: { DOM: true, NETWORK: true, STORAGE: true, CLIPBOARD: true, SCRIPT_ANALYSIS: true },
      ALERTS: { ENABLED: true, MIN_SEVERITY: 'medium', DESKTOP_NOTIFICATIONS: false, OVERLAY_TIMEOUT: 6000, SOUND_ALERTS: false },
      STORAGE: { MAX_EVENTS: 1000, MIN_SEVERITY: 'low', CLEANUP_DAYS: 7, AUTO_EXPORT: false },
      PERFORMANCE: { THROTTLE_DELAY: 100, BATCH_SIZE: 10, DEBOUNCE_MS: 500 },
      FEATURES: { ADVANCED_DETECTION: true, ANIMATIONS: true, LIVE_UPDATES: true, RULE_BASED_DETECTION: true },
      UI: { THEME: 'dark', ANIMATION_SPEED: 'normal', COMPACT_MODE: false }
    });
    return this.save();
  },
  
  // Helper to check if event should trigger alert
  shouldAlert: (severity) => {
    const severityLevels = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1,
      'info': 0
    };
    
    const minSeverity = CONFIG.ALERTS.MIN_SEVERITY;
    return severityLevels[severity] >= severityLevels[minSeverity];
  },
  
  // Helper to check if event should be stored
  shouldStore: (severity) => {
    const severityLevels = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1,
      'info': 0
    };
    
    const minSeverity = CONFIG.STORAGE.MIN_SEVERITY;
    return severityLevels[severity] >= severityLevels[minSeverity];
  }
};