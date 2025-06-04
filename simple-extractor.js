// Simplified task extractor that works reliably
console.log('[ActionLayer3] Simple extractor loaded');

// Set up message listener immediately
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ActionLayer3] Simple extractor received message:', request);
  
  if (request.action === 'extractTasks') {
    try {
      console.log('[ActionLayer3] Extracting tasks from page...');
      
      const tasks = [];
      const taskId = Date.now();
      
      // Find numbered list items and headings
      const headings = document.querySelectorAll('h1, h2, h3');
      const listItems = document.querySelectorAll('li');
      
      console.log('[ActionLayer3] Found', headings.length, 'headings and', listItems.length, 'list items');
      
      // Extract meaningful headings
      headings.forEach((heading, index) => {
        const text = heading.textContent.trim();
        if (text.length > 10 && !text.toLowerCase().includes('menu') && !text.toLowerCase().includes('search')) {
          tasks.push({
            id: `heading-${taskId}-${index}`,
            text: text,
            completed: false,
            url: window.location.href,
            source: 'heading',
            extractedAt: new Date().toISOString()
          });
        }
      });
      
      // Extract meaningful list items  
      listItems.forEach((item, index) => {
        const text = item.textContent.trim();
        if (text.length > 5 && !text.toLowerCase().includes('menu') && !text.toLowerCase().includes('open')) {
          tasks.push({
            id: `list-${taskId}-${index}`,
            text: text,
            completed: false,
            url: window.location.href,
            source: 'list',
            extractedAt: new Date().toISOString()
          });
        }
      });
      
      console.log('[ActionLayer3] Extracted', tasks.length, 'tasks:', tasks);
      sendResponse({ tasks: tasks });
      
    } catch (error) {
      console.error('[ActionLayer3] Extraction error:', error);
      sendResponse({ tasks: [], error: error.message });
    }
    
    return true;
  }
  
  return false;
});

console.log('[ActionLayer3] Simple extractor ready');