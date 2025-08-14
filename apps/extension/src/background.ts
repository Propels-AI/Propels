import { DemoCapture } from '@demo/shared';

// Background script for handling extension lifecycle and messaging
console.log('Demo Builder Extension: Background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Demo Builder Extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'START_CAPTURE':
      handleStartCapture();
      break;
    case 'STOP_CAPTURE':
      handleStopCapture();
      break;
    case 'SAVE_SCREENSHOT':
      handleSaveScreenshot(message.data);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
  
  sendResponse({ success: true });
});

function handleStartCapture() {
  console.log('Starting demo capture...');
  // TODO: Implement capture logic
}

function handleStopCapture() {
  console.log('Stopping demo capture...');
  // TODO: Implement stop logic
}

function handleSaveScreenshot(data: DemoCapture) {
  console.log('Saving screenshot:', data);
  // TODO: Implement IndexedDB storage logic
}
