const APP_BASE_URL = "https://app.propels.ai";

document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startCapture") as HTMLButtonElement;
  const stopButton = document.getElementById("stopCapture") as HTMLButtonElement;
  const viewButton = document.getElementById("viewDemos") as HTMLButtonElement;
  const status = document.getElementById("status") as HTMLDivElement;

  // Check initial recording state
  checkRecordingState();

  // Event listeners
  startButton.addEventListener("click", handleStartCapture);
  stopButton.addEventListener("click", handleStopCapture);
  viewButton.addEventListener("click", handleViewDemos);

  async function handleStartCapture() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        updateStatus("❌ No active tab found");
        return;
      }

      // Check if we can inject scripts into this tab
      if (
        tab.url?.startsWith("chrome://") ||
        tab.url?.startsWith("chrome-extension://") ||
        tab.url?.startsWith("edge://") ||
        tab.url?.startsWith("about:")
      ) {
        updateStatus("❌ Cannot capture on this type of page. Please navigate to a regular website.");
        return;
      }

      // Always inject content script to ensure it's fresh and properly connected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (injectionError) {
        console.error("Failed to inject content script:", injectionError);
        updateStatus("❌ Cannot inject content script. Try refreshing the page.");
        return;
      }

      try {
        // Send message to content script
        await chrome.tabs.sendMessage(tab.id, { type: "START_CAPTURE" });

        // Send message to background script
        await chrome.runtime.sendMessage({ type: "START_CAPTURE" });

        updateUI(true);
        updateStatus("🔴 Capturing... Click on elements to record");
      } catch (messageError) {
        console.error("Error sending message to content script:", messageError);
        updateStatus("❌ Cannot start capture on this page. Try refreshing and try again.");
      }
    } catch (error) {
      console.error("Error starting capture:", error);
      updateStatus("❌ Error starting capture");
    }
  }

  async function handleStopCapture() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        updateStatus("❌ No active tab found");
        return;
      }

      try {
        // Send message to content script
        await chrome.tabs.sendMessage(tab.id, { type: "STOP_CAPTURE" });
      } catch (messageError) {
        console.error("Content script may not be available:", messageError);
      }

      // Send message to background script
      await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });

      updateUI(false);
      updateStatus("✅ Capture completed. Checking authentication status...");

      // Check authentication status
      chrome.storage.local.get(["isAuthenticated"], (result) => {
        if (result.isAuthenticated) {
          updateStatus("✅ Capture completed. Uploading to your account...");
          // TODO: Trigger authenticated upload flow
        } else {
          // Background script will open the editor tab for anonymous users
          updateStatus("✅ Capture completed. Opening editor to review...");
        }
      });
    } catch (error) {
      console.error("Error stopping capture:", error);
      updateStatus("❌ Error stopping capture");
    }
  }

  function handleViewDemos() {
    // Open webapp to view demos
    const webappUrl = `${APP_BASE_URL}/dashboard`; // Dashboard URL
    chrome.tabs.create({ url: webappUrl });
  }

  function updateUI(isCapturing: boolean) {
    startButton.disabled = isCapturing;
    stopButton.disabled = !isCapturing;

    if (isCapturing) {
      startButton.style.opacity = "0.5";
      stopButton.style.opacity = "1";
    } else {
      startButton.style.opacity = "1";
      stopButton.style.opacity = "0.5";
    }
  }

  function updateStatus(message: string) {
    if (status) {
      status.textContent = message;
    }
  }

  // Check current recording state and update UI accordingly
  async function checkRecordingState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_RECORDING_STATE",
      });
      if (response && response.success) {
        const isRecording = response.isRecording;
        const stepCount = response.stepCount || 0;

        updateUI(isRecording);

        if (isRecording) {
          updateStatus(`🔴 Recording active - ${stepCount} steps captured`);
        } else {
          updateStatus("Ready to start recording");
        }
      }
    } catch (error) {
      updateUI(false);
      updateStatus("Ready to start recording");
    }
  }
});
