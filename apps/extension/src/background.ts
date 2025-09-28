import { indexedDBManager } from "./lib/indexed-db.js";

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

// Environment configuration
const isDev = true;
const APP_BASE_URL = isDev ? "http://localhost:5173" : "https://app.propels.ai";

const ALLOWED_ORIGINS = new Set<string>([APP_BASE_URL]);

try {
  chrome.action.setBadgeText({ text: "" });
} catch (_err) {}

const keepAlive = () => {
  try {
    chrome.action.setBadgeText({ text: "" });
  } catch (_err) {}
};

let keepAliveInterval: number;

const startAggressiveKeepAlive = () => {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  keepAliveInterval = setInterval(keepAlive, 10000);
};

const stopAggressiveKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = 0;
  }
};

keepAlive();

let currentCaptureSession: DemoCapture[] = [];
let stepCount = 0;
let isRecording = false;

async function updateActionIcon(options?: { recording?: boolean; count?: number }) {
  const rec = options?.recording ?? isRecording;
  const count = options?.count ?? stepCount;

  const make = (size: number): ImageData => {
    const canvas: any = new (globalThis as any).OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // As a fallback, return transparent ImageData
      return new (globalThis as any).ImageData(size, size);
    }

    ctx.clearRect(0, 0, size, size);

    const radius = Math.max(1, Math.floor(size * 0.5) - 1);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    if (rec) {
      // Solid red dot when recording
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "#dc2626";
      ctx.fill();

      // Draw step count in the center for a clear numeric indicator
      const display = count > 99 ? "99+" : String(count);
      const fontSize = Math.max(8, Math.floor(size * 0.48));
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, Math.floor(size * 0.08));
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      try {
        ctx.strokeText(display, cx, cy + 0.5);
      } catch {}
      ctx.fillStyle = "#ffffff";
      try {
        ctx.fillText(display, cx, cy);
      } catch {}
    } else {
      // Idle: hollow gray ring for clearer distinction
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();
    }
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

chrome.runtime.onInstalled.addListener((details) => {
  keepAlive();
  try {
    if (details.reason === "install") {
      const onboardingUrl = chrome.runtime.getURL("onboarding.html");
      chrome.tabs.create({ url: onboardingUrl });
    }
  } catch (e) {
    console.warn("Failed to open instruction page on install", e);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      return;
    }

    const result = await chrome.storage.local.get(["isRecording"]);
    if (result.isRecording) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });

        // Small delay then send START_CAPTURE message to resume recording
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { type: "START_CAPTURE" });
          } catch (error) {
            console.warn("Failed to send START_CAPTURE to new page:", error);
          }
        }, 100);
      } catch (error) {
        console.warn("Failed to inject content script on new page:", error);
      }
    }
  }
});

initializeRecordingState();

async function initializeRecordingState() {
  try {
    const result = await chrome.storage.local.get(["isRecording", "stepCount"]);
    isRecording = result.isRecording || false;
    stepCount = result.stepCount || 0;

    if (isRecording) {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Recording… Click to stop" });
      updateActionIcon({ recording: true, count: stepCount });
    } else {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Demo Builder" });
      updateActionIcon({ recording: false, count: 0 });
    }
  } catch (error) {
    console.error("Error initializing recording state:", error);
    isRecording = false;
    stepCount = 0;
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  keepAlive();

  switch (message.type) {
    case "PING":
      sendResponse({ success: true, message: "pong" });
      return false;
    case "START_CAPTURE":
      handleStartCapture();
      sendResponse({ success: true });
      return false;
    case "STOP_CAPTURE":
      handleStopCapture();
      sendResponse({ success: true });
      return false;
    case "CAPTURE_SCREENSHOT":
      handleCaptureScreenshot(message.data, sendResponse);
      return true;
    case "SAVE_CAPTURE_SESSION":
      handleSaveCaptureSession(message.data);
      sendResponse({ success: true });
      return false;
    case "GET_CAPTURE_SESSION":
      handleGetCaptureSession(sendResponse);
      return true;
    case "CLEAR_CAPTURE_SESSION":
      handleClearCaptureSession();
      sendResponse({ success: true });
      return false;
    case "GET_RECORDING_STATE":
      chrome.storage.local.get(["isRecording", "stepCount"], (result) => {
        const response = {
          success: true,
          isRecording: result.isRecording || false,
          stepCount: result.stepCount || 0,
        };
        sendResponse(response);
      });
      return true;
    case "DELETE_RECORDING":
      handleDeleteRecording();
      sendResponse({ success: true });
      return false;
    default:
      console.warn("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
      return false;
  }
});

async function handleStartCapture() {
  try {
    await indexedDBManager.clearCaptures();
  } catch (e) {
    console.warn("Failed to clear previous captures:", e);
  }

  currentCaptureSession = [];
  stepCount = 0;
  isRecording = true;

  startAggressiveKeepAlive();

  const storageData = {
    isRecording: true,
    stepCount: 0,
    recordingStartTime: Date.now(),
    hasAnonymousDemo: false,
  };
  chrome.storage.local.set(storageData, () => {});

  try {
    chrome.action.setTitle({ title: "Recording… Click to stop" });
    updateActionIcon({ recording: true, count: stepCount });
  } catch (_e) {}
}

function handleStopCapture() {
  isRecording = false;

  stopAggressiveKeepAlive();

  const storageData = {
    isRecording: false,
    stepCount: 0,
  };
  chrome.storage.local.set(storageData, () => {});

  chrome.storage.local.get(["isAuthenticated"], (result) => {
    if (!result.isAuthenticated) {
      chrome.storage.local.set({ hasAnonymousDemo: true });
      chrome.tabs.create({ url: `${APP_BASE_URL}/editor` });
    } else {
      triggerAuthenticatedUpload();
    }
  });

  try {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Demo Builder" });
    updateActionIcon({ recording: false, count: 0 });
  } catch (_e) {}
  try {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Demo Builder" });
    updateActionIcon({ recording: false, count: 0 });
  } catch (_e) {}
}

function handleSaveCaptureSession(data: DemoCapture[]) {
  currentCaptureSession = data;
  stepCount = data.length;

  if (isRecording) {
    try {
      updateActionIcon({ recording: true, count: stepCount });
    } catch {}
  }
}

async function handleGetCaptureSession(sendResponse: (response: CaptureSessionResponse) => void) {
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

    chrome.storage.local.set({
      isRecording: false,
      stepCount: 0,
    });

    chrome.action.setBadgeText({ text: "" });
  } catch (error) {
    console.error("Error clearing capture session:", error);
  }
}

function handleDeleteRecording() {
  console.log("Deleting recording...");
  isRecording = false;
  stopAggressiveKeepAlive();

  const storageData = {
    isRecording: false,
    stepCount: 0,
  };
  chrome.storage.local.set(storageData, () => {});

  try {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "Demo Builder" });
    updateActionIcon({ recording: false, count: 0 });
  } catch (_e) {}
}

async function handleCaptureScreenshot(captureData: DemoCapture, sendResponse: (response: any) => void) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.id) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    const screenshotDataUrl = await chrome.tabs.captureVisibleTab();
    const screenshotBlob = await fetch(screenshotDataUrl).then((res) => res.blob());

    const updatedCapture: DemoCapture = {
      ...captureData,
      screenshotBlob: screenshotBlob,
      pageUrl: tab.url || captureData.pageUrl,
    };

    await indexedDBManager.saveCapture(updatedCapture);

    currentCaptureSession.push(updatedCapture);
    stepCount = currentCaptureSession.length;

    chrome.storage.local.set({ stepCount: stepCount }, () => {});

    if (isRecording) {
      try {
        await updateActionIcon({ recording: true, count: stepCount });
      } catch (e) {}
    }

    sendResponse({ success: true, data: updatedCapture });
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    sendResponse({ success: false, error: "Failed to capture screenshot" });
  }
}

function triggerAuthenticatedUpload() {
  console.log("Triggering authenticated upload flow...");
  console.log("Would upload screenshots to S3 and create demo records in backend");
}

chrome.runtime.onMessageExternal.addListener((message: any, sender, sendResponse) => {
  const origin = (sender as any)?.origin || (sender.url ? new URL(sender.url).origin : undefined);
  const callerId = sender.id;

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    console.warn("Blocked external message from unauthorized origin:", origin);
    sendResponse({ success: false, error: "Unauthorized origin" });
    return false;
  }

  const type = typeof message?.type === "string" ? String(message.type) : "";
  if (!type) {
    sendResponse({ success: false, error: "Invalid message type" });
    return false;
  }

  console.log("Received external message from web app:", message, "from", origin);

  switch (type) {
    case "REQUEST_CAPTURE_DATA":
    case "GET_CAPTURE_SESSION":
      indexedDBManager
        .getAllCaptures()
        .then(async (captures) => {
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
      return true;
    case "CLEAR_CAPTURE_SESSION":
      (async () => {
        try {
          await handleClearCaptureSession();
          sendResponse({ success: true });
        } catch (e) {
          console.error("Error clearing capture session via external message:", e);
          sendResponse({ success: false, error: "Failed to clear capture session" });
        }
      })();
      return true;
    default:
      console.log("Unknown external message type:", type);
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true;
});

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
