// Minimal debug content script to test injection
console.log('DEBUG: Content script loaded successfully');
console.log('DEBUG: Current URL:', window.location.href);
console.log('DEBUG: Document ready state:', document.readyState);

// Force inject a visible test element
function injectTestElement() {
  console.log('DEBUG: Injecting test element...');
  
  const testDiv = document.createElement('div');
  testDiv.id = 'actionlayer3-test';
  testDiv.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    width: 200px !important;
    height: 100px !important;
    background: red !important;
    color: white !important;
    z-index: 99999 !important;
    padding: 10px !important;
    border: 2px solid black !important;
  `;
  testDiv.innerHTML = 'TEST: Content script working!';
  
  if (document.body) {
    document.body.appendChild(testDiv);
    console.log('DEBUG: Test element injected');
  } else {
    console.log('DEBUG: No document body found');
  }
}

// Try to inject immediately and on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectTestElement);
} else {
  injectTestElement();
}

// Also try after a short delay
setTimeout(injectTestElement, 1000);