/**
 * ActionLayer3 Popup Interface
 * Handles popup UI interactions and communication with background script
 */

class ActionLayer3Popup {
  constructor() {
    this.currentTab = 'tasks';
    this.tasks = [];
    this.memory = {};
    this.settings = {};
    this.isLoading = false;
    this.init();
  }

  /**
   * Initialize popup
   */
  async init() {
    try {
      console.log('[ActionLayer3] Popup initializing...');
      
      this.setupEventListeners();
      this.showLoading(true);
      
      await this.loadData();
      await this.updateCurrentPage();
      
      this.showLoading(false);
      this.showStatus('Ready', 'success');
      
      console.log('[ActionLayer3] Popup initialized');
    } catch (error) {
      console.error('[ActionLayer3] Popup initialization failed:', error);
      this.showStatus('Initialization failed', 'error');
      this.showLoading(false);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Header actions
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refreshData();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Task management
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      this.toggleAddTaskForm();
    });

    document.getElementById('saveTaskBtn').addEventListener('click', () => {
      this.saveTask();
    });

    document.getElementById('cancelTaskBtn').addEventListener('click', () => {
      this.cancelAddTask();
    });

    document.getElementById('taskInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveTask();
      } else if (e.key === 'Escape') {
        this.cancelAddTask();
      }
    });

    // Memory management
    document.getElementById('saveMemoryBtn').addEventListener('click', () => {
      this.saveMemory();
    });

    document.getElementById('clearMemoryBtn').addEventListener('click', () => {
      this.clearAllMemory();
    });

    document.getElementById('memoryKey').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('memoryValue').focus();
      }
    });

    document.getElementById('memoryValue').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.saveMemory();
      }
    });
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    try {
      // Update active tab
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

      // Update active content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}Tab`).classList.add('active');

      this.currentTab = tabName;

      // Load tab-specific data
      if (tabName === 'tasks') {
        this.renderTasks();
      } else if (tabName === 'memory') {
        this.renderMemory();
      }
    } catch (error) {
      console.error('[ActionLayer3] Tab switching failed:', error);
      this.showStatus('Tab switching failed', 'error');
    }
  }

  /**
   * Load all data
   */
  async loadData() {
    try {
      const [tasksResult, memoryResult, settingsResult] = await Promise.all([
        this.sendMessage({ action: 'getTasks' }),
        this.sendMessage({ action: 'getMemory' }),
        this.sendMessage({ action: 'getSettings' })
      ]);

      this.tasks = tasksResult.tasks || [];
      this.memory = memoryResult.memory || {};
      this.settings = settingsResult.settings || {};

      this.renderTasks();
      this.renderMemory();
    } catch (error) {
      console.error('[ActionLayer3] Data loading failed:', error);
      throw error;
    }
  }

  /**
   * Refresh data
   */
  async refreshData() {
    try {
      this.showLoading(true);
      this.showStatus('Refreshing...', 'info');
      
      // Extract tasks from current page
      const tab = await this.getCurrentTab();
      if (tab && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, { action: 'extractTasks' });
      }

      await this.loadData();
      this.showLoading(false);
      this.showStatus('Data refreshed', 'success');
    } catch (error) {
      console.error('[ActionLayer3] Data refresh failed:', error);
      this.showStatus('Refresh failed', 'error');
      this.showLoading(false);
    }
  }

  /**
   * Render tasks
   */
  renderTasks() {
    try {
      const taskList = document.getElementById('taskList');
      const emptyState = taskList.querySelector('.empty-state');

      // Update stats
      this.updateTaskStats();

      if (this.tasks.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      // Clear existing tasks
      taskList.innerHTML = '';

      // Render each task
      this.tasks.forEach(task => {
        const taskElement = this.createTaskElement(task);
        taskList.appendChild(taskElement);
      });
    } catch (error) {
      console.error('[ActionLayer3] Task rendering failed:', error);
      this.showStatus('Task rendering failed', 'error');
    }
  }

  /**
   * Create task element
   */
  createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    taskDiv.dataset.taskId = task.id;

    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
    checkbox.addEventListener('click', () => this.toggleTask(task.id));

    const content = document.createElement('div');
    content.className = 'task-content';

    const text = document.createElement('div');
    text.className = `task-text ${task.completed ? 'completed' : ''}`;
    text.textContent = task.text;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    
    const domain = document.createElement('span');
    domain.textContent = task.domain || 'Local';
    
    const date = document.createElement('span');
    date.textContent = this.formatDate(task.createdAt || task.extractedAt);
    
    meta.appendChild(domain);
    meta.appendChild(date);

    content.appendChild(text);
    content.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-action-btn delete';
    deleteBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="m19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
      </svg>
    `;
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

    const highlightBtn = document.createElement('button');
    highlightBtn.className = 'task-action-btn';
    highlightBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="21 21l-4.35-4.35"></path>
      </svg>
    `;
    highlightBtn.title = 'Highlight on page';
    highlightBtn.addEventListener('click', () => this.highlightTask(task.id));

    actions.appendChild(highlightBtn);
    actions.appendChild(deleteBtn);

    taskDiv.appendChild(checkbox);
    taskDiv.appendChild(content);
    taskDiv.appendChild(actions);

    return taskDiv;
  }

  /**
   * Update task statistics
   */
  updateTaskStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
  }

  /**
   * Toggle add task form
   */
  toggleAddTaskForm() {
    const form = document.getElementById('addTaskForm');
    const input = document.getElementById('taskInput');
    
    if (form.classList.contains('hidden')) {
      form.classList.remove('hidden');
      input.focus();
    } else {
      form.classList.add('hidden');
      input.value = '';
    }
  }

  /**
   * Save new task
   */
  async saveTask() {
    try {
      const input = document.getElementById('taskInput');
      const text = input.value.trim();

      if (!text) {
        this.showStatus('Please enter a task description', 'error');
        return;
      }

      const tab = await this.getCurrentTab();
      const taskData = {
        text: text,
        completed: false,
        url: tab?.url || '',
        domain: tab?.url ? new URL(tab.url).hostname : ''
      };

      const result = await this.sendMessage({ action: 'addTask', data: taskData });
      
      if (result.task) {
        this.tasks.push(result.task);
        this.renderTasks();
        this.cancelAddTask();
        this.showStatus('Task added successfully', 'success');
      }
    } catch (error) {
      console.error('[ActionLayer3] Task save failed:', error);
      this.showStatus('Failed to save task', 'error');
    }
  }

  /**
   * Cancel add task
   */
  cancelAddTask() {
    const form = document.getElementById('addTaskForm');
    const input = document.getElementById('taskInput');
    
    form.classList.add('hidden');
    input.value = '';
  }

  /**
   * Toggle task completion
   */
  async toggleTask(taskId) {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTask = { ...task, completed: !task.completed };
      const result = await this.sendMessage({ action: 'updateTask', data: updatedTask });

      if (result.task) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        this.tasks[index] = result.task;
        this.renderTasks();
        this.showStatus(`Task ${result.task.completed ? 'completed' : 'reopened'}`, 'success');
      }
    } catch (error) {
      console.error('[ActionLayer3] Task toggle failed:', error);
      this.showStatus('Failed to update task', 'error');
    }
  }

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    try {
      if (!confirm('Are you sure you want to delete this task?')) return;

      await this.sendMessage({ action: 'deleteTask', data: { taskId } });
      
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.renderTasks();
      this.showStatus('Task deleted', 'success');
    } catch (error) {
      console.error('[ActionLayer3] Task deletion failed:', error);
      this.showStatus('Failed to delete task', 'error');
    }
  }

  /**
   * Highlight task on page
   */
  async highlightTask(taskId) {
    try {
      const tab = await this.getCurrentTab();
      if (!tab) return;

      chrome.tabs.sendMessage(tab.id, { action: 'highlightTask', taskId });
      this.showStatus('Task highlighted on page', 'info');
    } catch (error) {
      console.error('[ActionLayer3] Task highlighting failed:', error);
      this.showStatus('Failed to highlight task', 'error');
    }
  }

  /**
   * Render memory items
   */
  renderMemory() {
    try {
      const memoryList = document.getElementById('memoryList');
      const emptyState = memoryList.querySelector('.empty-state');

      // Update stats
      this.updateMemoryStats();

      const entries = Object.entries(this.memory);
      
      if (entries.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      // Clear existing memory items
      memoryList.innerHTML = '';

      // Render each memory item
      entries.forEach(([key, value]) => {
        const memoryElement = this.createMemoryElement(key, value);
        memoryList.appendChild(memoryElement);
      });
    } catch (error) {
      console.error('[ActionLayer3] Memory rendering failed:', error);
      this.showStatus('Memory rendering failed', 'error');
    }
  }

  /**
   * Create memory element
   */
  createMemoryElement(key, value) {
    const memoryDiv = document.createElement('div');
    memoryDiv.className = 'memory-item';

    const keyDiv = document.createElement('div');
    keyDiv.className = 'memory-key';
    
    const keyText = document.createElement('span');
    keyText.textContent = key;
    
    const actions = document.createElement('div');
    actions.className = 'memory-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-action-btn delete';
    deleteBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="m19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
      </svg>
    `;
    deleteBtn.title = 'Delete memory';
    deleteBtn.addEventListener('click', () => this.deleteMemory(key));

    actions.appendChild(deleteBtn);
    keyDiv.appendChild(keyText);
    keyDiv.appendChild(actions);

    const valueDiv = document.createElement('div');
    valueDiv.className = 'memory-value';
    valueDiv.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

    memoryDiv.appendChild(keyDiv);
    memoryDiv.appendChild(valueDiv);

    return memoryDiv;
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    const entries = Object.keys(this.memory).length;
    const usage = new Blob([JSON.stringify(this.memory)]).size;

    document.getElementById('memoryEntries').textContent = entries;
    document.getElementById('memoryUsage').textContent = `${(usage / 1024).toFixed(1)} KB`;
  }

  /**
   * Save memory
   */
  async saveMemory() {
    try {
      const keyInput = document.getElementById('memoryKey');
      const valueInput = document.getElementById('memoryValue');
      
      const key = keyInput.value.trim();
      const value = valueInput.value.trim();

      if (!key || !value) {
        this.showStatus('Please enter both key and value', 'error');
        return;
      }

      await this.sendMessage({ action: 'setMemory', data: { key, value } });
      
      this.memory[key] = value;
      this.renderMemory();
      
      // Clear inputs
      keyInput.value = '';
      valueInput.value = '';
      
      this.showStatus('Memory saved successfully', 'success');
    } catch (error) {
      console.error('[ActionLayer3] Memory save failed:', error);
      this.showStatus('Failed to save memory', 'error');
    }
  }

  /**
   * Delete memory item
   */
  async deleteMemory(key) {
    try {
      if (!confirm(`Are you sure you want to delete memory "${key}"?`)) return;

      // Set to null to delete
      await this.sendMessage({ action: 'setMemory', data: { key, value: null } });
      
      delete this.memory[key];
      this.renderMemory();
      this.showStatus('Memory deleted', 'success');
    } catch (error) {
      console.error('[ActionLayer3] Memory deletion failed:', error);
      this.showStatus('Failed to delete memory', 'error');
    }
  }

  /**
   * Clear all memory
   */
  async clearAllMemory() {
    try {
      if (!confirm('Are you sure you want to clear all memory? This action cannot be undone.')) return;

      // Delete all keys
      const keys = Object.keys(this.memory);
      for (const key of keys) {
        await this.sendMessage({ action: 'setMemory', data: { key, value: null } });
      }

      this.memory = {};
      this.renderMemory();
      this.showStatus('All memory cleared', 'success');
    } catch (error) {
      console.error('[ActionLayer3] Memory clearing failed:', error);
      this.showStatus('Failed to clear memory', 'error');
    }
  }

  /**
   * Open settings (placeholder)
   */
  openSettings() {
    this.showStatus('Settings feature coming soon', 'info');
  }

  /**
   * Update current page info
   */
  async updateCurrentPage() {
    try {
      const tab = await this.getCurrentTab();
      const pageElement = document.getElementById('currentPage');
      
      if (tab && !tab.url.startsWith('chrome://')) {
        const domain = new URL(tab.url).hostname;
        pageElement.textContent = domain;
        pageElement.title = tab.title;
      } else {
        pageElement.textContent = 'Chrome page';
      }
    } catch (error) {
      console.error('[ActionLayer3] Page info update failed:', error);
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (error) {
      console.error('[ActionLayer3] Failed to get current tab:', error);
      return null;
    }
  }

  /**
   * Send message to background script
   */
  async sendMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('[ActionLayer3] Message send failed:', error);
      throw error;
    }
  }

  /**
   * Show loading state
   */
  showLoading(isLoading) {
    const overlay = document.getElementById('loadingOverlay');
    this.isLoading = isLoading;
    
    if (isLoading) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message text-${type}`;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'status-message';
    }, 3000);
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) { // Less than 1 minute
        return 'Just now';
      } else if (diff < 3600000) { // Less than 1 hour
        return `${Math.floor(diff / 60000)}m ago`;
      } else if (diff < 86400000) { // Less than 1 day
        return `${Math.floor(diff / 3600000)}h ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.actionLayer3Popup = new ActionLayer3Popup();
});
