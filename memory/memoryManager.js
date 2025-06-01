/**
 * ActionLayer3 Memory Manager
 * Advanced memory management system for persistent data storage and retrieval
 */

class MemoryManager {
  constructor() {
    this.storageKeys = {
      MEMORY: 'actionlayer3_memory',
      CACHE: 'actionlayer3_cache',
      SESSIONS: 'actionlayer3_sessions',
      ANALYTICS: 'actionlayer3_analytics'
    };
    
    this.cache = new Map();
    this.sessionData = new Map();
    this.listeners = new Map();
    this.compressionThreshold = 1024; // Compress data larger than 1KB
    this.maxCacheSize = 100; // Maximum cache entries
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize memory manager
   */
  async init() {
    try {
      if (this.isInitialized) return;

      console.log('[MemoryManager] Initializing...');
      
      await this.loadFromStorage();
      this.setupStorageListener();
      this.startPeriodicCleanup();
      
      this.isInitialized = true;
      console.log('[MemoryManager] Initialized successfully');
    } catch (error) {
      console.error('[MemoryManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Store data in memory with optional compression and encryption
   */
  async store(key, value, options = {}) {
    try {
      const {
        compress = true,
        encrypt = false,
        ttl = null, // Time to live in milliseconds
        namespace = 'default',
        priority = 'normal' // low, normal, high
      } = options;

      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      // Prepare data object
      const dataObject = {
        value: value,
        timestamp: Date.now(),
        accessed: Date.now(),
        namespace: namespace,
        priority: priority,
        compressed: false,
        encrypted: false,
        ttl: ttl,
        expiresAt: ttl ? Date.now() + ttl : null,
        size: this.calculateSize(value),
        type: this.getDataType(value),
        checksum: this.generateChecksum(value)
      };

      // Compress if enabled and data is large enough
      if (compress && dataObject.size > this.compressionThreshold) {
        try {
          dataObject.value = await this.compress(value);
          dataObject.compressed = true;
          dataObject.size = this.calculateSize(dataObject.value);
        } catch (error) {
          console.warn('[MemoryManager] Compression failed, storing uncompressed:', error);
        }
      }

      // Encrypt if enabled
      if (encrypt) {
        try {
          dataObject.value = await this.encrypt(dataObject.value);
          dataObject.encrypted = true;
        } catch (error) {
          console.warn('[MemoryManager] Encryption failed, storing unencrypted:', error);
        }
      }

      // Store in cache
      this.cache.set(key, dataObject);
      this.maintainCacheSize();

      // Store persistently
      await this.persistToStorage(key, dataObject, namespace);

      // Track analytics
      this.trackOperation('store', key, dataObject.size);

      // Emit event
      this.emit('stored', { key, namespace, size: dataObject.size });

      return true;
    } catch (error) {
      console.error('[MemoryManager] Store operation failed:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from memory
   */
  async retrieve(key, options = {}) {
    try {
      const {
        defaultValue = null,
        namespace = 'default',
        updateAccessed = true
      } = options;

      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      // Check cache first
      let dataObject = this.cache.get(key);

      // If not in cache, load from storage
      if (!dataObject) {
        dataObject = await this.loadFromStorage(key, namespace);
        if (dataObject) {
          this.cache.set(key, dataObject);
        }
      }

      // Return default if not found
      if (!dataObject) {
        return defaultValue;
      }

      // Check if expired
      if (this.isExpired(dataObject)) {
        await this.remove(key, { namespace });
        return defaultValue;
      }

      // Update access time
      if (updateAccessed) {
        dataObject.accessed = Date.now();
        this.cache.set(key, dataObject);
      }

      // Decrypt if needed
      let value = dataObject.value;
      if (dataObject.encrypted) {
        try {
          value = await this.decrypt(value);
        } catch (error) {
          console.error('[MemoryManager] Decryption failed:', error);
          throw new Error('Failed to decrypt data');
        }
      }

      // Decompress if needed
      if (dataObject.compressed) {
        try {
          value = await this.decompress(value);
        } catch (error) {
          console.error('[MemoryManager] Decompression failed:', error);
          throw new Error('Failed to decompress data');
        }
      }

      // Verify checksum
      if (!this.verifyChecksum(value, dataObject.checksum)) {
        console.warn('[MemoryManager] Checksum verification failed for key:', key);
      }

      // Track analytics
      this.trackOperation('retrieve', key, dataObject.size);

      // Emit event
      this.emit('retrieved', { key, namespace, size: dataObject.size });

      return value;
    } catch (error) {
      console.error('[MemoryManager] Retrieve operation failed:', error);
      throw error;
    }
  }

  /**
   * Remove data from memory
   */
  async remove(key, options = {}) {
    try {
      const { namespace = 'default' } = options;

      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      // Remove from cache
      const dataObject = this.cache.get(key);
      this.cache.delete(key);

      // Remove from storage
      await this.removeFromStorage(key, namespace);

      // Track analytics
      if (dataObject) {
        this.trackOperation('remove', key, dataObject.size);
      }

      // Emit event
      this.emit('removed', { key, namespace });

      return true;
    } catch (error) {
      console.error('[MemoryManager] Remove operation failed:', error);
      throw error;
    }
  }

  /**
   * Check if key exists in memory
   */
  async exists(key, options = {}) {
    try {
      const { namespace = 'default' } = options;

      // Check cache first
      if (this.cache.has(key)) {
        const dataObject = this.cache.get(key);
        return !this.isExpired(dataObject);
      }

      // Check storage
      const dataObject = await this.loadFromStorage(key, namespace);
      return dataObject && !this.isExpired(dataObject);
    } catch (error) {
      console.error('[MemoryManager] Exists check failed:', error);
      return false;
    }
  }

  /**
   * List all keys in a namespace
   */
  async listKeys(options = {}) {
    try {
      const { namespace = 'default', includeExpired = false } = options;

      const memory = await this.getAllMemoryData();
      const namespaceData = memory[namespace] || {};
      
      const keys = Object.keys(namespaceData);
      
      if (!includeExpired) {
        const validKeys = [];
        for (const key of keys) {
          const dataObject = namespaceData[key];
          if (!this.isExpired(dataObject)) {
            validKeys.push(key);
          }
        }
        return validKeys;
      }
      
      return keys;
    } catch (error) {
      console.error('[MemoryManager] List keys failed:', error);
      return [];
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(options = {}) {
    try {
      const { namespace = null } = options;

      const memory = await this.getAllMemoryData();
      const analytics = await this.getAnalytics();
      
      let totalSize = 0;
      let totalEntries = 0;
      let expiredEntries = 0;
      let namespaceStats = {};

      // Calculate stats for each namespace
      for (const [ns, data] of Object.entries(memory)) {
        if (namespace && ns !== namespace) continue;

        let nsSize = 0;
        let nsEntries = 0;
        let nsExpired = 0;

        for (const [key, dataObject] of Object.entries(data)) {
          nsEntries++;
          nsSize += dataObject.size || 0;
          
          if (this.isExpired(dataObject)) {
            nsExpired++;
          }
        }

        namespaceStats[ns] = {
          entries: nsEntries,
          size: nsSize,
          expired: nsExpired,
          sizeFormatted: this.formatBytes(nsSize)
        };

        totalEntries += nsEntries;
        totalSize += nsSize;
        expiredEntries += nsExpired;
      }

      return {
        total: {
          entries: totalEntries,
          size: totalSize,
          expired: expiredEntries,
          sizeFormatted: this.formatBytes(totalSize)
        },
        namespaces: namespaceStats,
        cache: {
          size: this.cache.size,
          maxSize: this.maxCacheSize,
          hitRate: this.calculateCacheHitRate()
        },
        analytics: analytics,
        storage: await this.getStorageQuota()
      };
    } catch (error) {
      console.error('[MemoryManager] Get stats failed:', error);
      return null;
    }
  }

  /**
   * Clear expired entries
   */
  async cleanup(options = {}) {
    try {
      const { namespace = null, force = false } = options;

      const memory = await this.getAllMemoryData();
      let cleanedCount = 0;
      let freedBytes = 0;

      for (const [ns, data] of Object.entries(memory)) {
        if (namespace && ns !== namespace) continue;

        const keysToRemove = [];
        
        for (const [key, dataObject] of Object.entries(data)) {
          if (force || this.isExpired(dataObject)) {
            keysToRemove.push(key);
            freedBytes += dataObject.size || 0;
            cleanedCount++;
          }
        }

        // Remove expired entries
        for (const key of keysToRemove) {
          delete data[key];
          this.cache.delete(key);
        }

        // Update storage if we removed anything
        if (keysToRemove.length > 0) {
          await this.updateNamespaceStorage(ns, data);
        }
      }

      // Emit event
      this.emit('cleaned', { cleanedCount, freedBytes });

      console.log(`[MemoryManager] Cleaned ${cleanedCount} entries, freed ${this.formatBytes(freedBytes)}`);
      
      return { cleanedCount, freedBytes };
    } catch (error) {
      console.error('[MemoryManager] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data in a namespace
   */
  async clear(options = {}) {
    try {
      const { namespace = 'default' } = options;

      // Clear from cache
      const keysToRemove = [];
      for (const [key, dataObject] of this.cache.entries()) {
        if (dataObject.namespace === namespace) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.cache.delete(key));

      // Clear from storage
      await this.clearNamespaceStorage(namespace);

      // Emit event
      this.emit('cleared', { namespace });

      return true;
    } catch (error) {
      console.error('[MemoryManager] Clear failed:', error);
      throw error;
    }
  }

  /**
   * Export memory data
   */
  async export(options = {}) {
    try {
      const {
        namespace = null,
        format = 'json', // json, csv
        includeMetadata = true,
        includeExpired = false
      } = options;

      const memory = await this.getAllMemoryData();
      const exportData = {};

      for (const [ns, data] of Object.entries(memory)) {
        if (namespace && ns !== namespace) continue;

        exportData[ns] = {};
        
        for (const [key, dataObject] of Object.entries(data)) {
          if (!includeExpired && this.isExpired(dataObject)) continue;

          const exportItem = {
            value: dataObject.value,
            ...(includeMetadata && {
              timestamp: dataObject.timestamp,
              accessed: dataObject.accessed,
              type: dataObject.type,
              size: dataObject.size,
              compressed: dataObject.compressed,
              encrypted: dataObject.encrypted,
              ttl: dataObject.ttl,
              expiresAt: dataObject.expiresAt
            })
          };

          exportData[ns][key] = exportItem;
        }
      }

      if (format === 'csv') {
        return this.convertToCSV(exportData);
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[MemoryManager] Export failed:', error);
      throw error;
    }
  }

  /**
   * Import memory data
   */
  async import(data, options = {}) {
    try {
      const {
        namespace = 'default',
        overwrite = false,
        validate = true
      } = options;

      let importData;
      
      if (typeof data === 'string') {
        importData = JSON.parse(data);
      } else {
        importData = data;
      }

      let importedCount = 0;

      for (const [ns, nsData] of Object.entries(importData)) {
        const targetNamespace = namespace || ns;
        
        for (const [key, value] of Object.entries(nsData)) {
          // Check if key exists and overwrite setting
          if (!overwrite && await this.exists(key, { namespace: targetNamespace })) {
            continue;
          }

          // Validate data if requested
          if (validate && !this.validateImportData(value)) {
            console.warn(`[MemoryManager] Skipping invalid data for key: ${key}`);
            continue;
          }

          // Store the data
          await this.store(key, value.value || value, {
            namespace: targetNamespace,
            compress: false, // Don't re-compress imported data
            encrypt: false   // Don't re-encrypt imported data
          });

          importedCount++;
        }
      }

      // Emit event
      this.emit('imported', { importedCount, namespace });

      return { importedCount };
    } catch (error) {
      console.error('[MemoryManager] Import failed:', error);
      throw error;
    }
  }

  /**
   * Session storage management
   */
  async storeSession(key, value, options = {}) {
    try {
      const { ttl = 3600000 } = options; // 1 hour default

      const sessionData = {
        value: value,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      };

      this.sessionData.set(key, sessionData);
      
      // Also store in Chrome session storage
      const sessions = await this.getSessionStorage();
      sessions[key] = sessionData;
      await chrome.storage.session.set({ [this.storageKeys.SESSIONS]: sessions });

      return true;
    } catch (error) {
      console.error('[MemoryManager] Session store failed:', error);
      throw error;
    }
  }

  /**
   * Retrieve session data
   */
  async retrieveSession(key, defaultValue = null) {
    try {
      // Check in-memory first
      let sessionData = this.sessionData.get(key);

      // If not found, check Chrome session storage
      if (!sessionData) {
        const sessions = await this.getSessionStorage();
        sessionData = sessions[key];
        
        if (sessionData) {
          this.sessionData.set(key, sessionData);
        }
      }

      // Check expiration
      if (sessionData && sessionData.expiresAt < Date.now()) {
        this.sessionData.delete(key);
        return defaultValue;
      }

      return sessionData ? sessionData.value : defaultValue;
    } catch (error) {
      console.error('[MemoryManager] Session retrieve failed:', error);
      return defaultValue;
    }
  }

  // Helper methods

  /**
   * Load data from Chrome storage
   */
  async loadFromStorage(key = null, namespace = 'default') {
    try {
      const result = await chrome.storage.local.get(this.storageKeys.MEMORY);
      const memory = result[this.storageKeys.MEMORY] || {};
      
      if (key) {
        return memory[namespace]?.[key] || null;
      }
      
      return memory;
    } catch (error) {
      console.error('[MemoryManager] Load from storage failed:', error);
      return key ? null : {};
    }
  }

  /**
   * Persist data to Chrome storage
   */
  async persistToStorage(key, dataObject, namespace) {
    try {
      const memory = await this.loadFromStorage();
      
      if (!memory[namespace]) {
        memory[namespace] = {};
      }
      
      memory[namespace][key] = dataObject;
      
      await chrome.storage.local.set({
        [this.storageKeys.MEMORY]: memory
      });
    } catch (error) {
      console.error('[MemoryManager] Persist to storage failed:', error);
      throw error;
    }
  }

  /**
   * Remove data from Chrome storage
   */
  async removeFromStorage(key, namespace) {
    try {
      const memory = await this.loadFromStorage();
      
      if (memory[namespace]) {
        delete memory[namespace][key];
        
        // Remove empty namespace
        if (Object.keys(memory[namespace]).length === 0) {
          delete memory[namespace];
        }
        
        await chrome.storage.local.set({
          [this.storageKeys.MEMORY]: memory
        });
      }
    } catch (error) {
      console.error('[MemoryManager] Remove from storage failed:', error);
      throw error;
    }
  }

  /**
   * Setup storage change listener
   */
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[this.storageKeys.MEMORY]) {
        this.emit('storageChanged', changes[this.storageKeys.MEMORY]);
      }
    });
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    // Clean up every hour
    setInterval(() => {
      this.cleanup().catch(error => {
        console.error('[MemoryManager] Periodic cleanup failed:', error);
      });
    }, 3600000);
  }

  /**
   * Maintain cache size
   */
  maintainCacheSize() {
    if (this.cache.size > this.maxCacheSize) {
      // Remove least recently used items
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].accessed - b[1].accessed);
      
      const removeCount = this.cache.size - this.maxCacheSize;
      for (let i = 0; i < removeCount; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Check if data is expired
   */
  isExpired(dataObject) {
    return dataObject.expiresAt && dataObject.expiresAt < Date.now();
  }

  /**
   * Calculate data size
   */
  calculateSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Get data type
   */
  getDataType(data) {
    if (data === null) return 'null';
    if (Array.isArray(data)) return 'array';
    return typeof data;
  }

  /**
   * Generate checksum
   */
  generateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Verify checksum
   */
  verifyChecksum(data, expectedChecksum) {
    return this.generateChecksum(data) === expectedChecksum;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Simple compression (placeholder - would use actual compression library)
   */
  async compress(data) {
    // In a real implementation, you would use a compression library like pako
    return JSON.stringify(data);
  }

  /**
   * Simple decompression (placeholder)
   */
  async decompress(data) {
    return JSON.parse(data);
  }

  /**
   * Simple encryption (placeholder - would use actual encryption)
   */
  async encrypt(data) {
    // In a real implementation, you would use Web Crypto API
    return btoa(JSON.stringify(data));
  }

  /**
   * Simple decryption (placeholder)
   */
  async decrypt(data) {
    return JSON.parse(atob(data));
  }

  /**
   * Event emitter functionality
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[MemoryManager] Event handler error for ${event}:`, error);
        }
      });
    }
  }

  // Additional helper methods for internal use

  async getAllMemoryData() {
    return await this.loadFromStorage();
  }

  async updateNamespaceStorage(namespace, data) {
    const memory = await this.loadFromStorage();
    memory[namespace] = data;
    await chrome.storage.local.set({ [this.storageKeys.MEMORY]: memory });
  }

  async clearNamespaceStorage(namespace) {
    const memory = await this.loadFromStorage();
    delete memory[namespace];
    await chrome.storage.local.set({ [this.storageKeys.MEMORY]: memory });
  }

  async getSessionStorage() {
    try {
      const result = await chrome.storage.session.get(this.storageKeys.SESSIONS);
      return result[this.storageKeys.SESSIONS] || {};
    } catch (error) {
      console.error('[MemoryManager] Get session storage failed:', error);
      return {};
    }
  }

  async getAnalytics() {
    try {
      const result = await chrome.storage.local.get(this.storageKeys.ANALYTICS);
      return result[this.storageKeys.ANALYTICS] || {};
    } catch (error) {
      return {};
    }
  }

  trackOperation(operation, key, size) {
    // Simple analytics tracking
    const timestamp = Date.now();
    const analytics = this.getAnalytics();
    
    if (!analytics[operation]) {
      analytics[operation] = { count: 0, totalSize: 0, lastUsed: timestamp };
    }
    
    analytics[operation].count++;
    analytics[operation].totalSize += size || 0;
    analytics[operation].lastUsed = timestamp;
    
    chrome.storage.local.set({ [this.storageKeys.ANALYTICS]: analytics });
  }

  calculateCacheHitRate() {
    // Would track cache hits/misses in a real implementation
    return 0.85; // Placeholder
  }

  async getStorageQuota() {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota,
        usage: estimate.usage,
        usagePercentage: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
      };
    } catch (error) {
      return { quota: 0, usage: 0, usagePercentage: 0 };
    }
  }

  convertToCSV(data) {
    // Simple CSV conversion - would be more robust in production
    const rows = ['Namespace,Key,Value,Type,Size,Timestamp'];
    
    for (const [namespace, nsData] of Object.entries(data)) {
      for (const [key, item] of Object.entries(nsData)) {
        const value = typeof item.value === 'string' ? item.value.replace(/"/g, '""') : JSON.stringify(item.value);
        rows.push(`"${namespace}","${key}","${value}","${item.type || 'unknown'}","${item.size || 0}","${item.timestamp || ''}"`);
      }
    }
    
    return rows.join('\n');
  }

  validateImportData(data) {
    // Basic validation
    return data && (data.value !== undefined || typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryManager;
} else if (typeof window !== 'undefined') {
  window.MemoryManager = MemoryManager;
}
