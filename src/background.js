/**
 * ActionLayer3 Background Service Worker
 * Manages extension lifecycle and cross-tab communication
 */

class ActionLayer3Background {
  constructor() {
    this.isInitialized = false;
    this.tabTasks = new Map(); // Store tasks per tab
    this.init();
  }

  /**
   * Initialize background service worker
   */
  async init() {
    try {
      if (this.isInitialized) return;

      console.log('[ActionLayer3] Background service worker initializing...');
      
      this.setupEventListeners();
      this.setupContextMenus();
      await this.initializeStorage();
      
      this.isInitialized = true;
      console.log('[ActionLayer3] Background service worker initialized');
    } catch (error) {
      console.error('[ActionLayer3] Background initialization failed:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('[ActionLayer3] Extension installed/updated:', details.reason);
      this.handleInstallation(details);
    });

    // Message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // Tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabTasks.delete(tabId);
    });

    // Action button click
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('[ActionLayer3] Extension startup');
      this.handleStartup();
    });
  }

  /**
   * Setup context menus
   */
  setupContextMenus() {
    try {
      // Remove existing menus first
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          console.log('[ActionLayer3] No existing context menus to remove');
        }
        
        // Create new context menus
        chrome.contextMenus.create({
          id: 'actionlayer3-extract-tasks',
          title: 'Extract tasks from this page',
          contexts: ['page']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[ActionLayer3] Context menu creation failed:', chrome.runtime.lastError);
          }
        });

        chrome.contextMenus.create({
          id: 'actionlayer3-add-task',
          title: 'Add selected text as task',
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[ActionLayer3] Context menu creation failed:', chrome.runtime.lastError);
          }
        });
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenuClick(info, tab);
      });
    } catch (error) {
      console.error('[ActionLayer3] Context menu setup failed:', error);
    }
  }

  /**
   * Initialize storage with default values
   */
  async initializeStorage() {
    try {
      const result = await chrome.storage.local.get(['settings', 'tasks', 'memory']);
      
      if (!result.settings) {
        await chrome.storage.local.set({
          settings: {
            autoExtract: true,
            notifications: true,
            theme: 'auto',
            extractDelay: 1000
          }
        });
      }

      if (!result.tasks) {
        await chrome.storage.local.set({ tasks: [] });
      }

      if (!result.memory) {
        await chrome.storage.local.set({ memory: {} });
      }

      console.log('[ActionLayer3] Storage initialized');
    } catch (error) {
      console.error('[ActionLayer3] Storage initialization failed:', error);
    }
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      const { action, data } = request;
      
      switch (action) {
        case 'tasksExtracted':
          await this.handleTasksExtracted(request.tasks, request.pageInfo, sender.tab);
          sendResponse({ success: true });
          break;

        case 'getTasks':
          const tasks = await this.getTasks();
          sendResponse({ tasks });
          break;

        case 'addTask':
          const newTask = await this.addTask(data);
          sendResponse({ task: newTask });
          break;

        case 'updateTask':
          const updatedTask = await this.updateTask(data);
          sendResponse({ task: updatedTask });
          break;

        case 'deleteTask':
          await this.deleteTask(data.taskId);
          sendResponse({ success: true });
          break;

        case 'getMemory':
          const memory = await this.getMemory(data.key);
          sendResponse({ memory });
          break;

        case 'setMemory':
          await this.setMemory(data.key, data.value);
          sendResponse({ success: true });
          break;

        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ settings });
          break;

        case 'updateSettings':
          await this.updateSettings(data);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[ActionLayer3] Message handling error:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle tasks extracted from content script
   */
  async handleTasksExtracted(tasks, pageInfo, tab) {
    try {
      if (!tab) return;

      // Store tasks for this tab
      this.tabTasks.set(tab.id, { tasks, pageInfo, extractedAt: Date.now() });

      // Limit storage to prevent quota issues
      const existingTasks = await this.getTasks();
      const maxTasks = 100; // Limit total tasks
      
      const newTasks = tasks.slice(0, 10).map(task => ({ // Limit new tasks per page
        id: task.id,
        text: task.text.substring(0, 200), // Limit text length
        completed: task.completed,
        url: pageInfo.url,
        domain: pageInfo.domain,
        extractedAt: new Date().toISOString()
      }));

      // Keep only recent tasks
      const allTasks = [...existingTasks, ...newTasks];
      const limitedTasks = allTasks.slice(-maxTasks);

      await chrome.storage.local.set({
        tasks: limitedTasks
      });

      // Send notification if enabled
      const settings = await this.getSettings();
      if (settings.notifications && tasks.length > 0) {
        const domain = pageInfo?.domain || 'this page';
        this.showNotification(`Found ${tasks.length} task(s) on ${domain}`);
      }

      console.log(`[ActionLayer3] Extracted ${tasks.length} tasks from ${pageInfo.url}`);
    } catch (error) {
      console.error('[ActionLayer3] Failed to handle extracted tasks:', error);
    }
  }

  /**
   * Handle extension installation
   */
  handleInstallation(details) {
    if (details.reason === 'install') {
      // Show welcome notification
      this.showNotification('ActionLayer3 installed! Click the icon to get started.');
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdate(tabId, tab) {
    try {
      const settings = await this.getSettings();
      if (settings.autoExtract && tab.url && !tab.url.startsWith('chrome://')) {
        // Delay task extraction to ensure page is loaded
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'extractTasks' }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        }, settings.extractDelay || 1000);
      }
    } catch (error) {
      console.error('[ActionLayer3] Tab update handling failed:', error);
    }
  }

  /**
   * Handle extension startup
   */
  handleStartup() {
    // Clean up old tab data
    this.tabTasks.clear();
  }

  /**
   * Handle extension icon click
   */
  async handleActionClick(tab) {
    try {
      console.log('[ActionLayer3] Extension icon clicked for tab:', tab.url);
      
      // First inject the sidebar script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/direct-sidebar.js']
      });
      
      // Then call the function to create the sidebar
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof createDirectSidebar === 'function') {
            createDirectSidebar();
            // Auto-extract tasks after sidebar is created
            setTimeout(() => {
              if (typeof extractAndDisplayTasks === 'function') {
                extractAndDisplayTasks();
              }
            }, 500);
          }
        }
      });
      
      console.log('[ActionLayer3] Sidebar created via action click');
    } catch (error) {
      console.error('[ActionLayer3] Failed to inject sidebar:', error);
    }
  }

  /**
   * Handle context menu clicks
   */
  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case 'actionlayer3-extract-tasks':
          chrome.tabs.sendMessage(tab.id, { action: 'extractTasks' });
          break;

        case 'actionlayer3-add-task':
          if (info.selectionText) {
            await this.addTask({
              text: info.selectionText.trim(),
              url: tab.url,
              domain: new URL(tab.url).hostname,
              completed: false
            });
            this.showNotification('Task added from selection');
          }
          break;
      }
    } catch (error) {
      console.error('[ActionLayer3] Context menu handling failed:', error);
    }
  }

  /**
   * Get all tasks from storage
   */
  async getTasks() {
    try {
      const result = await chrome.storage.local.get('tasks');
      return result.tasks || [];
    } catch (error) {
      console.error('[ActionLayer3] Failed to get tasks:', error);
      return [];
    }
  }

  /**
   * Add a new task
   */
  async addTask(taskData) {
    try {
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: taskData.text,
        completed: taskData.completed || false,
        url: taskData.url || '',
        domain: taskData.domain || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const tasks = await this.getTasks();
      tasks.push(task);
      await chrome.storage.local.set({ tasks });

      return task;
    } catch (error) {
      console.error('[ActionLayer3] Failed to add task:', error);
      throw error;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskData) {
    try {
      const tasks = await this.getTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskData.id);
      
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      tasks[taskIndex] = {
        ...tasks[taskIndex],
        ...taskData,
        updatedAt: new Date().toISOString()
      };

      await chrome.storage.local.set({ tasks });
      return tasks[taskIndex];
    } catch (error) {
      console.error('[ActionLayer3] Failed to update task:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    try {
      const tasks = await this.getTasks();
      const filteredTasks = tasks.filter(t => t.id !== taskId);
      await chrome.storage.local.set({ tasks: filteredTasks });
    } catch (error) {
      console.error('[ActionLayer3] Failed to delete task:', error);
      throw error;
    }
  }

  /**
   * Get memory value
   */
  async getMemory(key) {
    try {
      const result = await chrome.storage.local.get('memory');
      const memory = result.memory || {};
      return key ? memory[key] : memory;
    } catch (error) {
      console.error('[ActionLayer3] Failed to get memory:', error);
      return null;
    }
  }

  /**
   * Set memory value
   */
  async setMemory(key, value) {
    try {
      const result = await chrome.storage.local.get('memory');
      const memory = result.memory || {};
      memory[key] = value;
      await chrome.storage.local.set({ memory });
    } catch (error) {
      console.error('[ActionLayer3] Failed to set memory:', error);
      throw error;
    }
  }

  /**
   * Get settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      return result.settings || {};
    } catch (error) {
      console.error('[ActionLayer3] Failed to get settings:', error);
      return {};
    }
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const settings = { ...currentSettings, ...newSettings };
      await chrome.storage.local.set({ settings });
    } catch (error) {
      console.error('[ActionLayer3] Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Show notification (disabled to prevent errors)
   */
  showNotification(message) {
    // Notifications temporarily disabled to prevent Chrome extension errors
    console.log('[ActionLayer3] Notification (disabled):', message);
  }
}

// Initialize background service worker
const actionLayer3Background = new ActionLayer3Background();
