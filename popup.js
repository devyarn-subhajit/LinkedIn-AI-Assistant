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

  // ── Refresh bot button ─────────────────────────────
  const refreshBotBtn = document.getElementById("refreshBotBtn");
  refreshBotBtn.addEventListener("click", () => {
    refreshBotBtn.classList.add("spinning");
    refreshBotBtn.disabled = true;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes("linkedin.com")) {
        chrome.tabs.sendMessage(tab.id, { type: "RESCAN_BOTS" }, () => {
          setTimeout(() => {
            refreshBotBtn.classList.remove("spinning");
            refreshBotBtn.disabled = false;
          }, 800);
        });
      } else {
        refreshBotBtn.classList.remove("spinning");
        refreshBotBtn.disabled = false;
      }
    });
  });

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

  // ── Export Suggestion Log ─────────────────────────
  const exportBtn = document.getElementById("exportSuggestionsBtn");
  exportBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes("linkedin.com")) {
        chrome.tabs.sendMessage(tab.id, { type: "GET_SUGGESTION_LOG" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.log) {
            exportBtn.textContent = "No data — open LinkedIn first";
            setTimeout(() => { exportBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Suggestion Log (JSON)'; }, 2000);
            return;
          }
          if (res.log.length === 0) {
            exportBtn.textContent = "No suggestions yet";
            setTimeout(() => { exportBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Suggestion Log (JSON)'; }, 2000);
            return;
          }
          const blob = new Blob([JSON.stringify(res.log, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "lai-suggestions-" + new Date().toISOString().slice(0, 10) + ".json";
          a.click();
          URL.revokeObjectURL(url);
          exportBtn.textContent = "Exported " + res.log.length + " entries!";
          setTimeout(() => { exportBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Suggestion Log (JSON)'; }, 2000);
        });
      } else {
        exportBtn.textContent = "Open LinkedIn tab first";
        setTimeout(() => { exportBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Suggestion Log (JSON)'; }, 2000);
      }
    });
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

  // ── Check for Updates from GitHub ────────────────
  const updateBtn = document.getElementById("updateBtn");
  const updateStatusEl = document.getElementById("updateStatus");
  const GITHUB_REPO = "devyarn-subhajit/LinkedIn-AI-Assistant";
  const GITHUB_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/manifest.json`;
  const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
  const currentVersion = chrome.runtime.getManifest().version;

  updateBtn.addEventListener("click", async () => {
    updateBtn.classList.add("checking");
    updateBtn.innerHTML = '<span class="" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:-2px;margin-right:6px"></span>Checking…';
    updateStatusEl.className = "update-status";
    updateStatusEl.style.display = "none";

    try {
      const res = await fetch(GITHUB_MANIFEST_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const remote = await res.json();
      const remoteVersion = remote.version;

      if (compareVersions(remoteVersion, currentVersion) > 0) {
        updateStatusEl.textContent = `Update available: v${remoteVersion} (current: v${currentVersion})`;
        updateStatusEl.className = "update-status show has-update";
        updateBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Update';
        updateBtn.classList.remove("checking");
        updateBtn.onclick = () => chrome.tabs.create({ url: GITHUB_REPO_URL });
      } else {
        updateStatusEl.textContent = `You're up to date! (v${currentVersion})`;
        updateStatusEl.className = "update-status show success";
        resetUpdateBtn();
      }
    } catch (e) {
      updateStatusEl.textContent = "Could not check for updates. Try again later.";
      updateStatusEl.className = "update-status show info";
      resetUpdateBtn();
    }
  });

  function resetUpdateBtn() {
    updateBtn.classList.remove("checking");
    updateBtn.innerHTML = '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>Check for Updates';
  }

  function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
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
