// src/ui/popup.js
console.log("[ActionLayer3] Popup initializing…");

class ActionLayer3Popup {
  constructor() {
    this.refreshButton = null;
    this.saveMemoryButton = null;
    this.tasksTabBtn = null;
    this.memoryTabBtn = null;
    this.tasksTabContent = null;
    this.memoryTabContent = null;
    this.taskList = null;
    this.memoryList = null;
    this.memoryInput = null;
    this.init();
  }

  init() {
    try {
      this.setupEventListeners();
      console.log("[ActionLayer3] Popup setup complete");
    } catch (err) {
      console.error("[ActionLayer3] Popup initialization failed:", err);
    }
  }

  setupEventListeners() {
    // 1. Refresh Tasks button
    this.refreshButton = document.getElementById("refresh-tasks");
    if (!this.refreshButton) throw new Error("Missing #refresh-tasks button");
    this.refreshButton.addEventListener("click", () => this.onRefreshTasks());

    // 2. Save Memory button
    this.saveMemoryButton = document.getElementById("save-memory");
    if (!this.saveMemoryButton) throw new Error("Missing #save-memory button");
    this.saveMemoryButton.addEventListener("click", () => this.onSaveMemory());

    // 3. Test Extract button
    this.testExtractButton = document.getElementById("test-extract");
    if (this.testExtractButton) {
      this.testExtractButton.addEventListener("click", () => this.onTestExtract());
    }

    // 4. Clear All Tasks button
    this.clearTasksButton = document.getElementById("clear-all-tasks");
    if (this.clearTasksButton) {
      this.clearTasksButton.addEventListener("click", () => this.onClearTasks());
    }

    // 5. Close Sidebar button
    this.closeSidebarButton = document.getElementById("close-sidebar");
    if (this.closeSidebarButton) {
      this.closeSidebarButton.addEventListener("click", () => this.onCloseSidebar());
    }

    // 6. Add Task button and input
    this.addTaskButton = document.getElementById("add-task");
    this.taskInput = document.getElementById("task-input");
    if (this.addTaskButton && this.taskInput) {
      this.addTaskButton.addEventListener("click", () => this.onAddTask());
      this.taskInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.onAddTask();
        }
      });
    }

    // 3. Tab headers
    this.tasksTabBtn = document.querySelector('[data-tab="tasks"]');
    this.memoryTabBtn = document.querySelector('[data-tab="memory"]');
    if (!this.tasksTabBtn || !this.memoryTabBtn) throw new Error("Missing tab buttons");
    this.tasksTabBtn.addEventListener("click", () => this.switchTab("tasks"));
    this.memoryTabBtn.addEventListener("click", () => this.switchTab("memory"));

    // 4. Manual task input
    this.taskInput = document.getElementById("task-input");
    this.addTaskButton = document.getElementById("add-task");
    if (this.taskInput && this.addTaskButton) {
      this.addTaskButton.addEventListener("click", () => this.onAddTask());
      this.taskInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.onAddTask();
      });
    }

    // 4. Tab content areas
    this.tasksTabContent = document.getElementById("tasksTab");
    this.memoryTabContent = document.getElementById("memoryTab");
    if (!this.tasksTabContent || !this.memoryTabContent) throw new Error("Missing tab content divs");

    // 5. Task list and memory list ULs
    this.taskList = document.getElementById("task-list");
    this.memoryList = document.getElementById("memory-list");
    if (!this.taskList || !this.memoryList) throw new Error("Missing task-list or memory-list UL");

    // 6. Memory input field
    this.memoryInput = document.getElementById("memory-input");
    if (!this.memoryInput) throw new Error("Missing #memory-input field");
  }

  switchTab(tabKey) {
    if (tabKey === "tasks") {
      this.tasksTabBtn.classList.add("active");
      this.memoryTabBtn.classList.remove("active");
      this.tasksTabContent.classList.add("active");
      this.memoryTabContent.classList.remove("active");
    } else {
      this.memoryTabBtn.classList.add("active");
      this.tasksTabBtn.classList.remove("active");
      this.memoryTabContent.classList.add("active");
      this.tasksTabContent.classList.remove("active");
    }
  }

  onRefreshTasks() {
    console.log("[ActionLayer3] Refresh tasks clicked");
    
    // First try to inject content script, then extract tasks
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      
      try {
        // Try to inject content script programmatically
        console.log("[ActionLayer3] Injecting content script...");
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['simple-extractor.js']
        });
        console.log("[ActionLayer3] Content script injected successfully");
        
        // Wait a moment for initialization
        setTimeout(() => {
          // Now try to extract tasks
          chrome.tabs.sendMessage(activeTab.id, { action: "extractTasks" }, (response) => {
            if (!chrome.runtime.lastError && response && response.tasks) {
          console.log("[ActionLayer3] Content script found tasks:", response.tasks);
          chrome.storage.local.get(['tasks'], (result) => {
            const existingTasks = result.tasks || [];
            
            // Improve duplicate detection - check both text and URL
            const newTasks = response.tasks.filter(newTask => 
              !existingTasks.some(existing => 
                existing.text === newTask.text && existing.url === newTask.url
              )
            );
            
            console.log("[ActionLayer3] New tasks after filtering:", newTasks);
            console.log("[ActionLayer3] Existing tasks count:", existingTasks.length);
            
            if (newTasks.length > 0) {
              const allTasks = [...existingTasks, ...newTasks];
              chrome.storage.local.set({ tasks: allTasks }, () => {
                console.log("[ActionLayer3] Added", newTasks.length, "new tasks");
                this.renderTasks(allTasks);
              });
            } else {
              console.log("[ActionLayer3] No new tasks found (all were duplicates or none detected)");
              // Still render existing tasks to show current state
              this.renderTasks(existingTasks);
            }
          });
        } else {
          console.log("[ActionLayer3] No response from content script or error:", chrome.runtime.lastError);
          // Load existing tasks from storage as fallback
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            console.log("[ActionLayer3] Loaded tasks from storage (fallback):", tasks);
            this.renderTasks(tasks);
          });
        }
      });
    }, 500);
      } catch (injectionError) {
        console.error("[ActionLayer3] Failed to inject content script:", injectionError);
        // Fallback to loading existing tasks
        chrome.storage.local.get(['tasks'], (result) => {
          const tasks = result.tasks || [];
          console.log("[ActionLayer3] Loaded tasks from storage (injection failed):", tasks);
          this.renderTasks(tasks);
        });
      }
    });
  }

  // Function to extract tasks from the current page
  extractTasksFromPage() {
    const tasks = [];
    
    // Get all text from the page
    const pageText = document.body.innerText;
    
    // More flexible task patterns
    const taskPatterns = [
      /TODO:\s*(.+?)(?:\n|$)/gi,
      /todo:\s*(.+?)(?:\n|$)/gi,
      /\[ \]\s*(.+?)(?:\n|$)/gi,
      /- \[ \]\s*(.+?)(?:\n|$)/gi,
      /•\s*(.+?)(?:\n|$)/gi
    ];
    
    // Also search line by line for better matching
    const lines = pageText.split('\n');
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check each pattern
      taskPatterns.forEach(pattern => {
        const match = pattern.exec(trimmedLine);
        if (match && match[1] && match[1].trim().length > 0) {
          const taskText = match[1].trim();
          // Avoid duplicates
          if (!tasks.some(task => task.text === taskText)) {
            tasks.push({
              id: 'task_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 5),
              text: taskText,
              completed: false,
              source: 'page_extraction',
              url: window.location.href,
              extractedAt: new Date().toISOString()
            });
          }
        }
        pattern.lastIndex = 0; // Reset regex
      });
      
      // Simple TODO detection without regex for testing
      if (trimmedLine.toLowerCase().includes('todo:')) {
        const todoIndex = trimmedLine.toLowerCase().indexOf('todo:');
        const taskText = trimmedLine.substring(todoIndex + 5).trim();
        if (taskText && !tasks.some(task => task.text === taskText)) {
          tasks.push({
            id: 'task_simple_' + Date.now() + '_' + index,
            text: taskText,
            completed: false,
            source: 'simple_extraction',
            url: window.location.href,
            extractedAt: new Date().toISOString()
          });
        }
      }
    });
    
    // Return both tasks and page text for debugging
    return {
      tasks: tasks,
      pageText: pageText,
      totalLines: lines.length
    };
  }

  renderTasks(tasks) {
    this.taskList.innerHTML = "";
    if (!tasks || tasks.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-state";
      li.textContent = "No tasks found.";
      this.taskList.appendChild(li);
      return;
    }
    tasks.forEach((task) => {
      const li = document.createElement("li");
      li.textContent = task.text;
      li.addEventListener("click", () => chrome.tabs.create({ url: task.pageUrl }));
      this.taskList.appendChild(li);
    });
  }

  async onSaveMemory() {
    const text = this.memoryInput.value.trim();
    if (!text) {
      console.log("[ActionLayer3] No memory text to save.");
      return;
    }
    console.log("[ActionLayer3] Save memory clicked:", text);

    const activeTab = await new Promise((resolve) =>
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]))
    );
    const newMem = { text, timestamp: Date.now(), pageUrl: activeTab.url };

    chrome.storage.local.get(["memories"], (result) => {
      const current = result.memories || [];
      current.push(newMem);
      chrome.storage.local.set({ memories: current }, () => {
        console.log("[ActionLayer3] Memory saved:", newMem);
        this.memoryInput.value = "";
        this.renderMemories(current);
      });
    });
  }

  onTestExtract() {
    console.log("[ActionLayer3] Test extract clicked");
    
    // Add some test tasks to verify the system works
    const testTasks = [
      {
        id: 'test_' + Date.now() + '_1',
        text: 'Buy groceries',
        completed: false,
        source: 'test_extraction',
        url: 'test://page',
        extractedAt: new Date().toISOString()
      },
      {
        id: 'test_' + Date.now() + '_2',
        text: 'Write report',
        completed: false,
        source: 'test_extraction',
        url: 'test://page',
        extractedAt: new Date().toISOString()
      }
    ];
    
    chrome.storage.local.get(['tasks'], (result) => {
      const currentTasks = result.tasks || [];
      const allTasks = [...currentTasks, ...testTasks];
      chrome.storage.local.set({ tasks: allTasks }, () => {
        this.renderTasks(allTasks);
        console.log("[ActionLayer3] Test tasks added:", testTasks);
      });
    });
  }

  onClearTasks() {
    console.log("[ActionLayer3] Cleared all tasks");
    
    // Clear all tasks from storage
    chrome.storage.local.set({ tasks: [] }, () => {
      // Immediately re-render the empty task list
      this.renderTasks([]);
    });
  }

  onAddTask() {
    const text = this.taskInput.value.trim();
    if (!text) {
      console.log("[ActionLayer3] No task text to add.");
      return;
    }
    
    const newTask = {
      id: 'manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      text: text,
      completed: false,
      source: 'manual_entry',
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
    
    chrome.storage.local.get(['tasks'], (result) => {
      const currentTasks = result.tasks || [];
      currentTasks.push(newTask);
      chrome.storage.local.set({ tasks: currentTasks }, () => {
        this.taskInput.value = "";
        this.renderTasks(currentTasks);
        console.log("[ActionLayer3] Task added:", newTask);
      });
    });
  }

  renderMemories(memories) {
    this.memoryList.innerHTML = "";
    if (!memories || memories.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-state";
      li.textContent = "No memories saved.";
      this.memoryList.appendChild(li);
      return;
    }
    memories.forEach((mem) => {
      const li = document.createElement("li");
      li.textContent = `[${new Date(mem.timestamp).toLocaleString()}] ${mem.text}`;
      li.addEventListener("click", () => chrome.tabs.create({ url: mem.pageUrl }));
      this.memoryList.appendChild(li);
    });
  }

  onCloseSidebar() {
    console.log("[ActionLayer3] Close sidebar clicked");
    
    // Send message to parent window (content script) to close sidebar
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'closeSidebar' }, '*');
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ActionLayer3Popup();
});