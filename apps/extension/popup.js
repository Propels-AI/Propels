// Popup script with single Start/Stop toggle
(function () {
  // Environment configuration - check if this is a dev build
  const isDev = chrome.runtime.getManifest().version.includes("dev");
  const APP_BASE_URL = isDev ? "http://localhost:5173" : "https://app.propels.ai";
  document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("recordToggle");
    const recBadge = document.getElementById("recBadge");
    const recordDesc = document.getElementById("recordDesc");

    if (!toggleBtn) {
      console.warn("Popup UI elements missing");
      return;
    }

    function setToggle(recording) {
      toggleBtn.classList.remove("btn-primary", "btn-danger");
      if (recording) {
        toggleBtn.textContent = "Stop Recording";
        toggleBtn.classList.add("btn", "btn-danger");
      } else {
        toggleBtn.textContent = "Start Recording";
        toggleBtn.classList.add("btn", "btn-primary");
      }
    }

    function updateUI(recording) {
      setToggle(recording);
      if (recBadge) recBadge.style.display = recording ? "inline-block" : "none";
      if (recordDesc)
        recordDesc.textContent = recording
          ? "Recording current tab — click stop when done"
          : "Records the current browser tab";
    }

    async function getActiveTab() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs[0];
    }

    async function injectContent(tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await new Promise((r) => setTimeout(r, 200));
    }

    async function startCapture() {
      const tab = await getActiveTab();
      if (!tab || !tab.id) {
        console.warn("❌ No active tab");
        return false;
      }
      const url = tab.url || "";
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:")
      ) {
        console.warn("❌ Cannot record on this page. Open a regular website.");
        return false;
      }
      try {
        await injectContent(tab.id);
      } catch (e) {
        console.warn("Content injection failed", e);
        return false;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "START_CAPTURE" });
      } catch (_) {}
      await chrome.runtime.sendMessage({ type: "START_CAPTURE" });
      updateUI(true);
      return true;
    }

    async function stopCapture() {
      const tab = await getActiveTab();
      if (tab && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "STOP_CAPTURE" });
        } catch (_) {}
      }
      await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
      updateUI(false);
      return true;
    }

    async function refreshState() {
      try {
        const res = await chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" });
        const recording = !!(res && res.success && res.isRecording);
        updateUI(recording);
      } catch (e) {
        updateUI(false);
      }
    }

    toggleBtn.addEventListener("click", async () => {
      try {
        const res = await chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" });
        const recording = !!(res && res.success && res.isRecording);
        if (recording) {
          await stopCapture();
        } else {
          await startCapture();
        }
      } catch (e) {
        // fallback attempt: try starting
        await startCapture();
      }
    });

    // initial
    refreshState();
  });
})();
