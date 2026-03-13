/**
 * LinkedIn AI Assistant — Configuration
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SETUP — Two ways to configure:                             ║
 * ║  1. Edit the defaults below (quick, file-based)             ║
 * ║  2. Use the extension popup to set provider + API key       ║
 * ║     (popup settings override the defaults below)            ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Supported providers: "openai" | "claude" | "gemini"
 */

const CONFIG = {

  // ── AI Provider ───────────────────────────────────────
  // Choose one: "openai", "claude", or "gemini"
  AI_PROVIDER: "openai",

  // ── API Keys (fill in the one you're using) ───────────
  OPENAI_API_KEY: "",
  CLAUDE_API_KEY: "",
  GEMINI_API_KEY: "",

  // ── Model Settings ────────────────────────────────────
  OPENAI_MODEL: "gpt-4o",
  CLAUDE_MODEL: "claude-sonnet-4-20250514",
  GEMINI_MODEL: "gemini-2.0-flash",

  // ── Generation Settings ───────────────────────────────
  MAX_TOKENS: 384,
  TEMPERATURE: 0.6,

  // ── Language ──────────────────────────────────────────
  LANGUAGE: "English",
  MY_LANGUAGE: "",

  // ── Your Profile (configure via the extension popup) ──
  COMPANY_NAME: "",
  COMPANY_SERVICES: "",
  COMPANY_WEBSITE: "",
  COMPANY_PORTFOLIO: "",
  COMPANY_DESCRIPTION: "",
  USER_NAME: "",
  USER_ROLE: "",
  TONE: "professional, friendly, conversational",
};

/**
 * Load overrides from chrome.storage (set via the extension popup).
 * This runs once on injection and patches CONFIG before AI calls happen.
 */
(function loadStorageOverrides() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ["ai_provider", "ai_api_key", "ai_language", "ai_my_language", "user_name", "company_name", "company_services", "company_website", "company_portfolio", "company_description", "user_role"],
      (data) => {
        if (data.ai_provider) CONFIG.AI_PROVIDER = data.ai_provider;
        if (data.ai_language) CONFIG.LANGUAGE = data.ai_language;
        if (data.ai_my_language !== undefined) CONFIG.MY_LANGUAGE = data.ai_my_language;
        if (data.user_name) CONFIG.USER_NAME = data.user_name;
        if (data.company_name) CONFIG.COMPANY_NAME = data.company_name;
        if (data.company_services) CONFIG.COMPANY_SERVICES = data.company_services;
        if (data.company_website) CONFIG.COMPANY_WEBSITE = data.company_website;
        if (data.company_portfolio) CONFIG.COMPANY_PORTFOLIO = data.company_portfolio;
        if (data.company_description) CONFIG.COMPANY_DESCRIPTION = data.company_description;
        if (data.user_role) CONFIG.USER_ROLE = data.user_role;
        if (data.ai_api_key) {
          const keyMap = {
            openai: "OPENAI_API_KEY",
            claude: "CLAUDE_API_KEY",
            gemini: "GEMINI_API_KEY",
          };
          const field = keyMap[CONFIG.AI_PROVIDER];
          if (field) CONFIG[field] = data.ai_api_key;
        }
      }
    );
  }
})();
