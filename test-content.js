// Simple test content script
console.log('[TEST] Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[TEST] Message received:', request);
  if (request.action === 'test') {
    console.log('[TEST] Responding to test message');
    sendResponse({ status: 'success', message: 'Content script is working!' });
    return true;
  }
});

console.log('[TEST] Message listener set up');