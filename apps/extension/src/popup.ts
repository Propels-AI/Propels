// Popup script for extension UI interactions
console.log('Demo Builder Extension: Popup script loaded');

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startCapture') as HTMLButtonElement;
  const stopButton = document.getElementById('stopCapture') as HTMLButtonElement;
  const viewButton = document.getElementById('viewDemos') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLDivElement;

  // Initial state
  updateUI(false);

  // Event listeners
  startButton.addEventListener('click', handleStartCapture);
  stopButton.addEventListener('click', handleStopCapture);
  viewButton.addEventListener('click', handleViewDemos);

  async function handleStartCapture() {
    console.log('Start capture clicked');
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        // Send message to content script
        await chrome.tabs.sendMessage(tab.id, { type: 'START_CAPTURE' });
        
        // Send message to background script
        await chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
        
        updateUI(true);
        updateStatus('🔴 Capturing... Click on elements to record');
      }
    } catch (error) {
      console.error('Error starting capture:', error);
      updateStatus('❌ Error starting capture');
    }
  }

  async function handleStopCapture() {
    console.log('Stop capture clicked');
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        // Send message to content script
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_CAPTURE' });
        
        // Send message to background script
        await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
        
        updateUI(false);
        updateStatus('✅ Capture completed');
      }
    } catch (error) {
      console.error('Error stopping capture:', error);
      updateStatus('❌ Error stopping capture');
    }
  }

  function handleViewDemos() {
    console.log('View demos clicked');
    
    // TODO: Open webapp to view demos
    // For now, just open the webapp URL
    const webappUrl = 'http://localhost:5173'; // Development URL
    chrome.tabs.create({ url: webappUrl });
  }

  function updateUI(isCapturing: boolean) {
    startButton.disabled = isCapturing;
    stopButton.disabled = !isCapturing;
    
    if (isCapturing) {
      startButton.style.opacity = '0.5';
      stopButton.style.opacity = '1';
    } else {
      startButton.style.opacity = '1';
      stopButton.style.opacity = '0.5';
    }
  }

  function updateStatus(message: string) {
    status.textContent = message;
  }
});
