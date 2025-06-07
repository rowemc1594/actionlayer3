/**
 * ActionLayer3 Utility Helpers
 * Common utility functions for the Chrome extension
 */

const Helpers = {
  
  /**
   * Date and Time Utilities
   */
  datetime: {
    /**
     * Format date for display
     */
    formatDate(dateInput, options = {}) {
      try {
        const {
          format = 'relative', // relative, short, long, iso
          locale = 'en-US'
        } = options;

        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
          return 'Invalid Date';
        }

        const now = new Date();
        const diff = now - date;

        switch (format) {
          case 'relative':
            return this.getRelativeTime(diff);
          case 'short':
            return date.toLocaleDateString(locale, { 
              month: 'short', 
              day: 'numeric',
              year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
          case 'long':
            return date.toLocaleDateString(locale, { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          case 'iso':
            return date.toISOString();
          default:
            return date.toLocaleDateString(locale);
        }
      } catch (error) {
        console.error('[Helpers] Date formatting failed:', error);
        return 'Unknown';
      }
    },

    /**
     * Get relative time string
     */
    getRelativeTime(diff) {
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);

      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      if (weeks < 4) return `${weeks}w ago`;
      if (months < 12) return `${months}mo ago`;
      return `${years}y ago`;
    },

    /**
     * Parse natural language date
     */
    parseNaturalDate(text) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const patterns = {
        today: /\btoday\b/i,
        tomorrow: /\btomorrow\b/i,
        nextWeek: /\bnext week\b/i,
        thisWeek: /\bthis week\b/i,
        monday: /\bmonday\b/i,
        tuesday: /\btuesday\b/i,
        wednesday: /\bwednesday\b/i,
        thursday: /\bthursday\b/i,
        friday: /\bfriday\b/i,
        saturday: /\bsaturday\b/i,
        sunday: /\bsunday\b/i
      };

      if (patterns.today.test(text)) return today;
      if (patterns.tomorrow.test(text)) return tomorrow;

      // Try to parse as standard date
      const parsed = new Date(text);
      return isNaN(parsed.getTime()) ? null : parsed;
    },

    /**
     * Get time until deadline
     */
    getTimeUntil(targetDate) {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target - now;

      if (diff <= 0) return { expired: true, text: 'Expired' };

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) return { expired: false, text: `${days}d ${hours}h` };
      if (hours > 0) return { expired: false, text: `${hours}h ${minutes}m` };
      return { expired: false, text: `${minutes}m` };
    }
  },

  /**
   * String Utilities
   */
  string: {
    /**
     * Escape HTML characters
     */
    escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength = 100, suffix = '...') {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - suffix.length) + suffix;
    },

    /**
     * Clean and normalize text
     */
    cleanText(text) {
      return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
    },

    /**
     * Extract URLs from text
     */
    extractURLs(text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text.match(urlRegex) || [];
    },

    /**
     * Generate slug from text
     */
    slugify(text) {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },

    /**
     * Highlight search terms in text
     */
    highlightSearch(text, searchTerm, className = 'highlight') {
      if (!searchTerm) return text;
      
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, `<span class="${className}">$1</span>`);
    },

    /**
     * Extract keywords from text
     */
    extractKeywords(text, maxKeywords = 10) {
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
        'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
        'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
        'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
      ]);

      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

      const frequency = {};
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
      });

      return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, maxKeywords)
        .map(([word]) => word);
    }
  },

  /**
   * Array Utilities
   */
  array: {
    /**
     * Remove duplicates from array
     */
    unique(array, key = null) {
      if (key) {
        const seen = new Set();
        return array.filter(item => {
          const value = typeof key === 'function' ? key(item) : item[key];
          if (seen.has(value)) return false;
          seen.add(value);
          return true;
        });
      }
      return [...new Set(array)];
    },

    /**
     * Group array by key
     */
    groupBy(array, key) {
      return array.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        if (!groups[value]) groups[value] = [];
        groups[value].push(item);
        return groups;
      }, {});
    },

    /**
     * Sort array by multiple criteria
     */
    sortBy(array, ...criteria) {
      return array.sort((a, b) => {
        for (const criterion of criteria) {
          let aVal, bVal, desc = false;
          
          if (typeof criterion === 'string') {
            aVal = a[criterion];
            bVal = b[criterion];
          } else if (typeof criterion === 'function') {
            aVal = criterion(a);
            bVal = criterion(b);
          } else if (criterion.desc) {
            desc = true;
            if (typeof criterion.key === 'string') {
              aVal = a[criterion.key];
              bVal = b[criterion.key];
            } else {
              aVal = criterion.key(a);
              bVal = criterion.key(b);
            }
          }

          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
        }
        return 0;
      });
    },

    /**
     * Chunk array into smaller arrays
     */
    chunk(array, size) {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    },

    /**
     * Find items by fuzzy search
     */
    fuzzySearch(array, searchTerm, key = null) {
      if (!searchTerm) return array;
      
      const search = searchTerm.toLowerCase();
      return array.filter(item => {
        const text = (key ? item[key] : item).toLowerCase();
        return text.includes(search) || this.fuzzyMatch(text, search);
      });
    },

    /**
     * Simple fuzzy matching
     */
    fuzzyMatch(text, pattern) {
      const textLen = text.length;
      const patternLen = pattern.length;
      
      if (patternLen > textLen) return false;
      if (patternLen === textLen) return text === pattern;
      
      let textIndex = 0;
      let patternIndex = 0;
      
      while (textIndex < textLen && patternIndex < patternLen) {
        if (text[textIndex] === pattern[patternIndex]) {
          patternIndex++;
        }
        textIndex++;
      }
      
      return patternIndex === patternLen;
    }
  },

  /**
   * Object Utilities
   */
  object: {
    /**
     * Deep clone object
     */
    deepClone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime());
      if (obj instanceof Array) return obj.map(item => this.deepClone(item));
      if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            cloned[key] = this.deepClone(obj[key]);
          }
        }
        return cloned;
      }
      return obj;
    },

    /**
     * Deep merge objects
     */
    deepMerge(target, ...sources) {
      if (!sources.length) return target;
      const source = sources.shift();

      if (this.isObject(target) && this.isObject(source)) {
        for (const key in source) {
          if (this.isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            this.deepMerge(target[key], source[key]);
          } else {
            Object.assign(target, { [key]: source[key] });
          }
        }
      }

      return this.deepMerge(target, ...sources);
    },

    /**
     * Check if value is object
     */
    isObject(item) {
      return item && typeof item === 'object' && !Array.isArray(item);
    },

    /**
     * Get nested property value
     */
    get(obj, path, defaultValue = null) {
      try {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
          if (result === null || result === undefined) {
            return defaultValue;
          }
          result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
      } catch (error) {
        return defaultValue;
      }
    },

    /**
     * Set nested property value
     */
    set(obj, path, value) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let current = obj;

      for (const key of keys) {
        if (!(key in current) || !this.isObject(current[key])) {
          current[key] = {};
        }
        current = current[key];
      }

      current[lastKey] = value;
      return obj;
    },

    /**
     * Remove undefined properties
     */
    removeUndefined(obj) {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.isObject(value) ? this.removeUndefined(value) : value;
        }
      }
      return cleaned;
    }
  },

  /**
   * URL Utilities
   */
  url: {
    /**
     * Parse URL into components
     */
    parse(url) {
      try {
        const parsed = new URL(url);
        return {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port,
          pathname: parsed.pathname,
          search: parsed.search,
          hash: parsed.hash,
          origin: parsed.origin,
          domain: this.getDomain(parsed.hostname)
        };
      } catch (error) {
        return null;
      }
    },

    /**
     * Get domain from hostname
     */
    getDomain(hostname) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts.slice(-2).join('.');
      }
      return hostname;
    },

    /**
     * Check if URL is valid
     */
    isValid(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
      const parsed = this.parse(url);
      return parsed ? parsed.domain : null;
    },

    /**
     * Build query string
     */
    buildQuery(params) {
      return Object.entries(params)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    },

    /**
     * Parse query string
     */
    parseQuery(queryString) {
      const params = {};
      const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;
      
      if (!query) return params;
      
      query.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) {
          params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
      });
      
      return params;
    }
  },

  /**
   * Storage Utilities
   */
  storage: {
    /**
     * Get storage size
     */
    async getSize(area = 'local') {
      try {
        const data = await chrome.storage[area].get(null);
        const size = new Blob([JSON.stringify(data)]).size;
        return { bytes: size, formatted: Helpers.format.bytes(size) };
      } catch (error) {
        console.error('[Helpers] Storage size calculation failed:', error);
        return { bytes: 0, formatted: '0 B' };
      }
    },

    /**
     * Clear storage with confirmation
     */
    async clear(area = 'local', confirm = true) {
      try {
        if (confirm && !window.confirm(`Clear all ${area} storage data?`)) {
          return false;
        }
        
        await chrome.storage[area].clear();
        return true;
      } catch (error) {
        console.error('[Helpers] Storage clear failed:', error);
        return false;
      }
    },

    /**
     * Export storage data
     */
    async export(area = 'local') {
      try {
        const data = await chrome.storage[area].get(null);
        return {
          data: data,
          exportedAt: new Date().toISOString(),
          area: area,
          size: new Blob([JSON.stringify(data)]).size
        };
      } catch (error) {
        console.error('[Helpers] Storage export failed:', error);
        return null;
      }
    },

    /**
     * Import storage data
     */
    async import(importData, area = 'local', overwrite = false) {
      try {
        if (!overwrite) {
          const existing = await chrome.storage[area].get(null);
          const merged = { ...existing, ...importData.data };
          await chrome.storage[area].set(merged);
        } else {
          await chrome.storage[area].clear();
          await chrome.storage[area].set(importData.data);
        }
        return true;
      } catch (error) {
        console.error('[Helpers] Storage import failed:', error);
        return false;
      }
    }
  },

  /**
   * Format Utilities
   */
  format: {
    /**
     * Format bytes
     */
    bytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Format number with commas
     */
    number(num) {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Format percentage
     */
    percentage(value, total, decimals = 1) {
      if (total === 0) return '0%';
      const percent = (value / total) * 100;
      return `${percent.toFixed(decimals)}%`;
    },

    /**
     * Format duration
     */
    duration(milliseconds) {
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    }
  },

  /**
   * Validation Utilities
   */
  validate: {
    /**
     * Validate email
     */
    email(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    },

    /**
     * Validate URL
     */
    url(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Validate required fields
     */
    required(value) {
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined;
    },

    /**
     * Validate length
     */
    length(value, min = 0, max = Infinity) {
      const length = typeof value === 'string' ? value.length : 
                   Array.isArray(value) ? value.length : 0;
      return length >= min && length <= max;
    },

    /**
     * Validate JSON
     */
    json(text) {
      try {
        JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    }
  },

  /**
   * Chrome Extension Utilities
   */
  chrome: {
    /**
     * Get current tab
     */
    async getCurrentTab() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
      } catch (error) {
        console.error('[Helpers] Get current tab failed:', error);
        return null;
      }
    },

    /**
     * Send message with retry
     */
    async sendMessage(message, options = {}) {
      const { retries = 3, delay = 1000 } = options;
      
      for (let i = 0; i < retries; i++) {
        try {
          return await chrome.runtime.sendMessage(message);
        } catch (error) {
          if (i === retries - 1) throw error;
          await this.sleep(delay);
        }
      }
    },

    /**
     * Check if extension context is valid
     */
    isContextValid() {
      try {
        return chrome.runtime && chrome.runtime.id;
      } catch {
        return false;
      }
    },

    /**
     * Get extension info
     */
    getExtensionInfo() {
      try {
        const manifest = chrome.runtime.getManifest();
        return {
          name: manifest.name,
          version: manifest.version,
          id: chrome.runtime.id,
          permissions: manifest.permissions || [],
          hostPermissions: manifest.host_permissions || []
        };
      } catch (error) {
        console.error('[Helpers] Get extension info failed:', error);
        return null;
      }
    }
  },

  /**
   * Debug Utilities
   */
  debug: {
    /**
     * Log with timestamp and context
     */
    log(message, data = null, level = 'info') {
      const timestamp = new Date().toISOString();
      const prefix = `[ActionLayer3 ${timestamp}]`;
      
      switch (level) {
        case 'error':
          console.error(prefix, message, data);
          break;
        case 'warn':
          console.warn(prefix, message, data);
          break;
        case 'debug':
          console.debug(prefix, message, data);
          break;
        default:
          console.log(prefix, message, data);
      }
    },

    /**
     * Performance timing
     */
    time(label) {
      console.time(`[ActionLayer3] ${label}`);
    },

    timeEnd(label) {
      console.timeEnd(`[ActionLayer3] ${label}`);
    },

    /**
     * Memory usage
     */
    memory() {
      if (performance.memory) {
        return {
          used: this.format.bytes(performance.memory.usedJSHeapSize),
          total: this.format.bytes(performance.memory.totalJSHeapSize),
          limit: this.format.bytes(performance.memory.jsHeapSizeLimit)
        };
      }
      return null;
    }
  },

  /**
   * General Utilities
   */
  
  /**
   * Sleep/delay function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Debounce function
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Generate unique ID
   */
  generateId(prefix = '', length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Retry function with exponential backoff
   */
  async retry(fn, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      backoff = 2,
      maxDelay = 30000
    } = options;

    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i === retries) {
          throw lastError;
        }
        
        const currentDelay = Math.min(delay * Math.pow(backoff, i), maxDelay);
        await this.sleep(currentDelay);
      }
    }
  },

  /**
   * Safe JSON parse
   */
  safeJsonParse(text, defaultValue = null) {
    try {
      return JSON.parse(text);
    } catch {
      return defaultValue;
    }
  },

  /**
   * Check if running in extension context
   */
  isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Helpers;
} else if (typeof window !== 'undefined') {
  window.Helpers = Helpers;
}
