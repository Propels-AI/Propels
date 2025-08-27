// Prevent multiple injections by wrapping in IIFE
(function () {
  "use strict";

  // Check if already loaded
  if ((window as any).demoCaptureContentLoaded) {
    console.log("Demo Builder Extension: Content script already loaded, skipping");
    return;
  }
  (window as any).demoCaptureContentLoaded = true;

  console.log("Demo Builder Extension: Content script loaded on:", window.location.href);
  console.log("Document ready state:", document.readyState);

  // Import shared utilities inline to avoid module conflicts
  const generateId = (): string => {
    return crypto.randomUUID();
  };

  interface DemoCapture {
    id: string;
    screenshotBlob: Blob;
    pageUrl: string;
    timestamp: number;
    stepOrder: number;
    // Click and viewport metadata captured at the moment of interaction
    clickX: number;
    clickY: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    xNorm: number;
    yNorm: number;
    // Additional fields for robustness with editor sizing
    // CSS pixel coordinates (same as clickX/clickY, duplicated for clarity)
    clickXCss?: number;
    clickYCss?: number;
    // DPR-scaled pixel coordinates relative to the captured bitmap
    clickXDpr?: number;
    clickYDpr?: number;
    // Explicitly carry the CSS-sized screenshot dimensions
    screenshotCssWidth?: number;
    screenshotCssHeight?: number;
  }

  let isCapturing = false;
  let captureData: DemoCapture[] = []; // Local tracking for UI updates
  let stepCount = 0;

  // Check if we should resume recording after page navigation
  // Wait for page to be fully loaded before checking recording state
  console.log("Setting up recording state check...");
  if (document.readyState === "loading") {
    console.log("Document still loading, waiting for DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", () => {
      console.log("DOMContentLoaded fired, checking recording state");
      checkRecordingState();
    });
  } else {
    console.log("Document already loaded, checking recording state immediately");
    checkRecordingState();
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("Content script received message:", message);

    switch (message.type) {
      case "PING":
        sendResponse({ success: true, ready: true });
        break;
      case "START_CAPTURE":
        startCapture();
        sendResponse({ success: true });
        break;
      case "STOP_CAPTURE":
        stopCapture();
        sendResponse({ success: true });
        break;
      default:
        console.log("Unknown message type:", message.type);
        sendResponse({ success: false });
    }

    return true;
  });

  function startCapture() {
    console.log("🎬 Starting capture in content script...");

    // Only reset if not already capturing to preserve step count
    if (!isCapturing) {
      console.log("🔄 First time starting capture, resetting counters");
      isCapturing = true;
      captureData = [];
      stepCount = 0;
      // Add click listener to capture screenshots on user interactions
      // Use capture phase to prevent duplicate events
      document.addEventListener("click", handleClick, true);
    } else {
      console.log("📊 Already capturing, preserving step count:", stepCount);
      isCapturing = true;
    }

    // Visual indicator that capture is active
    showCaptureIndicator();
    updateCaptureIndicator(stepCount);
  }

  function stopCapture() {
    console.log("🛑 Stopping capture in content script...");
    console.log("📊 Final step count before stopping:", stepCount);
    console.log("💾 Local capture data length:", captureData.length);

    isCapturing = false;

    // Remove click listener (with same options as addEventListener)
    document.removeEventListener("click", handleClick, true);

    // Hide capture indicator
    hideCaptureIndicator();

    // The captured data is already saved in IndexedDB by the background script
    // No need to send it again
    console.log(`✅ Capture session stopped with ${stepCount} steps`);
  }

  async function handleClick(event: MouseEvent) {
    if (!isCapturing) return;
    console.log("Capturing screenshot at click:", event.target);

    try {
      const clickX = event.clientX;
      const clickY = event.clientY;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const xNorm = viewportWidth ? clickX / viewportWidth : 0;
      const yNorm = viewportHeight ? clickY / viewportHeight : 0;

      // Create a new capture entry
      const capture: DemoCapture = {
        id: generateId(),
        screenshotBlob: new Blob(), // This will be replaced by the background script
        pageUrl: window.location.href,
        timestamp: Date.now(),
        stepOrder: stepCount,
        // click metadata
        clickX,
        clickY,
        scrollX,
        scrollY,
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        xNorm,
        yNorm,
        // Additional DPR-aware and explicit CSS-dimension data
        clickXCss: clickX,
        clickYCss: clickY,
        clickXDpr: Math.round(clickX * devicePixelRatio),
        clickYDpr: Math.round(clickY * devicePixelRatio),
        screenshotCssWidth: viewportWidth,
        screenshotCssHeight: viewportHeight,
      };

      // Send message to background script to capture screenshot
      console.log("📤 Sending CAPTURE_SCREENSHOT message to background...");

      // Try to wake up service worker first
      try {
        await chrome.runtime.sendMessage({ type: "PING" });
      } catch (pingError) {
        console.log("📞 Ping failed, service worker may be inactive:", pingError);
      }

      const response = await chrome.runtime.sendMessage({
        type: "CAPTURE_SCREENSHOT",
        data: capture,
      });

      console.log("📸 Screenshot response received:", response);

      if (response && response.success) {
        captureData.push(response.data);
        stepCount++; // Increment after successful capture
        console.log("✅ Screenshot captured successfully, new step count:", stepCount);

        // Update capture indicator with step count
        updateCaptureIndicator(stepCount);
      } else {
        console.error("❌ Failed to capture screenshot:", response);
        // Still increment for UI feedback but log the issue
        stepCount++;
        console.log("⚠️ Incrementing step count despite background failure:", stepCount);
        updateCaptureIndicator(stepCount);
      }
    } catch (error) {
      console.error("💥 Error sending capture message:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);

        // Check if it's a service worker context invalidated error
        if (error.message.includes("Extension context invalidated") || error.message.includes("message port closed")) {
          console.error("🔄 Service worker appears to be inactive. Extension may need reload.");
        }
      }

      // Still increment for UI feedback
      stepCount++;
      console.log("⚠️ Incrementing step count despite error:", stepCount);
      updateCaptureIndicator(stepCount);
    }
  }

  function showCaptureIndicator() {
    // Remove existing indicator if present
    hideCaptureIndicator();

    const indicator = document.createElement("div");
    indicator.id = "demo-capture-indicator";
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
      pointer-events: none;
    `;
    indicator.textContent = "🔴 Recording Demo - 0 steps";
    document.body.appendChild(indicator);
  }

  function updateCaptureIndicator(stepCount: number) {
    const indicator = document.getElementById("demo-capture-indicator");
    if (indicator) {
      indicator.textContent = `🔴 Recording Demo - ${stepCount} steps`;
    }
  }

  function hideCaptureIndicator() {
    const indicator = document.getElementById("demo-capture-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  // Check with background script if recording is active
  async function checkRecordingState() {
    console.log("🔍 Checking recording state with background script...");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_RECORDING_STATE",
      });
      console.log("📨 Background response:", response);

      if (response && response.success && response.isRecording) {
        console.log("✅ Resuming recording on new page, step count:", response.stepCount);
        console.log("📍 Current URL:", window.location.href);

        isCapturing = true;
        stepCount = response.stepCount || 0;
        captureData = []; // Reset local data for new page

        // Add click listener and show indicator
        document.addEventListener("click", handleClick, true);
        console.log("👂 Click listener added to document");

        showCaptureIndicator();
        updateCaptureIndicator(stepCount);
        console.log("🔴 Recording indicator shown with step count:", stepCount);
      } else {
        console.log("❌ No active recording session found or response invalid:", response);
      }
    } catch (error) {
      console.log("💥 Error checking recording state:", error);
      console.log("This could indicate background script communication issues");
    }
  }
})(); // Close IIFE
