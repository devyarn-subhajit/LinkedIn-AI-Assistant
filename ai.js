/**
 * LinkedIn AI Assistant — AI API Module
 * Handles all communication with OpenAI / Claude / Gemini APIs.
 * Uses system+user message split, JSON mode, dynamic tokens,
 * multi-turn conversation memory, and retry with backoff.
 */

const AI = (() => {
  "use strict";

  // ── API Endpoints ───────────────────────────────────────
  const ENDPOINTS = {
    openai: "https://api.openai.com/v1/chat/completions",
    claude: "https://api.anthropic.com/v1/messages",
    gemini: (model, key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
  };

  // ── Dynamic Token Budgets ──────────────────────────────
  const TOKEN_BUDGETS = {
    comment: 200,
    reply: 200,
    dm: 800,
    "dm-custom": 700,
    connection: 200,
    post: 1024,
    "post-modify": 1024,
    translate: 200,
  };

  function getTokenBudget(type) {
    return TOKEN_BUDGETS[type] || CONFIG.MAX_TOKENS || 384;
  }

  // ── Spam Blocklist ─────────────────────────────────────
  const SPAM_BLOCKLIST = `NEVER use these phrases (they trigger spam perception and reduce credibility): "hire me", "cheap service", "discount", "limited offer", "best service", "guaranteed results", "limited time", "act now", "exclusive deal".`;

  // ── Adaptive Tone Detection ────────────────────────────
  function detectRoleType(profileInfo) {
    if (!profileInfo) return "general";
    const info = profileInfo.toLowerCase();
    if (/founder|ceo|co-founder|owner|director|vp|chief/.test(info)) return "founder";
    if (/developer|engineer|cto|architect|programmer|devops|tech lead/.test(info)) return "developer";
    if (/market|growth|brand|content|seo|social media|digital/.test(info)) return "marketer";
    return "general";
  }

  function getAdaptiveToneInstruction(roleType) {
    switch (roleType) {
      case "founder": return "Adapt your language for a business leader — talk about growth, scaling, ROI, team efficiency, and product-market fit.";
      case "developer": return "Adapt your language for a technical person — mention tech stacks, architecture, performance, code quality, and engineering.";
      case "marketer": return "Adapt your language for a marketer — discuss conversions, engagement, audience, analytics, and campaign strategy.";
      default: return "";
    }
  }

  // ── Lead Qualification ─────────────────────────────────
  function qualifyLead(profileInfo) {
    if (!profileInfo) return { level: "unknown", label: "" };
    const info = profileInfo.toLowerCase();
    if (/founder|startup|ceo|agency owner|cto|product manager|co-founder/.test(info)) return { level: "strong", label: "STRONG LEAD" };
    if (/marketing manager|operations lead|growth manager|head of|vp|director/.test(info)) return { level: "medium", label: "MEDIUM LEAD" };
    if (/student|recruiter|intern|entry.level/.test(info)) return { level: "low", label: "LOW PRIORITY" };
    return { level: "unknown", label: "" };
  }

  // ── Conversation Stage Detection ────────────────────────
  function detectConversationStage(chatHistory) {
    if (!chatHistory) return "first_message";
    const msgCount = (chatHistory.match(/^(You:|.+?:)/gm) || []).length;
    const mentionsProblem = /challenge|problem|issue|struggle|difficult|pain|stuck|need help/i.test(chatHistory);
    const mentionsWork = /project|build|develop|platform|product|service|team|hire|help|tool|solution/i.test(chatHistory);
    if (msgCount <= 2) return "engagement";
    if (mentionsProblem) return "problem_discovery";
    if (mentionsWork && msgCount <= 6) return "authority_positioning";
    if (msgCount > 6 && mentionsWork) return "offer_help";
    return "engagement";
  }

  function getStageGuidance(stage, firstName) {
    switch (stage) {
      case "engagement": return `CONVERSATION STAGE: Engagement — Your goal is to understand ${firstName}'s situation. Ask genuine questions about their work, team, or current projects. Be curious, not salesy.`;
      case "problem_discovery": return `CONVERSATION STAGE: Problem Discovery — ${firstName} has mentioned challenges. Dig deeper naturally. Ask follow-up questions about their pain points. Show empathy and understanding.`;
      case "authority_positioning": return `CONVERSATION STAGE: Authority Positioning — Share relevant experience naturally. Mention similar projects or challenges you've helped with, without bragging. Position your expertise as relatable context.`;
      case "offer_help": return `CONVERSATION STAGE: Offer Help — The relationship is established. Offer to share ideas, review something, or help with a specific aspect. Keep it low-pressure: "Happy to share a few ideas if useful."`;
      default: return "";
    }
  }

  // ── Tone Labels ────────────────────────────────────────
  const TONE_INSTRUCTION = "Return 3 suggestions in this exact order: Suggestion 1 = Friendly tone (warm, approachable), Suggestion 2 = Curious tone (asks a question, shows genuine interest), Suggestion 3 = Professional tone (confident, consultative). Each should feel distinctly different in style.";

  // ── Prompt Templates ───────────────────────────────────

  /** Build a block of company info for AI context */
  function buildCompanyInfoBlock() {
    const parts = [];
    if (CONFIG.COMPANY_NAME) parts.push(`Company: ${CONFIG.COMPANY_NAME}`);
    if (CONFIG.COMPANY_DESCRIPTION) parts.push(`About: ${CONFIG.COMPANY_DESCRIPTION}`);
    if (CONFIG.COMPANY_SERVICES) parts.push(`Services: ${CONFIG.COMPANY_SERVICES}`);
    if (CONFIG.COMPANY_WEBSITE) parts.push(`Website: ${CONFIG.COMPANY_WEBSITE}`);
    if (CONFIG.COMPANY_PORTFOLIO) parts.push(`Portfolio: ${CONFIG.COMPANY_PORTFOLIO}`);
    if (CONFIG.USER_ROLE) parts.push(`Your role: ${CONFIG.USER_ROLE}`);
    return parts.length > 0 ? parts.join("\n") : "";
  }

  /** Build system prompt for the comment writer role */
  function buildCommentSystemPrompt() {
    const companyInfo = buildCompanyInfoBlock();
    return `You are ${CONFIG.USER_NAME || "a tech professional"}. You comment on LinkedIn posts like a thoughtful human — brief, genuine, conversational. Language: ${CONFIG.LANGUAGE}.

${companyInfo ? `YOUR BACKGROUND:\n${companyInfo}` : ""}

Your commenting style:
- Casual and warm, like talking to a colleague at coffee
- 1-2 sentences max. Short and punchy.
- Share a real thought, insight, or curious question
- Contractions are natural ("that's", "I've", "wouldn't")
- NEVER generic praise ("Great post!", "Love this!")
- NEVER hashtags, self-promotion, or company plugs
- NEVER emoji — plain text only
- Sound human. If it sounds like AI wrote it, rewrite it.

${SPAM_BLOCKLIST}

Always return valid JSON. No markdown fences.`;
  }

  /** Append conversation memory (previous suggestions + user corrections) to a user prompt */
  function appendConversationMemory(userMsg, conversationMemory) {
    if (!conversationMemory || conversationMemory.length === 0) return userMsg;
    let memBlock = "\n\nPREVIOUS IN THIS SESSION:\n";
    conversationMemory.forEach(m => {
      if (m.role === "bot") memBlock += `Your suggestion: "${m.text}"\n`;
      else memBlock += `My feedback: "${m.text}"\n`;
    });
    memBlock += "\nCRITICAL: My feedback OVERRIDES everything. If I said \"don't mention X\" or \"no need for Y\", you must NOT include those topics. Generate something completely different.";
    return userMsg + memBlock;
  }

  function buildCommentPrompt(postText, authorName, customPrompt, conversationMemory) {
    const count = customPrompt ? 1 : 3;
    let userMsg = `Post by "${authorName}":\n"""${postText}"""\n\nWrite ${count} comment${count > 1 ? 's' : ''}.`;

    if (customPrompt) {
      userMsg += `\n\nMY INSTRUCTION: ${customPrompt}\nThis tells you WHAT to comment about. Execute it precisely. Examples:\n- "appreciate his work" → write genuine appreciation\n- "ask about the tech" → write a curious question about it\n- "disagree politely" → write a respectful counterpoint`;
    } else {
      userMsg += `\n\n${TONE_INSTRUCTION}`;
    }

    userMsg += `\n\nReturn a JSON array of ${count} string${count > 1 ? 's' : ''}. Example: ${count === 1 ? '["comment"]' : '["friendly comment", "curious comment", "professional comment"]'}`;
    return { system: buildCommentSystemPrompt(), user: appendConversationMemory(userMsg, conversationMemory) };
  }

  function buildCommentReplyPrompt(parentComment, parentAuthor, postText, customPrompt, surroundingComments, replyDepth, conversationMemory) {
    const depthLabel = replyDepth === "child-reply" ? "nested child comment" : "comment";
    const surroundingPart = surroundingComments
      ? `\nOther comments in this thread:\n${surroundingComments}`
      : "";
    const count = customPrompt ? 1 : 3;

    const system = `You are ${CONFIG.USER_NAME || "a tech professional"} replying to LinkedIn comments. Language: ${CONFIG.LANGUAGE}.

Your reply style:
- Like texting a friend — casual, warm, quick
- 1 sentence. Maybe 2 if you have something genuinely interesting to add.
- Respond directly to what they said. Don't be generic.
- Contractions are natural ("yeah", "that's cool", "I'd say")
${replyDepth === "child-reply" ? "- This is a NESTED reply in a thread — keep it extra brief, like continuing a chat\n" : ""}- NEVER generic praise, hashtags, self-promotion
- NEVER emoji — plain text only
- Sound human. Never robotic.

${SPAM_BLOCKLIST}

Always return valid JSON. No markdown fences.`;

    let userMsg = `Original post: """${postText}"""\n"${parentAuthor}" wrote this ${depthLabel}: """${parentComment}"""${surroundingPart}\n\nWrite ${count} repl${count > 1 ? 'ies' : 'y'}.`;

    if (customPrompt) {
      userMsg += `\n\nMY INSTRUCTION: ${customPrompt}\nDo exactly what I'm asking. Use the conversation context to make it natural.`;
    } else {
      userMsg += `\n\n${TONE_INSTRUCTION}`;
    }

    userMsg += `\n\nReturn a JSON array of ${count} string${count > 1 ? 's' : ''}. Example: ${count === 1 ? '["reply"]' : '["friendly reply", "curious reply", "professional reply"]'}`;
    return { system, user: appendConversationMemory(userMsg, conversationMemory) };
  }

  function buildDMReplyPrompt(chatHistory, contactName, profileInfo, lastSenderIsMe, customPrompt, conversationMemory) {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const firstName = contactName.split(" ")[0];
    const companyInfo = buildCompanyInfoBlock();
    const roleType = detectRoleType(profileInfo);
    const adaptiveTone = getAdaptiveToneInstruction(roleType);
    const lead = qualifyLead(profileInfo);
    const isNewConversation = !chatHistory || chatHistory.includes("No prior messages") || chatHistory.trim().length === 0;
    const stage = isNewConversation ? "first_message" : detectConversationStage(chatHistory);
    const stageGuidance = isNewConversation
      ? `CONVERSATION STAGE: First Message — This is your FIRST message to ${firstName}. You have never spoken before. Write a warm, genuine introduction. Reference their profile/role to show you looked them up. Be friendly and curious about their work. Keep it short (2-3 sentences). DO NOT pretend you have history with them.`
      : getStageGuidance(stage, firstName);

    // ── System prompt: defines WHO you are and HOW you write ──
    const system = `You are ${CONFIG.USER_NAME || "me"}, writing LinkedIn DMs to ${contactName}. Today: ${today}. Language: ${CONFIG.LANGUAGE}.

${companyInfo ? `YOUR COMPANY:\n${companyInfo}` : ""}
${profileInfo ? `\nABOUT ${firstName.toUpperCase()} (person you're messaging):\n${profileInfo}` : ""}
${lead.label ? `\nLEAD QUALIFICATION: ${lead.label} — ${lead.level === "strong" ? "Prioritize building this relationship. Be attentive and proactive." : lead.level === "medium" ? "Worth nurturing. Stay engaged and helpful." : "Lower priority. Keep it brief and friendly."}` : ""}
${adaptiveTone ? `\nTONE ADAPTATION: ${adaptiveTone}` : ""}
${stageGuidance ? `\n${stageGuidance}` : ""}

Your messaging style:
- You text like a real person — short, casual, genuine. Think WhatsApp, not email.
- 1-3 sentences max. No paragraphs. No walls of text.
- Match the energy of the conversation. If they're casual, be casual. If they're formal, slightly adjust.
- Use contractions naturally ("hey", "yeah", "sounds good", "I'd love to")
- When mentioning your services/company, weave it in naturally — never pitch cold
- NEVER use emoji, hashtags, buzzwords, or marketing speak
- NEVER address yourself or start with your own name
- Always address ${firstName} by first name
- You write as yourself. NEVER write as if you are ${contactName}.
- Follow the Conversation → Problem → Insight → Offer Help → Collaboration progression. Never skip stages.

CRITICAL — FULL CONTEXT AWARENESS:
- You will receive the COMPLETE chat history, not just recent messages.
- Before writing any reply, mentally review the ENTIRE conversation from the beginning.
- Remember all topics discussed, questions asked, agreements made, shared interests, pain points, and commitments.
- Never bring up something already discussed as if it's new. Never re-ask questions already answered.
- Reference earlier parts of the conversation naturally when relevant (e.g. "btw, how did that project you mentioned go?").
- If the conversation has been going on for a while, your reply should reflect that established relationship — not sound like a first interaction.

${SPAM_BLOCKLIST}

Always return valid JSON. No markdown fences.`;

    // ── User prompt: the specific task ──
    let userMsg;
    if (isNewConversation) {
      userMsg = `This is a BRAND NEW conversation with ${contactName}. You have NEVER messaged each other before.\n${profileInfo ? `Their profile info: ${profileInfo}` : ""}\n\nWrite the very first message to start a conversation. Be warm, genuine, and reference something specific about their profile or role. Do NOT pretend you know them already.\n`;
    } else {
      userMsg = `FULL CHAT HISTORY ("You:" = your messages, "${contactName}:" = theirs):\n"""${chatHistory}"""\n\nIMPORTANT: Read and analyze the ENTIRE chat history above before responding. Understand the full conversation arc — what topics were discussed, what was agreed on, what questions were asked, what the relationship dynamic is, and where the conversation currently stands. Your reply must be contextually aware of EVERYTHING discussed, not just the last few messages.\n`;
    }

    // Conversation memory: previous bot suggestions + user corrections in this session
    if (conversationMemory && conversationMemory.length > 0) {
      userMsg += `\nPREVIOUS CONVERSATION IN THIS SESSION (your earlier suggestions and my feedback):\n`;
      conversationMemory.forEach(m => {
        if (m.role === "bot") userMsg += `Your suggestion: "${m.text}"\n`;
        else userMsg += `My feedback: "${m.text}"\n`;
      });
      userMsg += `\nCRITICAL: My feedback OVERRIDES everything. If I said "don't mention X" or "no need for Y", you must NOT include those topics AT ALL. Understand WHY I gave that feedback and generate something completely different that avoids those issues.\n`;
    }

    if (customPrompt) {
      userMsg += `\nMY INSTRUCTION: ${customPrompt}\n\nDo EXACTLY what I'm asking. Think about what I actually want — not just the literal words, but the intent.\n`;
      userMsg += `Examples of how to interpret instructions:\n`;
      userMsg += `- "showcase our services" → naturally introduce what we do, tailored to ${firstName}'s industry. Include website if available.\n`;
      userMsg += `- "no need mention X" → completely avoid topic X. Write about something else relevant from the chat.\n`;
      userMsg += `- "ask about his project" → ask a genuine, specific question about their work\n`;
      userMsg += `- "say thanks and schedule a call" → thank them warmly and propose a time\n`;
      userMsg += `\nWrite 1 best reply. Return: {"reply": "your message"}`;
    } else {
      // Situation-aware auto-generation
      if (isNewConversation) {
        userMsg += `\nThis is your FIRST message ever to ${firstName}. Write a warm, personalized introduction:\n- Reference their role/headline to show you checked their profile\n- Be genuinely curious about their work\n- Keep it short (2-3 sentences max)\n- Don't be salesy or formal — be human\n`;
      } else if (lastSenderIsMe) {
        userMsg += `\nYou sent the last message and ${firstName} hasn't replied yet. Follow up naturally:\n- If you asked something → give them time, maybe add context\n- If you answered their question → ask them something back\n- If you both agreed to something → suggest a specific next step\n- NEVER repeat what you already said. NEVER re-greet.\n`;
      } else {
        userMsg += `\n${firstName} sent the last message. Respond to what THEY said:\n- Question → answer naturally\n- Greeting → greet back, start a conversation\n- Info shared → acknowledge and engage\n`;
      }
      userMsg += `\nStale check: If the last messages are from weeks/months ago, this conversation went cold. Reconnect fresh — don't reference old topics.\n`;
      userMsg += `\nWrite 3 replies in this order: Reply 1 = Friendly tone (warm, approachable), Reply 2 = Curious tone (asks a question, shows genuine interest), Reply 3 = Professional tone (confident, consultative). Plus 1 strategic reply (moves things forward — call, collab, opportunity).\nReturn: {"replies": ["friendly", "curious", "professional"], "strategic": "S"}`;
    }

    return { system, user: userMsg };
  }

  function buildConnectionPrompt(profileName, profileHeadline, profileAbout, customPrompt, conversationMemory) {
    const firstName = profileName.split(" ")[0];
    const companyInfo = buildCompanyInfoBlock();
    const count = customPrompt ? 1 : 3;
    const roleType = detectRoleType(profileHeadline || profileAbout || "");
    const adaptiveTone = getAdaptiveToneInstruction(roleType);
    const lead = qualifyLead(profileHeadline || profileAbout || "");

    const system = `You are ${CONFIG.USER_NAME || "a professional"} sending LinkedIn connection requests. Language: ${CONFIG.LANGUAGE}.

${companyInfo ? `YOUR BACKGROUND:\n${companyInfo}` : ""}
${lead.label ? `\nLEAD QUALIFICATION: ${lead.label}` : ""}
${adaptiveTone ? `\nTONE ADAPTATION: ${adaptiveTone}` : ""}

Connection note rules:
- Start with "Hi ${firstName},"
- 2-3 sentences. HARD LIMIT: 300 characters total.
- Reference their specific work — show you actually looked at their profile
- Casual and genuine, like approaching someone at a meetup
- NEVER salesy, pushy, or use buzzwords ("unlock", "elevate", "synergy")
- NEVER emoji — plain text only
- Count your characters. If over 300, shorten it.

${SPAM_BLOCKLIST}

Always return valid JSON. No markdown fences.`;

    let userMsg = `Profile: ${profileName}\nRole: ${profileHeadline || "N/A"}\n${profileAbout ? `About: ${profileAbout}` : ""}\n\nWrite ${count} connection note${count > 1 ? 's' : ''}.`;

    if (customPrompt) {
      userMsg += `\n\nMY INSTRUCTION: ${customPrompt}\nDo exactly what I'm asking.`;
    } else {
      userMsg += `\n\n${TONE_INSTRUCTION}`;
    }

    userMsg += `\n\nReturn a JSON array of ${count} string${count > 1 ? 's' : ''}. Each MUST be under 300 characters.`;
    return { system, user: appendConversationMemory(userMsg, conversationMemory) };
  }

  function buildPostPrompt(topic, existingPost, conversationMemory) {
    const companyInfo = buildCompanyInfoBlock();

    const system = `You are ${CONFIG.USER_NAME || "a professional"} writing LinkedIn posts. Language: ${CONFIG.LANGUAGE}.

${companyInfo ? `YOUR BACKGROUND:\n${companyInfo}` : ""}

Your posting style:
- 80-150 words. Strong hook in the first line that makes people stop scrolling.
- Write like you're telling a real story to a friend — honest, specific, conversational
- Use line breaks for readability. Short paragraphs.
- End with a question or thought-provoker that invites discussion
- 2-3 relevant hashtags at the end
- NEVER sound like a content marketer, motivational speaker, or AI
- NEVER use buzzwords, corporate jargon, or generic advice
- NEVER emoji — plain text only
- Be specific and authentic. Generic = bad. Personal experience = good.

${SPAM_BLOCKLIST}

Always return valid JSON. No markdown fences.`;

    let userMsg;
    if (existingPost) {
      userMsg = `Here's a LinkedIn post I generated:\n"""${existingPost}"""\n\nMY INSTRUCTION: ${topic}\n\nModify the post based on my instruction. Keep what works, change what I asked for. If I say "shorter" → cut it down. "more personal" → add a real anecdote. "add hashtags" → add relevant ones.\n\nReturn a JSON array of 3 modified versions. ${TONE_INSTRUCTION}`;
    } else {
      userMsg = `Write 3 LinkedIn posts about: """${topic}"""\n\n${TONE_INSTRUCTION}\n\nReturn a JSON array of 3 strings.`;
    }

    return { system, user: appendConversationMemory(userMsg, conversationMemory) };
  }

  // ── Demo / Dummy Responses (when no API key) ───────────

  const DEMO = {
    comments: [
      "[Test] Lorem ipsum dolor sit amet, consectetur adipiscing elit. Add your API key to get real AI suggestions.",
      "[Test] Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Configure API key in extension settings."
    ],
    dmReplies: {
      replies: [
        "[Test] Lorem ipsum dolor sit amet. Add your API key for real reply suggestions.",
        "[Test] Ut enim ad minim veniam, quis nostrud exercitation. Configure API key in settings."
      ],
      strategic: "[Test] Lorem ipsum dolor sit amet, consectetur adipiscing elit. This is a placeholder — add your API key in the extension popup to get real AI-generated strategic replies."
    },
    connectionMessages: [
      "[Test] Lorem ipsum dolor sit amet. Add API key for real connection messages.",
      "[Test] Ut enim ad minim veniam. Configure API key in extension settings."
    ],
    commentReplies: [
      "[Test] Lorem ipsum dolor sit amet. Add your API key for real replies.",
      "[Test] Sed do eiusmod tempor incididunt. Configure API key in settings."
    ],
    posts: [
      "[Test] Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nAdd your API key in the extension popup to generate real posts.\n\n#Test #LoremIpsum",
      "[Test] Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.\n\nConfigure your API key to get AI-generated posts.\n\n#Test #Placeholder"
    ]
  };

  function isDemoMode() {
    const key = getAPIKey(CONFIG.AI_PROVIDER);
    return !key;
  }

  // ── Cost per 1M tokens (USD) by model ─────────────────────
  const COST_PER_M = {
    "gpt-4o":           { input: 2.50, output: 10.00 },
    "gpt-4o-mini":      { input: 0.15, output: 0.60 },
    "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
    "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
    "gemini-2.0-flash": { input: 0.075, output: 0.30 },
    "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  };

  function estimateCost(model, inputTokens, outputTokens) {
    const rates = COST_PER_M[model] || { input: 2.50, output: 10.00 };
    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  }

  // ── Usage Tracking ──────────────────────────────────
  function trackUsage(model, inputTokens, outputTokens) {
    const cost = estimateCost(model, inputTokens, outputTokens);
    chrome.storage.local.get(["lai_usage"], (res) => {
      const usage = res.lai_usage || { totalCost: 0, totalCalls: 0, inputTokens: 0, outputTokens: 0, lastUsed: null };
      usage.totalCost = (usage.totalCost || 0) + cost;
      usage.totalCalls = (usage.totalCalls || 0) + 1;
      usage.inputTokens = (usage.inputTokens || 0) + inputTokens;
      usage.outputTokens = (usage.outputTokens || 0) + outputTokens;
      usage.lastUsed = new Date().toISOString();
      chrome.storage.local.set({ lai_usage: usage });
    });
  }

  // ── API Call Dispatcher ─────────────────────────────────
  // prompt can be a string (legacy) or { system, user } object

  async function callAI(prompt, maxTokens) {
    const provider = CONFIG.AI_PROVIDER;
    const key = getAPIKey(provider);
    const tokens = maxTokens || CONFIG.MAX_TOKENS;

    if (!key) return null; // Demo mode

    // Normalize prompt to { system, user } format
    const msg = typeof prompt === "string"
      ? { system: "", user: prompt }
      : prompt;

    // Retry with backoff: try up to 2 times
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        switch (provider) {
          case "openai":  return await callOpenAI(msg, key, tokens);
          case "claude":  return await callClaude(msg, key, tokens);
          case "gemini":  return await callGemini(msg, key, tokens);
          default: throw new Error(`Unknown AI provider: ${provider}`);
        }
      } catch (err) {
        lastError = err;
        // Don't retry on auth errors (401, 403) or invalid request (400)
        const status = err.message.match(/\((\d+)\)/);
        if (status && [400, 401, 403].includes(parseInt(status[1]))) throw err;
        // Wait before retry: 1.5s
        if (attempt < 1) await new Promise(r => setTimeout(r, 1500));
      }
    }
    throw lastError;
  }

  function getAPIKey(provider) {
    const map = {
      openai: CONFIG.OPENAI_API_KEY,
      claude: CONFIG.CLAUDE_API_KEY,
      gemini: CONFIG.GEMINI_API_KEY,
    };
    return map[provider] || "";
  }

  // ── OpenAI (with system prompt + JSON mode) ───────────

  async function callOpenAI(msg, key, maxTokens) {
    const messages = [];
    if (msg.system) messages.push({ role: "system", content: msg.system });
    messages.push({ role: "user", content: msg.user });

    const body = {
      model: CONFIG.OPENAI_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: CONFIG.TEMPERATURE,
    };
    // Enable JSON mode when system prompt asks for JSON
    if (msg.system && msg.system.includes("return valid JSON")) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(ENDPOINTS.openai, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error (${res.status}): ${err.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    const inTok = data.usage?.prompt_tokens || 0;
    const outTok = data.usage?.completion_tokens || 0;
    trackUsage(CONFIG.OPENAI_MODEL, inTok, outTok);
    return data.choices[0].message.content.trim();
  }

  // ── Claude (with system prompt) ───────────────────────

  async function callClaude(msg, key, maxTokens) {
    const body = {
      model: CONFIG.CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: CONFIG.TEMPERATURE,
      messages: [{ role: "user", content: msg.user }],
    };
    // Claude uses a top-level "system" field
    if (msg.system) body.system = msg.system;

    const res = await fetch(ENDPOINTS.claude, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `Claude API error (${res.status}): ${err.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    const inTok = data.usage?.input_tokens || 0;
    const outTok = data.usage?.output_tokens || 0;
    trackUsage(CONFIG.CLAUDE_MODEL, inTok, outTok);
    return data.content[0].text.trim();
  }

  // ── Gemini (system instruction support) ───────────────

  async function callGemini(msg, key, maxTokens) {
    const url = ENDPOINTS.gemini(CONFIG.GEMINI_MODEL, key);
    const genConfig = {
      temperature: CONFIG.TEMPERATURE,
      maxOutputTokens: maxTokens,
    };
    // Only request JSON output when the prompt expects JSON
    if (msg.system && msg.system.includes("return valid JSON")) {
      genConfig.responseMimeType = "application/json";
    }
    const body = {
      contents: [{ parts: [{ text: msg.user }] }],
      generationConfig: genConfig,
    };
    // Gemini uses "systemInstruction" for system prompts
    if (msg.system) {
      body.systemInstruction = { parts: [{ text: msg.system }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `Gemini API error (${res.status}): ${err.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    const meta = data.usageMetadata || {};
    const inTok = meta.promptTokenCount || 0;
    const outTok = meta.candidatesTokenCount || 0;
    trackUsage(CONFIG.GEMINI_MODEL, inTok, outTok);
    return data.candidates[0].content.parts[0].text.trim();
  }

  // ── Emoji Stripper ──────────────────────────────────────
  // Remove emoji characters that may corrupt to "??" in some contexts
  function stripEmoji(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23E9}-\u{23EF}\u{25AA}-\u{25FE}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{1F004}\u{1F0CF}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}\u{00A9}\u{00AE}\u{2122}\u{23CF}\u{24C2}\u{25B6}\u{23E9}-\u{23EF}\u{25C0}\u{23EA}-\u{23EE}\u{2139}\u{2194}-\u{21AA}\u{2328}\u{23ED}\u{23EF}\u{23F1}-\u{23F2}\u{2602}-\u{2604}\u{2611}\u{2618}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{265F}-\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267E}-\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26A7}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /** Recursively strip emoji from parsed AI response */
  function cleanResponse(data) {
    if (typeof data === "string") return stripEmoji(data);
    if (Array.isArray(data)) return data.map(cleanResponse);
    if (data && typeof data === "object") {
      const out = {};
      for (const key of Object.keys(data)) {
        out[key] = cleanResponse(data[key]);
      }
      return out;
    }
    return data;
  }

  /**
   * Unwrap AI response to always get an array.
   * JSON mode (OpenAI) wraps arrays in objects like {"comments": ["a","b"]}.
   * This extracts the array regardless of wrapper key name.
   */
  function unwrapArray(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      // Find the first value that is an array
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) return data[key];
      }
      // If it's an object with string values, wrap as array
      const vals = Object.values(data).filter(v => typeof v === "string");
      if (vals.length > 0) return vals;
    }
    if (typeof data === "string") return [data];
    return [];
  }

  // ── JSON Parser (robust) ───────────────────────────────

  function parseJSON(raw) {
    // Strip markdown code fences if present
    let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    // Try direct parse first
    try {
      return JSON.parse(cleaned);
    } catch (_) { /* continue to fallback strategies */ }

    // Try to extract JSON block from surrounding text
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      let jsonStr = match[0];
      try {
        return JSON.parse(jsonStr);
      } catch (_) { /* continue to cleanup */ }

      // Fix common AI quirks: trailing commas before } or ]
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");
      // Fix unescaped newlines inside strings
      jsonStr = jsonStr.replace(/(["'])([^"']*?)\n([^"']*?)\1/g, (m, q, a, b) => q + a + " " + b + q);
      try {
        return JSON.parse(jsonStr);
      } catch (_) { /* continue */ }

      // Truncated JSON: try closing open brackets/braces
      let attempt = jsonStr;
      const opens = (attempt.match(/[\[{]/g) || []).length;
      const closes = (attempt.match(/[\]}]/g) || []).length;
      for (let i = 0; i < opens - closes; i++) {
        // Remove trailing comma if present
        attempt = attempt.replace(/,\s*$/, "");
        // Guess bracket type: if last open was [ use ], else }
        const lastOpen = attempt.lastIndexOf("[") > attempt.lastIndexOf("{") ? "]" : "}";
        attempt += lastOpen;
      }
      try {
        return JSON.parse(attempt);
      } catch (_) { /* continue */ }
    }

    // Last resort: return raw text as a single-element array
    // so callers always get something usable
    return [cleaned];
  }

  // ── Translation Cache ────────────────────────────────────
  // In-memory cache + localStorage persistence to avoid repeat API calls
  const TRANSLATION_CACHE_KEY = "lai_translation_cache";
  let translationCache = {};

  // Load cache from localStorage on init
  try {
    const stored = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (stored) translationCache = JSON.parse(stored);
  } catch (_) {}

  function saveTranslationCache() {
    try {
      // Keep cache size reasonable — max 200 entries
      const keys = Object.keys(translationCache);
      if (keys.length > 200) {
        const toRemove = keys.slice(0, keys.length - 200);
        toRemove.forEach(k => delete translationCache[k]);
      }
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(translationCache));
    } catch (_) {}
  }

  function getTranslationCacheKey(text, targetLang) {
    // Simple hash: first 100 chars + language
    return targetLang + "::" + text.slice(0, 100).trim();
  }

  // ── Public API ──────────────────────────────────────────

  return {
    /** Check if translation is available (MY_LANGUAGE is set and differs from LANGUAGE) */
    canTranslate() {
      return !!(CONFIG.MY_LANGUAGE && CONFIG.MY_LANGUAGE !== CONFIG.LANGUAGE);
    },

    /** Get target translation language */
    getTranslationLanguage() {
      return CONFIG.MY_LANGUAGE || "";
    },

    /** Translate text to MY_LANGUAGE. Uses cache first, then API. */
    async translateText(text) {
      if (!text || !this.canTranslate()) return "";
      const lang = CONFIG.MY_LANGUAGE;
      const cacheKey = getTranslationCacheKey(text, lang);

      // Check in-memory cache
      if (translationCache[cacheKey]) return translationCache[cacheKey];

      if (isDemoMode()) return `[Demo] ${lang} translation not available without API key.`;

      const prompt = {
        system: `You translate text to ${lang}. Return ONLY the translated text. No quotes, no explanation, no markdown, no emoji. Sound natural like a native speaker in casual conversation.`,
        user: `Translate: "${text}"`
      };
      const raw = await callAI(prompt, getTokenBudget("translate"));
      const translated = stripEmoji((raw || "").replace(/^["']|["']$/g, "").trim());

      // Cache it
      translationCache[cacheKey] = translated;
      saveTranslationCache();

      return translated;
    },

    async generateComments(postText, authorName, customPrompt, conversationMemory) {
      if (isDemoMode()) return DEMO.comments;
      const prompt = buildCommentPrompt(postText, authorName, customPrompt, conversationMemory);
      const raw = await callAI(prompt, getTokenBudget("comment"));
      return unwrapArray(cleanResponse(parseJSON(raw)));
    },

    async generateCommentReplies(parentComment, parentAuthor, postText, customPrompt, surroundingComments, replyDepth, conversationMemory) {
      if (isDemoMode()) return DEMO.commentReplies;
      const prompt = buildCommentReplyPrompt(parentComment, parentAuthor, postText, customPrompt, surroundingComments, replyDepth, conversationMemory);
      const raw = await callAI(prompt, getTokenBudget("reply"));
      return unwrapArray(cleanResponse(parseJSON(raw)));
    },

    async generateDMReplies(chatHistory, contactName, profileInfo, lastSenderIsMe, customPrompt, conversationMemory) {
      if (isDemoMode()) {
        // Even in demo mode, show a more helpful message instead of lorem ipsum
        const isNew = !chatHistory || chatHistory.includes("No prior messages") || chatHistory.trim().length === 0;
        if (isNew) {
          return {
            replies: [
              `[Demo] Hi ${contactName.split(" ")[0]}, I'd love to connect! Add your API key in extension settings for real AI-generated messages.`,
              `[Demo] Hey ${contactName.split(" ")[0]}! No API key configured — set one up in the extension popup for personalized message suggestions.`,
            ],
            strategic: ""
          };
        }
        return DEMO.dmReplies;
      }
      const prompt = buildDMReplyPrompt(chatHistory, contactName, profileInfo, lastSenderIsMe, customPrompt, conversationMemory);
      const budget = customPrompt ? getTokenBudget("dm-custom") : getTokenBudget("dm");
      const raw = await callAI(prompt, budget);
      let parsed = cleanResponse(parseJSON(raw));
      // Unwrap JSON-mode object wrapper: {"data": {"replies":[...]}} → {"replies":[...]}
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !parsed.replies && !parsed.reply) {
        const vals = Object.values(parsed);
        if (vals.length === 1 && vals[0] && typeof vals[0] === "object") parsed = vals[0];
      }
      // When customPrompt is given, AI returns {"reply": "..."} — normalize it
      if (customPrompt) {
        if (typeof parsed === "string") return { reply: parsed };
        if (parsed.reply) return parsed;
        if (Array.isArray(parsed)) return { reply: parsed[0] || "" };
        if (parsed.replies) return { reply: parsed.replies[0] || "" };
        return { reply: JSON.stringify(parsed) };
      }
      // Normalize: if AI returned an array instead of {replies:[...]}, wrap it
      if (Array.isArray(parsed)) {
        return { replies: parsed, strategic: "" };
      }
      if (!parsed.replies) {
        return { replies: [typeof parsed === "string" ? parsed : JSON.stringify(parsed)], strategic: "" };
      }
      return parsed;
    },

    async generateConnectionMessages(profileName, headline, about, customPrompt, conversationMemory) {
      if (isDemoMode()) return DEMO.connectionMessages;
      const prompt = buildConnectionPrompt(profileName, headline, about, customPrompt, conversationMemory);
      const raw = await callAI(prompt, getTokenBudget("connection"));
      return unwrapArray(cleanResponse(parseJSON(raw)));
    },

    async generatePosts(topic, existingPost, conversationMemory) {
      if (isDemoMode()) return DEMO.posts;
      const prompt = buildPostPrompt(topic, existingPost, conversationMemory);
      const budget = existingPost ? getTokenBudget("post-modify") : getTokenBudget("post");
      const raw = await callAI(prompt, budget);
      return unwrapArray(cleanResponse(parseJSON(raw)));
    },
  };
})();
