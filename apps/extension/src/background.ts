// Import IndexedDB manager (include .js for ESM in MV3)
import { indexedDBManager } from "./lib/indexed-db.js";

// Define types inline to avoid module conflicts
interface DemoCapture {
  id: string;
  screenshotBlob: Blob;
  pageUrl: string;
  timestamp: number;
  stepOrder: number;
}

interface CaptureSessionResponse {
  success: boolean;
  data?: DemoCapture[];
  error?: string;
}

// Background script for handling extension lifecycle and messaging
console.log("🚀 Demo Builder Extension: Background script loaded at", new Date().toISOString());

// Immediate activation and aggressive keepalive
console.log("🚀 Background: Service worker initializing...");

// Force immediate activation
try {
  chrome.action.setBadgeText({ text: "" });
} catch (_err) {
  // Silently handle errors
}

// Aggressive keepalive mechanism for active recording sessions
const keepAlive = () => {
  console.log("🔄 Background: Service worker keepalive ping");
  try {
    chrome.action.setBadgeText({ text: "" });
  } catch (_err) {
    // Silently handle errors
  }
};

// More frequent keepalive during recording - every 10 seconds
let keepAliveInterval: number;

const startAggressiveKeepAlive = () => {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  keepAliveInterval = setInterval(keepAlive, 10000);
  console.log("🚀 Background: Started aggressive keepalive");
};

const stopAggressiveKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = 0;
    console.log("🛑 Background: Stopped aggressive keepalive");
  }
};

// Initial keepalive
keepAlive();

// Also on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Background: Service worker started via onStartup");
});

let currentCaptureSession: DemoCapture[] = [];
let stepCount = 0;
let isRecording = false;

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Demo Builder Extension installed");
  console.log("🚀 Background: Service worker started via onInstalled");
  keepAlive();
});

// Handle tab updates to inject content script when recording is active
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when page has completed loading
  if (changeInfo.status === "complete" && tab.url) {
    // Skip chrome:// and extension pages
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      return;
    }

    // Check if recording is active
    const result = await chrome.storage.local.get(["isRecording"]);
    if (result.isRecording) {
      console.log("🔄 Background: Page loaded during recording, injecting content script on:", tab.url);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });
        console.log("✅ Background: Content script injected successfully on new page");

        // Small delay then send START_CAPTURE message to resume recording
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { type: "START_CAPTURE" });
            console.log("📤 Background: Sent START_CAPTURE to content script on new page");
          } catch (error) {
            console.log("❌ Background: Failed to send START_CAPTURE to new page:", error);
          }
        }, 100);
      } catch (error) {
        console.log("❌ Background: Failed to inject content script on new page:", error);
      }
    }
  }
});

// Initialize recording state from storage on startup
initializeRecordingState();

async function initializeRecordingState() {
  try {
    const result = await chrome.storage.local.get(["isRecording", "stepCount"]);
    isRecording = result.isRecording || false;
    stepCount = result.stepCount || 0;

    if (isRecording) {
      console.log("Restored recording state:", { isRecording, stepCount });
      // Update badge to show current step count
      chrome.action.setBadgeText({ text: stepCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });
    } else {
      // Clear badge if not recording
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("Error initializing recording state:", error);
    // Fallback to safe defaults
    isRecording = false;
    stepCount = 0;
    chrome.action.setBadgeText({ text: "" });
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  console.log("🔔 Background received message:", message.type, "at", new Date().toISOString());
  console.log("📍 Message sender:", sender.tab?.url || "popup");
  console.log("📦 Full message data:", message);

  // Keep service worker alive during message processing
  keepAlive();

  switch (message.type) {
    case "PING":
      console.log("🏓 Background: Received ping, responding with pong");
      sendResponse({ success: true, message: "pong" });
      return false;
    case "START_CAPTURE":
      // Fire-and-forget clearing of previous session before starting
      handleStartCapture();
      sendResponse({ success: true });
      return false;
    case "STOP_CAPTURE":
      handleStopCapture();
      sendResponse({ success: true });
      return false;
    case "CAPTURE_SCREENSHOT":
      handleCaptureScreenshot(message.data, sendResponse);
      return true; // Keep message channel open for async response
    case "SAVE_CAPTURE_SESSION":
      handleSaveCaptureSession(message.data);
      sendResponse({ success: true });
      return false;
    case "GET_CAPTURE_SESSION":
      handleGetCaptureSession(sendResponse);
      return true; // Keep message channel open for async response
    case "CLEAR_CAPTURE_SESSION":
      handleClearCaptureSession();
      sendResponse({ success: true });
      return false;
    case "GET_RECORDING_STATE":
      // Get recording state from chrome.storage for persistence
      console.log("🔍 Background: GET_RECORDING_STATE request received");
      chrome.storage.local.get(["isRecording", "stepCount"], (result) => {
        console.log("📦 Background: Storage result:", result);
        console.log("🎯 Background: Local variables - isRecording:", isRecording, "stepCount:", stepCount);

        const response = {
          success: true,
          isRecording: result.isRecording || false,
          stepCount: result.stepCount || 0,
        };
        console.log("📤 Background: Sending response:", response);
        sendResponse(response);
      });
      return true; // Keep message channel open for async response
    default:
      console.log("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
      return false;
  }
});

async function handleStartCapture() {
  console.log("🎬 Background: Starting demo capture...");
  // Clear any previous captures to avoid mixing sessions
  try {
    await indexedDBManager.clearCaptures();
    console.log("🧹 Cleared previous captures from IndexedDB");
  } catch (e) {
    console.warn("Failed to clear previous captures:", e);
  }

  currentCaptureSession = [];
  stepCount = 0;
  isRecording = true;

  // Start aggressive keepalive during recording
  startAggressiveKeepAlive();

  // Persist recording state to chrome.storage
  const storageData = {
    isRecording: true,
    stepCount: 0,
    recordingStartTime: Date.now(),
    hasAnonymousDemo: false,
  };
  console.log("💾 Background: Saving to storage:", storageData);
  chrome.storage.local.set(storageData, () => {
    console.log("✅ Background: Recording state saved to storage");
  });
}

function handleStopCapture() {
  console.log("🛑 Background: Stopping demo capture...");
  isRecording = false;

  // Stop aggressive keepalive when recording ends
  stopAggressiveKeepAlive();

  // Clear recording state from chrome.storage
  const storageData = {
    isRecording: false,
    stepCount: 0,
  };
  console.log("💾 Background: Clearing storage:", storageData);
  chrome.storage.local.set(storageData, () => {
    console.log("✅ Background: Recording state cleared from storage");
  });

  // Check if user is authenticated
  chrome.storage.local.get(["isAuthenticated"], (result) => {
    if (!result.isAuthenticated) {
      // Mark there is an anonymous demo available for editing
      chrome.storage.local.set({ hasAnonymousDemo: true });
      // Redirect anonymous users to the editor page
      chrome.tabs.create({ url: "http://localhost:5173/editor" });
    } else {
      // For authenticated users, trigger upload flow
      triggerAuthenticatedUpload();
    }
  });
}

function handleSaveCaptureSession(data: DemoCapture[]) {
  console.log("Saving capture session:", data);
  currentCaptureSession = data;
  stepCount = data.length;

  // Update extension icon badge with step count
  chrome.action.setBadgeText({ text: stepCount.toString() });
  chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });
}

async function handleGetCaptureSession(sendResponse: (response: CaptureSessionResponse) => void) {
  console.log("Getting capture session...");
  try {
    const captures = await indexedDBManager.getAllCaptures();
    sendResponse({ success: true, data: captures });
  } catch (error) {
    console.error("Error getting capture session:", error);
    sendResponse({
      success: false,
      error: "Failed to retrieve capture session",
    });
  }
}

async function handleClearCaptureSession() {
  console.log("Clearing capture session...");
  try {
    await indexedDBManager.clearCaptures();
    currentCaptureSession = [];
    stepCount = 0;
    isRecording = false;

    // Clear recording state from chrome.storage
    chrome.storage.local.set({
      isRecording: false,
      stepCount: 0,
    });

    chrome.action.setBadgeText({ text: "" });
  } catch (error) {
    console.error("Error clearing capture session:", error);
  }
}

async function handleCaptureScreenshot(captureData: DemoCapture, sendResponse: (response: any) => void) {
  console.log("Capturing screenshot for:", captureData);
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.id) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    // Capture visible tab screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab();

    // Convert data URL to Blob
    const screenshotBlob = await fetch(screenshotDataUrl).then((res) => res.blob());

    // Update the capture data with the actual screenshot
    const updatedCapture: DemoCapture = {
      ...captureData,
      screenshotBlob: screenshotBlob,
      pageUrl: tab.url || captureData.pageUrl,
    };

    // Save to IndexedDB
    await indexedDBManager.saveCapture(updatedCapture);

    // Update session tracking
    currentCaptureSession.push(updatedCapture);
    stepCount = currentCaptureSession.length;

    // Persist updated step count to chrome.storage
    console.log("💾 Background: Updating step count in storage:", stepCount);
    chrome.storage.local.set({ stepCount: stepCount }, () => {
      console.log("✅ Background: Step count updated in storage");
    });

    // Update extension badge
    chrome.action.setBadgeText({ text: stepCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });

    console.log("Screenshot captured and saved:", updatedCapture);
    sendResponse({ success: true, data: updatedCapture });
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    sendResponse({ success: false, error: "Failed to capture screenshot" });
  }
}

// Trigger authenticated upload flow
function triggerAuthenticatedUpload() {
  console.log("Triggering authenticated upload flow...");
  // This would typically involve:
  // 1. Getting the user's auth token from storage
  // 2. Uploading each screenshot to S3
  // 3. Creating demo and step records in the backend
  // For now, we'll just log that this would happen
  console.log("Would upload screenshots to S3 and create demo records in backend");
}

// Handle requests from the web app for data synchronization
chrome.runtime.onMessageExternal.addListener((message: any, _sender, sendResponse) => {
  console.log("Received external message from web app:", message);

  switch (message.type) {
    case "REQUEST_CAPTURE_DATA":
    case "GET_CAPTURE_SESSION":
      // Return the captured data from IndexedDB
      indexedDBManager
        .getAllCaptures()
        .then(async (captures) => {
          // External messaging doesn't reliably transfer Blob objects.
          // Convert each Blob to a data URL for the web app.
          const serialized = await Promise.all(
            captures.map(async (c) => {
              let screenshotDataUrl = "";
              try {
                screenshotDataUrl = await blobToDataUrl(c.screenshotBlob);
              } catch (e) {
                console.warn("Failed to convert blob to data URL for capture", c.id, e);
              }
              return {
                id: c.id,
                pageUrl: c.pageUrl,
                timestamp: c.timestamp,
                stepOrder: c.stepOrder,
                screenshotDataUrl,
                // Pass-through click metadata for editor placement
                // @ts-ignore
                clickX: (c as any).clickX,
                // @ts-ignore
                clickY: (c as any).clickY,
                // @ts-ignore
                scrollX: (c as any).scrollX,
                // @ts-ignore
                scrollY: (c as any).scrollY,
                // @ts-ignore
                viewportWidth: (c as any).viewportWidth,
                // @ts-ignore
                viewportHeight: (c as any).viewportHeight,
                // @ts-ignore
                devicePixelRatio: (c as any).devicePixelRatio,
                // @ts-ignore
                xNorm: (c as any).xNorm,
                // @ts-ignore
                yNorm: (c as any).yNorm,
              };
            })
          );
          sendResponse({ success: true, data: serialized });
        })
        .catch((error) => {
          console.error("Error retrieving capture data:", error);
          sendResponse({
            success: false,
            error: "Failed to retrieve capture data",
          });
        });
      return true; // Keep message channel open for async response
    default:
      console.log("Unknown external message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true;
});

// Helpers
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
