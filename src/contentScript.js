/**
 * ActionLayer3 Content Script
 * Handles web page interaction and task extraction
 */

// Test if content script loads
console.log('[ActionLayer3] Content script file loaded');

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
    if (text.length < 3 || text.length > 200) return false;
    
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
    
    // Define task patterns first - simplified for better detection
    const taskPatterns = [
      /^[-*•]\s+/,  // Bullet points
      /^\d+\.\s+/,  // Numbered lists
      /^☐|^□|^✓|^✔|^✕/,  // Checkbox symbols
      /\b(define|identify|choose|select|build|create|develop|implement|design|plan|consider|determine|decide)\b/i,
      /\b(functionality|target|audience|integration|approach|platforms)\b/i,  // Content-specific words
      /\b(guide|step|process|method|way|approach)\b/i,
      /:\s*$/  // Text ending with colon (like headings that suggest action items)
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
    
    // Filter out very short generic words that aren't tasks
    const genericWords = ['open', 'close', 'click', 'more', 'less', 'menu', 'search', 'home', 'back', 'next', 'prev'];
    if (genericWords.includes(text.toLowerCase())) {
      return false;
    }
    
    const hasTaskPattern = taskPatterns.some(pattern => pattern.test(text));
    
    // Check for interactive elements (checkboxes, buttons)
    const hasCheckbox = element.querySelector('input[type="checkbox"]') || 
                       element.closest('label') || 
                       element.getAttribute('role') === 'checkbox';
    
    // Check for task-related classes or attributes
    const elementClasses = element.className.toLowerCase();
    const hasTaskClass = ['task', 'todo', 'item', 'action', 'checkbox'].some(cls => 
      elementClasses.includes(cls)
    );
    
    return hasTaskPattern || hasCheckbox || hasTaskClass;
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
      if (text.length < 5 || text.length > 150) return null;

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
