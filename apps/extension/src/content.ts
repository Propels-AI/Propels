(function () {
  "use strict";

  if ((window as any).demoCaptureContentLoaded) {
    return;
  }
  (window as any).demoCaptureContentLoaded = true;

  const generateId = (): string => {
    return crypto.randomUUID();
  };

  interface DemoCapture {
    id: string;
    screenshotBlob: Blob;
    pageUrl: string;
    timestamp: number;
    stepOrder: number;
    clickX: number;
    clickY: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    xNorm: number;
    yNorm: number;
    clickXCss?: number;
    clickYCss?: number;
    clickXDpr?: number;
    clickYDpr?: number;
    screenshotCssWidth?: number;
    screenshotCssHeight?: number;
  }

  let isCapturing = false;
  let captureData: DemoCapture[] = [];
  let stepCount = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      checkRecordingState();
    });
  } else {
    checkRecordingState();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        console.warn("Unknown message type:", message.type);
        sendResponse({ success: false });
    }

    return true;
  });

  function startCapture() {
    if (!isCapturing) {
      isCapturing = true;
      captureData = [];
      stepCount = 0;
      document.addEventListener("click", handleClick, true);
    } else {
      isCapturing = true;
    }
  }

  function stopCapture() {
    isCapturing = false;

    document.removeEventListener("click", handleClick, true);
  }

  async function handleClick(event: MouseEvent) {
    if (!isCapturing) return;

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

      const capture: DemoCapture = {
        id: generateId(),
        screenshotBlob: new Blob(),
        pageUrl: window.location.href,
        timestamp: Date.now(),
        stepOrder: stepCount,
        clickX,
        clickY,
        scrollX,
        scrollY,
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        xNorm,
        yNorm,
        clickXCss: clickX,
        clickYCss: clickY,
        clickXDpr: Math.round(clickX * devicePixelRatio),
        clickYDpr: Math.round(clickY * devicePixelRatio),
        screenshotCssWidth: viewportWidth,
        screenshotCssHeight: viewportHeight,
      };

      try {
        await chrome.runtime.sendMessage({ type: "PING" });
      } catch (pingError) {
        console.warn("Service worker ping failed (may be inactive).", pingError);
      }

      const response = await chrome.runtime.sendMessage({
        type: "CAPTURE_SCREENSHOT",
        data: capture,
      });

      if (response && response.success) {
        captureData.push(response.data);
        stepCount++;
      } else {
        console.error("Failed to capture screenshot:", response);
        stepCount++;
        console.warn("Incrementing step count despite background failure:", stepCount);
      }
    } catch (error) {
      console.error("Error sending capture message:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);

        if (error.message.includes("Extension context invalidated") || error.message.includes("message port closed")) {
          console.warn("Service worker appears to be inactive. Extension may need reload.");
        }
      }

      stepCount++;
      console.warn("Incrementing step count despite error:", stepCount);
    }
  }

  async function checkRecordingState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_RECORDING_STATE",
      });

      if (response && response.success && response.isRecording) {
        isCapturing = true;
        stepCount = response.stepCount || 0;
        captureData = []; // Reset local data for new page

        document.addEventListener("click", handleClick, true);
      } else {
        console.warn("No active recording session found or response invalid:", response);
      }
    } catch (error) {
      console.error("Error checking recording state:", error);
    }
  }
})();
