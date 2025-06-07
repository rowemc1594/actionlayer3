/**
 * ActionLayer3 Task Extractor
 * Advanced task extraction logic for web pages
 */

class TaskExtractor {
  constructor() {
    this.patterns = {
      // Task-like text patterns
      bulletPoints: /^\s*[-*•▪▫◦‣⁃]\s+(.+)/gm,
      numberedLists: /^\s*\d+[\.\)]\s+(.+)/gm,
      checkboxes: /^\s*\[\s*[x✓✔]?\s*\]\s*(.+)/gim,
      todoKeywords: /\b(todo|task|action|complete|finish|fix|implement|add|update|remove|delete|create)\b[:\s]+(.+)/gi,
      
      // Priority indicators
      priorities: /\b(urgent|important|critical|high|medium|low|priority)\b/gi,
      
      // Due date patterns
      dueDates: /\b(due|deadline|by)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/gi
    };
    
    this.selectors = {
      // Common task container selectors
      taskContainers: [
        '[data-testid*="task"]',
        '[class*="task"]',
        '[class*="todo"]',
        '[class*="item"]',
        '[role="listitem"]',
        'li',
        '.checkbox',
        '[data-task]',
        '[data-todo]'
      ],
      
      // Interactive elements
      interactive: [
        'input[type="checkbox"]',
        'button[data-task]',
        '[role="button"]'
      ],
      
      // Content areas
      contentAreas: [
        'main',
        '[role="main"]',
        '.content',
        '#content',
        '.main-content'
      ]
    };
    
    this.excludeSelectors = [
      'script',
      'style',
      'nav',
      'footer',
      'header',
      '.advertisement',
      '.ads'
    ];
  }

  /**
   * Extract all tasks from the current page
   */
  extractTasks(options = {}) {
    try {
      const {
        includeCompleted = true,
        minTextLength = 5,
        maxTextLength = 500,
        focusArea = null
      } = options;

      const tasks = [];
      const seenTexts = new Set();
      
      // Determine extraction scope
      const scope = focusArea ? document.querySelector(focusArea) : document;
      if (!scope) {
        console.warn('[TaskExtractor] Focus area not found, using document');
        return this.extractTasks({ ...options, focusArea: null });
      }

      // Extract from structured elements
      const structuredTasks = this.extractFromStructuredElements(scope, {
        includeCompleted,
        minTextLength,
        maxTextLength
      });
      
      structuredTasks.forEach(task => {
        if (!seenTexts.has(task.text.toLowerCase())) {
          tasks.push(task);
          seenTexts.add(task.text.toLowerCase());
        }
      });

      // Extract from text patterns
      const patternTasks = this.extractFromTextPatterns(scope, {
        includeCompleted,
        minTextLength,
        maxTextLength
      });
      
      patternTasks.forEach(task => {
        if (!seenTexts.has(task.text.toLowerCase())) {
          tasks.push(task);
          seenTexts.add(task.text.toLowerCase());
        }
      });

      // Enhance tasks with metadata
      return tasks.map(task => this.enhanceTask(task));
    } catch (error) {
      console.error('[TaskExtractor] Extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract tasks from structured HTML elements
   */
  extractFromStructuredElements(scope, options) {
    const tasks = [];
    
    try {
      // Find all potential task elements
      const elements = this.findTaskElements(scope);
      
      elements.forEach((element, index) => {
        const task = this.parseStructuredElement(element, index, options);
        if (task) {
          tasks.push(task);
        }
      });
    } catch (error) {
      console.error('[TaskExtractor] Structured extraction failed:', error);
    }
    
    return tasks;
  }

  /**
   * Extract tasks from text patterns
   */
  extractFromTextPatterns(scope, options) {
    const tasks = [];
    
    try {
      // Get all text content
      const walker = document.createTreeWalker(
        scope,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            
            // Skip excluded elements
            if (this.isExcludedElement(parent)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            // Only process meaningful text
            const text = node.textContent.trim();
            if (text.length < options.minTextLength) {
              return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      // Process text nodes for patterns
      textNodes.forEach((textNode, index) => {
        const patternTasks = this.extractPatternsFromText(
          textNode.textContent,
          textNode.parentElement,
          index,
          options
        );
        tasks.push(...patternTasks);
      });
    } catch (error) {
      console.error('[TaskExtractor] Pattern extraction failed:', error);
    }
    
    return tasks;
  }

  /**
   * Find potential task elements in the DOM
   */
  findTaskElements(scope) {
    const elements = new Set();
    
    // Search using selectors
    this.selectors.taskContainers.forEach(selector => {
      try {
        const found = scope.querySelectorAll(selector);
        found.forEach(element => {
          if (this.isValidTaskElement(element)) {
            elements.add(element);
          }
        });
      } catch (error) {
        // Ignore invalid selectors
      }
    });
    
    return Array.from(elements);
  }

  /**
   * Check if element is a valid task element
   */
  isValidTaskElement(element) {
    if (!element || this.isExcludedElement(element)) {
      return false;
    }
    
    const text = element.textContent?.trim();
    if (!text || text.length < 3 || text.length > 500) {
      return false;
    }
    
    // Check for task-like characteristics
    const hasTaskPattern = this.hasTaskPattern(text, element);
    const hasInteractiveElements = this.hasInteractiveElements(element);
    const isListItem = element.tagName === 'LI';
    
    return hasTaskPattern || hasInteractiveElements || isListItem;
  }

  /**
   * Check if element should be excluded
   */
  isExcludedElement(element) {
    if (!element) return true;
    
    return this.excludeSelectors.some(selector => {
      try {
        return element.matches(selector) || element.closest(selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if text/element has task-like patterns
   */
  hasTaskPattern(text, element) {
    // Check text patterns
    const hasTextPattern = Object.values(this.patterns).some(pattern => 
      pattern.test(text)
    );
    
    // Check element attributes
    const hasAttributePattern = ['class', 'id', 'data-testid'].some(attr => {
      const value = element.getAttribute(attr) || '';
      return /task|todo|item|action/i.test(value);
    });
    
    return hasTextPattern || hasAttributePattern;
  }

  /**
   * Check if element has interactive elements
   */
  hasInteractiveElements(element) {
    return this.selectors.interactive.some(selector => {
      try {
        return element.matches(selector) || element.querySelector(selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * Parse structured element into task object
   */
  parseStructuredElement(element, index, options) {
    try {
      const text = this.extractElementText(element);
      
      if (!text || text.length < options.minTextLength || text.length > options.maxTextLength) {
        return null;
      }
      
      const completed = this.isElementCompleted(element);
      
      if (!options.includeCompleted && completed) {
        return null;
      }
      
      return {
        id: this.generateTaskId('structured', index),
        text: text,
        completed: completed,
        type: 'structured',
        element: element.tagName.toLowerCase(),
        selector: this.generateSelector(element),
        confidence: this.calculateConfidence(element, text),
        metadata: this.extractMetadata(element, text)
      };
    } catch (error) {
      console.error('[TaskExtractor] Element parsing failed:', error);
      return null;
    }
  }

  /**
   * Extract clean text from element
   */
  extractElementText(element) {
    // Clone element to avoid modifying original
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const unwanted = clone.querySelectorAll('script, style, .hidden, [hidden]');
    unwanted.forEach(el => el.remove());
    
    // Get text content
    let text = clone.textContent?.trim() || '';
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');
    
    // Remove common prefixes
    text = text.replace(/^\s*[-*•▪▫◦‣⁃]\s*/, '');
    text = text.replace(/^\s*\d+[\.\)]\s*/, '');
    text = text.replace(/^\s*\[\s*[x✓✔]?\s*\]\s*/i, '');
    
    return text;
  }

  /**
   * Check if element represents completed task
   */
  isElementCompleted(element) {
    // Check checkbox state
    const checkbox = element.querySelector('input[type="checkbox"]');
    if (checkbox) {
      return checkbox.checked;
    }
    
    // Check CSS classes
    const completedClasses = ['completed', 'done', 'finished', 'checked'];
    if (completedClasses.some(cls => element.classList.contains(cls))) {
      return true;
    }
    
    // Check text content for completion indicators
    const text = element.textContent || '';
    const completionIndicators = /[✓✔][✗❌]/;
    if (completionIndicators.test(text)) {
      return true;
    }
    
    // Check styling
    const style = window.getComputedStyle(element);
    if (style.textDecoration.includes('line-through')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract tasks from text patterns
   */
  extractPatternsFromText(text, parentElement, index, options) {
    const tasks = [];
    
    Object.entries(this.patterns).forEach(([patternName, pattern]) => {
      if (patternName === 'priorities' || patternName === 'dueDates') {
        return; // Skip metadata patterns
      }
      
      let match;
      pattern.lastIndex = 0; // Reset regex
      
      while ((match = pattern.exec(text)) !== null) {
        const taskText = (match[1] || match[0]).trim();
        
        if (taskText.length >= options.minTextLength && 
            taskText.length <= options.maxTextLength) {
          
          tasks.push({
            id: this.generateTaskId('pattern', tasks.length),
            text: taskText,
            completed: this.isTextCompleted(match[0]),
            type: 'pattern',
            pattern: patternName,
            element: parentElement?.tagName.toLowerCase() || 'text',
            confidence: this.calculatePatternConfidence(patternName, taskText),
            metadata: this.extractMetadata(parentElement, taskText)
          });
        }
      }
    });
    
    return tasks;
  }

  /**
   * Check if text indicates completion
   */
  isTextCompleted(text) {
    return /^\s*\[\s*[x✓✔]\s*\]/i.test(text) || 
           /[✓✔]/.test(text);
  }

  /**
   * Calculate confidence score for task extraction
   */
  calculateConfidence(element, text) {
    let confidence = 0.5; // Base confidence
    
    // Element-based indicators
    if (element) {
      if (element.tagName === 'LI') confidence += 0.2;
      if (element.querySelector('input[type="checkbox"]')) confidence += 0.3;
      if (/task|todo|action/i.test(element.className)) confidence += 0.2;
      if (/task|todo|action/i.test(element.id)) confidence += 0.2;
    }
    
    // Text-based indicators
    if (text) {
      if (/^(todo|task|action|complete|finish|fix|implement)/i.test(text)) confidence += 0.2;
      if (/\b(urgent|important|priority)\b/i.test(text)) confidence += 0.1;
      if (this.patterns.checkboxes.test(text)) confidence += 0.2;
      if (this.patterns.bulletPoints.test(text)) confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence for pattern-based extraction
   */
  calculatePatternConfidence(patternName, text) {
    const baseConfidence = {
      checkboxes: 0.9,
      bulletPoints: 0.7,
      numberedLists: 0.8,
      todoKeywords: 0.8
    };
    
    let confidence = baseConfidence[patternName] || 0.5;
    
    // Adjust based on text characteristics
    if (text.length > 100) confidence -= 0.1;
    if (/\b(urgent|important|critical)\b/i.test(text)) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Extract metadata from task
   */
  extractMetadata(element, text) {
    const metadata = {};
    
    // Extract priority
    const priorityMatch = text.match(this.patterns.priorities);
    if (priorityMatch) {
      metadata.priority = priorityMatch[0].toLowerCase();
    }
    
    // Extract due date
    const dueDateMatch = text.match(this.patterns.dueDates);
    if (dueDateMatch) {
      metadata.dueDate = dueDateMatch[0];
    }
    
    // Extract context from element
    if (element) {
      const container = element.closest('[data-project], [data-category], .project, .category');
      if (container) {
        metadata.context = container.dataset.project || 
                          container.dataset.category || 
                          container.className;
      }
    }
    
    return metadata;
  }

  /**
   * Enhance task with additional information
   */
  enhanceTask(task) {
    return {
      ...task,
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      extractedAt: new Date().toISOString(),
      xpath: this.generateXPath(task.selector)
    };
  }

  /**
   * Generate unique task ID
   */
  generateTaskId(type, index) {
    return `${type}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Generate CSS selector for element
   */
  generateSelector(element) {
    if (!element) return '';
    
    try {
      if (element.id) {
        return `#${element.id}`;
      }
      
      if (element.className) {
        const classes = element.className.split(' ')
          .filter(c => c.length > 0 && !/^(ng-|js-|css-)/.test(c))
          .slice(0, 3);
        if (classes.length > 0) {
          return `.${classes.join('.')}`;
        }
      }
      
      // Generate nth-child selector
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element);
        const tagName = element.tagName.toLowerCase();
        
        if (index >= 0) {
          return `${tagName}:nth-child(${index + 1})`;
        }
      }
      
      return element.tagName.toLowerCase();
    } catch (error) {
      console.error('[TaskExtractor] Selector generation failed:', error);
      return element.tagName?.toLowerCase() || 'unknown';
    }
  }

  /**
   * Generate XPath for element
   */
  generateXPath(selector) {
    // Simple selector to XPath conversion
    if (selector.startsWith('#')) {
      return `//*[@id="${selector.substring(1)}"]`;
    }
    
    if (selector.startsWith('.')) {
      const className = selector.substring(1).replace(/\./g, ' ');
      return `//*[contains(@class, "${className}")]`;
    }
    
    return `//${selector}`;
  }

  /**
   * Get extraction statistics
   */
  getExtractionStats() {
    return {
      totalElements: document.querySelectorAll('*').length,
      taskElements: this.findTaskElements(document).length,
      textNodes: document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
      ).length,
      extractedAt: new Date().toISOString()
    };
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskExtractor;
} else if (typeof window !== 'undefined') {
  window.TaskExtractor = TaskExtractor;
}
