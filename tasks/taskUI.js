/**
 * ActionLayer3 Task UI Components
 * Reusable UI components for task management
 */

class TaskUI {
  constructor(container) {
    this.container = container;
    this.tasks = [];
    this.filters = {
      status: 'all', // all, completed, pending
      search: '',
      sort: 'created' // created, updated, alphabetical, priority
    };
    this.listeners = new Map();
    this.init();
  }

  /**
   * Initialize task UI
   */
  init() {
    this.setupEventListeners();
    this.render();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Global event delegation for task actions
    this.container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const taskId = target.closest('[data-task-id]')?.dataset.taskId;

      this.handleTaskAction(action, taskId, target);
    });

    // Input events for real-time updates
    this.container.addEventListener('input', (e) => {
      if (e.target.matches('[data-search]')) {
        this.updateFilter('search', e.target.value);
      }
    });

    // Change events for filters
    this.container.addEventListener('change', (e) => {
      if (e.target.matches('[data-filter]')) {
        const filterType = e.target.dataset.filter;
        this.updateFilter(filterType, e.target.value);
      }
    });

    // Keyboard shortcuts
    this.container.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }

  /**
   * Handle task actions
   */
  handleTaskAction(action, taskId, element) {
    const task = this.findTask(taskId);
    
    switch (action) {
      case 'toggle':
        this.toggleTask(taskId);
        break;
      case 'edit':
        this.editTask(taskId);
        break;
      case 'delete':
        this.deleteTask(taskId);
        break;
      case 'duplicate':
        this.duplicateTask(taskId);
        break;
      case 'priority':
        this.setPriority(taskId, element.dataset.priority);
        break;
      case 'category':
        this.setCategory(taskId, element.dataset.category);
        break;
      case 'highlight':
        this.highlightTask(taskId);
        break;
      default:
        this.emit('action', { action, taskId, task, element });
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + N: New task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.showAddTaskForm();
    }

    // Escape: Close modals/forms
    if (e.key === 'Escape') {
      this.closeModals();
    }

    // Delete: Delete selected task
    if (e.key === 'Delete' && document.activeElement.dataset.taskId) {
      const taskId = document.activeElement.dataset.taskId;
      this.deleteTask(taskId);
    }
  }

  /**
   * Render the task UI
   */
  render() {
    const filteredTasks = this.getFilteredTasks();
    const html = this.generateHTML(filteredTasks);
    this.container.innerHTML = html;
    this.bindEvents();
  }

  /**
   * Generate HTML for task UI
   */
  generateHTML(tasks) {
    return `
      <div class="task-ui">
        ${this.generateHeader()}
        ${this.generateFilters()}
        ${this.generateStats(tasks)}
        ${this.generateTaskList(tasks)}
        ${this.generateFloatingActions()}
      </div>
    `;
  }

  /**
   * Generate header HTML
   */
  generateHeader() {
    return `
      <header class="task-header">
        <h2 class="task-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
          </svg>
          Task Management
        </h2>
        <div class="task-header-actions">
          <button class="btn-icon" data-action="refresh" title="Refresh tasks">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M3 18l7-7-7-7"></path>
            </svg>
          </button>
          <button class="btn-primary" data-action="add-task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Task
          </button>
        </div>
      </header>
    `;
  }

  /**
   * Generate filters HTML
   */
  generateFilters() {
    return `
      <div class="task-filters">
        <div class="filter-group">
          <input 
            type="text" 
            class="search-input" 
            placeholder="Search tasks..." 
            data-search
            value="${this.filters.search}"
          >
        </div>
        <div class="filter-group">
          <select class="filter-select" data-filter="status">
            <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Tasks</option>
            <option value="pending" ${this.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="completed" ${this.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        <div class="filter-group">
          <select class="filter-select" data-filter="sort">
            <option value="created" ${this.filters.sort === 'created' ? 'selected' : ''}>Date Created</option>
            <option value="updated" ${this.filters.sort === 'updated' ? 'selected' : ''}>Last Updated</option>
            <option value="alphabetical" ${this.filters.sort === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>
            <option value="priority" ${this.filters.sort === 'priority' ? 'selected' : ''}>Priority</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Generate stats HTML
   */
  generateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `
      <div class="task-stats">
        <div class="stat-card">
          <div class="stat-value">${total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completed}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completionRate}%</div>
          <div class="stat-label">Completion</div>
        </div>
      </div>
    `;
  }

  /**
   * Generate task list HTML
   */
  generateTaskList(tasks) {
    if (tasks.length === 0) {
      return this.generateEmptyState();
    }

    const taskHTML = tasks.map(task => this.generateTaskItem(task)).join('');
    
    return `
      <div class="task-list">
        ${taskHTML}
      </div>
    `;
  }

  /**
   * Generate task item HTML
   */
  generateTaskItem(task) {
    const priorityClass = task.metadata?.priority ? `priority-${task.metadata.priority}` : '';
    const completedClass = task.completed ? 'completed' : '';
    
    return `
      <div class="task-item ${priorityClass} ${completedClass}" data-task-id="${task.id}">
        <div class="task-checkbox" data-action="toggle">
          ${task.completed ? '✓' : ''}
        </div>
        
        <div class="task-content">
          <div class="task-text">${this.escapeHTML(task.text)}</div>
          <div class="task-meta">
            ${this.generateTaskMeta(task)}
          </div>
        </div>
        
        <div class="task-actions">
          ${this.generateTaskActions(task)}
        </div>
      </div>
    `;
  }

  /**
   * Generate task metadata HTML
   */
  generateTaskMeta(task) {
    const meta = [];
    
    if (task.domain) {
      meta.push(`<span class="meta-domain">${task.domain}</span>`);
    }
    
    if (task.metadata?.priority) {
      meta.push(`<span class="meta-priority priority-${task.metadata.priority}">${task.metadata.priority}</span>`);
    }
    
    if (task.metadata?.category) {
      meta.push(`<span class="meta-category">${task.metadata.category}</span>`);
    }
    
    if (task.createdAt || task.extractedAt) {
      const date = task.createdAt || task.extractedAt;
      meta.push(`<span class="meta-date">${this.formatDate(date)}</span>`);
    }
    
    if (task.confidence) {
      const confidence = Math.round(task.confidence * 100);
      meta.push(`<span class="meta-confidence">${confidence}% confidence</span>`);
    }
    
    return meta.join(' • ');
  }

  /**
   * Generate task actions HTML
   */
  generateTaskActions(task) {
    return `
      <button class="action-btn" data-action="edit" title="Edit task">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      
      <button class="action-btn" data-action="duplicate" title="Duplicate task">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
        </svg>
      </button>
      
      ${task.url && !task.url.includes('chrome://') ? `
        <button class="action-btn" data-action="highlight" title="Highlight on page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="21 21l-4.35-4.35"></path>
          </svg>
        </button>
      ` : ''}
      
      <button class="action-btn delete" data-action="delete" title="Delete task">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
        </svg>
      </button>
    `;
  }

  /**
   * Generate empty state HTML
   */
  generateEmptyState() {
    return `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
        </svg>
        <h3>No tasks found</h3>
        <p>Start by adding a task or extracting tasks from web pages</p>
        <button class="btn-primary" data-action="add-task">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Your First Task
        </button>
      </div>
    `;
  }

  /**
   * Generate floating actions HTML
   */
  generateFloatingActions() {
    return `
      <div class="floating-actions">
        <button class="fab" data-action="extract" title="Extract tasks from page">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Set tasks data
   */
  setTasks(tasks) {
    this.tasks = Array.isArray(tasks) ? tasks : [];
    this.render();
  }

  /**
   * Add task
   */
  addTask(task) {
    this.tasks.push(task);
    this.render();
    this.emit('taskAdded', task);
  }

  /**
   * Update task
   */
  updateTask(taskId, updates) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.render();
      this.emit('taskUpdated', { taskId, task: this.tasks[index] });
    }
  }

  /**
   * Toggle task completion
   */
  toggleTask(taskId) {
    const task = this.findTask(taskId);
    if (task) {
      task.completed = !task.completed;
      task.updatedAt = new Date().toISOString();
      this.render();
      this.emit('taskToggled', task);
    }
  }

  /**
   * Delete task
   */
  deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const task = this.tasks[index];
      this.tasks.splice(index, 1);
      this.render();
      this.emit('taskDeleted', { taskId, task });
    }
  }

  /**
   * Duplicate task
   */
  duplicateTask(taskId) {
    const task = this.findTask(taskId);
    if (task) {
      const duplicate = {
        ...task,
        id: `duplicate_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        text: `Copy of ${task.text}`,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.addTask(duplicate);
    }
  }

  /**
   * Edit task
   */
  editTask(taskId) {
    const task = this.findTask(taskId);
    if (!task) return;

    const newText = prompt('Edit task:', task.text);
    if (newText !== null && newText.trim()) {
      this.updateTask(taskId, { 
        text: newText.trim(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Highlight task on page
   */
  highlightTask(taskId) {
    const task = this.findTask(taskId);
    if (task) {
      this.emit('highlightTask', task);
    }
  }

  /**
   * Show add task form
   */
  showAddTaskForm() {
    const text = prompt('Enter task description:');
    if (text && text.trim()) {
      const task = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        text: text.trim(),
        completed: false,
        type: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };
      this.addTask(task);
    }
  }

  /**
   * Close modals and forms
   */
  closeModals() {
    // Implementation for closing modals
    this.emit('closeModals');
  }

  /**
   * Update filter
   */
  updateFilter(type, value) {
    this.filters[type] = value;
    this.render();
    this.emit('filterChanged', { type, value, filters: this.filters });
  }

  /**
   * Get filtered tasks
   */
  getFilteredTasks() {
    let filtered = [...this.tasks];

    // Filter by status
    if (this.filters.status !== 'all') {
      filtered = filtered.filter(task => {
        return this.filters.status === 'completed' ? task.completed : !task.completed;
      });
    }

    // Filter by search
    if (this.filters.search) {
      const search = this.filters.search.toLowerCase();
      filtered = filtered.filter(task => {
        return task.text.toLowerCase().includes(search) ||
               task.domain?.toLowerCase().includes(search) ||
               task.metadata?.category?.toLowerCase().includes(search);
      });
    }

    // Sort tasks
    filtered.sort((a, b) => {
      switch (this.filters.sort) {
        case 'alphabetical':
          return a.text.localeCompare(b.text);
        case 'priority':
          const priorities = { high: 3, medium: 2, low: 1 };
          const aPriority = priorities[a.metadata?.priority] || 0;
          const bPriority = priorities[b.metadata?.priority] || 0;
          return bPriority - aPriority;
        case 'updated':
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        case 'created':
        default:
          return new Date(b.createdAt || b.extractedAt || 0) - new Date(a.createdAt || a.extractedAt || 0);
      }
    });

    return filtered;
  }

  /**
   * Find task by ID
   */
  findTask(taskId) {
    return this.tasks.find(t => t.id === taskId);
  }

  /**
   * Bind events after rendering
   */
  bindEvents() {
    // Additional event binding if needed
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Escape HTML
   */
  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
          console.error(`[TaskUI] Event handler error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Destroy the task UI
   */
  destroy() {
    this.listeners.clear();
    this.container.innerHTML = '';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskUI;
} else if (typeof window !== 'undefined') {
  window.TaskUI = TaskUI;
}
