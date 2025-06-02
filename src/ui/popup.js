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
      
      // Try to get tasks from background script instead of content script
      chrome.runtime.sendMessage({ type: "getTasks" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("[ActionLayer3] No content script available, loading from storage");
          // Fallback to getting tasks directly from storage
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            this.renderTasks(tasks);
          });
          return;
        }
        
        if (response && response.tasks) {
          console.log("[ActionLayer3] Tasks received:", response.tasks);
          this.renderTasks(response.tasks);
        } else {
          // Fallback to storage if no response
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            this.renderTasks(tasks);
          });
        }
      });
    });
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
      console.warn("[ActionLayer3] No memory text entered.");
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