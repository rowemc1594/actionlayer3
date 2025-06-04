// ActionLayer3 Sidebar Content Script
console.log('[ActionLayer3] Sidebar content script loaded');

// Create and inject sidebar immediately
function injectSidebar() {
  // Check if sidebar already exists
  if (document.getElementById('actionlayer3-sidebar')) {
    console.log('[ActionLayer3] Sidebar already exists');
    return;
  }

  console.log('[ActionLayer3] Injecting sidebar...');
  
  // Create iframe
  const sidebar = document.createElement('iframe');
  sidebar.id = 'actionlayer3-sidebar';
  sidebar.src = chrome.runtime.getURL('src/ui/panel.html');
  
  // Style the sidebar
  sidebar.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 300px !important;
    height: 100vh !important;
    border: none !important;
    z-index: 10000 !important;
    background: white !important;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1) !important;
  `;
  
  // Add to page
  document.body.appendChild(sidebar);
  console.log('[ActionLayer3] Sidebar injected successfully');
  
  // Handle close messages
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'closeSidebar') {
      console.log('[ActionLayer3] Closing sidebar');
      sidebar.remove();
    }
  });
}

// Inject when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}