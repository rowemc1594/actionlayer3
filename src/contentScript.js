/**
 * ActionLayer3 Content Script
 * Handles web page interaction and task extraction
 */

class ActionLayer3ContentScript {
  constructor() {
    this.isInitialized = false;
    this.taskElements = new Map();
    this.observers = [];
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
            sendResponse({ tasks: this.extractTasks() });
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
      const tasks = [];
      const taskElements = this.findTaskElements();
      
      taskElements.forEach((element, index) => {
        const task = this.parseTaskElement(element, index);
        if (task) {
          tasks.push(task);
          this.taskElements.set(task.id, element);
        }
      });

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
    const selectors = [
      '[data-testid*="task"]',
      '[class*="task"]',
      '[class*="todo"]',
      '[class*="item"]',
      'li',
      '[role="listitem"]',
      '.checkbox',
      'input[type="checkbox"]',
      '[data-task]',
      '[data-todo]'
    ];

    const elements = [];
    selectors.forEach(selector => {
      try {
        const found = root.querySelectorAll(selector);
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

    const text = element.textContent?.trim();
    if (!text || text.length < 3) return false;

    // Check for task-like patterns
    const taskPatterns = [
      /^\s*[-*•]\s+/,  // Bullet points
      /^\s*\d+\.\s+/,  // Numbered lists
      /^\s*\[\s*\]\s+/, // Checkboxes
      /^\s*☐\s+/,      // Checkbox symbols
      /todo|task|action|complete|done/i
    ];

    const hasTaskPattern = taskPatterns.some(pattern => 
      pattern.test(text) || pattern.test(element.className) || pattern.test(element.id)
    );

    // Check for interactive elements
    const isInteractive = element.tagName === 'LI' || 
                         element.querySelector('input[type="checkbox"]') ||
                         element.hasAttribute('data-task') ||
                         element.hasAttribute('data-todo');

    return hasTaskPattern || isInteractive;
  }

  /**
   * Parse a task element into a task object
   */
  parseTaskElement(element, index) {
    try {
      const text = element.textContent?.trim();
      if (!text) return null;

      const checkbox = element.querySelector('input[type="checkbox"]');
      const isCompleted = checkbox ? checkbox.checked : 
                         element.classList.contains('completed') ||
                         element.classList.contains('done') ||
                         text.includes('✓') || text.includes('✔');

      return {
        id: `task_${Date.now()}_${index}`,
        text: text,
        completed: isCompleted,
        element: element.tagName.toLowerCase(),
        url: window.location.href,
        domain: window.location.hostname,
        extractedAt: new Date().toISOString(),
        selector: this.generateSelector(element)
      };
    } catch (error) {
      console.error('[ActionLayer3] Failed to parse task element:', error);
      return null;
    }
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
   * Cleanup observers and listeners
   */
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.taskElements.clear();
  }
}

// Initialize content script
if (typeof window !== 'undefined') {
  window.actionLayer3Content = new ActionLayer3ContentScript();
}
