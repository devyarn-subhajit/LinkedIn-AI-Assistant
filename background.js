/**
 * LinkedIn AI Assistant — Background Service Worker
 * Handles extension lifecycle events and message passing.
 */

// On install/update, inject content scripts into already-open LinkedIn tabs
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("[LinkedIn AI Assistant] Extension installed successfully.");
  } else if (details.reason === "update") {
    console.log("[LinkedIn AI Assistant] Extension updated.");
  }

  // Inject into all open LinkedIn tabs so the user doesn't need to refresh
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["settings.js", "storage.js", "ai.js", "content.js"],
      }).catch(() => {}); // ignore tabs that can't be injected
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["styles.css"],
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[LinkedIn AI Assistant] Could not inject into existing tabs:", err);
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_URL") {
    sendResponse({ url: sender.tab?.url || "" });
    return true;
  }

  return false;
});
