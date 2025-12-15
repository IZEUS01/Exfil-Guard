// Rule Manager for easy rule access
import config from './config.js';

class RuleManager {
  constructor() {
    this.rules = null;
    this.config = null;
  }

  async loadRules() {
    if (this.rules) return this.rules;
    
    try {
      const response = await fetch(chrome.runtime.getURL('rules/rules.json'));
      this.config = await response.json();
      this.rules = this.config.rules.filter(rule => rule.enabled);
      return this.rules;
    } catch (error) {
      console.error('Failed to load rules:', error);
      return [];
    }
  }

  getRulesByType(type) {
    if (!this.rules) return [];
    return this.rules.filter(rule => rule.type === type);
  }

  getRuleById(id) {
    if (!this.rules) return null;
    return this.rules.find(rule => rule.id === id);
  }

  getSeverityLevel(severity) {
    return this.config?.severityLevels?.[severity] || 0;
  }

  getSeverityColor(severity) {
    return this.config?.severityColors?.[severity] || '#4CAF50';
  }

  shouldAlert(severity) {
    const minSeverity = config.get('ALERTS.MIN_SEVERITY') || 'medium';
    return this.getSeverityLevel(severity) >= this.getSeverityLevel(minSeverity);
  }

  matchPatterns(text, ruleType) {
    const matches = [];
    const rules = this.getRulesByType(ruleType);
    
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(text)) {
            matches.push({
              rule: rule,
              pattern: pattern,
              match: regex.exec(text)?.[0] || ''
            });
          }
        } catch (error) {
          console.error('Invalid pattern:', pattern, error);
        }
      }
    }
    
    return matches;
  }
}

// Singleton instance
const ruleManager = new RuleManager();
export default ruleManager;