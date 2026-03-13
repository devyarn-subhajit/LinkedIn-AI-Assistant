/**
 * LinkedIn AI Assistant — IndexedDB Storage Module
 * Stores structured context data locally for fast retrieval and better AI suggestions.
 *
 * Stores:  contacts, conversations, interactions (comments/replies), profiles
 * Avoids:  UI elements, duplicated messages, irrelevant page data
 */

const Storage = (() => {
  "use strict";

  const DB_NAME = "lai_assistant";
  const DB_VERSION = 1;
  let _db = null;

  // ── Open / Initialize DB ─────────────────────────────

  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Contacts — people we've interacted with
        if (!db.objectStoreNames.contains("contacts")) {
          const s = db.createObjectStore("contacts", { keyPath: "id" });
          s.createIndex("name", "name", { unique: false });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // Conversations — DM thread snapshots
        if (!db.objectStoreNames.contains("conversations")) {
          const s = db.createObjectStore("conversations", { keyPath: "id" });
          s.createIndex("contactId", "contactId", { unique: false });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // Interactions — comment / reply contexts
        if (!db.objectStoreNames.contains("interactions")) {
          const s = db.createObjectStore("interactions", { keyPath: "id" });
          s.createIndex("type", "type", { unique: false });
          s.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = (e) => {
        console.warn("[LAI Storage] IndexedDB open failed:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  // ── Generic helpers ───────────────────────────────────

  async function _tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function _req(idbRequest) {
    return new Promise((resolve, reject) => {
      idbRequest.onsuccess = () => resolve(idbRequest.result);
      idbRequest.onerror = () => reject(idbRequest.error);
    });
  }

  // ── Contacts ─────────────────────────────────────────

  /**
   * Save or update a contact profile.
   * @param {{ name, headline, company, role, about, profileUrl }} data
   */
  async function saveContact(data) {
    if (!data || !data.name) return;
    const id = _contactId(data.name);
    const store = await _tx("contacts", "readwrite");
    const existing = await _req(store.get(id));

    const record = {
      id,
      name: data.name,
      headline: data.headline || "",
      company: data.company || "",
      role: data.role || "",
      about: (data.about || "").slice(0, 500),
      profileUrl: data.profileUrl || "",
      updatedAt: Date.now(),
      ...(existing ? { createdAt: existing.createdAt } : { createdAt: Date.now() }),
    };

    const writeStore = await _tx("contacts", "readwrite");
    await _req(writeStore.put(record));
    return record;
  }

  async function getContact(name) {
    if (!name) return null;
    const store = await _tx("contacts", "readonly");
    return _req(store.get(_contactId(name)));
  }

  function _contactId(name) {
    return "c_" + (name || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60);
  }

  // ── Conversations ────────────────────────────────────

  /**
   * Save a DM conversation snapshot.
   * @param {{ contactName, messages: [{sender, text, timestamp?}], lastSenderIsMe }} data
   */
  async function saveConversation(data) {
    if (!data || !data.contactName) return;
    const id = "conv_" + _contactId(data.contactName);

    // Only keep last 20 messages to avoid bloat
    const messages = (data.messages || []).slice(-20).map((m) => ({
      sender: m.sender || "Unknown",
      text: (m.text || "").slice(0, 1000),
      timestamp: m.timestamp || null,
    }));

    const store = await _tx("conversations", "readwrite");
    const existing = await _req(store.get(id));

    const record = {
      id,
      contactId: _contactId(data.contactName),
      contactName: data.contactName,
      messages,
      lastSenderIsMe: !!data.lastSenderIsMe,
      messageCount: messages.length,
      updatedAt: Date.now(),
      ...(existing ? { createdAt: existing.createdAt } : { createdAt: Date.now() }),
    };

    const writeStore = await _tx("conversations", "readwrite");
    await _req(writeStore.put(record));
    return record;
  }

  async function getConversation(contactName) {
    if (!contactName) return null;
    const id = "conv_" + _contactId(contactName);
    const store = await _tx("conversations", "readonly");
    return _req(store.get(id));
  }

  // ── Interactions (comments / replies) ────────────────

  /**
   * Save a comment/reply interaction context.
   * @param {{ type: "comment"|"reply"|"child-reply", postText, postAuthor, commentText, commentAuthor, parentCommentText?, parentCommentAuthor? }} data
   */
  async function saveInteraction(data) {
    if (!data || !data.type) return;
    const id = "int_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    const record = {
      id,
      type: data.type,
      postText: (data.postText || "").slice(0, 1000),
      postAuthor: data.postAuthor || "",
      commentText: (data.commentText || "").slice(0, 500),
      commentAuthor: data.commentAuthor || "",
      parentCommentText: (data.parentCommentText || "").slice(0, 500),
      parentCommentAuthor: data.parentCommentAuthor || "",
      createdAt: Date.now(),
    };

    const store = await _tx("interactions", "readwrite");
    await _req(store.put(record));

    // Prune old interactions — keep last 100
    await _pruneInteractions();
    return record;
  }

  async function getRecentInteractions(type, limit) {
    const store = await _tx("interactions", "readonly");
    const index = store.index("createdAt");
    const results = [];
    const count = limit || 10;

    return new Promise((resolve, reject) => {
      const req = index.openCursor(null, "prev");
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < count) {
          if (!type || cursor.value.type === type) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function _pruneInteractions() {
    const store = await _tx("interactions", "readonly");
    const index = store.index("createdAt");
    const allKeys = await _req(index.getAllKeys());

    if (allKeys.length > 100) {
      const toDelete = allKeys.slice(0, allKeys.length - 100);
      const writeStore = await _tx("interactions", "readwrite");
      for (const key of toDelete) {
        writeStore.delete(key);
      }
    }
  }

  // ── Utility ──────────────────────────────────────────

  async function getStats() {
    const contacts = await _tx("contacts", "readonly");
    const convos = await _tx("conversations", "readonly");
    const ints = await _tx("interactions", "readonly");

    return {
      contacts: await _req(contacts.count()),
      conversations: await _req(convos.count()),
      interactions: await _req(ints.count()),
    };
  }

  async function clearAll() {
    const db = await open();
    const tx = db.transaction(["contacts", "conversations", "interactions"], "readwrite");
    tx.objectStore("contacts").clear();
    tx.objectStore("conversations").clear();
    tx.objectStore("interactions").clear();
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  }

  // ── Public API ───────────────────────────────────────

  return {
    open,
    saveContact,
    getContact,
    saveConversation,
    getConversation,
    saveInteraction,
    getRecentInteractions,
    getStats,
    clearAll,
  };
})();
