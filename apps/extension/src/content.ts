import { DemoCapture, generateId } from '@demo/shared';

// Content script for capturing screenshots and user interactions
console.log('Demo Builder Extension: Content script loaded');

let isCapturing = false;
let captureData: DemoCapture[] = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'START_CAPTURE':
      startCapture();
      break;
    case 'STOP_CAPTURE':
      stopCapture();
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
  
  sendResponse({ success: true });
});

function startCapture() {
  console.log('Starting capture in content script...');
  isCapturing = true;
  
  // Add click listener to capture screenshots on user interactions
  document.addEventListener('click', handleClick);
  
  // Visual indicator that capture is active
  showCaptureIndicator();
}

function stopCapture() {
  console.log('Stopping capture in content script...');
  isCapturing = false;
  
  // Remove click listener
  document.removeEventListener('click', handleClick);
  
  // Hide capture indicator
  hideCaptureIndicator();
  
  // Send captured data to background script
  if (captureData.length > 0) {
    chrome.runtime.sendMessage({
      type: 'SAVE_CAPTURE_SESSION',
      data: captureData
    });
  }
}

function handleClick(event: MouseEvent) {
  if (!isCapturing) return;
  
  console.log('Capturing screenshot at click:', event.target);
  
  // TODO: Implement screenshot capture logic
  // For now, just store the interaction data
  const capture: DemoCapture = {
    id: generateId(),
    screenshotBlob: new Blob(), // Placeholder
    pageUrl: window.location.href,
    timestamp: Date.now()
  };
  
  captureData.push(capture);
}

function showCaptureIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'demo-capture-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  indicator.textContent = '🔴 Recording Demo';
  document.body.appendChild(indicator);
}

function hideCaptureIndicator() {
  const indicator = document.getElementById('demo-capture-indicator');
  if (indicator) {
    indicator.remove();
  }
}
