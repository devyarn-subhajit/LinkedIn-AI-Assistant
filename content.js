/**
 * LinkedIn AI Assistant — Content Script
 * Injects the floating AI panel into LinkedIn pages and handles all interactions.
 */

(() => {
  "use strict";

  // Prevent double-injection of the entire script
  if (window.__laiContentScriptLoaded) return;
  window.__laiContentScriptLoaded = true;

  // Inject Google Fonts (Inter + DM Sans, weight 400-700)
  if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(fontLink);
  }

  // ══════════════════════════════════════════════════════
  //  DOM HELPERS
  // ══════════════════════════════════════════════════════

  /** Try multiple selectors in order and return the first match. */
  function q(parent, selectors) {
    for (const sel of selectors) {
      const el = parent.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ══════════════════════════════════════════════════════
  //  SVG ICONS (Lucide-style, 16×16)
  // ══════════════════════════════════════════════════════

  const ICO = {
    bot:       '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="14" r="1.5"/></svg>',
    edit:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/></svg>',
    chat:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    reply:     '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
    comments:  '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
    user:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
    link:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    calendar:  '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    refresh:   '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    close:     '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
    warn:      '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    sparkle:   '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
    cursor:    '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>',
    translate: '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
    ctx:       '<svg class="lai-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };

  // ══════════════════════════════════════════════════════
  //  UI HELPERS
  // ══════════════════════════════════════════════════════

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  }

  // ══════════════════════════════════════════════════════
  //  INLINE BOT — appears in post modal, comments,
  //  reply boxes, and chat/DM windows
  // ══════════════════════════════════════════════════════

  /**
   * Detect what type of input area an element belongs to.
   * Returns: "post-modal" | "chat" | "comment"
   */
  function detectInputType(el) {
    // Chat / messaging — MUST check before post-modal because chat overlays
    // also use [role='dialog'] and .artdeco-modal__content
    if (el.closest(".msg-form")
      || el.closest("[class*='msg-form']")
      || el.closest(".msg-overlay-conversation-bubble")
      || el.closest("[class*='msg-overlay-conversation']")
      || el.closest("[class*='msg-overlay']")
      || el.closest(".msg-conversations-container")
      || el.closest(".msg-thread")
      || el.closest("[class*='msg-thread']")
      || el.closest("[class*='msg-convo']")
      || el.closest("[class*='messaging']")
      || el.closest("aside[class*='msg']")) {
      return "chat";
    }

    // Connection request "Add a note" modal — check before post-modal
    // because it also uses [role='dialog'] / .artdeco-modal
    const dialog = el.closest("[role='dialog']") || el.closest(".artdeco-modal");
    if (dialog) {
      const header = dialog.querySelector("h2, h3, [class*='artdeco-modal__header']");
      const headerText = header ? header.innerText.toLowerCase() : "";
      if (headerText.includes("invitation") || headerText.includes("add a note")) {
        return "connection";
      }
      // Also detect by textarea placeholder
      const ta = dialog.querySelector("textarea");
      if (ta) {
        const ph = (ta.placeholder || "").toLowerCase();
        if (ph.includes("know each other") || ph.includes("connect") || ph.includes("invitation")) {
          return "connection";
        }
      }
    }

    // Post creation modal
    if (el.closest(".share-creation-state__text-editor")
      || el.closest("[class*='share-creation']")
      || el.closest(".artdeco-modal__content")
      || el.closest("[class*='share-box']")) {
      return "post-modal";
    }

    // Check if this is a reply box under a specific comment
    if (el.closest(".comments-comment-entity__reply-action-container")
      || el.closest("[class*='comments-reply']")
      || el.closest(".comments-comment-entity + .comments-comment-texteditor")
      || el.closest(".reply-comment-box")
      || el.closest("[class*='comments-comment-box--reply']")) {
      return "reply";
    }

    // Also detect reply if the reply box is nested under a comment item
    const commentEntity = el.closest(".comments-comment-entity")
      || el.closest(".comments-comment-item");
    if (commentEntity) {
      // If there's a comment body sibling, this is a reply box
      const body = commentEntity.querySelector(".comments-comment-item__main-content")
        || commentEntity.querySelector(".update-components-text");
      if (body) return "reply";
    }

    // Default: top-level comment
    return "comment";
  }

  /**
   * Find the parent comment text that a reply box belongs to.
   */
  function getParentCommentContext(replyBox) {
    // Walk up to find the comment entity this reply box is nested under
    let el = replyBox.parentElement;
    for (let i = 0; i < 15 && el; i++) {
      // Look for the comment text in siblings or ancestors
      const commentText = el.querySelector(".comments-comment-item__main-content .update-components-text")
        || el.querySelector(".comments-comment-item__main-content span[dir='ltr']")
        || el.querySelector(".feed-shared-inline-show-more-text")
        || el.querySelector(".comments-comment-item__main-content");

      const authorEl = el.querySelector(".comments-post-meta__name-text a span[aria-hidden='true']")
        || el.querySelector(".comments-post-meta__name-text")
        || el.querySelector("[class*='comments-post-meta'] a")
        || el.querySelector(".update-components-actor__name span[aria-hidden='true']");

      if (commentText && commentText.innerText.trim().length > 2) {
        return {
          author: authorEl ? authorEl.innerText.trim() : "Someone",
          text: commentText.innerText.trim(),
        };
      }
      el = el.parentElement;
    }

    // Fallback: look at the sibling comment directly above the reply box
    const prev = replyBox.closest(".comments-comment-texteditor")
      || replyBox;
    let sibling = prev.previousElementSibling;
    for (let i = 0; i < 5 && sibling; i++) {
      const txt = sibling.querySelector(".update-components-text")
        || sibling.querySelector("span[dir='ltr']")
        || sibling;
      const auth = sibling.querySelector("[class*='comments-post-meta'] span[aria-hidden='true']")
        || sibling.querySelector("a[class*='tap-target'] span");
      if (txt && txt.innerText.trim().length > 2) {
        return {
          author: auth ? auth.innerText.trim() : "Someone",
          text: txt.innerText.trim(),
        };
      }
      sibling = sibling.previousElementSibling;
    }

    return null;
  }

  /**
   * Capture surrounding comments near a reply box for richer context.
   * Returns up to 3 sibling comments (excluding the parent).
   */
  function getSurroundingComments(replyBox) {
    const post = replyBox.closest(".feed-shared-update-v2")
      || replyBox.closest("[data-urn*='activity']")
      || replyBox.closest(".occludable-update")
      || replyBox.closest("article");
    if (!post) return [];

    const allComments = post.querySelectorAll(
      ".comments-comment-item, [class*='comments-comment-item'], .comments-comment-entity"
    );
    const surrounding = [];
    allComments.forEach((c) => {
      if (surrounding.length >= 3) return;
      const textEl = c.querySelector(".update-components-text")
        || c.querySelector("span[dir='ltr']")
        || c.querySelector(".feed-shared-inline-show-more-text");
      const authEl = c.querySelector("[class*='comments-post-meta'] span[aria-hidden='true']")
        || c.querySelector(".comments-post-meta__name-text");
      if (textEl && textEl.innerText.trim().length > 2) {
        surrounding.push({
          author: authEl ? authEl.innerText.trim() : "Someone",
          text: textEl.innerText.trim().slice(0, 200),
        });
      }
    });
    return surrounding;
  }

  /**
   * Detect if a reply is a child (nested) comment reply vs a top-level comment reply.
   * Returns "child-reply" if nested under another comment's reply thread, otherwise "reply".
   */
  function detectReplyDepth(replyBox) {
    // Check if the reply box is inside a replies container (nested comment)
    const repliesContainer = replyBox.closest(".comments-replies-list")
      || replyBox.closest("[class*='comments-replies']")
      || replyBox.closest(".comments-comment-entity__reply-action-container");
    if (repliesContainer) return "child-reply";

    // Check nesting depth — if there's a parent comment entity wrapping this
    let depth = 0;
    let el = replyBox.parentElement;
    for (let i = 0; i < 20 && el; i++) {
      if (el.classList && (
        el.classList.contains("comments-comment-item") ||
        el.classList.contains("comments-comment-entity") ||
        el.className.includes("comments-comment-item")
      )) {
        depth++;
      }
      el = el.parentElement;
    }
    return depth > 1 ? "child-reply" : "reply";
  }

  /**
   * Find the post text for a given comment box element by walking up the DOM.
   */
  function getPostTextForCommentBox(commentBox) {
    let container = commentBox.closest(".feed-shared-update-v2")
      || commentBox.closest("[data-urn*='activity']")
      || commentBox.closest(".occludable-update")
      || commentBox.closest("article");

    if (!container) {
      let el = commentBox.parentElement;
      for (let i = 0; i < 25 && el; i++) {
        const textEl = q(el, [
          ".feed-shared-update-v2__description .break-words",
          ".feed-shared-inline-show-more-text",
          ".update-components-text .break-words",
          ".feed-shared-text__text-view",
          ".update-components-text span[dir='ltr']",
          "span.break-words[dir='ltr']",
        ]);
        if (textEl && textEl.innerText.trim().length > 10) {
          container = el;
          break;
        }
        el = el.parentElement;
      }
    }

    if (!container) return { author: "Unknown", text: "" };

    const authorEl = q(container, [
      ".update-components-actor__name span[aria-hidden='true']",
      ".update-components-actor__title span[aria-hidden='true']",
      ".update-components-actor__name",
      ".feed-shared-actor__name span[aria-hidden='true']",
      ".feed-shared-actor__name",
    ]);
    const textEl = q(container, [
      ".feed-shared-update-v2__description .break-words",
      ".feed-shared-inline-show-more-text",
      ".update-components-text .break-words",
      ".feed-shared-text__text-view",
      ".update-components-text span[dir='ltr']",
      "span.break-words[dir='ltr']",
    ]);

    return {
      author: authorEl ? authorEl.innerText.trim() : "Unknown",
      text: textEl ? textEl.innerText.trim() : "",
    };
  }

  /**
   * Scroll up in a chat container to trigger LinkedIn to load older messages.
   * Returns a promise that resolves when scrolling is complete.
   */
  async function scrollToLoadFullChatHistory(bubble) {
    if (!bubble) return;
    const scrollContainer = bubble.querySelector(".msg-s-message-list-content")
      || bubble.querySelector("[class*='message-list']")
      || bubble.querySelector("ul[class*='msg-s-message-list']")
      || bubble.querySelector(".msg-s-message-list");
    if (!scrollContainer) return;

    // Scroll to the top in steps to trigger lazy loading of older messages
    const maxScrollAttempts = 8;
    let prevHeight = scrollContainer.scrollHeight;
    for (let i = 0; i < maxScrollAttempts; i++) {
      scrollContainer.scrollTop = 0;
      // Wait for LinkedIn to load more messages
      await new Promise(r => setTimeout(r, 400));
      const newHeight = scrollContainer.scrollHeight;
      // If scroll height didn't change, we've loaded everything
      if (newHeight === prevHeight) break;
      prevHeight = newHeight;
    }
    // Scroll back to bottom so user doesn't notice
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  /**
   * Get chat context from a messaging bubble.
   * Handles both overlay chat bubbles and full-page messaging.
   */
  function getChatContextFromBubble(el) {
    // Find the messaging container
    const bubble = el.closest(".msg-overlay-conversation-bubble")
      || el.closest(".msg-convo-wrapper")
      || el.closest("[class*='msg-overlay-conversation']")
      || el.closest(".msg-conversations-container")
      || el.closest(".msg-thread")
      || el.closest("[class*='msg-thread']")
      || el.closest("[class*='msg-overlay']")
      || el.closest("[class*='messaging']")
      || document.querySelector(".msg-overlay-conversation-bubble")
      || document.querySelector(".msg-conversations-container")
      || document.querySelector("[class*='messaging']");

    if (!bubble) return { contactName: "Contact", chatHistory: "" };

    // Contact name — try multiple selectors
    const nameEl = q(bubble, [
      "h2.msg-overlay-bubble-header__title",
      ".msg-overlay-bubble-header__title",
      "h2[class*='msg-overlay']",
      ".msg-entity-lockup__entity-title",
      "h2.msg-entity-lockup__entity-title",
      ".msg-conversation-card__participant-names",
      ".msg-thread__link-to-profile",
      "[class*='entity-lockup'] span",
      "[data-control-name='conversation_title']",
      "h2",
    ]);

    // Contact headline — LinkedIn often shows it under the name in chat header
    const headlineEl = q(bubble, [
      ".msg-overlay-bubble-header__subtitle",
      ".msg-entity-lockup__entity-subtitle",
      "[class*='entity-lockup__subtitle']",
      ".msg-overlay-bubble-header__occupation",
      "[class*='bubble-header__subtitle']",
      "[class*='entity-lockup'] .msg-entity-lockup__entity-subtitle",
    ]);
    const contactHeadline = headlineEl ? headlineEl.innerText.trim() : "";

    // Scrape all visible messages with a broad, multi-strategy approach
    const messages = [];

    // First, grab any date/time headers visible in the chat
    const dateHeaders = bubble.querySelectorAll(
      ".msg-s-message-list__time-heading, [class*='time-heading'], [class*='msg-s-message-list-content'] h4, [class*='msg-s-message-list-content'] time"
    );
    const dateSet = new Set();
    dateHeaders.forEach((dh) => {
      const dt = dh.innerText.trim();
      if (dt && dt.length > 2 && dt.length < 40) dateSet.add(dt);
    });

    // Also try to get datetime from <time> elements for exact dates
    const timeEls = bubble.querySelectorAll("time[datetime], [class*='msg-s-message-group__timestamp'] time, [class*='timestamp'] time");
    timeEls.forEach((te) => {
      const dt = te.getAttribute("datetime");
      if (dt) {
        try {
          const d = new Date(dt);
          const formatted = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
          dateSet.add(formatted);
        } catch (_) {}
      }
    });

    // Deduplication: track DOM elements already scraped to avoid multi-match selectors
    const scrapedEls = new WeakSet();

    // Strategy 1: Process each message <li> in the chat list
    // Target only <li> elements to avoid double-processing with inner <div>s
    const messageLis = bubble.querySelectorAll("li.msg-s-message-list__event");
    const contactNameFromHeader = nameEl ? nameEl.innerText.trim().split("\n")[0].trim() : "Contact";

    if (messageLis.length > 0) {
      let lastSender = "Unknown";
      messageLis.forEach((li) => {
        if (scrapedEls.has(li)) return;
        scrapedEls.add(li);

        // Also mark inner event divs as scraped to prevent Strategy 2/3 duplicates
        const innerDivs = li.querySelectorAll(".msg-s-event-listitem, [class*='msg-s-event-listitem']");
        innerDivs.forEach((d) => scrapedEls.add(d));

        // Find the inner event item div (the actual message container)
        const eventDiv = li.querySelector(".msg-s-event-listitem, [class*='msg-s-event-listitem']");

        // Check for date/time heading within this li
        const dateEl = li.querySelector(".msg-s-message-list__time-heading, [class*='time-heading']");
        if (dateEl) {
          const dateText = dateEl.innerText.trim();
          if (dateText && dateText.length > 0 && dateText.length < 40) {
            messages.push(`[${dateText}]`);
          }
        }

        // Skip non-message li elements (loader, typing indicator, quick replies, etc.)
        if (!eventDiv) return;

        // SENDER DETECTION — 3 methods in priority order
        // Method 1: Name element within this li (present on first message in a group)
        let senderEl = li.querySelector(".msg-s-message-group__name")
          || li.querySelector("[class*='message-group__name']")
          || li.querySelector(".msg-s-message-group__profile-link")
          || li.querySelector("[class*='profile-name']");

        if (senderEl) {
          lastSender = senderEl.innerText.trim().split("\n")[0].trim();
        } else {
          // Method 2: A11y heading (contains "X sent the following message/messages at...")
          const a11yHeading = li.querySelector(".msg-s-event-listitem--group-a11y-heading, [class*='group-a11y-heading']");
          if (a11yHeading) {
            const headingText = a11yHeading.innerText.trim();
            const match = headingText.match(/^(.+?)\s+sent the following/i);
            if (match) {
              lastSender = match[1].trim();
            }
          }
          // Method 3: Use --other class on the event div
          // --other = contact's message, absence = your message
          else if (eventDiv.classList.contains("msg-s-event-listitem--other")) {
            lastSender = contactNameFromHeader;
          }
          // If no --other and no name found, lastSender from previous iteration persists
          // (correct for continuation messages from same sender)
        }

        // Message body
        let bodyEl = li.querySelector(".msg-s-event-listitem__body")
          || li.querySelector("[class*='event-listitem__body']")
          || li.querySelector(".msg-s-event__content")
          || li.querySelector(".msg-s-event-listitem__message-bubble p")
          || li.querySelector("p.msg-s-event-listitem__body")
          || li.querySelector("[class*='message-bubble'] p")
          || li.querySelector("p");

        // Fallback: grab text directly from the message bubble container
        if (!bodyEl) {
          bodyEl = li.querySelector(".msg-s-event-listitem__message-bubble")
            || li.querySelector("[class*='message-bubble']");
        }

        if (bodyEl) {
          const body = bodyEl.innerText.trim();
          if (body && body.length > 0) {
            messages.push(`${lastSender}: ${body}`);
          }
        }
      });
    }

    // Strategy 2: Message groups (grouped by sender) — also runs as supplementary pass
    // to catch messages that Strategy 1 may have missed
    {
      const groups = bubble.querySelectorAll(
        ".msg-s-message-group, [class*='msg-s-message-group']"
      );
      groups.forEach((group) => {
        const senderEl = group.querySelector(".msg-s-message-group__name")
          || group.querySelector("[class*='message-group__name']")
          || group.querySelector(".msg-s-message-group__profile-link span")
          || group.querySelector("a span");
        const sender = senderEl ? senderEl.innerText.trim().split("\n")[0].trim() : "Unknown";

        // Get all message bubbles in this group, extract text from each
        const bubbleEls = group.querySelectorAll(
          ".msg-s-event-listitem, [class*='msg-s-event-listitem']"
        );
        bubbleEls.forEach((item) => {
          if (scrapedEls.has(item)) return;
          scrapedEls.add(item);
          let bodyEl = item.querySelector(".msg-s-event-listitem__body")
            || item.querySelector("[class*='event-listitem__body']")
            || item.querySelector("[class*='message-bubble'] p")
            || item.querySelector("[class*='message-bubble'] span[dir='ltr']")
            || item.querySelector("p");
          // Fallback: grab the bubble container text directly
          if (!bodyEl) {
            bodyEl = item.querySelector(".msg-s-event-listitem__message-bubble")
              || item.querySelector("[class*='message-bubble']");
          }
          if (bodyEl) {
            const body = bodyEl.innerText.trim();
            if (body && body.length > 0) {
              messages.push(`${sender}: ${body}`);
            }
          }
        });
      });
    }

    // Strategy 3: Broadest possible — catch any remaining messages in the chat list
    // This catches messages with non-standard selectors (e.g., recently sent messages,
    // messages inside li elements without .msg-s-event-listitem class)
    {
      const msgList = bubble.querySelector(".msg-s-message-list-content")
        || bubble.querySelector("[class*='message-list-content']")
        || bubble.querySelector("[class*='message-list']")
        || bubble.querySelector("ul")
        || bubble;

      // Find all list items that contain message content
      const allItems = msgList.querySelectorAll("li");
      allItems.forEach((li) => {
        if (scrapedEls.has(li)) return;

        // Look for message body text in this list item
        const bodyEl = li.querySelector(".msg-s-event-listitem__body")
          || li.querySelector("[class*='event-listitem__body']")
          || li.querySelector("[class*='message-bubble'] p")
          || li.querySelector("[class*='message-bubble'] span[dir='ltr']")
          || li.querySelector("[class*='message-bubble']")
          || li.querySelector("p");

        if (!bodyEl) return;
        const body = bodyEl.innerText.trim();
        if (!body || body.length === 0) return;

        scrapedEls.add(li);

        // Try to find sender — check the item, then its parent group
        let sender = "Unknown";
        let senderEl = li.querySelector(".msg-s-message-group__name")
          || li.querySelector("[class*='message-group__name']")
          || li.querySelector("[class*='profile-name']");
        if (!senderEl) {
          const group = li.closest(".msg-s-message-group, [class*='msg-s-message-group']");
          if (group) {
            senderEl = group.querySelector(".msg-s-message-group__name")
              || group.querySelector("[class*='message-group__name']")
              || group.querySelector(".msg-s-message-group__profile-link span");
          }
        }
        if (senderEl) sender = senderEl.innerText.trim().split("\n")[0].trim();

        messages.push(`${sender}: ${body}`);
      });
    }

    // Deduplicate messages (remove all duplicates, not just consecutive)
    const seen = new Set();
    const deduped = [];
    messages.forEach((m) => {
      if (!seen.has(m)) { seen.add(m); deduped.push(m); }
    });

    // Use ALL messages — AI needs full chat history for context-aware suggestions
    const recentMessages = deduped;

    // Prepend date context if found
    const datePrefix = dateSet.size > 0 ? `[Conversation dates: ${[...dateSet].join(", ")}]\n` : "";

    // Determine who sent the last message (skip date markers)
    let lastRealMessage = "";
    for (let i = deduped.length - 1; i >= 0; i--) {
      if (!deduped[i].startsWith("[")) { lastRealMessage = deduped[i]; break; }
    }
    const contactName = nameEl ? nameEl.innerText.trim().split("\n")[0].trim() : "Contact";
    let lastSenderIsMe = false;
    // Identify the user's own name — any sender that ISN'T the contact is "me"
    let myNameInChat = "";
    if (lastRealMessage) {
      const colonIdx = lastRealMessage.indexOf(":");
      if (colonIdx > 0) {
        const senderName = lastRealMessage.slice(0, colonIdx).trim();
        const contactLower = contactName.toLowerCase();
        const contactFirst = contactLower.split(" ")[0];
        const senderLower = senderName.toLowerCase();
        if (!senderLower.startsWith(contactFirst) && senderLower !== contactLower) {
          lastSenderIsMe = true;
          myNameInChat = senderName;
        }
      }
    }
    // If we didn't find our name from last message, scan all messages
    if (!myNameInChat) {
      const contactLower = contactName.toLowerCase();
      const contactFirst = contactLower.split(" ")[0];
      for (const m of deduped) {
        if (m.startsWith("[")) continue;
        const ci = m.indexOf(":");
        if (ci > 0) {
          const s = m.slice(0, ci).trim().toLowerCase();
          if (!s.startsWith(contactFirst) && s !== contactLower && s !== "unknown") {
            myNameInChat = m.slice(0, ci).trim();
            break;
          }
        }
      }
    }

    // Relabel messages: replace user's name with "You" for clarity in AI prompt
    const relabeledMessages = recentMessages.map((m) => {
      if (m.startsWith("[")) return m; // date markers
      if (myNameInChat) {
        const prefix = myNameInChat + ":";
        if (m.startsWith(prefix)) {
          return "You:" + m.slice(prefix.length);
        }
      }
      return m;
    });

    // Build structured messages array for storage (from deduped)
    const structuredMessages = deduped
      .filter((m) => !m.startsWith("["))
      .map((m) => {
        const colonIdx = m.indexOf(":");
        if (colonIdx > 0) {
          return { sender: m.slice(0, colonIdx).trim(), text: m.slice(colonIdx + 1).trim() };
        }
        return { sender: "Unknown", text: m };
      });

    return {
      contactName,
      contactHeadline,
      chatHistory: datePrefix + relabeledMessages.join("\n"),
      lastSenderIsMe,
      structuredMessages,
      messageDates: [...dateSet],
    };
  }

  /**
   * Scrape profile info from the page for connection request notes.
   */
  function getProfileInfoForConnection() {
    const dialog = document.querySelector("[role='dialog']") || document.querySelector(".artdeco-modal");

    // Get name from the profile page BEHIND the modal (not from the modal itself)
    // Try multiple strategies since LinkedIn frequently changes class names
    let nameEl = null;

    // Strategy 1: Main content h1 (exclude any h1 inside dialogs/modals)
    const allH1s = document.querySelectorAll("h1");
    for (const h1 of allH1s) {
      if (!h1.closest("[role='dialog']") && !h1.closest(".artdeco-modal") && h1.innerText.trim().length > 1) {
        nameEl = h1;
        break;
      }
    }

    // Strategy 2: Known LinkedIn profile name selectors
    if (!nameEl) {
      nameEl = document.querySelector("h1.text-heading-xlarge")
        || document.querySelector("h1[class*='text-heading']")
        || document.querySelector(".pv-text-details__left-panel h1")
        || document.querySelector("[class*='profile-card'] h1")
        || document.querySelector(".profile-card-one-to-one__name")
        || document.querySelector("[class*='profile-topcard'] h1")
        || document.querySelector(".pv-top-card--list li:first-child");
    }

    let name = nameEl ? nameEl.innerText.trim().split("\n")[0].trim() : "";

    // Strategy 3: Parse from page title as fallback (e.g. "Gunjan Agarwal - Interior Designer | LinkedIn")
    if (!name || name.length < 2) {
      const title = document.title || "";
      const titleMatch = title.match(/^(.+?)\s*[-–|]/);
      if (titleMatch) name = titleMatch[1].trim();
    }
    // Clean name: remove emojis, pronouns like "She/Her", verified badges
    name = name.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "").trim();
    name = name.replace(/\s*(She\/Her|He\/Him|They\/Them)\s*/gi, "").trim();
    // Remove any verified badge text or extra whitespace
    name = name.replace(/\s{2,}/g, " ").trim();
    // Extract just the first name for greeting
    const firstName = name.split(" ")[0] || "there";

    // Headline (usually right below name on the profile page)
    const headlineEl = document.querySelector(".text-body-medium[data-generated-suggestion-target]")
      || document.querySelector(".pv-text-details__left-panel .text-body-medium")
      || document.querySelector("[class*='profile-card'] .text-body-medium")
      || document.querySelector("div.text-body-medium");
    const headline = headlineEl ? headlineEl.innerText.trim() : "";

    // About section (if visible)
    const aboutEl = document.querySelector("#about ~ div .inline-show-more-text")
      || document.querySelector("[class*='pv-about'] span[aria-hidden='true']")
      || document.querySelector("section.pv-about-section .pv-about__summary-text");
    const about = aboutEl ? aboutEl.innerText.trim().slice(0, 200) : "";

    return { name, firstName, headline, about };
  }

  /**
   * Set text into a LinkedIn contenteditable element.
   */
  function fillInputArea(target, text) {
    // Find the actual contenteditable
    let editableDiv = null;
    if (target.getAttribute("contenteditable") === "true") {
      editableDiv = target;
    } else {
      editableDiv = target.querySelector("[contenteditable='true']")
        || target.closest("[contenteditable='true']");
    }

    // Also check for Quill editor in post modals
    if (!editableDiv) {
      const modal = target.closest("[role='dialog']") || target.closest(".artdeco-modal");
      if (modal) {
        editableDiv = modal.querySelector(".ql-editor[contenteditable='true']")
          || modal.querySelector("[contenteditable='true']");
      }
    }

    if (editableDiv) {
      editableDiv.focus();

      // Method 1: Use execCommand (most reliable for LinkedIn's React/contenteditable)
      try {
        // Select all existing content first
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        sel.removeAllRanges();
        sel.addRange(range);
        // Insert text via execCommand — this triggers LinkedIn's internal handlers
        document.execCommand("insertText", false, text);
        // If execCommand worked, dispatch events and return
        if (editableDiv.innerText.trim().length > 0) {
          editableDiv.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
      } catch (_) { /* fall through to manual method */ }

      // Method 2: Direct DOM manipulation fallback
      // Split text into paragraphs for multi-line content
      const lines = text.split("\n").filter(l => l.length > 0);
      if (lines.length > 1) {
        editableDiv.innerHTML = lines.map(line => `<p>${escapeHTML(line)}</p>`).join("");
      } else {
        const p = editableDiv.querySelector("p");
        if (p) {
          p.innerHTML = escapeHTML(text);
        } else {
          editableDiv.innerHTML = `<p>${escapeHTML(text)}</p>`;
        }
      }

      // Dispatch events so LinkedIn registers the change
      editableDiv.dispatchEvent(new Event("input", { bubbles: true }));
      editableDiv.dispatchEvent(new Event("change", { bubbles: true }));
      editableDiv.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
      editableDiv.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));

      // Remove placeholder class if present
      if (editableDiv.classList.contains("ql-blank")) {
        editableDiv.classList.remove("ql-blank");
      }
    }

    // Textarea / input fallback
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(target, text);
      } else {
        target.value = text;
      }
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /**
   * Track all bot buttons for cleanup.
   */
  const allBotEntries = [];
  const injectedElements = new WeakSet();

  /** Suggestion cache — avoids redundant API calls for same context */
  const suggestionCache = new Map();

  function makeCacheKey(inputType, contextText) {
    // Simple hash: type + first 300 chars of context (enough to distinguish)
    return inputType + "::" + (contextText || "").slice(0, 300).trim();
  }

  /** Close all open modals */
  function closeAllDropdowns() {
    document.querySelectorAll(".lai-modal-overlay").forEach(d => {
      d.style.display = "none";
    });
  }

  /**
   * Inject a bot button next to an input area.
   * Placed inline inside the toolbar (next to emoji/image buttons).
   */
  function injectBot(anchor) {
    if (anchor.dataset.laiBotDone) return;
    // Also check if any parent or child already has a bot
    if (injectedElements.has(anchor)) return;
    const existing = anchor.querySelector(".lai-inline-bot-btn");
    if (existing) return;
    // Check if a parent already has one
    const parentWithBot = anchor.closest("[data-lai-bot-done='true']");
    if (parentWithBot) return;

    anchor.dataset.laiBotDone = "true";
    injectedElements.add(anchor);

    const inputType = detectInputType(anchor);

    const botBtn = document.createElement("button");
    botBtn.className = "lai-inline-bot-btn";
    botBtn.innerHTML = "🤖";
    botBtn.title = inputType === "post-modal" ? "AI Post Writer"
      : inputType === "chat" ? "AI Reply Suggestion"
      : inputType === "reply" ? "AI Reply to Comment"
      : inputType === "connection" ? "AI Connection Note"
      : "AI Comment Suggestion";

    // Modal overlay appended to body
    const dropdown = document.createElement("div");
    dropdown.className = "lai-modal-overlay";
    dropdown.style.display = "none";
    document.body.appendChild(dropdown);

    // Track the last generated post for modification flow (post-modal only)
    let lastGeneratedPost = null;

    // Conversation memory: tracks user prompts + bot responses in current modal session
    // This allows the AI to understand corrections like "no need mention game jams"
    let conversationMemory = [];

    // Cached chat data: stores the scrolled + merged chat history for this modal session
    let _cachedChatData = null;

    // Find the toolbar/action bar to insert the bot button inline
    function findToolbar() {
      // For connection note modal, place bot in the modal footer (near Cancel/Send)
      if (inputType === "connection") {
        const dialog = anchor.closest("[role='dialog']") || anchor.closest(".artdeco-modal");
        if (dialog) {
          const footer = dialog.querySelector(".artdeco-modal__actionbar")
            || dialog.querySelector("[class*='artdeco-modal__actionbar']")
            || dialog.querySelector("footer")
            || dialog.querySelector("[class*='modal__action']")
            || dialog.querySelector(".ml-auto");
          if (footer) return footer;
          // Fallback: find the div that contains Cancel/Send buttons
          const sendBtn = dialog.querySelector("button[aria-label*='Send']") || dialog.querySelector("button:last-child");
          if (sendBtn && sendBtn.parentElement) return sendBtn.parentElement;
        }
        return anchor.parentElement;
      }

      // For comment/reply boxes, look for the toolbar with emoji/image buttons
      const form = anchor.closest(".comments-comment-box")
        || anchor.closest(".comments-comment-texteditor")
        || anchor.closest("[class*='comments-comment-box']")
        || anchor.closest("[class*='comments-comment-texteditor']")
        || anchor.closest(".reply-comment-box")
        || anchor.closest("[class*='comments-reply']")
        || anchor.closest(".msg-form")
        || anchor.closest("[class*='msg-form']")
        || anchor.closest(".msg-overlay-conversation-bubble")
        || anchor.closest("[class*='msg-overlay']")
        || anchor.closest("[class*='msg-thread']")
        || anchor.closest("[class*='msg-convo']")
        || anchor.closest("[class*='messaging']")
        || anchor.closest("[class*='share-creation']")
        || anchor.closest("[role='dialog']")
        || anchor.closest("[class*='editor']")
        || anchor.parentElement;

      if (!form) return null;

      // Look for the action bar (contains emoji/image buttons)
      const toolbar = form.querySelector(".comments-comment-box__controls")
        || form.querySelector(".comments-comment-box-comment__controls")
        || form.querySelector("[class*='comment-box__controls']")
        || form.querySelector("[class*='comment-box-comment__controls']")
        || form.querySelector(".msg-form__footer")
        || form.querySelector(".msg-form__left-actions")
        || form.querySelector("[class*='msg-form__footer']")
        || form.querySelector("[class*='msg-form__left']")
        || form.querySelector("[class*='msg-form__right']")
        || form.querySelector("[class*='msg-form__content-container']")
        || form.querySelector(".share-creation-state__footer")
        || form.querySelector("[class*='share-actions']")
        || form.querySelector("[class*='editor-toolbar']")
        || form.querySelector("[class*='toolbar']");

      return toolbar || form;
    }

    const toolbar = findToolbar();
    // Don't inject if this toolbar already has a bot button
    if (toolbar && toolbar.querySelector(".lai-inline-bot-btn")) return;

    if (toolbar) {
      // For messaging, insert bot button next to the right-side controls
      // instead of blindly appending (which disrupts Send button alignment)
      if (inputType === "chat") {
        const form = anchor.closest(".msg-form")
          || anchor.closest("[class*='msg-form']")
          || anchor.closest(".msg-overlay-conversation-bubble")
          || anchor.closest("[class*='msg-overlay']");
        if (form) {
          // Place bot button right before the Send button
          const sendBtn = form.querySelector(".msg-form__send-button")
            || form.querySelector("button[aria-label*='Send' i]")
            || form.querySelector("button[type='submit']");

          if (sendBtn) {
            sendBtn.parentElement.insertBefore(botBtn, sendBtn);
          } else {
            // Fallback: append to footer or toolbar
            const footer = form.querySelector(".msg-form__footer")
              || form.querySelector("[class*='msg-form__footer']");
            if (footer) {
              footer.appendChild(botBtn);
            } else {
              toolbar.appendChild(botBtn);
            }
          }
        } else {
          toolbar.appendChild(botBtn);
        }
      } else if (inputType === "comment" || inputType === "reply") {
        // For comment/reply, place bot next to emoji/image buttons inside the controls bar
        const commentForm = anchor.closest(".comments-comment-box")
          || anchor.closest(".comments-comment-texteditor")
          || anchor.closest("[class*='comments-comment-box']")
          || anchor.closest("[class*='comments-comment-texteditor']")
          || anchor.closest("[class*='comments-reply']")
          || anchor.closest(".reply-comment-box")
          || anchor;

        // Try to find the controls bar by multiple selectors
        let controlsBar = commentForm.querySelector(".comments-comment-box__controls")
          || commentForm.querySelector(".comments-comment-box-comment__controls")
          || commentForm.querySelector("[class*='comment-box__controls']")
          || commentForm.querySelector("[class*='comment-box-comment__controls']");

        // If no controls bar found, look for the row containing emoji/image buttons
        if (!controlsBar) {
          const emojiBtn = commentForm.querySelector("button[aria-label*='emoji' i]")
            || commentForm.querySelector("button[aria-label*='Open Emoji' i]")
            || commentForm.querySelector("button[aria-label*='smiley' i]")
            || commentForm.querySelector(".comments-comment-box__detour-icons button")
            || commentForm.querySelector("[class*='detour-icons'] button");
          if (emojiBtn) {
            controlsBar = emojiBtn.parentElement;
          }
        }

        // Also try: find the form-actions container or any div with buttons next to editor
        if (!controlsBar) {
          controlsBar = commentForm.querySelector("[class*='form-actions']")
            || commentForm.querySelector("[class*='detour-icons']")
            || commentForm.querySelector("[class*='form__actions']");
        }

        if (controlsBar) {
          // Find the image/media button and insert bot after it (rightmost position)
          const imageBtn = commentForm.querySelector("button[aria-label*='image' i]")
            || commentForm.querySelector("button[aria-label*='photo' i]")
            || commentForm.querySelector("button[aria-label*='media' i]")
            || commentForm.querySelector("button[aria-label*='Add a photo' i]");
          if (imageBtn && imageBtn.nextSibling) {
            imageBtn.parentElement.insertBefore(botBtn, imageBtn.nextSibling);
          } else if (imageBtn) {
            imageBtn.parentElement.appendChild(botBtn);
          } else {
            controlsBar.appendChild(botBtn);
          }
        } else {
          // Last resort: find emoji/image button anywhere near the anchor
          const nearbyEmoji = toolbar.querySelector("button[aria-label*='emoji' i]")
            || toolbar.querySelector("button[aria-label*='Open Emoji' i]");
          if (nearbyEmoji && nearbyEmoji.parentElement) {
            nearbyEmoji.parentElement.appendChild(botBtn);
          } else {
            toolbar.appendChild(botBtn);
          }
        }
      } else if (inputType === "post-modal") {
        // For post creation modal, place bot near the Post button footer
        const dialog = anchor.closest("[role='dialog']") || anchor.closest(".artdeco-modal");
        if (dialog) {
          // Prevent duplicate: if dialog already has a bot, skip
          if (dialog.querySelector(".lai-inline-bot-btn")) return;

          // Try to find the footer area with the Post button
          const postBtn = dialog.querySelector("button.share-actions__primary-action")
            || dialog.querySelector("button[class*='share-actions__primary']")
            || dialog.querySelector("button[aria-label*='Post' i]");
          const footer = dialog.querySelector(".share-creation-state__footer")
            || dialog.querySelector("[class*='share-actions']")
            || dialog.querySelector(".share-creation-state__action-bar")
            || dialog.querySelector("[class*='action-bar']")
            || (postBtn && postBtn.parentElement);
          if (footer) {
            if (postBtn) {
              postBtn.parentElement.insertBefore(botBtn, postBtn);
            } else {
              footer.appendChild(botBtn);
            }
          } else {
            // Fallback: put near the bottom toolbar (emoji/image row)
            const emojiBtn = dialog.querySelector("button[aria-label*='emoji' i]")
              || dialog.querySelector("button[aria-label*='Open Emoji' i]");
            if (emojiBtn && emojiBtn.parentElement) {
              emojiBtn.parentElement.appendChild(botBtn);
            } else {
              toolbar.appendChild(botBtn);
            }
          }
        } else {
          toolbar.appendChild(botBtn);
        }
      } else {
        toolbar.appendChild(botBtn);
      }
      // Force overflow visible on bot button's ancestors
      const btnParent = botBtn.parentElement;
      if (btnParent) {
        btnParent.style.setProperty("overflow", "visible", "important");
        // For comment/reply, also fix clipping on higher ancestors
        if (inputType === "comment" || inputType === "reply") {
          let el = btnParent;
          for (let i = 0; i < 5; i++) {
            if (!el || el === document.body) break;
            el.style.setProperty("overflow", "visible", "important");
            el = el.parentElement;
          }
        }
      }
    } else {
      anchor.parentElement.appendChild(botBtn);
    }

    // Track this entry
    allBotEntries.push({ botBtn, anchor });

    // Click handler — opens the center-aligned modal
    botBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Toggle — if this modal is already open, close it
      if (dropdown.style.display !== "none" && dropdown.style.display !== "") {
        dropdown.style.display = "none";
        restoreLinkedInDialog();
        return;
      }

      // Close all other modals first
      closeAllDropdowns();

      // Reset post tracking for fresh modal session
      if (inputType === "post-modal") lastGeneratedPost = null;

      // Reset conversation memory for fresh session
      conversationMemory = [];

      // For DM chats: scroll to load full history + merge with stored data BEFORE modal renders
      _cachedChatData = null;
      if (inputType === "chat") {
        const chatBubble = anchor.closest(".msg-overlay-conversation-bubble")
          || anchor.closest(".msg-convo-wrapper")
          || anchor.closest("[class*='msg-overlay-conversation']")
          || anchor.closest(".msg-conversations-container")
          || anchor.closest("[class*='messaging']")
          || document.querySelector(".msg-overlay-conversation-bubble")
          || document.querySelector("[class*='messaging']");
        await scrollToLoadFullChatHistory(chatBubble);

        // Scrape chat after scrolling
        const chat = getChatContextFromBubble(anchor);

        // Merge with previously stored conversation history
        let mergedMessages = chat.structuredMessages || [];
        try {
          const storedConvo = await Storage.getConversation(chat.contactName);
          if (storedConvo && storedConvo.messages && storedConvo.messages.length > 0) {
            const existingTexts = new Set(mergedMessages.map(m => m.text.trim().toLowerCase()));
            const olderMessages = storedConvo.messages.filter(m =>
              !existingTexts.has((m.text || "").trim().toLowerCase())
            );
            if (olderMessages.length > 0) {
              mergedMessages = [...olderMessages, ...mergedMessages];
            }
          }
        } catch (_) {}

        // Save merged conversation back to storage
        Storage.saveConversation({
          contactName: chat.contactName,
          messages: mergedMessages,
          lastSenderIsMe: chat.lastSenderIsMe,
        }).catch(() => {});
        if (chat.contactHeadline) {
          Storage.saveContact({ name: chat.contactName, headline: chat.contactHeadline }).catch(() => {});
        }

        // Cache for use by captureFullContext and generateAndRender
        _cachedChatData = {
          contactName: chat.contactName,
          contactHeadline: chat.contactHeadline,
          chatHistory: chat.chatHistory,
          lastSenderIsMe: chat.lastSenderIsMe,
          structuredMessages: mergedMessages,
          messageDates: chat.messageDates,
        };
      }

      // Build fresh modal every time (captures latest context)
      setupModalStructure(_cachedChatData);
      dropdown.style.display = "flex";

      // Scroll left panel chat history to bottom only for DMs
      if (inputType === "chat") {
        const ctxScroll = dropdown.querySelector(".lai-ctx-scroll");
        if (ctxScroll) ctxScroll.scrollTop = ctxScroll.scrollHeight;
      }

      // Auto-generate first bot message (skip for post-modal — wait for user prompt)
      const sugArea = dropdown.querySelector(".lai-suggestions-area");
      if (sugArea) {
        sugArea.innerHTML = "";
        if (inputType === "post-modal") {
          // Show waiting message — user must type a topic first
          const waitMsg = document.createElement("div");
          waitMsg.className = "lai-chat-bubble lai-chat-bubble--bot";
          waitMsg.innerHTML = `<div class="lai-chat-bubble-label">${ICO.sparkle} Assistant</div><div class="lai-chat-bubble-text">Tell me what you want to post about, and I'll write a professional LinkedIn post for you. You can refine it afterwards.</div>`;
          sugArea.appendChild(waitMsg);
          // Focus the input so user can start typing immediately
          const regenInput = dropdown.querySelector(".lai-regen-input");
          if (regenInput) {
            regenInput.placeholder = "Describe your post topic or idea\u2026";
            setTimeout(() => regenInput.focus(), 100);
          }
        } else {
          appendLoading(sugArea);
          await generateAndRender(null, false);
        }
      }
    });

    /** Get contextual header text with interaction label */
    function getHeaderText() {
      if (inputType === "post-modal") return `${ICO.edit} Generate Post:`;
      if (inputType === "chat") {
        const chat = getChatContextFromBubble(anchor);
        return chat.lastSenderIsMe
          ? `${ICO.chat} Reply to DM · Follow up with ${escapeHTML(chat.contactName)}:`
          : `${ICO.chat} Reply to DM · ${escapeHTML(chat.contactName)}:`;
      }
      if (inputType === "reply") {
        const depth = detectReplyDepth(anchor);
        if (depth === "child-reply") return `${ICO.reply} Reply to Child Comment:`;
        return `${ICO.chat} Reply to Post Comment:`;
      }
      if (inputType === "connection") {
        const profile = getProfileInfoForConnection();
        return `${ICO.link} Connection Note · ${escapeHTML(profile.firstName)}:`;
      }
      return `${ICO.chat} Comment on Post:`;
    }

    /** Get interaction type badge info */
    function getTypeInfo() {
      if (inputType === "chat") return { label: "DM", cls: "lai-badge-dm" };
      if (inputType === "reply") {
        const depth = detectReplyDepth(anchor);
        return depth === "child-reply"
          ? { label: "Child Reply", cls: "lai-badge-child" }
          : { label: "Comment Reply", cls: "lai-badge-reply" };
      }
      if (inputType === "connection") return { label: "Connection", cls: "lai-badge-connection" };
      if (inputType === "post-modal") return { label: "Post", cls: "lai-badge-post" };
      return { label: "Comment", cls: "lai-badge-comment" };
    }

    /** Capture the full context around this bot button for the left panel display */
    function captureFullContext(cachedChatData) {
      const sections = [];

      // Always show user's own profile at the top
      if (CONFIG.USER_NAME) {
        sections.push({
          icon: ICO.user, title: "Your Profile", type: "user-profile",
          name: CONFIG.USER_NAME,
          role: CONFIG.USER_ROLE || "",
          company: CONFIG.COMPANY_NAME || "",
          services: CONFIG.COMPANY_SERVICES || "",
        });
      }

      if (inputType === "comment" || inputType === "reply") {
        const post = getPostTextForCommentBox(anchor);
        if (post.text) {
          sections.push({ icon: ICO.ctx, title: `Post by ${post.author}`, type: "text", content: post.text });
        }

        if (inputType === "reply") {
          const parent = getParentCommentContext(anchor);
          if (parent) {
            sections.push({ icon: ICO.chat, title: `Parent Comment by ${parent.author}`, type: "text", content: parent.text, isReplyTarget: true });
          }
        }

        // Gather all visible comments on the post
        const postContainer = anchor.closest(".feed-shared-update-v2")
          || anchor.closest("[data-urn*='activity']")
          || anchor.closest(".occludable-update")
          || anchor.closest("article");
        if (postContainer) {
          const allComments = [];
          const commentEls = postContainer.querySelectorAll(
            ".comments-comment-item, .comments-comment-entity"
          );
          commentEls.forEach((c) => {
            const textEl = c.querySelector(".update-components-text")
              || c.querySelector("span[dir='ltr']")
              || c.querySelector(".feed-shared-inline-show-more-text");
            const authEl = c.querySelector("[class*='comments-post-meta'] span[aria-hidden='true']")
              || c.querySelector(".comments-post-meta__name-text");
            if (textEl && textEl.innerText.trim().length > 2) {
              allComments.push({
                author: authEl ? authEl.innerText.trim() : "Someone",
                text: textEl.innerText.trim().slice(0, 300),
              });
            }
          });
          if (allComments.length > 0) {
            sections.push({ icon: ICO.comments, title: `Comments (${allComments.length})`, type: "comments", items: allComments });
          }
        }

      } else if (inputType === "chat") {
        // Use pre-loaded & merged chat data if available, otherwise scrape fresh
        const chat = cachedChatData || getChatContextFromBubble(anchor);
        sections.push({
          icon: ICO.user, title: `Conversation with ${chat.contactName}`,
          type: "chat", messages: chat.structuredMessages || [],
          dates: chat.messageDates || [], contactName: chat.contactName,
        });

      } else if (inputType === "connection") {
        const profile = getProfileInfoForConnection();
        sections.push({
          icon: ICO.user, title: profile.name,
          type: "profile", headline: profile.headline, about: profile.about,
        });

      } else if (inputType === "post-modal") {
        sections.push({ icon: ICO.edit, title: "New Post", type: "text", content: "Write your post idea in the prompt area →" });
      }

      return sections;
    }

    /** Render context sections into HTML for the left panel */
    function renderContextHTML(sections) {
      const canTrans = AI.canTranslate();
      const transLang = canTrans ? AI.getTranslationLanguage() : "";
      let html = "";
      sections.forEach((s) => {
        const replyTargetAttr = s.isReplyTarget ? ' data-reply-target="true"' : '';
        html += `<div class="lai-ctx-section"${replyTargetAttr}>`;
        html += `<div class="lai-ctx-label"><span class="lai-ctx-icon">${s.icon}</span> ${escapeHTML(s.title)}</div>`;
        html += `<div class="lai-ctx-body">`;

        if (s.type === "text") {
          const lines = (s.content || "").split("\n").filter(l => l.trim());
          html += `<div class="lai-ctx-text-content">`;
          lines.forEach(l => { html += `<p>${escapeHTML(l)}</p>`; });
          html += `</div>`;
          if (canTrans && s.content && s.content.trim()) {
            html += `<div class="lai-ctx-translate-wrap"><button class="lai-ctx-translate-btn" data-translate-text="${escapeHTML(s.content)}" title="Translate to ${transLang}">Translate to ${escapeHTML(transLang)}</button><div class="lai-ctx-translated-text" style="display:none"></div></div>`;
          }

        } else if (s.type === "comments") {
          s.items.forEach((c) => {
            html += `<div class="lai-ctx-comment"><div class="lai-ctx-comment-author">${escapeHTML(c.author)}</div><div class="lai-ctx-comment-text">${escapeHTML(c.text)}</div>`;
            if (canTrans) {
              html += `<div class="lai-ctx-translate-wrap"><button class="lai-ctx-translate-btn" data-translate-text="${escapeHTML(c.text)}" title="Translate to ${transLang}">Translate</button><div class="lai-ctx-translated-text" style="display:none"></div></div>`;
            }
            html += `</div>`;
          });

        } else if (s.type === "chat") {
          if (s.dates && s.dates.length > 0) {
            html += `<div class="lai-ctx-date-wrap"><span class="lai-ctx-date">${ICO.calendar} ${escapeHTML(s.dates.slice(0, 3).join(", "))}</span></div>`;
          }
          const contactLower = (s.contactName || "").toLowerCase();
          const contactFirst = contactLower.split(" ")[0];
          s.messages.forEach((msg) => {
            const senderLower = (msg.sender || "").toLowerCase();
            const isContact = senderLower.startsWith(contactFirst) || senderLower === contactLower;
            const cls = isContact ? "lai-ctx-msg--other" : "lai-ctx-msg--me";
            html += `<div class="lai-ctx-msg ${cls}"><div class="lai-ctx-msg-sender">${escapeHTML(msg.sender)}</div><div class="lai-ctx-msg-text">${escapeHTML(msg.text)}</div>`;
            if (canTrans) {
              html += `<div class="lai-ctx-translate-wrap"><button class="lai-ctx-translate-btn" data-translate-text="${escapeHTML(msg.text)}" title="Translate to ${transLang}">Translate</button><div class="lai-ctx-translated-text" style="display:none"></div></div>`;
            }
            html += `</div>`;
          });
          if (s.messages.length === 0) {
            html += `<p style="color:#999;font-style:italic;">No messages captured yet.</p>`;
          }

        } else if (s.type === "user-profile") {
          html += `<div class="lai-user-card">`;
          html += `<div class="lai-user-card-name">${escapeHTML(s.name)}</div>`;
          if (s.role) html += `<div class="lai-user-card-role">${escapeHTML(s.role)}</div>`;
          if (s.company) html += `<div class="lai-user-card-company">${escapeHTML(s.company)}</div>`;
          if (s.services) html += `<div class="lai-user-card-services">${escapeHTML(s.services)}</div>`;
          html += `</div>`;

        } else if (s.type === "profile") {
          html += `<div class="lai-ctx-profile-name">${escapeHTML(s.title)}</div>`;
          if (s.headline) html += `<div class="lai-ctx-profile-hl">${escapeHTML(s.headline)}</div>`;
          if (s.about) {
            html += `<p>${escapeHTML(s.about)}</p>`;
            if (canTrans) {
              html += `<div class="lai-ctx-translate-wrap"><button class="lai-ctx-translate-btn" data-translate-text="${escapeHTML(s.about)}" title="Translate to ${transLang}">Translate to ${escapeHTML(transLang)}</button><div class="lai-ctx-translated-text" style="display:none"></div></div>`;
            }
          }
        }

        html += `</div></div>`;
      });
      return html || `<div style="padding:20px;color:#999;text-align:center;">No context available</div>`;
    }

    /** Set up the modal with split-panel layout: left=context, right=suggestions */
    function setupModalStructure(cachedChatData) {
      const headerText = getHeaderText();
      const typeInfo = getTypeInfo();
      const needsContext = (inputType === "comment" || inputType === "reply" || inputType === "chat");
      const contextSections = needsContext ? captureFullContext(cachedChatData) : [];
      const contextHTML = needsContext ? renderContextHTML(contextSections) : "";

      const contextPanelHTML = needsContext ? `
            <div class="lai-modal-context">
              <div class="lai-ctx-panel-title">${ICO.ctx} Captured Context</div>
              <div class="lai-ctx-scroll">${contextHTML}</div>
            </div>` : "";

      dropdown.innerHTML = `
        <div class="lai-modal${needsContext ? ' lai-modal--wide' : ''}">
          <div class="lai-modal-header">
            <div class="lai-header-left">
              <span class="lai-type-badge ${typeInfo.cls}">${escapeHTML(typeInfo.label)}</span>
              <span class="lai-header-title">${headerText}</span>
            </div>
            <div class="lai-header-actions">
              <button class="lai-inline-refresh" title="Regenerate" style="display:none">${ICO.refresh}</button>
              <button class="lai-inline-close" title="Close">${ICO.close}</button>
            </div>
          </div>
          <div class="lai-modal-body">${contextPanelHTML}
            <div class="lai-modal-suggestions">
              <div class="lai-sug-panel-title">${ICO.chat} Conversation</div>
              <div class="lai-suggestions-area"></div>
              <div class="lai-chat-input-bar">
                <textarea class="lai-regen-input" placeholder="Tell me what to say\u2026 (Shift+Enter for new line)" rows="2" style="min-height:36px!important;height:auto!important;font-size:14px!important;padding:8px 14px!important;color:#1d2226!important;opacity:1!important;visibility:visible!important;display:block!important;position:relative!important;z-index:2147483647!important;pointer-events:auto!important;cursor:text!important;"></textarea>
                <button class="lai-regen-btn" title="Send">${ICO.send}</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Close on overlay background click (not modal content) — only add once
      if (!dropdown._laiOverlayWired) {
        dropdown._laiOverlayWired = true;
        dropdown.addEventListener("click", (ev) => {
          if (ev.target === dropdown) {
            dropdown.style.display = "none";
            restoreLinkedInDialog();
          }
        });
      }

      // Block LinkedIn from intercepting events — bubble phase on modal
      const modalDivEl = dropdown.querySelector(".lai-modal");
      if (modalDivEl) {
        // Bubble phase: stop events from reaching LinkedIn's handlers above us
        ["mouseup", "pointerup", "click", "focus", "focusin", "keydown", "keyup", "keypress", "input"].forEach((evtName) => {
          modalDivEl.addEventListener(evtName, (ev) => {
            ev.stopPropagation();
          });
        });

        // Prevent focus from escaping to LinkedIn when clicking non-interactive areas
        modalDivEl.addEventListener("mousedown", (ev) => {
          ev.stopPropagation();
          const tag = ev.target.tagName;
          const isInteractive = tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || tag === "SELECT" || ev.target.closest("button");
          if (!isInteractive) {
            ev.preventDefault();
          }
        });
        modalDivEl.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          const tag = ev.target.tagName;
          const isInteractive = tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || tag === "SELECT" || ev.target.closest("button");
          if (!isInteractive) {
            ev.preventDefault();
          }
        });
      }

      // Prevent focus escape on the overlay itself
      dropdown.addEventListener("mousedown", (ev) => {
        if (ev.target === dropdown) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      });

      // Wire close button
      const closeBtn = dropdown.querySelector(".lai-inline-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          dropdown.style.display = "none";
          restoreLinkedInDialog();
        });
      }

      // Left panel: scroll to reply target & wire translate buttons (if context panel exists)
      if (needsContext) {
        const replyTarget = dropdown.querySelector('[data-reply-target="true"]');
        if (replyTarget) {
          const scrollContainer = dropdown.querySelector('.lai-ctx-scroll');
          if (scrollContainer) {
            setTimeout(() => {
              replyTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
              replyTarget.style.background = '#e8f0fa';
              replyTarget.style.borderRadius = '8px';
              replyTarget.style.padding = '6px 8px';
              replyTarget.style.borderLeft = '3px solid var(--lai-primary)';
              replyTarget.style.transition = 'background .3s';
            }, 200);
          }
        }

        dropdown.querySelectorAll(".lai-ctx-translate-btn").forEach(btn => {
          btn.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const wrap = btn.closest(".lai-ctx-translate-wrap");
            const resultDiv = wrap.querySelector(".lai-ctx-translated-text");
            if (resultDiv.style.display === "block") {
              resultDiv.style.display = "none";
              btn.textContent = btn.getAttribute("title");
              return;
            }
            if (resultDiv.dataset.done) {
              resultDiv.style.display = "block";
              btn.textContent = "Hide translation";
              return;
            }
            const origText = btn.dataset.translateText;
            btn.textContent = "Translating...";
            btn.disabled = true;
            try {
              const translated = await AI.translateText(origText);
              resultDiv.textContent = translated || "(no translation)";
              resultDiv.dataset.done = "1";
              resultDiv.style.display = "block";
              btn.textContent = "Hide translation";
            } catch (err) {
              resultDiv.textContent = "Translation failed.";
              resultDiv.style.display = "block";
              btn.textContent = btn.getAttribute("title");
            }
            btn.disabled = false;
          });
        });
      }

      // Wire refresh button
      const refreshBtn = dropdown.querySelector(".lai-inline-refresh");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          for (const key of suggestionCache.keys()) {
            if (key.startsWith(inputType)) suggestionCache.delete(key);
          }
          const sugArea = dropdown.querySelector(".lai-suggestions-area");
          sugArea.innerHTML = "";
          appendLoading(sugArea);
          await generateAndRender(undefined, true);
        });
      }

      // Wire send button
      const regenInput = dropdown.querySelector(".lai-regen-input");
      const regenBtn = dropdown.querySelector(".lai-regen-btn");

      async function sendPrompt() {
        const userPrompt = regenInput.value.trim();
        if (!userPrompt) return;
        const sugArea = dropdown.querySelector(".lai-suggestions-area");
        appendUserBubble(sugArea, userPrompt);
        appendLoading(sugArea);
        regenInput.value = "";
        regenInput.style.height = "auto";

        // Record user prompt in conversation memory for multi-turn context
        conversationMemory.push({ role: "user", text: userPrompt });
        await generateAndRender(userPrompt, true);
      }

      regenBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await sendPrompt();
      });

      regenInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          sendPrompt();
        }
        ev.stopPropagation();
      });
      // Auto-resize textarea as user types
      regenInput.addEventListener("input", () => {
        regenInput.style.height = "auto";
        regenInput.style.height = Math.min(regenInput.scrollHeight, 80) + "px";
      });
      regenInput.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // Force focus in case LinkedIn stole it
        regenInput.focus();
      });

      // Explicitly handle mousedown on textarea to guarantee focus
      regenInput.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        // Let the default happen (places cursor) then force focus
        setTimeout(() => regenInput.focus(), 0);
      });

      regenInput.addEventListener("focus", (ev) => ev.stopPropagation());
      regenInput.addEventListener("focusin", (ev) => ev.stopPropagation());

      // Block LinkedIn from stealing key events while typing
      ["keydown", "keyup", "keypress", "input"].forEach((evtName) => {
        regenInput.addEventListener(evtName, (ev) => {
          ev.stopPropagation();
        }, true);
      });

      // For post-modal and connection: neutralize LinkedIn's dialog focus trap
      // The native `inert` attribute disables all interactivity + focus trapping
      if (inputType === "post-modal" || inputType === "connection") {
        const linkedInDialog = anchor.closest("[role='dialog']") || anchor.closest(".artdeco-modal");
        if (linkedInDialog) {
          linkedInDialog.setAttribute("data-lai-inert", "true");
          linkedInDialog.inert = true;
        }
      }

      // Ensure textarea is interactive (LinkedIn CSS may override)
      regenInput.style.setProperty("pointer-events", "auto", "important");
      regenInput.style.setProperty("user-select", "text", "important");
      regenInput.style.setProperty("-webkit-user-select", "text", "important");
      regenInput.setAttribute("tabindex", "0");
    }

    /** Restore LinkedIn dialog when our modal closes */
    function restoreLinkedInDialog() {
      if (inputType === "post-modal" || inputType === "connection") {
        const linkedInDialog = document.querySelector("[data-lai-inert='true']");
        if (linkedInDialog) {
          linkedInDialog.removeAttribute("data-lai-inert");
          linkedInDialog.inert = false;
        }
      }
    }

    /** Append a user chat bubble to the conversation area */
    function appendUserBubble(sugArea, text) {
      const bubble = document.createElement("div");
      bubble.className = "lai-chat-bubble lai-chat-bubble--user";
      bubble.innerHTML = `<div class="lai-chat-bubble-label">You <span class="lai-edit-prompt" title="Edit & resend">${ICO.edit}</span></div><div class="lai-chat-bubble-text">${escapeHTML(text)}</div>`;

      // Click edit icon to load text back into input for editing
      const editBtn = bubble.querySelector(".lai-edit-prompt");
      editBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const regenInput = dropdown.querySelector(".lai-regen-input");
        if (regenInput) {
          regenInput.value = text;
          regenInput.focus();
          regenInput.style.height = "auto";
          regenInput.style.height = Math.min(regenInput.scrollHeight, 80) + "px";
        }
      });

      sugArea.appendChild(bubble);
      sugArea.scrollTop = sugArea.scrollHeight;
    }

    /** Append a bot chat bubble (clickable to use the suggestion) */
    function appendBotBubble(sugArea, item) {
      const bubble = document.createElement("div");
      const isStrategic = item.label === "Strategic";
      const toneLabels = { "Friendly": "Friendly", "Curious": "Curious", "Professional": "Professional" };
      const toneText = toneLabels[item.label];
      bubble.className = `lai-chat-bubble lai-chat-bubble--bot${isStrategic ? " lai-chat-bubble--strategic" : ""}${toneText ? " lai-chat-bubble--" + toneText.toLowerCase() : ""}`;
      const labelText = isStrategic ? `${ICO.sparkle} Strategic Reply` : toneText ? `${ICO.sparkle} ${toneText}` : `${ICO.sparkle} Assistant`;

      // Build hint area: show translate button if MY_LANGUAGE is configured
      const showTranslateBtn = AI.canTranslate();
      const translateLang = AI.getTranslationLanguage();
      const hintHTML = showTranslateBtn
        ? `<div class="lai-inline-hint lai-translate-trigger" data-translated="false"><span class="lai-translate-label">${ICO.translate} Click to translate to ${escapeHTML(translateLang)}</span><span class="lai-translate-loading" style="display:none;">${ICO.translate} Translating...</span><span class="lai-translate-result" style="display:none;"></span><div class="lai-chat-use-hint lai-hint-use" style="display:none;">${ICO.cursor} Click to use this</div></div>`
        : "";

      bubble.innerHTML = `<div class="lai-chat-bubble-label">${labelText}</div><div class="lai-chat-bubble-text">${escapeHTML(item.text)}<div class="lai-chat-use-hint">${ICO.cursor} Click to use</div>${hintHTML}</div>`;

      /** Fill the chosen text into the LinkedIn input */
      function useText(textToUse) {
        dropdown.style.display = "none";
        restoreLinkedInDialog();
        anchor.click();
        anchor.focus();
        setTimeout(() => {
          let target = anchor;
          if (inputType === "connection") {
            const modal = anchor.closest("[role='dialog']") || anchor.closest(".artdeco-modal");
            if (modal) { target = modal.querySelector("textarea") || anchor; }
          } else if (inputType === "post-modal") {
            const modal = anchor.closest("[role='dialog']") || anchor.closest(".artdeco-modal");
            if (modal) { target = modal.querySelector(".ql-editor[contenteditable='true']") || modal.querySelector("[contenteditable='true']") || anchor; }
          } else {
            target = anchor.querySelector("[contenteditable='true']") || anchor.closest("[contenteditable='true']") || anchor;
          }
          fillInputArea(target, textToUse);
        }, 400);
      }

      // Click on the main text area → use English text
      bubble.addEventListener("click", (ev) => {
        if (ev.target.closest(".lai-inline-hint")) return;
        useText(item.text);
      });

      // Click-to-translate: trigger on click, show Bengali permanently once translated
      if (showTranslateBtn) {
        const hintEl = bubble.querySelector(".lai-translate-trigger");
        let translated = false;
        let translatedText = "";

        hintEl.addEventListener("click", async (ev) => {
          ev.stopPropagation();

          // If already translated, clicking the hint inserts the translated text
          if (translated && translatedText) {
            useText(translatedText);
            return;
          }

          // Prevent duplicate calls while loading
          if (hintEl.dataset.loading === "true") return;
          hintEl.dataset.loading = "true";

          const labelEl = hintEl.querySelector(".lai-translate-label");
          const loadingEl = hintEl.querySelector(".lai-translate-loading");
          const resultEl = hintEl.querySelector(".lai-translate-result");
          const useHintEl = hintEl.querySelector(".lai-hint-use");

          labelEl.style.display = "none";
          loadingEl.style.display = "";

          try {
            translatedText = await AI.translateText(item.text);
            loadingEl.style.display = "none";
            resultEl.textContent = translatedText;
            resultEl.style.display = "";
            useHintEl.style.display = "";
            hintEl.dataset.translated = "true";
            translated = true;
          } catch (err) {
            loadingEl.style.display = "none";
            labelEl.style.display = "";
            labelEl.textContent = "Translation failed — click to retry";
            hintEl.dataset.loading = "false";
          }
        });
      }

      sugArea.appendChild(bubble);
      sugArea.scrollTop = sugArea.scrollHeight;
    }

    /** Append loading indicator to conversation area */
    function appendLoading(sugArea) {
      const loader = document.createElement("div");
      loader.className = "lai-inline-loading";
      loader.innerHTML = `<div class="lai-spinner"></div><span>Generating\u2026</span>`;
      sugArea.appendChild(loader);
      sugArea.scrollTop = sugArea.scrollHeight;
    }

    /** Remove loading indicator from conversation area */
    function removeLoading(sugArea) {
      const loader = sugArea.querySelector(".lai-inline-loading");
      if (loader) loader.remove();
    }

    /** Generate suggestions and render them in the suggestions area.
     *  forceRefresh=true bypasses cache (used by Regenerate button). */
    async function generateAndRender(customPrompt, forceRefresh) {
      try {
        let items = [];
        let headerText = "";
        let cacheKey = "";
        let contextText = "";

        // Build context & cache key per input type
        if (inputType === "connection") {
          const profile = getProfileInfoForConnection();
          headerText = `${ICO.link} Connection Note · ${escapeHTML(profile.firstName)}:`;
          contextText = profile.name + profile.headline;
          cacheKey = makeCacheKey("connection", contextText + (customPrompt || ""));

          // Store contact profile
          Storage.saveContact({
            name: profile.name,
            headline: profile.headline,
            about: profile.about,
          }).catch(() => {});
        } else if (inputType === "post-modal") {
          headerText = `${ICO.edit} Generate Post:`;
          contextText = customPrompt || "";
          cacheKey = makeCacheKey("post", contextText);
        } else if (inputType === "chat") {
          // Use cached chat data from modal open, or re-scrape if refreshing
          let chat;
          if (_cachedChatData && !forceRefresh) {
            chat = _cachedChatData;
          } else {
            // Re-scrape fresh (e.g., user clicked refresh)
            const chatBubble = anchor.closest(".msg-overlay-conversation-bubble")
              || anchor.closest(".msg-convo-wrapper")
              || anchor.closest("[class*='msg-overlay-conversation']")
              || anchor.closest(".msg-conversations-container")
              || anchor.closest("[class*='messaging']")
              || document.querySelector(".msg-overlay-conversation-bubble")
              || document.querySelector("[class*='messaging']");
            await scrollToLoadFullChatHistory(chatBubble);
            const freshChat = getChatContextFromBubble(anchor);

            // Merge with stored history
            let mergedMessages = freshChat.structuredMessages || [];
            try {
              const storedConvo = await Storage.getConversation(freshChat.contactName);
              if (storedConvo && storedConvo.messages && storedConvo.messages.length > 0) {
                const existingTexts = new Set(mergedMessages.map(m => m.text.trim().toLowerCase()));
                const olderMessages = storedConvo.messages.filter(m =>
                  !existingTexts.has((m.text || "").trim().toLowerCase())
                );
                if (olderMessages.length > 0) {
                  mergedMessages = [...olderMessages, ...mergedMessages];
                }
              }
            } catch (_) {}

            chat = {
              contactName: freshChat.contactName,
              contactHeadline: freshChat.contactHeadline,
              chatHistory: freshChat.chatHistory,
              lastSenderIsMe: freshChat.lastSenderIsMe,
              structuredMessages: mergedMessages,
              messageDates: freshChat.messageDates,
            };
            // Update cached data and storage
            _cachedChatData = chat;
            Storage.saveConversation({
              contactName: chat.contactName,
              messages: mergedMessages,
              lastSenderIsMe: chat.lastSenderIsMe,
            }).catch(() => {});
            if (chat.contactHeadline) {
              Storage.saveContact({ name: chat.contactName, headline: chat.contactHeadline }).catch(() => {});
            }
          }

          headerText = chat.lastSenderIsMe
            ? `${ICO.chat} Reply to DM · Follow up with ${escapeHTML(chat.contactName)}:`
            : `${ICO.chat} Reply to DM · ${escapeHTML(chat.contactName)}:`;

          // Build full chat history string from merged messages
          const contactLower = (chat.contactName || "").toLowerCase();
          const contactFirst = contactLower.split(" ")[0];
          let myNameInChat = "";
          for (const m of (chat.structuredMessages || [])) {
            const senderLower = (m.sender || "").toLowerCase();
            if (!senderLower.startsWith(contactFirst) && senderLower !== contactLower && senderLower !== "unknown") {
              myNameInChat = m.sender;
              break;
            }
          }
          const mergedHistory = (chat.structuredMessages || []).map(m => {
            const isMe = myNameInChat && m.sender === myNameInChat;
            return `${isMe ? "You" : m.sender}: ${m.text}`;
          }).join("\n");

          contextText = mergedHistory || chat.chatHistory || "";
          cacheKey = makeCacheKey("chat", contextText + (customPrompt || ""));
        } else if (inputType === "reply") {
          const parentComment = getParentCommentContext(anchor);
          contextText = parentComment ? parentComment.text : "";
          cacheKey = makeCacheKey("reply", contextText + (customPrompt || ""));
        } else {
          headerText = `${ICO.chat} Comment on Post:`;
          const post = getPostTextForCommentBox(anchor);
          contextText = post.text || "";
          cacheKey = makeCacheKey("comment", contextText + (customPrompt || ""));
        }

        // Check cache (skip if forceRefresh or custom prompt)
        if (!forceRefresh && !customPrompt && suggestionCache.has(cacheKey)) {
          const cached = suggestionCache.get(cacheKey);
          items = cached.items;
          headerText = cached.headerText || headerText;
        } else {
          // Generate fresh suggestions
          if (inputType === "connection") {
            const profile = getProfileInfoForConnection();
            const msgs = await AI.generateConnectionMessages(
              profile.name, profile.headline, profile.about, customPrompt || undefined,
              conversationMemory.length > 0 ? conversationMemory : undefined
            );
            const toneLabels = ["Friendly", "Curious", "Professional"];
            items = msgs.slice(0, customPrompt ? 1 : 3).map((t, i) => ({ label: customPrompt ? "Note" : toneLabels[i] || `Note ${i + 1}`, text: typeof t === "string" ? t : t.text }));

          } else if (inputType === "post-modal") {
            let posts;
            if (lastGeneratedPost && customPrompt) {
              // User wants to modify/refine the previously generated post
              posts = await AI.generatePosts(customPrompt, lastGeneratedPost, conversationMemory.length > 0 ? conversationMemory : undefined);
            } else if (customPrompt) {
              // First prompt — generate fresh post from topic
              posts = await AI.generatePosts(customPrompt, undefined, conversationMemory.length > 0 ? conversationMemory : undefined);
            } else {
              // No prompt provided (shouldn't happen for post-modal, but fallback)
              return;
            }
            items = posts.slice(0, customPrompt && lastGeneratedPost ? 1 : 3).map((t, i) => {
              const toneLabels = ["Friendly", "Curious", "Professional"];
              return { label: (customPrompt && lastGeneratedPost) ? `Post ${i + 1}` : toneLabels[i] || `Post ${i + 1}`, text: typeof t === "string" ? t : t.text };
            });
            // Track the generated post for future modification
            if (items.length > 0) {
              lastGeneratedPost = items[0].text;
              // Update placeholder to indicate modify mode
              const regenInput = dropdown.querySelector(".lai-regen-input");
              if (regenInput) regenInput.placeholder = "Tell me how to modify this post\u2026 (e.g. make it shorter, more formal, add hashtags)";
            }

          } else if (inputType === "chat") {
            const chat = getChatContextFromBubble(anchor);
            headerText = chat.lastSenderIsMe
              ? `${ICO.chat} Reply to DM · Follow up with ${escapeHTML(chat.contactName)}:`
              : `${ICO.chat} Reply to DM · ${escapeHTML(chat.contactName)}:`;
            // Enrich with stored profile info if available
            let profileInfo = "";
            try {
              const storedContact = await Storage.getContact(chat.contactName);
              if (storedContact) {
                const parts = [];
                if (storedContact.headline) parts.push(`Role: ${storedContact.headline}`);
                if (storedContact.company) parts.push(`Company: ${storedContact.company}`);
                if (storedContact.about) parts.push(`About: ${storedContact.about}`);
                profileInfo = parts.join(" | ");
              }
            } catch (_) {}
            // Fallback: use headline scraped from chat bubble header
            if (!profileInfo && chat.contactHeadline) {
              profileInfo = `Role: ${chat.contactHeadline}`;
            }

            // Use the full merged chat history (contextText) built in the context phase above
            const fullHistory = contextText || chat.chatHistory || "";

            if (fullHistory) {
              const data = await AI.generateDMReplies(
                fullHistory,
                chat.contactName, profileInfo, chat.lastSenderIsMe, customPrompt || undefined,
                conversationMemory.length > 0 ? conversationMemory : undefined
              );
              if (customPrompt) {
                // User gave a prompt — show only 1 best reply
                const singleReply = data.reply || (data.replies && data.replies[0]) || "";
                const text = typeof singleReply === "string" ? singleReply : singleReply.text;
                if (text) items = [{ label: "Reply", text }];
              } else {
                const toneLabels = ["Friendly", "Curious", "Professional"];
                items = data.replies.slice(0, 3).map((t, i) => ({ label: toneLabels[i] || `Reply ${i + 1}`, text: typeof t === "string" ? t : t.text }));
                // Include strategic reply if available
                if (data.strategic) {
                  const s = data.strategic;
                  items.push({ label: "Strategic", text: typeof s === "string" ? s : s.text });
                }
              }
            } else {
              items = [
                { label: "Reply 1", text: "[Test] Lorem ipsum dolor sit amet. Add your API key for real reply suggestions." },
              ];
            }

          } else if (inputType === "reply") {
            const parentComment = getParentCommentContext(anchor);
            const post = getPostTextForCommentBox(anchor);
            const replyDepth = detectReplyDepth(anchor);
            const surrounding = getSurroundingComments(anchor);

            if (parentComment && parentComment.text) {
              const shortText = parentComment.text.length > 80
                ? parentComment.text.slice(0, 80) + "…"
                : parentComment.text;

              if (replyDepth === "child-reply") {
                headerText = `${ICO.reply} Reply to Child Comment · ${escapeHTML(parentComment.author)}: "${escapeHTML(shortText)}"`;
              } else {
                headerText = `${ICO.chat} Reply to Post Comment · ${escapeHTML(parentComment.author)}: "${escapeHTML(shortText)}"`;
              }

              // Build surrounding context string for AI
              let surroundingContext = "";
              if (surrounding.length > 0) {
                surroundingContext = surrounding
                  .map((c) => `${c.author}: "${c.text}"`)
                  .join("\n");
              }

              const replies = await AI.generateCommentReplies(
                parentComment.text, parentComment.author, post.text || "", customPrompt || undefined,
                surroundingContext, replyDepth,
                conversationMemory.length > 0 ? conversationMemory : undefined
              );
              const toneLabels = ["Friendly", "Curious", "Professional"];
              items = replies.slice(0, customPrompt ? 1 : 3).map((t, i) => ({ label: customPrompt ? "Reply" : toneLabels[i] || `Reply ${i + 1}`, text: typeof t === "string" ? t : t.text }));

              // Save interaction
              Storage.saveInteraction({
                type: replyDepth,
                postText: post.text,
                postAuthor: post.author,
                commentText: parentComment.text,
                commentAuthor: parentComment.author,
              }).catch(() => {});
            } else {
              headerText = "Pick a reply:";
              items = [
                { label: "Reply 1", text: "[Test] Lorem ipsum dolor sit amet. Add your API key for real replies." },
              ];
            }

          } else {
            const post = getPostTextForCommentBox(anchor);
            if (post.text) {
              const comments = await AI.generateComments(post.text, post.author, customPrompt || undefined,
                conversationMemory.length > 0 ? conversationMemory : undefined
              );
              const toneLabels = ["Friendly", "Curious", "Professional"];
              items = comments.slice(0, customPrompt ? 1 : 3).map((t, i) => ({ label: customPrompt ? "Comment" : toneLabels[i] || `Comment ${i + 1}`, text: typeof t === "string" ? t : t.text }));

              // Save interaction
              Storage.saveInteraction({
                type: "comment",
                postText: post.text,
                postAuthor: post.author,
              }).catch(() => {});
            } else {
              items = [
                { label: "Comment 1", text: "[Test] Lorem ipsum dolor sit amet. Add your API key for real suggestions." },
              ];
            }
          }

          // Save to cache
          suggestionCache.set(cacheKey, { items, headerText });
        }

        // Render items as bot bubbles in the conversation thread
        const sugArea = dropdown.querySelector(".lai-suggestions-area");
        const refreshBtn = dropdown.querySelector(".lai-inline-refresh");
        const headerSpan = dropdown.querySelector(".lai-header-title");

        removeLoading(sugArea);

        items.forEach((item) => {
          appendBotBubble(sugArea, item);
        });

        // Record bot responses in conversation memory for multi-turn context
        items.forEach((item) => {
          conversationMemory.push({ role: "bot", text: item.text });
        });

        // Update header text
        if (headerSpan) headerSpan.innerHTML = headerText;

        // Show refresh button now that we have results
        if (refreshBtn) refreshBtn.style.display = "";
      } catch (err) {
        const sugArea = dropdown.querySelector(".lai-suggestions-area");
        if (sugArea) {
          removeLoading(sugArea);
          const errBubble = document.createElement("div");
          errBubble.className = "lai-inline-error";
          errBubble.innerHTML = `${ICO.warn} ${escapeHTML(err.message)}`;
          sugArea.appendChild(errBubble);
          sugArea.scrollTop = sugArea.scrollHeight;
        }
      }
    }
  }

  /**
   * Scan and inject bots into all relevant input areas.
   */
  function scan() {
      const seen = new Set();

      // ── 1. Post creation modal ──────────────────────
      document.querySelectorAll(
        "[class*='share-creation'] [contenteditable='true'], " +
        "[class*='share-box'] [contenteditable='true'], " +
        "[role='dialog'] .ql-editor, " +
        ".artdeco-modal [contenteditable='true']"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        // Avoid injecting in non-post modals (settings etc)
        const modal = el.closest("[role='dialog']") || el.closest(".artdeco-modal");
        if (!modal) return;
        const hasPostBtn = modal.querySelector("button.share-actions__primary-action")
          || modal.querySelector("[class*='share-actions']")
          || modal.querySelector("button[aria-label*='Post']");
        if (!hasPostBtn && !el.closest("[class*='share-creation']") && !el.closest("[class*='share-box']")) return;
        if (!seen.has(modal)) {
          seen.add(modal);
          injectBot(el);
        }
      });

      // ── 2. Chat / Messaging windows ────────────────
      document.querySelectorAll(
        ".msg-form__contenteditable, " +
        "[class*='msg-form'] [contenteditable='true'], " +
        ".msg-form [role='textbox'], " +
        ".msg-overlay-conversation-bubble [contenteditable='true'], " +
        ".msg-overlay-conversation-bubble [role='textbox'], " +
        "[class*='msg-overlay-conversation'] [contenteditable='true'], " +
        "[class*='msg-overlay-conversation'] [role='textbox'], " +
        ".msg-thread [contenteditable='true'], " +
        ".msg-thread [role='textbox'], " +
        "[class*='msg-thread'] [contenteditable='true'], " +
        "[class*='msg-convo'] [contenteditable='true'], " +
        "[class*='message-list'] ~ * [contenteditable='true'], " +
        "[class*='messaging'] [contenteditable='true'], " +
        "[class*='messaging'] [role='textbox'], " +
        "[aria-label*='message' i][contenteditable='true'], " +
        "[aria-label*='message' i][role='textbox'], " +
        "[placeholder*='message' i][contenteditable='true'], " +
        "[data-placeholder*='message' i][contenteditable='true'], " +
        "[aria-placeholder*='message' i]"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        const bubble = el.closest(".msg-overlay-conversation-bubble")
          || el.closest(".msg-form")
          || el.closest("[class*='msg-form']")
          || el.closest("[class*='msg-overlay']")
          || el.closest("[class*='msg-thread']")
          || el.closest("[class*='msg-convo']")
          || el.closest("[class*='messaging']")
          || el.closest("[class*='message-list']")
          || el.parentElement;
        if (bubble && !seen.has(bubble)) {
          seen.add(bubble);
          injectBot(el);
        }
      });

      // ── 3. Connection request "Add a note" modals ──
      document.querySelectorAll(
        "[role='dialog'] textarea, .artdeco-modal textarea"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        const dialog = el.closest("[role='dialog']") || el.closest(".artdeco-modal");
        if (!dialog) return;
        // Verify it's a connection/invitation modal
        const header = dialog.querySelector("h2, h3, [class*='artdeco-modal__header']");
        const hText = header ? header.innerText.toLowerCase() : "";
        const ph = (el.placeholder || "").toLowerCase();
        if (hText.includes("invitation") || hText.includes("connect") || hText.includes("note")
          || ph.includes("know each other") || ph.includes("connect")) {
          if (!seen.has(dialog)) {
            seen.add(dialog);
            injectBot(el);
          }
        }
      });

      // ── 4. Feed comments + reply boxes ─────────────
      document.querySelectorAll(
        ".comments-comment-texteditor, " +
        ".comments-comment-box, " +
        "[class*='comments-comment-box'], " +
        "[class*='comments-comment-texteditor'], " +
        ".comments-comment-box .ql-editor, " +
        ".comments-comment-box [contenteditable='true'], " +
        ".comments-comment-box [role='textbox']"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        if (el.querySelector(".lai-inline-bot-btn")) return;
        if (el.closest("[data-lai-bot-done='true']")) return;
        injectBot(el);
      });

      // ── 5. Reply boxes under comments (child comments) ──
      document.querySelectorAll(
        ".comments-reply-comment-box, " +
        "[class*='comments-reply'], " +
        ".reply-comment-box, " +
        ".comments-replies [contenteditable='true'], " +
        "[class*='comments-comment-box--reply']"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        if (el.querySelector(".lai-inline-bot-btn")) return;
        if (el.closest("[data-lai-bot-done='true']")) return;
        injectBot(el);
      });

      // ── 6. Generic contenteditable with comment/reply placeholders ──
      document.querySelectorAll(
        "[contenteditable='true'][aria-placeholder*='comment' i], " +
        "[contenteditable='true'][aria-placeholder*='reply' i], " +
        "[contenteditable='true'][data-placeholder*='comment' i], " +
        "[contenteditable='true'][data-placeholder*='reply' i], " +
        "[role='textbox'][aria-label*='comment' i], " +
        "[role='textbox'][aria-label*='reply' i]"
      ).forEach((el) => {
        if (el.dataset.laiBotDone) return;
        if (el.querySelector(".lai-inline-bot-btn")) return;
        if (el.closest("[data-lai-bot-done='true']")) return;
        injectBot(el);
      });
  }

  function startBotWatcher() {
    // Initial scan (wait for LinkedIn to render)
    setTimeout(scan, 1500);
    setTimeout(scan, 3000);
    setTimeout(scan, 5000);
    setTimeout(scan, 8000);

    // Debounced observer
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        scan();
      }, 600);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Detect LinkedIn SPA navigation (URL changes without page reload)
    let lastUrl = location.href;
    const urlWatcher = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // URL changed — immediate scan + follow-up scans for lazy-rendered content
        scan();
        setTimeout(scan, 800);
        setTimeout(scan, 2000);
      }
    }, 500);

    // Also listen for popstate (browser back/forward)
    window.addEventListener("popstate", () => {
      lastUrl = location.href;
      scan();
      setTimeout(scan, 800);
      setTimeout(scan, 2000);
    });

    // Listen for focus events on comment/message inputs — handles
    // LinkedIn expanding a collapsed "Add a comment..." box on click
    document.addEventListener("focusin", (e) => {
      const target = e.target;
      if (!target) return;
      const isEditable = target.isContentEditable
        || target.getAttribute("role") === "textbox"
        || target.tagName === "TEXTAREA";
      if (!isEditable) return;
      // Only act on comment/reply/message areas
      const inCommentArea = target.closest(".comments-comment-box")
        || target.closest("[class*='comments-comment-box']")
        || target.closest(".comments-comment-texteditor")
        || target.closest("[class*='comments-comment-texteditor']")
        || target.closest(".msg-form")
        || target.closest("[class*='msg-form']")
        || target.closest("[role='dialog']");
      if (!inCommentArea) return;
      // Short delay to let LinkedIn finish rendering the expanded editor
      setTimeout(scan, 200);
      setTimeout(scan, 600);
    });

    // Periodic re-scan as fallback (LinkedIn SPA navigation)
    setInterval(scan, 5000);
  }

  // ══════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════

  // Initialize storage
  Storage.open().catch((err) => console.warn("[LAI] Storage init:", err));

  // Message listener for popup communication
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_STORAGE_STATS") {
      Storage.getStats()
        .then((stats) => sendResponse(stats))
        .catch(() => sendResponse({ contacts: 0, conversations: 0, interactions: 0 }));
      return true; // async response
    }
    if (msg.type === "CLEAR_STORAGE") {
      Storage.clearAll()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (msg.type === "RESCAN_BOTS") {
      // Remove existing bot markers and UI so they get re-injected
      document.querySelectorAll("[data-lai-bot-done]").forEach(el => {
        delete el.dataset.laiBotDone;
        injectedElements.delete(el);
      });
      document.querySelectorAll(".lai-inline-bot-btn").forEach(el => el.remove());
      document.querySelectorAll(".lai-modal-overlay").forEach(el => el.remove());
      allBotEntries.length = 0;
      // Run scan immediately + follow-up scans for lazy-rendered content
      scan();
      setTimeout(scan, 500);
      setTimeout(scan, 1500);
      sendResponse({ ok: true });
      return true;
    }
  });

  startBotWatcher();
  console.log("[LinkedIn AI Assistant] v2.1 — Inline bots ready.");
})();
