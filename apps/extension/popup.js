// Popup script with single Start/Stop toggle
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("recordToggle");
    const viewBtn = document.getElementById("viewDemos");
    const statusEl = document.getElementById("status");

    if (!toggleBtn || !statusEl) {
      console.warn("Popup UI elements missing");
      return;
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function setToggle(recording) {
      toggleBtn.textContent = recording ? "⏹ Stop Recording" : "🔴 Start Recording";
      toggleBtn.classList.toggle("secondary", recording);
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
        setStatus("❌ No active tab");
        return false;
      }
      const url = tab.url || "";
      if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("edge://") || url.startsWith("about:")) {
        setStatus("❌ Cannot record on this page. Open a regular website.");
        return false;
      }
      try {
        await injectContent(tab.id);
      } catch (e) {
        console.warn("Content injection failed", e);
        setStatus("❌ Inject failed. Refresh the page and try again.");
        return false;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "START_CAPTURE" });
      } catch (_) {}
      await chrome.runtime.sendMessage({ type: "START_CAPTURE" });
      setToggle(true);
      setStatus("🔴 Capturing… Click on the page to add steps");
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
      setToggle(false);
      setStatus("✅ Capture complete. Opening editor if needed…");
      return true;
    }

    async function refreshState() {
      try {
        const res = await chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" });
        const recording = !!(res && res.success && res.isRecording);
        setToggle(recording);
        setStatus(recording ? "🔴 Recording active" : "Ready to start recording");
      } catch (e) {
        setToggle(false);
        setStatus("Ready to start recording");
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

    if (viewBtn) {
      viewBtn.addEventListener("click", () => chrome.tabs.create({ url: "http://localhost:5173/dashboard" }));
    }

    // initial
    refreshState();
  });
})();
