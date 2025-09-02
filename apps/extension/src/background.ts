// Import IndexedDB manager (include .js for ESM in MV3)
import { indexedDBManager } from "./lib/indexed-db.js";

// Define types inline to avoid module conflicts
interface DemoCapture {
  id: string;
  screenshotBlob: Blob;
  pageUrl: string;
  timestamp: number;
  stepOrder: number;
  clickX?: number;
  clickY?: number;
  scrollX?: number;
  scrollY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  xNorm?: number;
  yNorm?: number;
  clickXCss?: number;
  clickYCss?: number;
  clickXDpr?: number;
  clickYDpr?: number;
  screenshotCssWidth?: number;
  screenshotCssHeight?: number;
}

interface CaptureSessionResponse {
  success: boolean;
  data?: DemoCapture[];
  error?: string;
}

// Background script for handling extension lifecycle and messaging
console.log("🚀 Demo Builder Extension: Background script loaded at", new Date().toISOString());

// Explicit allowlist for external messaging origins
const ALLOWED_ORIGINS = new Set<string>(["http://localhost:5173", "https://app.propels.ai"]);
// Note: external messaging is restricted by origin; no extension ID allowlist is used.

// Immediate activation and aggressive keepalive
console.log("🚀 Background: Service worker initializing...");

// Force immediate activation and clear any badge
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

// Render dynamic action icon (red dot + step count when recording; neutral when idle)
async function updateActionIcon(options?: { recording?: boolean; count?: number }) {
  const rec = options?.recording ?? isRecording;
  const count = options?.count ?? stepCount;

  // Helper: create ImageData for a given size
  const make = (size: number): ImageData => {
    // OffscreenCanvas is available in MV3 service worker
    // Fallback types to any to avoid TS lib issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas: any = new (globalThis as any).OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // As a fallback, return transparent ImageData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (globalThis as any).ImageData(size, size);
    }

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background transparent (kept clear)

    // Draw icon
    const radius = Math.floor(size * 0.48);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    if (rec) {
      // Solid red dot when recording
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "#dc2626"; // red-600
      ctx.fill();
    } else {
      // Idle: hollow gray ring for clearer distinction
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.lineWidth = Math.max(2, Math.floor(size * 0.18));
      ctx.strokeStyle = "#94a3b8"; // slate-400 ring
      ctx.stroke();
    }

    // No text overlay; just the status dot/ring

    return ctx.getImageData(0, 0, size, size);
  };

  try {
    await chrome.action.setIcon({
      imageData: {
        16: make(16),
        32: make(32),
        48: make(48),
        128: make(128),
      } as any,
    });
  } catch (e) {
    // Ignore icon failures silently
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Demo Builder Extension installed", details);
  console.log("🚀 Background: Service worker started via onInstalled");
  keepAlive();
  try {
    // Open instruction page on first install
    if (details.reason === "install") {
      const onboardingUrl = chrome.runtime.getURL("onboarding.html");
      chrome.tabs.create({ url: onboardingUrl });
    }
  } catch (e) {
    console.warn("Failed to open instruction page on install", e);
  }
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
      // Keep badge as red dot while recording
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Recording… Click to stop" });
      updateActionIcon({ recording: true, count: stepCount });
    } else {
      // Clear badge if not recording
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Demo Builder" });
      updateActionIcon({ recording: false, count: 0 });
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

  // Update extension icon to red dot while recording
  try {
    chrome.action.setTitle({ title: "Recording… Click to stop" });
    updateActionIcon({ recording: true, count: stepCount });
  } catch (_e) {}
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

  // Clear badge/icon when not recording
  try {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Demo Builder" });
    updateActionIcon({ recording: false, count: 0 });
  } catch (_e) {}
}

function handleSaveCaptureSession(data: DemoCapture[]) {
  console.log("Saving capture session:", data);
  currentCaptureSession = data;
  stepCount = data.length;

  // Update dynamic icon with new step count while recording
  if (isRecording) {
    try {
      updateActionIcon({ recording: true, count: stepCount });
    } catch {}
  }
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

    // Keep red dot badge while recording
    if (isRecording) {
      chrome.action.setBadgeText({ text: "●" });
      chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    }

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
chrome.runtime.onMessageExternal.addListener((message: any, sender, sendResponse) => {
  // Derive origin per Chrome's sender fields
  const origin = (sender as any)?.origin || (sender.url ? new URL(sender.url).origin : undefined);
  const callerId = sender.id;

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    console.warn("Blocked external message from unauthorized origin:", origin);
    sendResponse({ success: false, error: "Unauthorized origin" });
    return false;
  }

  // Sanitize and validate the payload
  const type = typeof message?.type === "string" ? String(message.type) : "";
  if (!type) {
    sendResponse({ success: false, error: "Invalid message type" });
    return false;
  }

  console.log("Received external message from web app:", message, "from", origin);

  switch (type) {
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
                clickX: c.clickX,
                clickY: c.clickY,
                scrollX: c.scrollX,
                scrollY: c.scrollY,
                viewportWidth: c.viewportWidth,
                viewportHeight: c.viewportHeight,
                devicePixelRatio: c.devicePixelRatio,
                xNorm: c.xNorm,
                yNorm: c.yNorm,
                clickXCss: c.clickXCss,
                clickYCss: c.clickYCss,
                clickXDpr: c.clickXDpr,
                clickYDpr: c.clickYDpr,
                screenshotCssWidth: c.screenshotCssWidth,
                screenshotCssHeight: c.screenshotCssHeight,
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
    case "CLEAR_CAPTURE_SESSION":
      // Allow the web app (authorized origin) to clear the stored captures
      (async () => {
        try {
          await handleClearCaptureSession();
          sendResponse({ success: true });
        } catch (e) {
          console.error("Error clearing capture session via external message:", e);
          sendResponse({ success: false, error: "Failed to clear capture session" });
        }
      })();
      return true; // async response
    default:
      console.log("Unknown external message type:", type);
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
