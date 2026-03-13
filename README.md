# LinkedIn AI Assistant — Chrome Extension

> AI-powered LinkedIn engagement assistant for DevYarn team.  
> Generates smart comments, DM replies, conversation analysis, and connection messages.

---

## 📦 Installation (Load Unpacked)

1. **Download** this entire `extension/` folder to your computer.
2. Open **Google Chrome** and go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in the top-right corner).
4. Click **"Load unpacked"** button.
5. Select the `extension/` folder.
6. The extension icon will appear in your Chrome toolbar.

---

## 🔑 Configuration (Required)

You need an API key from **one** of these providers:

| Provider | Get Key At | Model Used |
|----------|-----------|------------|
| **OpenAI** | https://platform.openai.com/api-keys | gpt-4o |
| **Claude** | https://console.anthropic.com/ | claude-sonnet-4-20250514 |
| **Gemini** | https://aistudio.google.com/app/apikey | gemini-1.5-pro |

### Option A: Via Extension Popup (Recommended)

1. Click the extension icon in Chrome toolbar.
2. Select your **AI Provider** from the dropdown.
3. Paste your **API Key**.
4. Click **Save Settings**.
5. Reload any open LinkedIn tab.

### Option B: Edit settings.js Directly

Open `extension/settings.js` and fill in your key:

```js
AI_PROVIDER: "openai",        // or "claude" or "gemini"
OPENAI_API_KEY: "sk-xxxxx",   // your OpenAI key
```

You can also customize:
- `COMPANY_NAME` — your company name used in AI prompts
- `COMPANY_SERVICES` — description of your services
- `TONE` — the communication tone for generated content

---

## 🚀 How to Use

1. Go to **linkedin.com**
2. A blue floating **chat button** appears in the bottom-right corner.
3. Click it to open the AI Assistant panel.
4. Use the action buttons:

| Button | What It Does | Where to Use |
|--------|-------------|-------------- |
| 💬 **Generate Comment** | Creates 5 smart comment suggestions for a post | LinkedIn feed or post page |
| ✉️ **Generate DM Reply** | Creates 3 reply options + 1 strategic reply | LinkedIn messaging/DM |
| 🔍 **Analyze Conversation** | Analyzes intent, opportunity score, next steps | LinkedIn messaging/DM |
| 🤝 **Connection Message** | Creates 3 personalized connection messages | LinkedIn profile page |

5. Click **Copy** on any suggestion to copy it to your clipboard.
6. **Paste** it manually into LinkedIn.

> ⚠️ The extension **never auto-posts**. You always copy and paste manually.

---

## 📁 File Structure

```
extension/
├── manifest.json      ← Chrome Extension configuration
├── settings.js        ← API key & company settings (EDIT THIS)
├── ai.js              ← AI API calls (OpenAI / Claude / Gemini)
├── content.js         ← Floating panel + LinkedIn page scraping
├── background.js      ← Service worker for extension lifecycle
├── popup.html         ← Extension popup UI
├── popup.js           ← Popup logic & settings persistence
├── styles.css         ← Panel styling
└── icons/
    ├── icon16.png     ← Toolbar icon
    ├── icon48.png     ← Extensions page icon
    └── icon128.png    ← Chrome Web Store icon
```

---

## 🤖 AI Prompt Examples

### Comment Generation Prompt
```
You are a LinkedIn engagement specialist for DevYarn, which provides
Web Development, Mobile Apps, AI/ML Solutions, SaaS Products.

A LinkedIn post by "John Smith" says:
"AI is transforming the way we build software..."

Generate exactly 5 unique, thoughtful comments. Each should:
- Be 1-3 sentences long
- Sound natural, not salesy
- Add value (insight, question, agreement with nuance)
- Subtly position DevYarn as knowledgeable when relevant
```

### DM Reply Generation Prompt
```
You are a business development expert for DevYarn.
You are replying to "Sarah Chen" in a LinkedIn DM.
Their profile: CTO at TechCorp

Recent chat messages:
"Sarah: Hi, I saw your post about React development..."
"You: Thanks Sarah! Yes, we've been doing a lot of work with React..."

Generate 3 short DM reply options plus 1 strategic reply that moves
the conversation toward discussing a potential project collaboration.
```

### Conversation Analysis Prompt
```
You are a senior sales strategist for DevYarn.
Analyze this LinkedIn conversation with "Mike Johnson".

Provide:
1. Client intent analysis
2. Opportunity score (1-10)
3. Recommended next step
4. A suggested reply that advances toward closing a project
```

---

## 🛠 Troubleshooting

| Issue | Solution |
|-------|---------|
| Panel doesn't appear | Refresh the LinkedIn page; check `chrome://extensions` for errors |
| "No API key configured" | Add your API key via popup or `settings.js` |
| "No post found" | Navigate to a LinkedIn feed or single post page |
| "No chat messages found" | Open a LinkedIn messaging conversation |
| API errors | Verify your API key is valid and has credits |
| CORS errors with Claude | The `anthropic-dangerous-direct-browser-access` header is included; if blocked, try OpenAI or Gemini instead |

---

## 🔒 Security Notes

- API keys are stored locally in Chrome's extension storage — they never leave your machine except for API calls.
- The extension only runs on `linkedin.com`.
- No data is sent anywhere except your chosen AI provider's API.
- No automation or auto-posting — all actions are manual copy-paste.

---

## 🔄 Updating

1. Edit files in the `extension/` folder.
2. Go to `chrome://extensions`.
3. Click the **refresh** icon on the LinkedIn AI Assistant card.
4. Reload any open LinkedIn tabs.

---

*Built for DevYarn team internal use.*
