// Direct sidebar injection without iframe
console.log('[ActionLayer3] Direct sidebar script loaded');

function createDirectSidebar() {
  // Check if sidebar already exists
  const existingSidebar = document.getElementById('actionlayer3-direct-sidebar');
  if (existingSidebar) {
    console.log('[ActionLayer3] Direct sidebar already exists, toggling visibility');
    const isVisible = existingSidebar.style.display !== 'none';
    existingSidebar.style.display = isVisible ? 'none' : 'block';
    
    // Save state to localStorage
    localStorage.setItem('actionlayer3-sidebar-visible', !isVisible);
    return;
  }

  console.log('[ActionLayer3] Creating direct sidebar...');

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
      <h2 class="actionlayer3-title">ActionLayer3</h2>
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
    sidebar.style.display = 'none';
    localStorage.setItem('actionlayer3-sidebar-visible', 'false');
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
  
  // Clear button
  const clearBtn = sidebar.querySelector('#actionlayer3-clear');
  clearBtn.addEventListener('click', () => {
    clearAllTasks();
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
        toggleTask(taskId);
      });
    });
  });
}

function refreshTasks() {
  console.log('[ActionLayer3] Refreshing tasks...');
  extractAndDisplayTasks();
}

function extractAndDisplayTasks() {
  // Extract tasks from current page
  const extractedTasks = extractTasksFromPage();
  
  // Load existing tasks and merge with extracted ones
  chrome.storage.local.get(['tasks'], (result) => {
    const existingTasks = result.tasks || [];
    const currentUrl = window.location.href;
    
    // Remove old extracted tasks from this URL
    const filteredTasks = existingTasks.filter(task => 
      task.source === 'manual' || task.url !== currentUrl
    );
    
    // Add new extracted tasks
    const allTasks = [...filteredTasks, ...extractedTasks];
    
    chrome.storage.local.set({ tasks: allTasks }, () => {
      loadTasks();
      console.log(`[ActionLayer3] Extracted ${extractedTasks.length} tasks from page`);
    });
  });
}

function extractTasksFromPage() {
  const tasks = [];
  const currentUrl = window.location.href;
  
  // Task extraction patterns
  const taskPatterns = [
    // Action verbs at start of sentences
    /^(Create|Build|Make|Develop|Design|Write|Configure|Setup|Install|Deploy|Test|Fix|Update|Add|Remove|Delete|Modify|Implement|Optimize|Review|Plan|Research|Analyze|Document|Learn|Practice|Study|Complete|Finish|Start|Begin|Initialize|Launch|Execute|Run|Debug|Troubleshoot|Validate|Verify|Check|Ensure|Confirm|Submit|Send|Upload|Download|Export|Import|Save|Load|Backup|Restore|Migrate|Upgrade|Patch|Maintain|Monitor|Track|Measure|Evaluate|Assess|Audit|Inspect|Investigate|Explore|Discover|Find|Search|Locate|Identify|Define|Specify|Determine|Decide|Choose|Select|Pick|Collect|Gather|Organize|Sort|Arrange|Structure|Format|Convert|Transform|Process|Generate|Produce|Craft|Prepare|Setup|Enable|Disable|Activate|Deactivate|Turn on|Turn off|Switch|Toggle|Adjust|Customize|Personalize|Tailor|Adapt|Modify|Change|Alter|Edit|Revise|Refactor|Rewrite|Restructure|Redesign|Rebuild|Recreate|Reproduce|Duplicate|Copy|Clone|Fork|Branch|Merge|Sync|Synchronize|Integrate|Connect|Link|Associate|Attach|Bind|Join|Combine|Unite|Unify|Consolidate|Centralize|Coordinate|Collaborate|Communicate|Discuss|Meet|Schedule|Arrange|Book|Reserve|Allocate|Assign|Delegate|Distribute|Share|Publish|Release|Announce|Notify|Alert|Remind|Follow up|Contact|Reach out|Call|Email|Message|Chat|Reply|Respond|Answer|Address|Handle|Manage|Oversee|Supervise|Lead|Guide|Direct|Instruct|Teach|Train|Educate|Inform|Explain|Clarify|Demonstrate|Show|Present|Display|Exhibit|Showcase|Highlight|Emphasize|Focus|Prioritize|Rank|Rate|Score|Grade|Evaluate|Judge|Approve|Reject|Accept|Decline|Confirm|Cancel|Postpone|Reschedule|Delay|Wait|Pause|Stop|Continue|Resume|Restart|Refresh|Reload|Reset|Clear|Clean|Purge|Delete|Remove|Eliminate|Exclude|Filter|Sort|Search|Find|Locate|Navigate|Browse|Explore|Visit|Go to|Access|Enter|Exit|Leave|Return|Come back|Stay|Remain|Keep|Maintain|Preserve|Protect|Secure|Lock|Unlock|Encrypt|Decrypt|Compress|Decompress|Zip|Unzip|Archive|Extract|Expand|Collapse|Minimize|Maximize|Resize|Scale|Zoom|Pan|Scroll|Slide|Drag|Drop|Click|Tap|Press|Push|Pull|Grab|Hold|Release|Let go)\\s+[^.!?]*[.!?]/gi,
    // Checkbox or list items
    /^\s*[-*•]\s+(.+)$/gm,
    // Numbered lists
    /^\s*\d+\.\s+(.+)$/gm,
    // Todo patterns
    /(?:TODO|To do|ToDo|TASK|Task|ACTION|Action):\s*(.+)/gi
  ];
  
  // Extract text content
  const textContent = document.body.innerText;
  
  // Find tasks using patterns
  taskPatterns.forEach((pattern, patternIndex) => {
    const matches = textContent.match(pattern);
    if (matches) {
      matches.forEach((match, matchIndex) => {
        let taskText = match.trim();
        
        // Clean up the task text
        taskText = taskText.replace(/^[-*•]\s*/, ''); // Remove list markers
        taskText = taskText.replace(/^\d+\.\s*/, ''); // Remove numbers
        taskText = taskText.replace(/^(TODO|To do|ToDo|TASK|Task|ACTION|Action):\s*/i, ''); // Remove labels
        taskText = taskText.replace(/[.!?]+$/, ''); // Remove trailing punctuation
        
        // Filter out very short or very long tasks
        if (taskText.length > 10 && taskText.length < 200) {
          tasks.push({
            id: `extracted_${patternIndex}_${matchIndex}_${Date.now()}`,
            text: taskText,
            completed: false,
            source: 'extracted',
            url: currentUrl,
            extractedAt: new Date().toISOString(),
            confidence: calculateConfidence(taskText)
          });
        }
      });
    }
  });
  
  // Look for structured task elements
  const taskElements = document.querySelectorAll('li, .task, .todo, [class*="task"], [class*="todo"], [class*="action"]');
  taskElements.forEach((element, index) => {
    const text = element.textContent.trim();
    if (text.length > 10 && text.length < 200 && isLikelyTask(text)) {
      tasks.push({
        id: `element_${index}_${Date.now()}`,
        text: text,
        completed: element.classList.contains('completed') || element.classList.contains('done'),
        source: 'extracted',
        url: currentUrl,
        extractedAt: new Date().toISOString(),
        confidence: calculateConfidence(text)
      });
    }
  });
  
  // Remove duplicates and sort by confidence
  const uniqueTasks = tasks.filter((task, index, self) => 
    index === self.findIndex(t => t.text.toLowerCase() === task.text.toLowerCase())
  );
  
  return uniqueTasks.sort((a, b) => b.confidence - a.confidence).slice(0, 20); // Limit to top 20 tasks
}

function calculateConfidence(text) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for action words
  const actionWords = /\b(create|build|make|develop|design|write|configure|setup|install|deploy|test|fix|update|add|remove|implement|complete|finish|start|begin|check|verify|ensure|review|analyze|optimize)\b/gi;
  if (actionWords.test(text)) confidence += 0.3;
  
  // Increase confidence for imperative mood
  if (/^[A-Z][a-z]+\s+/.test(text)) confidence += 0.2;
  
  // Decrease confidence for questions
  if (text.includes('?')) confidence -= 0.2;
  
  // Decrease confidence for very generic text
  if (/^(the|this|that|a|an)\s/i.test(text)) confidence -= 0.1;
  
  return Math.min(Math.max(confidence, 0), 1);
}

function isLikelyTask(text) {
  // Check if text looks like a task
  const actionPatterns = [
    /^(create|build|make|develop|design|write|configure|setup|install|deploy|test|fix|update|add|remove|implement|complete|finish|start|begin|check|verify|ensure|review|analyze|optimize)/i,
    /\b(need to|should|must|have to|required|necessary)\b/i,
    /\b(task|todo|action|step|instruction)\b/i
  ];
  
  return actionPatterns.some(pattern => pattern.test(text));
}

function toggleTask(taskId) {
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
}

function clearAllTasks() {
  if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
    chrome.storage.local.set({ tasks: [] }, () => {
      loadTasks();
      console.log('[ActionLayer3] All tasks cleared');
    });
  }
}

// Only create sidebar when explicitly called (via extension icon)
// The background script will inject this file and call createDirectSidebar() manually