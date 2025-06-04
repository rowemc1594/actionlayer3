// Direct sidebar injection without iframe
console.log('[ActionLayer3] Direct sidebar script loaded');

function createDirectSidebar() {
  // Check if sidebar already exists
  const existingSidebar = document.getElementById('actionlayer3-direct-sidebar');
  if (existingSidebar) {
    console.log('[ActionLayer3] Direct sidebar already exists, toggling visibility');
    existingSidebar.style.display = existingSidebar.style.display === 'none' ? 'block' : 'none';
    return;
  }

  console.log('[ActionLayer3] Creating direct sidebar...');

  // Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.id = 'actionlayer3-direct-sidebar';
  
  // Style the sidebar
  sidebar.style.cssText = `
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
  `;
  
  // Add content directly
  sidebar.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      <h2 style="margin: 0; font-size: 18px; color: #333;">ActionLayer3</h2>
      <button id="actionlayer3-close" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>
    </div>
    
    <div style="margin-bottom: 15px;">
      <button id="actionlayer3-refresh" style="background: #007acc; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Refresh Tasks</button>
      <button id="actionlayer3-save" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer;">Save Memory</button>
    </div>
    
    <div style="margin-bottom: 15px;">
      <input type="text" id="actionlayer3-task-input" placeholder="Add a task..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box; margin-bottom: 5px;">
      <button id="actionlayer3-add-task" style="width: 100%; background: #17a2b8; color: white; border: none; padding: 8px; border-radius: 3px; cursor: pointer;">Add Task</button>
    </div>
    
    <div id="actionlayer3-task-list" style="border: 1px solid #ddd; border-radius: 3px; max-height: 200px; overflow-y: auto;">
      <div style="padding: 10px; color: #666; text-align: center;">Loading tasks...</div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(sidebar);
  console.log('[ActionLayer3] Direct sidebar added to page');
  
  // Add event listeners
  setupSidebarEvents(sidebar);
  
  // Load existing tasks
  loadTasks();
}

function setupSidebarEvents(sidebar) {
  // Close button
  const closeBtn = sidebar.querySelector('#actionlayer3-close');
  closeBtn.addEventListener('click', () => {
    console.log('[ActionLayer3] Closing direct sidebar');
    sidebar.remove();
  });
  
  // Add task button
  const addBtn = sidebar.querySelector('#actionlayer3-add-task');
  const taskInput = sidebar.querySelector('#actionlayer3-task-input');
  
  addBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (text) {
      addTask(text);
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
    refreshTasks();
  });
}

function addTask(text) {
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
      loadTasks();
      console.log('[ActionLayer3] Task added:', task.text);
    });
  });
}

function loadTasks() {
  chrome.storage.local.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    const taskList = document.querySelector('#actionlayer3-task-list');
    
    if (tasks.length === 0) {
      taskList.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No tasks found</div>';
      return;
    }
    
    const taskHTML = tasks.map(task => `
      <div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <span style="flex: 1; ${task.completed ? 'text-decoration: line-through; color: #666;' : ''}">${task.text}</span>
        <button onclick="toggleTask('${task.id}')" style="background: ${task.completed ? '#28a745' : '#6c757d'}; color: white; border: none; padding: 2px 6px; border-radius: 2px; cursor: pointer; font-size: 12px;">
          ${task.completed ? '✓' : '○'}
        </button>
      </div>
    `).join('');
    
    taskList.innerHTML = taskHTML;
  });
}

function refreshTasks() {
  console.log('[ActionLayer3] Refreshing tasks...');
  loadTasks();
}

// Global function for toggle button
window.toggleTask = function(taskId) {
  chrome.storage.local.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      chrome.storage.local.set({ tasks: tasks }, () => {
        loadTasks();
        console.log('[ActionLayer3] Task toggled:', task.text);
      });
    }
  });
};

// Inject when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createDirectSidebar);
} else {
  createDirectSidebar();
}