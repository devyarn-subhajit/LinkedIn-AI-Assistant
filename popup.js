/**
 * LinkedIn AI Assistant — Popup Script
 * Manages the extension popup UI and settings persistence.
 */

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const providerSelect = document.getElementById("providerSelect");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const languageSelect = document.getElementById("languageSelect");
  const myLanguageSelect = document.getElementById("myLanguageSelect");
  const saveBtn = document.getElementById("saveBtn");
  const saveMsg = document.getElementById("saveMsg");
  const openLinkedIn = document.getElementById("openLinkedIn");

  // Profile fields
  const userNameInput = document.getElementById("userNameInput");
  const userRoleInput = document.getElementById("userRoleInput");
  const companyNameInput = document.getElementById("companyNameInput");
  const companyServicesInput = document.getElementById("companyServicesInput");
  const companyDescInput = document.getElementById("companyDescInput");
  const companyWebsiteInput = document.getElementById("companyWebsiteInput");
  const companyPortfolioInput = document.getElementById("companyPortfolioInput");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profileSaveMsg = document.getElementById("profileSaveMsg");

  // ── Load saved settings ─────────────────────────────
  chrome.storage.local.get(
    ["ai_provider", "ai_api_key", "ai_language", "ai_my_language",
     "user_name", "user_role", "company_name", "company_services",
     "company_description", "company_website", "company_portfolio"],
    (data) => {
      if (data.ai_provider) providerSelect.value = data.ai_provider;
      if (data.ai_api_key) apiKeyInput.value = data.ai_api_key;
      if (data.ai_language) languageSelect.value = data.ai_language;
      if (data.ai_my_language) myLanguageSelect.value = data.ai_my_language;
      if (data.user_name) userNameInput.value = data.user_name;
      if (data.user_role) userRoleInput.value = data.user_role;
      if (data.company_name) companyNameInput.value = data.company_name;
      if (data.company_services) companyServicesInput.value = data.company_services;
      if (data.company_description) companyDescInput.value = data.company_description;
      if (data.company_website) companyWebsiteInput.value = data.company_website;
      if (data.company_portfolio) companyPortfolioInput.value = data.company_portfolio;
      updateStatus(data.ai_api_key);
    }
  );

  // ── Save settings ──────────────────────────────────
  saveBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const key = apiKeyInput.value.trim();
    const language = languageSelect.value;
    const myLanguage = myLanguageSelect.value;

    chrome.storage.local.set(
      { ai_provider: provider, ai_api_key: key, ai_language: language, ai_my_language: myLanguage },
      () => {
        saveMsg.classList.add("show");
        updateStatus(key);
        setTimeout(() => saveMsg.classList.remove("show"), 3000);
      }
    );
  });

  // ── Open LinkedIn ──────────────────────────────────
  openLinkedIn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.linkedin.com/feed/" });
  });
  // ── Save profile ──────────────────────────────
  saveProfileBtn.addEventListener("click", () => {
    chrome.storage.local.set({
      user_name: userNameInput.value.trim(),
      user_role: userRoleInput.value.trim(),
      company_name: companyNameInput.value.trim(),
      company_services: companyServicesInput.value.trim(),
      company_description: companyDescInput.value.trim(),
      company_website: companyWebsiteInput.value.trim(),
      company_portfolio: companyPortfolioInput.value.trim(),
    }, () => {
      profileSaveMsg.classList.add("show");
      setTimeout(() => profileSaveMsg.classList.remove("show"), 3000);
    });
  });
  // ── AI Usage & Billing Dashboard ──────────────────
  const aiUsageBtn = document.getElementById("aiUsageBtn");
  const usageDashboards = {
    openai: "https://platform.openai.com/usage",
    claude: "https://console.anthropic.com/settings/billing",
    gemini: "https://aistudio.google.com/app/plan_billing",
  };
  aiUsageBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const url = usageDashboards[provider] || usageDashboards.openai;
    chrome.tabs.create({ url });
  });

  // ── Clear storage button ──────────────────────────
  const clearBtn = document.getElementById("clearStorageBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all stored context data? This cannot be undone.")) return;
      chrome.tabs.query({ url: "https://www.linkedin.com/*" }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR_STORAGE" }, () => {
            clearBtn.textContent = "Data cleared!";
            clearBtn.disabled = true;
            setTimeout(() => { clearBtn.textContent = "Clear All Stored Data"; clearBtn.disabled = false; }, 2000);
          });
        }
      });
    });
  }

  // ── Status indicator ──────────────────────────────
  function updateStatus(apiKey) {
    if (apiKey) {
      statusDot.className = "status-dot green";
      statusText.textContent = "Ready — API key configured";
    } else {
      statusDot.className = "status-dot red";
      statusText.textContent = "Add your API key to get started";
    }
  }
});
