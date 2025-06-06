/**
 * ActionLayer3 Content Script
 * Handles web page interaction and task extraction
 */

// Test if content script loads
console.log('[ActionLayer3] Content script file loaded - sidebar version');
console.log('[ActionLayer3] URL:', window.location.href);
console.log('[ActionLayer3] Document ready state:', document.readyState);

class ActionLayer3ContentScript {
  constructor() {
    this.isInitialized = false;
    this.taskElements = new Map();
    this.observers = [];
    this.sidebarIframe = null;
    this.sidebarVisible = false;
    this.init();
  }

  /**
   * Initialize the content script
   */
  async init() {
    try {
      if (this.isInitialized) return;
      
      console.log('[ActionLayer3] Content script initializing...');
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('[ActionLayer3] Content script initialization failed:', error);
    }
  }

  /**
   * Setup content script functionality
   */
  setup() {
    try {
      this.setupMessageListener();
      this.setupDOMObserver();
      this.extractInitialTasks();
      
      // Auto-dock sidebar only on ChatGPT pages
      if (location.hostname.includes("chat.openai.com")) {
        this.injectSidebar();
      }
      
      this.setupPostMessageListener();
      
      console.log('[ActionLayer3] Content script setup complete');
    } catch (error) {
      console.error('[ActionLayer3] Content script setup failed:', error);
    }
  }

  /**
   * Setup message listener for communication with background script
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        switch (request.action) {
          case 'extractTasks':
            console.log('[ActionLayer3] Content script extracting tasks...');
            console.log('[ActionLayer3] Current URL:', window.location.href);
            
            // Simple test: just find all h1, h2, li elements regardless of filtering
            const testElements = document.querySelectorAll('h1, h2, h3, li');
            console.log('[ActionLayer3] Test found', testElements.length, 'heading/list elements');
            
            const tasks = this.extractTasks();
            console.log('[ActionLayer3] Content script found', tasks.length, 'tasks:', tasks);
            sendResponse({ tasks: tasks });
            break;
          case 'highlightTask':
            this.highlightTask(request.taskId);
            sendResponse({ success: true });
            break;
          case 'getPageInfo':
            sendResponse({
              url: window.location.href,
              title: document.title,
              domain: window.location.hostname
            });
            break;
          default:
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[ActionLayer3] Message handling error:', error);
        sendResponse({ error: error.message });
      }
      return true; // Keep message channel open for async response
    });
  }

  /**
   * Setup DOM observer to watch for dynamic content changes
   */
  setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldReextract = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if added nodes contain potential task elements
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.isTaskElement(node) || node.querySelector && this.findTaskElements(node).length > 0) {
                shouldReextract = true;
                break;
              }
            }
          }
        }
      });
      
      if (shouldReextract) {
        this.extractTasks();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  /**
   * Extract tasks from the current page
   */
  extractTasks() {
    try {
      console.log('[ActionLayer3] Starting task extraction...');
      const tasks = [];
      const taskElements = this.findTaskElements();
      console.log('[ActionLayer3] Found', taskElements.length, 'potential task elements');
      
      taskElements.forEach((element, index) => {
        console.log('[ActionLayer3] Processing element:', element.tagName, element.textContent?.substring(0, 50));
        const task = this.parseTaskElement(element, index);
        if (task) {
          console.log('[ActionLayer3] Created task:', task.text);
          tasks.push(task);
          this.taskElements.set(task.id, element);
        } else {
          console.log('[ActionLayer3] Element rejected during parsing');
        }
      });

      console.log('[ActionLayer3] Final task count:', tasks.length);

      // Notify background script of extracted tasks
      chrome.runtime.sendMessage({
        action: 'tasksExtracted',
        tasks: tasks,
        pageInfo: {
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname
        }
      }).catch(error => {
        console.error('[ActionLayer3] Failed to send tasks to background:', error);
      });

      return tasks;
    } catch (error) {
      console.error('[ActionLayer3] Task extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract tasks on initial page load
   */
  extractInitialTasks() {
    // Delay extraction to ensure page is fully loaded
    setTimeout(() => {
      this.extractTasks();
    }, 1000);
  }

  /**
   * Find potential task elements on the page
   */
  findTaskElements(root = document) {
    const elements = [];
    
    // Focus on main content areas first
    const mainContentSelectors = [
      'main', 
      '[role="main"]', 
      '.content', 
      '.main-content', 
      'article',
      '.post-content',
      '.entry-content'
    ];
    
    let contentArea = null;
    for (const selector of mainContentSelectors) {
      contentArea = root.querySelector(selector);
      if (contentArea) break;
    }
    
    // If no main content area found, use the body but exclude common UI areas
    if (!contentArea) {
      contentArea = root.body || root;
    }
    
    // Look for structured task elements in content area
    const structuredSelectors = [
      'li',
      '[role="listitem"]',
      'h1, h2, h3, h4, h5, h6',
      'p',
      '.step',
      '.task',
      '.todo',
      '.item'
    ];

    structuredSelectors.forEach(selector => {
      try {
        const found = contentArea.querySelectorAll(selector);
        elements.push(...Array.from(found));
      } catch (error) {
        // Ignore invalid selectors
      }
    });

    return elements.filter(el => this.isTaskElement(el));
  }

  /**
   * Check if an element represents a task
   */
  isTaskElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    const text = element.textContent?.trim() || '';
    if (text.length < 10 || text.length > 500) return false;
    
    // Skip navigation, header, footer, and UI elements
    const excludedTags = ['nav', 'header', 'footer', 'script', 'style', 'meta', 'aside', 'button'];
    if (excludedTags.includes(element.tagName.toLowerCase())) return false;
    
    // Skip elements with UI-related classes and IDs
    const elementClasses = element.className.toLowerCase();
    const elementId = element.id.toLowerCase();
    const uiKeywords = ['sidebar', 'menu', 'nav', 'toolbar', 'header', 'footer', 'chatgpt', 'shareplus', 'button', 'dropdown', 'modal'];
    
    if (uiKeywords.some(keyword => elementClasses.includes(keyword) || elementId.includes(keyword))) {
      return false;
    }
    
    // Enhanced task patterns for better detection
    const taskPatterns = [
      /^\d+\.\s+\w+/,  // Numbered list items (like "1. Defining the Scope")
      /^[-*•]\s+\w+/,  // Bullet points
      /^☐|^□|^✓|^✔|^✕/,  // Checkbox symbols
      /\b(defining|choosing|integrating|implementing|building|deploying|setting up|configuring)\b/i,  // Action verbs
      /\b(step|phase|stage|process|procedure|method|approach|technique)\b/i,  // Process words
      /\b(first|second|third|next|then|finally|lastly)\b.*\b(you|need|should|must|will)\b/i,  // Instructional patterns
      /:\s*\w+.*\.(.*data.*sources|.*tools|.*integration|.*access.*controls|.*model|.*deployment)/i,  // Descriptive task patterns
      /\b(ensure|make sure|verify|check|confirm|validate)\b/i  // Verification actions
    ];
    
    // Skip elements that are likely UI components
    if (element.closest('[class*="sidebar"]') || 
        element.closest('[class*="menu"]') || 
        element.closest('[class*="nav"]') ||
        element.closest('[id*="sidebar"]') ||
        element.closest('button') ||
        element.closest('[role="button"]') ||
        element.closest('[class*="toolbar"]') ||
        element.closest('[class*="chrome"]') ||
        element.closest('[class*="extension"]')) {
      return false;
    }
    
    // Filter out very generic text that's not actionable
    const genericPhrases = ['read more', 'learn more', 'click here', 'see more', 'view all', 'home', 'menu', 'search', 'back', 'next', 'previous'];
    if (genericPhrases.some(phrase => text.toLowerCase().includes(phrase))) {
      return false;
    }
    
    const hasTaskPattern = taskPatterns.some(pattern => pattern.test(text));
    
    // Check for interactive elements (checkboxes, buttons)
    const hasCheckbox = element.querySelector('input[type="checkbox"]') || 
                       element.closest('label') || 
                       element.getAttribute('role') === 'checkbox';
    
    // Check for task-related classes or attributes
    const hasTaskClass = ['task', 'todo', 'item', 'action', 'checkbox', 'step'].some(cls => 
      elementClasses.includes(cls)
    );
    
    // Special handling for numbered list items in structured content
    const isNumberedListItem = element.tagName.toLowerCase() === 'li' && /^\d+\./.test(text);
    
    // Check if it's a paragraph with actionable content
    const isParagraphWithAction = element.tagName.toLowerCase() === 'p' && 
      (/\b(you need|you should|you must|you will|involves|requires|includes)\b/i.test(text) ||
       /\b(first|second|third|next|then|finally)\b/i.test(text));
    
    return hasTaskPattern || hasCheckbox || hasTaskClass || isNumberedListItem || isParagraphWithAction;
  }

  /**
   * Parse a task element into a task object
   */
  parseTaskElement(element, index) {
    try {
      let text = this.extractCleanText(element);
      if (!text) return null;

      // Clean up the text further
      text = text.replace(/\s+/g, ' ').trim();
      
      // Skip if too short or too long
      if (text.length < 10 || text.length > 300) return null;

      // Skip very generic text that's not actionable
      const genericTexts = ['read more', 'learn more', 'click here', 'see more', 'view all', 'home', 'menu', 'search'];
      if (genericTexts.some(generic => text.toLowerCase().includes(generic))) return null;

      const checkbox = element.querySelector('input[type="checkbox"]');
      const isCompleted = checkbox ? checkbox.checked : 
                         element.classList.contains('completed') ||
                         element.classList.contains('done') ||
                         text.includes('✓') || text.includes('✔');

      return {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
        text: text,
        completed: isCompleted,
        element: element.tagName.toLowerCase(),
        url: window.location.href,
        domain: window.location.hostname,
        extractedAt: new Date().toISOString(),
        selector: this.generateSelector(element),
        source: 'auto_extraction'
      };
    } catch (error) {
      console.error('[ActionLayer3] Failed to parse task element:', error);
      return null;
    }
  }

  /**
   * Extract clean text from element, focusing on direct content
   */
  extractCleanText(element) {
    // For headings, use the heading text directly
    if (/^h[1-6]$/i.test(element.tagName)) {
      return element.textContent?.trim();
    }

    // For list items, try to get just the main text
    if (element.tagName.toLowerCase() === 'li') {
      // Clone the element to manipulate it
      const clone = element.cloneNode(true);
      
      // Remove nested lists to avoid concatenated text
      const nestedLists = clone.querySelectorAll('ul, ol');
      nestedLists.forEach(list => list.remove());
      
      return clone.textContent?.trim();
    }

    // For paragraphs, get the text but limit length
    if (element.tagName.toLowerCase() === 'p') {
      const text = element.textContent?.trim();
      // If paragraph is too long, it's probably not a task
      if (text && text.length > 100) {
        return null;
      }
      return text;
    }

    // For other elements, use direct text content
    return element.textContent?.trim();
  }

  /**
   * Generate a CSS selector for an element
   */
  generateSelector(element) {
    try {
      if (element.id) {
        return `#${element.id}`;
      }
      
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
          return `.${classes.join('.')}`;
        }
      }

      // Generate path-based selector
      let path = [];
      let current = element;
      
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        const siblings = Array.from(current.parentNode?.children || []);
        const index = siblings.indexOf(current);
        
        if (index > 0) {
          selector += `:nth-child(${index + 1})`;
        }
        
        path.unshift(selector);
        current = current.parentNode;
      }

      return path.join(' > ');
    } catch (error) {
      console.error('[ActionLayer3] Failed to generate selector:', error);
      return element.tagName.toLowerCase();
    }
  }

  /**
   * Highlight a specific task element
   */
  highlightTask(taskId) {
    try {
      const element = this.taskElements.get(taskId);
      if (!element) return false;

      // Add highlight effect
      element.style.outline = '2px solid #4F46E5';
      element.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.style.outline = '';
        element.style.backgroundColor = '';
      }, 3000);

      return true;
    } catch (error) {
      console.error('[ActionLayer3] Failed to highlight task:', error);
      return false;
    }
  }

  /**
   * Inject sidebar directly into the page
   */
  injectSidebar() {
    if (document.getElementById('actionlayer3-direct-sidebar')) {
      console.log('[ActionLayer3] Sidebar already exists, skipping injection');
      return;
    }

    console.log('[ActionLayer3] Starting direct sidebar injection...');
    
    if (!document.body) {
      console.log('[ActionLayer3] Document body not ready, waiting...');
      setTimeout(() => this.injectSidebar(), 100);
      return;
    }

    try {
      this.createDirectSidebar();
      console.log('[ActionLayer3] Direct sidebar injected successfully');
    } catch (error) {
      console.error('[ActionLayer3] Error injecting sidebar:', error);
    }
  }

  /**
   * Create direct sidebar without iframe
   */
  createDirectSidebar() {
    // Inject CSS if not already present
    if (!document.getElementById('actionlayer3-styles')) {
      const style = document.createElement('style');
      style.id = 'actionlayer3-styles';
      style.textContent = `
        #actionlayer3-direct-sidebar {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          width: 300px !important;
          height: 100vh !important;
          background: white !important;
          border-left: 1px solid #ddd !important;
          box-shadow: -2px 0 10px rgba(0,0,0,0.1) !important;
          z-index: 10000 !important;
          padding: 10px !important;
          overflow-y: auto !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
        }
        .actionlayer3-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .actionlayer3-title { margin: 0; font-size: 18px; color: #333; }
        .actionlayer3-close { background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
        .actionlayer3-buttons { margin-bottom: 15px; }
        .actionlayer3-btn { border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; margin-right: 5px; }
        .actionlayer3-btn-primary { background: #007acc; color: white; }
        .actionlayer3-btn-danger { background: #dc3545; color: white; }
        .actionlayer3-btn-success { background: #28a745; color: white; }
        .actionlayer3-btn-info { background: #17a2b8; color: white; width: 100%; }
        .actionlayer3-input-group { margin-bottom: 15px; }
        .actionlayer3-input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box; margin-bottom: 5px; }
        .actionlayer3-task-list { border: 1px solid #ddd; border-radius: 3px; max-height: 200px; overflow-y: auto; }
        .actionlayer3-task-item { padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .actionlayer3-task-text { flex: 1; }
        .actionlayer3-task-completed { text-decoration: line-through; color: #666; }
        .actionlayer3-toggle-btn { color: white; border: none; padding: 2px 6px; border-radius: 2px; cursor: pointer; font-size: 12px; }
        .actionlayer3-toggle-completed { background: #28a745; }
        .actionlayer3-toggle-pending { background: #6c757d; }
        .actionlayer3-empty-state { padding: 10px; color: #666; text-align: center; }
      `;
      document.head.appendChild(style);
    }

    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'actionlayer3-direct-sidebar';
    
    // Add content with CSS classes
    sidebar.innerHTML = `
      <div class="actionlayer3-header">
        <div>
          <h2 class="actionlayer3-title">ActionLayer3</h2>
          <div style="font-size: 10px; color: #888; margin-top: -5px;">v2.1.0</div>
        </div>
        <button id="actionlayer3-close" class="actionlayer3-close">×</button>
      </div>
      
      <div class="actionlayer3-buttons">
        <button id="actionlayer3-refresh" class="actionlayer3-btn actionlayer3-btn-primary">Refresh Tasks</button>
        <button id="actionlayer3-clear" class="actionlayer3-btn actionlayer3-btn-danger">Clear All Tasks</button>
        <button id="actionlayer3-save" class="actionlayer3-btn actionlayer3-btn-success">Save Memory</button>
      </div>
      
      <div class="actionlayer3-input-group">
        <input type="text" id="actionlayer3-task-input" placeholder="Add a task..." class="actionlayer3-input">
        <button id="actionlayer3-add-task" class="actionlayer3-btn actionlayer3-btn-info">Add Task</button>
      </div>
      
      <div id="actionlayer3-task-list" class="actionlayer3-task-list">
        <div class="actionlayer3-empty-state">Loading tasks...</div>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(sidebar);
    
    // Setup event listeners
    this.setupSidebarEvents(sidebar);
    
    // Load tasks
    this.loadTasks();
  }

  /**
   * Setup sidebar event listeners
   */
  setupSidebarEvents(sidebar) {
    // Close button
    const closeBtn = sidebar.querySelector('#actionlayer3-close');
    closeBtn.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });
    
    // Add task button
    const addBtn = sidebar.querySelector('#actionlayer3-add-task');
    const taskInput = sidebar.querySelector('#actionlayer3-task-input');
    
    addBtn.addEventListener('click', () => {
      const text = taskInput.value.trim();
      if (text) {
        this.addTask(text);
        taskInput.value = '';
      }
    });
    
    taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addBtn.click();
      }
    });
    
    // Refresh button
    const refreshBtn = sidebar.querySelector('#actionlayer3-refresh');
    refreshBtn.addEventListener('click', () => {
      this.extractAndDisplayTasks();
    });
    
    // Clear button
    const clearBtn = sidebar.querySelector('#actionlayer3-clear');
    clearBtn.addEventListener('click', () => {
      this.clearAllTasks();
    });
  }

  /**
   * Add a manual task
   */
  addTask(text) {
    const task = {
      id: 'manual_' + Date.now(),
      text: text,
      completed: false,
      source: 'manual',
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
    
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.push(task);
      chrome.storage.local.set({ tasks: tasks }, () => {
        this.loadTasks();
        console.log('[ActionLayer3] Task added:', task.text);
      });
    });
  }

  /**
   * Load and display tasks
   */
  loadTasks() {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      const taskList = document.querySelector('#actionlayer3-task-list');
      
      if (!taskList) return;
      
      if (tasks.length === 0) {
        taskList.innerHTML = '<div class="actionlayer3-empty-state">No tasks found</div>';
        return;
      }
      
      const taskHTML = tasks.map(task => `
        <div class="actionlayer3-task-item">
          <span class="actionlayer3-task-text ${task.completed ? 'actionlayer3-task-completed' : ''}">${task.text}</span>
          <button data-task-id="${task.id}" class="actionlayer3-toggle-btn ${task.completed ? 'actionlayer3-toggle-completed' : 'actionlayer3-toggle-pending'}">
            ${task.completed ? '✓' : '○'}
          </button>
        </div>
      `).join('');
      
      taskList.innerHTML = taskHTML;
      
      // Add event listeners to toggle buttons
      taskList.querySelectorAll('.actionlayer3-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const taskId = e.target.getAttribute('data-task-id');
          this.toggleTask(taskId);
        });
      });
    });
  }

  /**
   * Toggle task completion
   */
  toggleTask(taskId) {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        chrome.storage.local.set({ tasks: tasks }, () => {
          this.loadTasks();
          console.log('[ActionLayer3] Task toggled:', task.text);
        });
      }
    });
  }

  /**
   * Extract and display tasks from current page
   */
  extractAndDisplayTasks() {
    console.log('[ActionLayer3] v2.1.0 - Starting enhanced task extraction...');
    const tasks = this.extractTasks();
    
    // Log task details for debugging
    console.log('[ActionLayer3] Raw extracted tasks:', tasks.map(t => t.text.substring(0, 50) + '...'));
    
    // Remove duplicates based on text content
    const uniqueTasks = tasks.filter((task, index, self) => 
      index === self.findIndex(t => t.text.toLowerCase().trim() === task.text.toLowerCase().trim())
    );
    
    console.log(`[ActionLayer3] v2.1.0 - Found ${tasks.length} total tasks, ${uniqueTasks.length} unique tasks`);
    console.log('[ActionLayer3] Unique task texts:', uniqueTasks.map(t => t.text.substring(0, 80)));
    
    // Store extracted tasks
    chrome.storage.local.get(['tasks'], (result) => {
      const existingTasks = result.tasks || [];
      const currentUrl = window.location.href;
      
      // Remove old extracted tasks from this URL
      const filteredTasks = existingTasks.filter(task => 
        task.source === 'manual' || task.url !== currentUrl
      );
      
      // Add new unique extracted tasks
      const allTasks = [...filteredTasks, ...uniqueTasks];
      
      chrome.storage.local.set({ tasks: allTasks }, () => {
        this.loadTasks();
        console.log(`[ActionLayer3] v2.1.0 - Successfully stored ${uniqueTasks.length} unique tasks`);
      });
    });
  }

  /**
   * Clear all tasks from storage and update view
   */
  clearAllTasks() {
    if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
      chrome.storage.local.set({ tasks: [] }, () => {
        this.loadTasks();
        console.log('[ActionLayer3] All tasks cleared');
      });
    }
  }

  /**
   * Setup post message listener for iframe communication
   */
  setupPostMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.action === 'closeSidebar') {
        this.closeSidebar();
      }
    });
  }

  /**
   * Close the sidebar
   */
  closeSidebar() {
    if (this.sidebarIframe) {
      console.log('[ActionLayer3] Closing sidebar');
      this.sidebarIframe.remove();
      this.sidebarIframe = null;
      this.sidebarVisible = false;
    }
  }

  /**
   * Cleanup observers and listeners
   */
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.taskElements.clear();
    this.closeSidebar();
  }
}

// Initialize content script
if (typeof window !== 'undefined') {
  // Prevent multiple initializations
  if (!window.actionLayer3Content) {
    console.log('[ActionLayer3] Initializing content script instance...');
    window.actionLayer3Content = new ActionLayer3ContentScript();
  } else {
    console.log('[ActionLayer3] Content script already initialized');
  }
}
