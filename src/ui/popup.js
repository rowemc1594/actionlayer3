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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      // First try to extract tasks from the current page
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: this.extractTasksFromPage
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.log("[ActionLayer3] Could not extract from page, loading stored tasks");
          // Fallback to stored tasks
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            this.renderTasks(tasks);
          });
          return;
        }
        
        if (results && results[0] && results[0].result) {
          const extractionResult = results[0].result;
          console.log("[ActionLayer3] Page extraction result:", extractionResult);
          
          if (extractionResult.tasks && extractionResult.tasks.length > 0) {
            console.log("[ActionLayer3] Found tasks:", extractionResult.tasks);
            chrome.storage.local.get(['tasks'], (result) => {
              const existingTasks = result.tasks || [];
              const allTasks = [...existingTasks, ...extractionResult.tasks];
              chrome.storage.local.set({ tasks: allTasks }, () => {
                this.renderTasks(allTasks);
              });
            });
          } else {
            console.log("[ActionLayer3] No tasks found. Page text was:", extractionResult.pageText);
            // Show stored tasks
            chrome.storage.local.get(['tasks'], (result) => {
              const tasks = result.tasks || [];
              this.renderTasks(tasks);
            });
          }
        }
      });
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
}

document.addEventListener("DOMContentLoaded", () => {
  new ActionLayer3Popup();
});