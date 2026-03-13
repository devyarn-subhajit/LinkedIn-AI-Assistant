/**
 * LinkedIn AI Assistant — Background Service Worker
 * Handles extension lifecycle events and message passing.
 */

// Log installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[LinkedIn AI Assistant] Extension installed successfully.");
  } else if (details.reason === "update") {
    console.log("[LinkedIn AI Assistant] Extension updated.");
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
