(function () {
  "use strict";

  /* ─── Constants ─── */
  /* Legacy single-session key (kept for migration). */
  var LEGACY_SESSION_KEY = "vrs:ai-chat-session-v2";
  /* New multi-session store. localStorage so chats survive across reloads
   * and tabs. The library is shaped { activeId, sessions: { [id]: state } }. */
  var LIBRARY_KEY = "vrs:ai-chat-library-v1";
  var MAX_SESSIONS = 30;
  var TITLE_MAX_LEN = 60;
  var WELCOME =
    "Hi there! I'm your AI Booking Assistant. I can help you with:\n" +
    "\u2022 Trip planning & vehicle recommendations\n" +
    "\u2022 Multi-stop itinerary quotes (rental + fuel estimate)\n" +
    "\u2022 Upcoming booking dates & details\n" +
    "\u2022 Vehicle information\n" +
    "\u2022 Cancellation policy & refund status\n" +
    "\u2022 Invoice availability\n\n" +
    "Tell me about your trip and I'll find the perfect vehicle for you!";
  var MAX_MESSAGES = 100;
  var MAX_SEARCHES = 25;
  var SUGGESTIONS = [
    "When is my next booking?",
    "Show my bookings",
    "Plan a trip",
    "Multi-stop trip",
    "Refund status",
  ];

  /* ─── Dark Mode ─── */
  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function T() {
    var d = isDark();
    return {
      panelBg: d ? "#1a2e2b" : "#fff",
      panelBorder: d ? "#2d4a45" : "#c8dfd8",
      headerBg: d ? "linear-gradient(to right,#1a2e2b,#1e3530)" : "linear-gradient(to right,#f0faf7,#e8f5f1)",
      headerBorder: d ? "#2d4a45" : "#e0ece8",
      headerTitle: d ? "#d4f0e8" : "#0f3d3a",
      headerSub: d ? "#7aaa9e" : "#5a8a80",
      headerBtn: d ? "#8abfb2" : "#3a7a72",
      headerBtnHover: d ? "rgba(255,255,255,0.08)" : "#dff0eb",
      threadBg: d ? "linear-gradient(to bottom,#162724,#1a2e2b)" : "linear-gradient(to bottom,#f6fcfa,#eff8f5)",
      userBubble: d ? "linear-gradient(135deg,#1a6b62,#22897e)" : "linear-gradient(135deg,#145f59,#1a8a7e)",
      aiBubbleBg: d ? "#1e3530" : "#fff",
      aiBubbleBorder: d ? "#2d4a45" : "#d4e8e2",
      aiBubbleText: d ? "#d4f0e8" : "#12353a",
      userText: "#fff",
      timestamp: d ? "#6a9a90" : "#7a9a9e",
      citeBg: d ? "#1a3d36" : "#e0f2ed",
      citeText: d ? "#8abfb2" : "#145f59",
      actionBg: d ? "#1a3d36" : "#f7fcfa",
      actionBorder: d ? "#2d5a50" : "#c2ddd6",
      actionText: d ? "#8abfb2" : "#145f59",
      chipBg: d ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
      chipBorder: d ? "#2d5a50" : "#bdd8d0",
      chipText: d ? "#8abfb2" : "#145f59",
      inputBg: d ? "#162724" : "#f8fcfb",
      inputBorder: d ? "#2d4a45" : "#c8dfd8",
      inputText: d ? "#d4f0e8" : "#12353a",
      inputPlaceholder: d ? "#5a8a80" : "#8fafaa",
      composerBg: d ? "#1a2e2b" : "#fff",
      composerBorder: d ? "#2d4a45" : "#e0ece8",
      histBg: d ? "#162724" : "#f5fbf9",
      histTitle: d ? "#8abfb2" : "#2a6660",
      histItemBg: d ? "#1e3530" : "#fff",
      histItemText: d ? "#b0d4ca" : "#12353a",
      histItemSub: d ? "#6a9a90" : "#3a5a5e",
      cardBg: d ? "#1e3530" : "#f8fcfa",
      cardBorder: d ? "#2d5a50" : "#d4e8e2",
      cardTitle: d ? "#d4f0e8" : "#12353a",
      cardSub: d ? "#8abfb2" : "#5a7a72",
      cardPrice: d ? "#4eeac0" : "#145f59",
      cardBtnBg: d ? "#1a6b62" : "linear-gradient(135deg,#145f59,#1a8a7e)",
      cardBtnText: "#fff",
      dotColor: d ? "#4eeac0" : "#1b7a71",
    };
  }

  /* ─── Helpers ─── */
  function uid(p) {
    return (p || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function trim(v) { return String(v || "").trim(); }

  function esc(v) {
    return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeJson(raw, fb) {
    if (!raw) return fb;
    try { return JSON.parse(raw); } catch (_) { return fb; }
  }

  function relTime(iso) {
    if (!iso) return "";
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 10) return "just now";
    if (diff < 60) return Math.floor(diff) + "s ago";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  /* ─── SVG Icons ─── */
  var ICON_BOT =
    '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="3" y="7" width="18" height="12" rx="3"/>' +
    '<circle cx="9" cy="13" r="1.5" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="13" r="1.5" fill="currentColor" stroke="none"/>' +
    '<path d="M8 7V5a4 4 0 0 1 8 0v2"/>' +
    "</svg>";

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
    "</svg>";

  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var ICON_CLEAR =
    '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/></svg>';

  var ICON_HISTORY =
    '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';

  var ICON_SEND =
    '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>';

  /* ─── Trip Wizard Steps ─── */
  var TRIP_STEPS_SINGLE = [
    {
      key: "people",
      question: "How many passengers will be traveling?",
      options: [
        { label: "Just me", value: "1 person" },
        { label: "2 people", value: "2 people" },
        { label: "3-4 people", value: "4 people" },
        { label: "5-7 people", value: "7 people" },
        { label: "8+ (large group)", value: "10 people" },
      ],
      allowTyping: true,
    },
    {
      key: "fuel",
      question: "Any fuel type preference?",
      options: [
        { label: "Petrol", value: "petrol" },
        { label: "Diesel", value: "diesel" },
        { label: "Electric (EV)", value: "electric" },
        { label: "No preference", value: "" },
      ],
      allowTyping: false,
    },
    {
      key: "budget",
      question: "What's your daily budget (NPR per day)?",
      options: [
        { label: "Under 3,000", value: "budget under 3000 NPR" },
        { label: "3,000 - 5,000", value: "budget under 5000 NPR" },
        { label: "5,000 - 10,000", value: "budget under 10000 NPR" },
        { label: "10,000+", value: "budget under 50000 NPR" },
        { label: "No limit", value: "" },
      ],
      allowTyping: true,
    },
    {
      key: "destination",
      question: "What type of destination?",
      options: [
        { label: "City / Urban", value: "city" },
        { label: "Mountain / Hills", value: "mountain" },
        { label: "Highway / Terai", value: "highway" },
        { label: "Not sure yet", value: "" },
      ],
      allowTyping: false,
    },
  ];

  /* Multi-stop branch: ask for itinerary first, then reuse single-trip steps. */
  var TRIP_STEPS_MULTI = [
    {
      key: "stops",
      question:
        "Great — list your stops in order with the days you'll spend at each.\n" +
        "Examples:\n" +
        "\u2022 Pokhara 3 days, Chitwan 2 days, Lumbini 1 day\n" +
        "\u2022 Kathmandu to Pokhara to Chitwan, 5 days",
      options: [
        { label: "Pokhara 3d, Chitwan 2d", value: "Pokhara 3 days, Chitwan 2 days" },
        { label: "Kathmandu \u2192 Pokhara \u2192 Lumbini, 6 days", value: "Kathmandu to Pokhara to Lumbini, 6 days" },
        { label: "Pokhara \u2192 Mustang, 5 days", value: "Pokhara to Mustang, 5 days" },
      ],
      allowTyping: true,
    },
  ].concat([
    TRIP_STEPS_SINGLE[0], // people
    TRIP_STEPS_SINGLE[1], // fuel
    TRIP_STEPS_SINGLE[2], // budget
  ]);

  /* Picks the right wizard branch based on active mode. */
  function getWizardSteps(mode) {
    return mode === "multi" ? TRIP_STEPS_MULTI : TRIP_STEPS_SINGLE;
  }

  /* ─── State & Library Management ─────────────────────────────────────
   * The chat now persists multiple sessions ("chats") in localStorage so
   * users can keep their history across page reloads and switch back to
   * older threads. The active session is tracked by an id and rehydrated
   * into a single in-memory `state` object. All mutators go through the
   * library helpers below to keep storage in sync. */

  function freshState(opts) {
    opts = opts || {};
    var nowIso = new Date().toISOString();
    return {
      sessionId: opts.id || uid("s"),
      title: opts.title || "New chat",
      startedAt: nowIso,
      updatedAt: nowIso,
      messages: [{
        id: uid("m"), role: "assistant", text: WELCOME,
        timestamp: nowIso, citations: [], actions: [],
        showSuggestions: true,
      }],
      searches: [],
      unreadCount: 0,
      tripWizard: null,
    };
  }

  function normalizeSessionState(p) {
    if (!p || !Array.isArray(p.messages)) return null;
    var nowIso = new Date().toISOString();
    return {
      sessionId: trim(p.sessionId) || uid("s"),
      title: trim(p.title) || "New chat",
      startedAt: trim(p.startedAt) || nowIso,
      updatedAt: trim(p.updatedAt) || trim(p.startedAt) || nowIso,
      messages: p.messages.slice(0, MAX_MESSAGES),
      searches: Array.isArray(p.searches) ? p.searches.slice(0, MAX_SEARCHES) : [],
      unreadCount: Math.max(0, Number(p.unreadCount) || 0),
      tripWizard: p.tripWizard || null,
    };
  }

  /* Load the entire library plus migrate any legacy single-session blob. */
  function loadLibrary() {
    var lib = safeJson(localStorage.getItem(LIBRARY_KEY), null);
    var sessions = {};
    var order = [];
    if (lib && lib.sessions && typeof lib.sessions === "object") {
      Object.keys(lib.sessions).forEach(function (id) {
        var s = normalizeSessionState(lib.sessions[id]);
        if (s) {
          s.sessionId = id;
          sessions[id] = s;
          order.push(id);
        }
      });
    }

    /* One-time migration of legacy v2 single-session storage. */
    if (!order.length) {
      var legacy = safeJson(sessionStorage.getItem(LEGACY_SESSION_KEY), null) ||
                   safeJson(localStorage.getItem(LEGACY_SESSION_KEY), null);
      var migrated = normalizeSessionState(legacy);
      if (migrated) {
        if (!migrated.title || migrated.title === "New chat") {
          migrated.title = deriveSessionTitle(migrated);
        }
        sessions[migrated.sessionId] = migrated;
        order.push(migrated.sessionId);
      }
    }

    var activeId = trim(lib && lib.activeId);
    if (!activeId || !sessions[activeId]) activeId = order[0] || "";

    if (!order.length) {
      var fresh = freshState();
      sessions[fresh.sessionId] = fresh;
      order.push(fresh.sessionId);
      activeId = fresh.sessionId;
    }

    return { activeId: activeId, sessions: sessions, order: order };
  }

  function saveLibrary(library) {
    try {
      /* Trim oldest sessions if we're over the cap (keeps storage small). */
      var ids = Object.keys(library.sessions);
      if (ids.length > MAX_SESSIONS) {
        ids
          .map(function (id) { return library.sessions[id]; })
          .sort(function (a, b) { return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); })
          .slice(0, ids.length - MAX_SESSIONS)
          .forEach(function (s) { delete library.sessions[s.sessionId]; });
      }
      var payload = { activeId: library.activeId, sessions: library.sessions };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(payload));
    } catch (_) { /* storage full, ignored */ }
  }

  function deriveSessionTitle(state) {
    /* Use first non-empty user message as the natural title. Fall back to
     * the first assistant message excerpt, or a date-based stub. */
    var firstUser = (state.messages || []).find(function (m) {
      return m && m.role === "user" && trim(m.text);
    });
    var seed = firstUser ? trim(firstUser.text) : "";
    if (!seed) {
      var firstAi = (state.messages || []).find(function (m) {
        return m && m.role === "assistant" && trim(m.text) && !m.isTyping;
      });
      seed = firstAi ? trim(firstAi.text).split(/\n/)[0] : "";
    }
    if (!seed) {
      try { return "Chat " + new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
      catch (_) { return "New chat"; }
    }
    var clean = seed.replace(/\s+/g, " ").trim();
    if (clean.length > TITLE_MAX_LEN) clean = clean.slice(0, TITLE_MAX_LEN - 1).trim() + "\u2026";
    return clean;
  }

  /* Persist the active state slot into the library. */
  function save(state, library) {
    if (!state || !library) return;
    state.updatedAt = new Date().toISOString();
    /* Auto-title sessions that still carry the default once the user has
     * actually typed something. This gives history items a meaningful name. */
    if ((!state.title || state.title === "New chat") && state.messages && state.messages.length) {
      var derived = deriveSessionTitle(state);
      if (derived) state.title = derived;
    }
    library.sessions[state.sessionId] = state;
    library.activeId = state.sessionId;
    saveLibrary(library);
  }

  function pushMsg(state, msg, library) {
    state.messages.push(msg);
    if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
    save(state, library);
  }

  function replaceTyping(state, msg, library) {
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i] && state.messages[i].isTyping) {
        state.messages.splice(i, 1, msg);
        save(state, library);
        return;
      }
    }
    pushMsg(state, msg, library);
  }

  function trackSearch(state, q, library) {
    var t = trim(q); if (!t) return;
    state.searches = [t].concat(state.searches.filter(function (s) {
      return trim(s).toLowerCase() !== t.toLowerCase();
    })).slice(0, MAX_SEARCHES);
    save(state, library);
  }

  /* Sort sessions by updatedAt descending (most recent first) for the
   * history panel's chronological list. */
  function listSessions(library) {
    var ids = Object.keys(library.sessions);
    return ids
      .map(function (id) { return library.sessions[id]; })
      .sort(function (a, b) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  /* ─── API ─── */
  async function getClient() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function")
      throw new Error("Supabase client unavailable.");
    return window.SupabaseClient.init();
  }

  function buildHistoryForAPI(state) {
    if (!state || !Array.isArray(state.messages)) return [];
    return state.messages
      .filter(function (m) { return m && !m.isTyping && (m.role === "user" || m.role === "assistant") && trim(m.text); })
      .slice(-10)
      .map(function (m) { return { role: m.role, text: trim(m.text) }; });
  }

  async function askAI(query, state) {
    var client = await getClient();
    var history = buildHistoryForAPI(state);
    var res = await client.functions.invoke("booking-chat", {
      body: {
        query: query,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        nowIso: new Date().toISOString(),
        history: history,
        conversationId: state ? state.sessionId : "",
      },
    });
    if (res.error) throw new Error(String(res.error.message || "Chat API call failed."));
    return res.data || {};
  }

  function normActions(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (a) {
      return { type: trim(a && a.type), label: trim(a && a.label) || "Open", bookingId: trim(a && a.bookingId), vehicleId: trim(a && a.vehicleId), href: trim(a && a.href), meta: (a && a.meta) || null };
    });
  }

  function normCitations(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (c) {
      return { bookingId: trim(c && c.bookingId), bookingCode: trim(c && c.bookingCode) || "booking", source: trim(c && c.source) || "vehicle_bookings" };
    });
  }

  /* ─── Navigation Actions ─── */
  function runAction(btn) {
    if (!btn) return;
    var type = trim(btn.getAttribute("data-action-type"));
    var bid = trim(btn.getAttribute("data-action-booking-id"));
    var vid = trim(btn.getAttribute("data-action-vehicle-id"));
    var href = trim(btn.getAttribute("data-action-href"));
    if (type === "view_booking") {
      if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
        window.VehicleAuthUI.openBookingsPanel({ bookingId: bid }); return;
      }
      var fb = document.querySelector("[data-open-bookings-panel]");
      if (fb) fb.click();
      return;
    }
    if (type === "book_vehicle" && vid) { window.location.assign("booking.html?vehicle=" + encodeURIComponent(vid)); return; }
    if ((type === "open_vehicle" || type === "suggest_vehicle") && vid) { window.location.assign("vehicle-details.html?id=" + encodeURIComponent(vid)); return; }
    if (type === "confirmation_cta") {
      var base = href || "modify-booking.html";
      var glue = base.indexOf("?") >= 0 ? "&" : "?";
      window.location.assign(bid ? base + glue + "bookingId=" + encodeURIComponent(bid) : base); return;
    }
    if (type === "contact_support" && href) { window.location.assign(href); }
  }

  /* ─── Inject CSS ─── */
  function injectStyles() {
    if (document.getElementById("vrs-ai-chat-styles")) return;
    var style = document.createElement("style");
    style.id = "vrs-ai-chat-styles";
    style.textContent = [
      "@keyframes vrs-chat-dot{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}",
      "@keyframes vrs-chat-slide-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes vrs-chat-fade-in{from{opacity:0}to{opacity:1}}",
      ".vrs-chat-dot-1{animation:vrs-chat-dot 1.4s infinite}",
      ".vrs-chat-dot-2{animation:vrs-chat-dot 1.4s 0.2s infinite}",
      ".vrs-chat-dot-3{animation:vrs-chat-dot 1.4s 0.4s infinite}",
      ".vrs-msg-appear{animation:vrs-chat-slide-up .25s ease-out}",
      ".vrs-panel-enter{animation:vrs-chat-fade-in .2s ease-out}",
      ".vrs-chat-thread::-webkit-scrollbar{width:5px}",
      ".vrs-chat-thread::-webkit-scrollbar-track{background:transparent}",
      ".vrs-chat-thread::-webkit-scrollbar-thumb{border-radius:20px}",
      ".vrs-history-slide{transition:transform .25s cubic-bezier(.4,0,.2,1)}",
      ".vrs-history-slide.is-hidden{transform:translateX(100%)}",
      ".vrs-vehicle-card img{display:block;width:100%;height:80px;object-fit:cover;border-radius:8px 8px 0 0}",
    ].join("\n");
    document.head.appendChild(style);
  }

  /* ─── Render Messages ─── */
  function renderMsg(msg) {
    var t = T();
    var isUser = msg.role === "user";
    var isTyping = msg.isTyping;
    var ts = relTime(msg.timestamp);
    var DEFAULT_IMG = "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=400&q=60";

    /* avatar */
    var avatarHtml = isUser ? "" :
      '<div style="flex-shrink:0;width:28px;height:28px;margin-top:2px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,#145f59,#1a8a7e);color:#fff">' + ICON_BOT + "</div>";

    /* body */
    var bodyHtml;
    if (isTyping) {
      bodyHtml =
        '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 0">' +
        '<span class="vrs-chat-dot-1" style="width:7px;height:7px;border-radius:50%;background:' + t.dotColor + ';display:inline-block"></span>' +
        '<span class="vrs-chat-dot-2" style="width:7px;height:7px;border-radius:50%;background:' + t.dotColor + ';display:inline-block"></span>' +
        '<span class="vrs-chat-dot-3" style="width:7px;height:7px;border-radius:50%;background:' + t.dotColor + ';display:inline-block"></span>' +
        "</span>";
    } else {
      bodyHtml = '<div style="white-space:pre-wrap">' + esc(msg.text || "").replace(/\n/g, "<br>") + "</div>";
    }

    /* citations */
    var citations = Array.isArray(msg.citations) ? msg.citations : [];
    var citeHtml = "";
    if (citations.length && !isTyping) {
      citeHtml = '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">' + citations.map(function (c) {
        return '<span style="display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:' + t.citeBg + ';padding:3px 10px;font-size:10px;font-weight:600;color:' + t.citeText + '">' +
          '<svg viewBox="0 0 16 16" style="width:12px;height:12px;flex-shrink:0" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1 10H7V7h2v4Zm0-5H7V4h2v2Z"/></svg>' +
          esc(c.bookingCode || "booking") +
          "</span>";
      }).join("") + "</div>";
    }

    /* split actions: trip quote panel, vehicle cards, regular buttons */
    var actions = Array.isArray(msg.actions) ? msg.actions : [];
    var tripQuote = null;
    var vehicleCards = [];
    var regularActions = [];
    if (!isTyping) {
      actions.forEach(function (a) {
        if (a.type === "trip_quote" && a.meta && !tripQuote) tripQuote = a;
        else if (a.type === "suggest_vehicle" && a.meta) vehicleCards.push(a);
        else regularActions.push(a);
      });
    }

    /* trip-quote summary card (multi-stop itinerary + fuel band + per-vehicle totals) */
    var quoteHtml = "";
    if (tripQuote) {
      var qm = tripQuote.meta || {};
      var qStops = Array.isArray(qm.stops) ? qm.stops : [];
      var qLegs = Array.isArray(qm.legs) ? qm.legs : [];
      var qQuotes = Array.isArray(qm.quotes) ? qm.quotes : [];
      var fuelLabel = trim(qm.fuelType) || "petrol";
      var fuelLow = Math.round(Number(qm.fuelLow) || 0);
      var fuelHigh = Math.round(Number(qm.fuelHigh) || 0);
      var totalDays = Math.round(Number(qm.totalDays) || 0);
      var totalKm = Math.round(Number(qm.totalKm) || 0);

      var stopsHtml = qStops.map(function (s, idx) {
        return '<li style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed ' + t.cardBorder + '">' +
          '<span><span style="display:inline-block;min-width:18px;font-weight:700;color:' + t.cardPrice + '">' + (idx + 1) + '.</span> ' + esc(s.name || "") + '</span>' +
          '<span style="color:' + t.cardSub + '">' + esc(String(s.days || 1)) + ' day' + ((s.days || 1) === 1 ? '' : 's') + '</span>' +
          '</li>';
      }).join("");

      var legsHtml = qLegs.map(function (leg) {
        return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:' + t.cardSub + ';padding:2px 0">' +
          '<span>' + esc(leg.from || "") + ' \u2192 ' + esc(leg.to || "") + '</span>' +
          '<span>~' + esc(String(leg.km || 0)) + ' km</span>' +
          '</div>';
      }).join("");

      var quotesHtml = qQuotes.map(function (q) {
        var rentalSubtotal = Math.round(Number(q.rentalSubtotal) || 0);
        var packageLow = Math.round(Number(q.packageLow) || 0);
        var packageHigh = Math.round(Number(q.packageHigh) || 0);
        return '<div style="margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid ' + t.cardBorder + ';background:' + t.cardBg + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="font-size:12px;font-weight:700;color:' + t.cardTitle + '">#' + esc(String(q.rank || 1)) + ' ' + esc(q.vehicleLabel || 'Vehicle') + '</div>' +
          '<div style="font-size:12px;font-weight:700;color:' + t.cardPrice + ';white-space:nowrap">NPR ' + packageLow.toLocaleString() + '\u2013' + packageHigh.toLocaleString() + '</div>' +
          '</div>' +
          '<div style="margin-top:2px;font-size:10px;color:' + t.cardSub + '">Rental NPR ' + rentalSubtotal.toLocaleString() + ' + Fuel NPR ' + fuelLow.toLocaleString() + '\u2013' + fuelHigh.toLocaleString() + '</div>' +
          '</div>';
      }).join("");

      quoteHtml =
        '<div style="margin-top:10px;border-radius:12px;border:1px solid ' + t.cardBorder + ';background:linear-gradient(165deg,' + t.cardBg + ',' + t.actionBg + ');padding:10px 12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' + t.cardPrice + '">Multi-stop Quote</div>' +
        '<div style="font-size:11px;color:' + t.cardSub + '">' + esc(String(totalDays)) + 'd \u2022 ~' + esc(String(totalKm)) + ' km</div>' +
        '</div>' +
        (qStops.length ? '<ul style="list-style:none;margin:8px 0 0;padding:0;font-size:12px;color:' + t.cardTitle + '">' + stopsHtml + '</ul>' : '') +
        (qLegs.length ? '<div style="margin-top:8px;padding-top:6px;border-top:1px solid ' + t.cardBorder + '">' + legsHtml + '</div>' : '') +
        '<div style="margin-top:8px;font-size:11px;font-weight:600;color:' + t.cardSub + '">Fuel band (' + esc(fuelLabel) + '): NPR ' + fuelLow.toLocaleString() + '\u2013' + fuelHigh.toLocaleString() + '</div>' +
        (quotesHtml ? '<div style="margin-top:6px">' + quotesHtml + '</div>' : '') +
        '</div>';
    }

    /* vehicle suggestion cards */
    var cardsHtml = "";
    if (vehicleCards.length) {
      cardsHtml = '<div style="margin-top:10px;display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">' +
        vehicleCards.map(function (a) {
          var m = a.meta || {};
          var img = trim(m.image) || DEFAULT_IMG;
          var seats = m.seats || 5;
          var price = Math.round(Number(m.price) || 0);
          var fuel = trim(m.fuel) || "Petrol";
          var cat = trim(m.category) || "";
          var reason = trim(m.reason) || "";
          var rank = Number(m.rank) || 0;
          var rankBadge = rank ? '<span style="position:absolute;top:6px;left:6px;background:linear-gradient(135deg,#145f59,#1a8a7e);color:#fff;font-size:9px;font-weight:700;border-radius:999px;padding:2px 8px;box-shadow:0 2px 4px rgba(0,0,0,0.2)">#' + rank + '</span>' : '';
          return '<div class="vrs-vehicle-card" style="flex-shrink:0;width:180px;border-radius:10px;border:1px solid ' + t.cardBorder + ';background:' + t.cardBg + ';overflow:hidden" data-action-type="suggest_vehicle" data-action-vehicle-id="' + esc(a.vehicleId || "") + '">' +
            '<div style="position:relative">' +
            '<img src="' + esc(img) + '" alt="' + esc(a.label) + '" onerror="this.src=\'' + esc(DEFAULT_IMG) + '\'" />' +
            rankBadge +
            '</div>' +
            '<div style="padding:8px 10px">' +
            '<p style="font-size:12px;font-weight:700;color:' + t.cardTitle + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.label) + '</p>' +
            '<p style="font-size:10px;color:' + t.cardSub + ';margin-top:2px">' + esc(seats + ' seats \u2022 ' + fuel + (cat ? ' \u2022 ' + cat : '')) + '</p>' +
            (reason ? '<p style="font-size:10px;color:' + t.cardSub + ';margin-top:4px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(reason) + '</p>' : '') +
            '<p style="font-size:13px;font-weight:700;color:' + t.cardPrice + ';margin-top:4px">NPR ' + price.toLocaleString() + '<span style="font-weight:400;font-size:10px">/day</span></p>' +
            '<div style="margin-top:6px;display:flex;gap:4px">' +
            '<button type="button" style="flex:1;padding:5px 0;border-radius:6px;border:none;background:' + t.cardBtnBg + ';color:' + t.cardBtnText + ';font-size:11px;font-weight:600;cursor:pointer" data-action-type="book_vehicle" data-action-vehicle-id="' + esc(a.vehicleId || "") + '">Book this</button>' +
            '<button type="button" style="padding:5px 10px;border-radius:6px;border:1px solid ' + t.cardBorder + ';background:transparent;color:' + t.cardSub + ';font-size:10px;font-weight:600;cursor:pointer" data-action-type="suggest_vehicle" data-action-vehicle-id="' + esc(a.vehicleId || "") + '">Details</button>' +
            '</div>' +
            '</div></div>';
        }).join("") + "</div>";
    }

    /* regular action buttons */
    var actHtml = "";
    if (regularActions.length) {
      actHtml = '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">' + regularActions.map(function (a) {
        var icon = "";
        var svgStyle = 'style="width:12px;height:12px;flex-shrink:0;margin-right:4px"';
        if (a.type === "view_booking") icon = '<svg viewBox="0 0 16 16" ' + svgStyle + ' fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 7h6M5 9.5h4"/></svg>';
        if (a.type === "open_vehicle") icon = '<svg viewBox="0 0 16 16" ' + svgStyle + ' fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="6" width="14" height="6" rx="2"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="11.5" cy="12" r="1.5"/><path d="M3 6l2-3h6l2 3"/></svg>';
        if (a.type === "confirmation_cta") icon = '<svg viewBox="0 0 16 16" ' + svgStyle + ' fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8l4 4 8-8"/></svg>';
        if (a.type === "contact_support") icon = '<svg viewBox="0 0 16 16" ' + svgStyle + ' fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4l6 4 6-4M2 4v8h12V4"/></svg>';
        return '<button type="button" style="display:inline-flex;align-items:center;border-radius:8px;border:1px solid ' + t.actionBorder + ';background:' + t.actionBg + ';padding:6px 12px;font-size:11px;font-weight:600;color:' + t.actionText + ';cursor:pointer;white-space:nowrap"' +
          ' data-action-type="' + esc(a.type || "") + '"' +
          ' data-action-booking-id="' + esc(a.bookingId || "") + '"' +
          ' data-action-vehicle-id="' + esc(a.vehicleId || "") + '"' +
          ' data-action-href="' + esc(a.href || "") + '">' +
          icon + esc(a.label || "Open") + "</button>";
      }).join("") + "</div>";
    }

    /* suggestion chips (only on welcome) */
    var suggestHtml = "";
    if (msg.showSuggestions && !isUser && !isTyping) {
      suggestHtml = '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">' + SUGGESTIONS.map(function (s) {
        return '<button type="button" data-ai-suggest="' + esc(s) + '" style="border-radius:999px;border:1px solid ' + t.chipBorder + ';background:' + t.chipBg + ';padding:5px 12px;font-size:11px;font-weight:500;color:' + t.chipText + ';cursor:pointer">' + esc(s) + "</button>";
      }).join("") + "</div>";
    }

    /* wizard option buttons */
    var wizardHtml = "";
    if (msg.wizardOptions && !isTyping) {
      wizardHtml = '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">' +
        msg.wizardOptions.map(function (opt) {
          return '<button type="button" data-wizard-pick="' + esc(opt.value) + '" style="border-radius:10px;border:1px solid ' + t.chipBorder + ';background:' + t.chipBg + ';padding:8px 14px;font-size:12px;font-weight:600;color:' + t.chipText + ';cursor:pointer;transition:background .15s">' + esc(opt.label) + '</button>';
        }).join("") +
        (msg.wizardAllowTyping ? '<p style="width:100%;margin-top:2px;font-size:10px;color:' + t.timestamp + '">Or type your answer below</p>' : '') +
        '</div>';
    }

    /* bubble styles */
    var bubbleStyle = isUser
      ? "max-width:82%;margin-left:auto;border-radius:16px 16px 4px 16px;background:" + t.userBubble + ";padding:10px 14px;color:" + t.userText + ";box-shadow:0 2px 8px rgba(10,40,38,0.15)"
      : "max-width:calc(100% - 36px);border-radius:16px 16px 16px 4px;border:1px solid " + t.aiBubbleBorder + ";background:" + t.aiBubbleBg + ";padding:10px 14px;color:" + t.aiBubbleText + ";box-shadow:0 1px 4px rgba(10,40,38,0.06)";

    var wrapStyle = isUser
      ? "display:flex;justify-content:flex-end;gap:0"
      : "display:flex;justify-content:flex-start;gap:8px;align-items:flex-start";

    return '<div class="vrs-msg-appear" style="' + wrapStyle + '">' +
      avatarHtml +
      '<div style="min-width:0;' + (isUser ? 'max-width:82%' : 'flex:1;min-width:0') + '">' +
      '<div style="' + bubbleStyle + '">' +
      '<div style="font-size:13px;line-height:1.6">' + bodyHtml + "</div>" +
      citeHtml + quoteHtml + cardsHtml + actHtml + suggestHtml + wizardHtml +
      "</div>" +
      (ts && !isTyping ? '<p style="margin-top:4px;font-size:10px;color:' + t.timestamp + ';' + (isUser ? 'text-align:right' : '') + '">' + esc(ts) + "</p>" : "") +
      "</div></div>";
  }

  /* ─── Build DOM ─── */
  function buildUi() {
    var t = T();
    var shell = document.createElement("section");
    shell.className = "vrs-ai-chat";
    shell.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:9999";
    shell.setAttribute("role", "region");
    shell.setAttribute("aria-label", "AI Booking Chat");

    shell.innerHTML =
      /* FAB */
      '<button type="button" data-ai-fab aria-expanded="false" aria-controls="vrsAiPanel" ' +
      'style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,#145f59,#1a8a7e);color:#fff;border:none;cursor:pointer;box-shadow:0 8px 30px rgba(10,60,55,0.35)">' +
      ICON_CHAT +
      '<span data-ai-badge style="display:none;position:absolute;right:-4px;top:-4px;min-width:20px;border-radius:999px;background:#ef4444;padding:2px 6px;text-align:center;font-size:10px;font-weight:700;line-height:1;color:#fff"></span>' +
      "</button>" +

      /* Panel */
      '<div id="vrsAiPanel" data-ai-panel ' +
      'style="height:min(78vh,640px);width:min(94vw,400px);bottom:4.5rem;position:absolute;right:0;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;border:1px solid ' + t.panelBorder + ';background:' + t.panelBg + ';opacity:0;pointer-events:none;box-shadow:0 24px 64px rgba(8,40,44,0.22);transition:all .2s;transform:translateY(12px)" ' +
      'role="dialog" aria-label="Booking AI Chat">' +

      /* Header */
      '<header data-ai-header style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ' + t.headerBorder + ';background:' + t.headerBg + ';padding:12px 16px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,#145f59,#1a8a7e);color:#fff">' + ICON_BOT + "</div>" +
      '<div><h3 style="font-size:14px;font-weight:700;color:' + t.headerTitle + ';margin:0">Booking Assistant</h3>' +
      '<p style="display:flex;align-items:center;gap:4px;font-size:10px;color:' + t.headerSub + ';margin:0"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 4px rgba(16,185,129,0.6)"></span>Online &middot; Session only</p>' +
      "</div></div>" +
      '<div style="display:flex;align-items:center;gap:2px">' +
      '<button type="button" data-ai-new-header style="border-radius:8px;padding:8px;color:' + t.headerBtn + ';background:none;border:none;cursor:pointer" title="Start a new chat" aria-label="Start a new chat">' +
      '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>' +
      "</button>" +
      '<button type="button" data-ai-history-toggle style="border-radius:8px;padding:8px;color:' + t.headerBtn + ';background:none;border:none;cursor:pointer" title="Chat history">' + ICON_HISTORY + "</button>" +
      '<button type="button" data-ai-clear style="border-radius:8px;padding:8px;color:' + t.headerBtn + ';background:none;border:none;cursor:pointer" title="Reset this chat">' + ICON_CLEAR + "</button>" +
      '<button type="button" data-ai-close style="border-radius:8px;padding:8px;color:' + t.headerBtn + ';background:none;border:none;cursor:pointer" title="Close">' + ICON_CLOSE + "</button>" +
      "</div></header>" +

      /* Thread */
      '<div style="flex:1 1 0%;min-height:0;position:relative">' +
      '<div data-ai-thread class="vrs-chat-thread" style="height:100%;overflow-y:auto;background:' + t.threadBg + ';padding:16px 12px"></div>' +

      /* History panel overlay */
      '<div data-ai-history class="vrs-history-slide is-hidden" style="position:absolute;inset:0;z-index:20;overflow-y:auto;background:' + t.histBg + ';padding:16px">' +
      '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">' +
      '<h4 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' + t.histTitle + '">Chat History</h4>' +
      '<button type="button" data-ai-history-close style="border-radius:6px;padding:4px 8px;font-size:10px;font-weight:600;color:' + t.histTitle + ';cursor:pointer;border:1px solid ' + t.panelBorder + ';background:' + t.histItemBg + '">Close</button>' +
      "</div>" +
      '<div data-ai-history-body></div>' +
      "</div>" +
      "</div>" +

      /* Composer */
      '<form data-ai-form style="flex-shrink:0;display:flex;align-items:center;gap:8px;border-top:1px solid ' + t.composerBorder + ';background:' + t.composerBg + ';padding:10px 12px">' +
      '<input type="text" data-ai-input maxlength="400" placeholder="Ask about bookings, trips, refund..." autocomplete="off" ' +
      'style="flex:1;min-width:0;border:1px solid ' + t.inputBorder + ';border-radius:12px;background:' + t.inputBg + ';padding:10px 14px;font-size:13px;color:' + t.inputText + ';outline:none" />' +
      '<button type="submit" data-ai-send ' +
      'style="flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:linear-gradient(135deg,#145f59,#1a8a7e);color:#fff;border:none;cursor:pointer;box-shadow:0 2px 6px rgba(10,40,38,0.2)">' +
      ICON_SEND + "</button>" +
      "</form>" +

      "</div>";

    document.body.appendChild(shell);

    return {
      root: shell,
      fab: shell.querySelector("[data-ai-fab]"),
      badge: shell.querySelector("[data-ai-badge]"),
      panel: shell.querySelector("[data-ai-panel]"),
      thread: shell.querySelector("[data-ai-thread]"),
      form: shell.querySelector("[data-ai-form]"),
      input: shell.querySelector("[data-ai-input]"),
      send: shell.querySelector("[data-ai-send]"),
      newHeaderBtn: shell.querySelector("[data-ai-new-header]"),
      clearBtn: shell.querySelector("[data-ai-clear]"),
      closeBtn: shell.querySelector("[data-ai-close]"),
      historyToggle: shell.querySelector("[data-ai-history-toggle]"),
      historyPanel: shell.querySelector("[data-ai-history]"),
      historyClose: shell.querySelector("[data-ai-history-close]"),
      historyBody: shell.querySelector("[data-ai-history-body]"),
    };
  }

  /* ─── Panel Toggle ─── */
  function isOpen(ui) { return ui.panel.classList.contains("is-open"); }

  function openPanel(ui) {
    ui.panel.style.opacity = "1";
    ui.panel.style.pointerEvents = "auto";
    ui.panel.style.transform = "translateY(0) scale(1)";
    ui.panel.classList.add("is-open", "vrs-panel-enter");
    ui.fab.setAttribute("aria-expanded", "true");
    setTimeout(function () { ui.input.focus(); }, 80);
  }

  function closePanel(ui) {
    ui.panel.style.opacity = "0";
    ui.panel.style.pointerEvents = "none";
    ui.panel.style.transform = "translateY(12px) scale(0.97)";
    ui.panel.classList.remove("is-open", "vrs-panel-enter");
    ui.fab.setAttribute("aria-expanded", "false");
    ui.historyPanel.classList.add("is-hidden");
  }

  /* ─── Badge ─── */
  function renderBadge(ui, state) {
    var c = Math.max(0, state.unreadCount || 0);
    if (!c) { ui.badge.style.display = "none"; ui.badge.textContent = ""; return; }
    ui.badge.style.display = "block";
    ui.badge.textContent = c > 99 ? "99+" : String(c);
  }

  function clearUnread(ui, state, library) { state.unreadCount = 0; save(state, library); renderBadge(ui, state); }

  function bumpUnread(ui, state, library) {
    if (isOpen(ui)) return;
    state.unreadCount = (state.unreadCount || 0) + 1;
    save(state, library); renderBadge(ui, state);
  }

  /* ─── Render ─── */
  function renderThread(ui, state) {
    ui.thread.innerHTML = state.messages.map(renderMsg).join("");
    requestAnimationFrame(function () {
      ui.thread.scrollTo({ top: ui.thread.scrollHeight, behavior: "smooth" });
    });
  }

  function renderHistory(ui, state, library) {
    var t = T();

    /* ─── Session list (the main change in v1) ─── */
    var sessions = library ? listSessions(library) : [];
    var activeId = library ? library.activeId : "";

    var sessionsHtml = sessions.map(function (s) {
      var isActive = s.sessionId === activeId;
      var preview = "";
      var lastMsg = (s.messages || []).filter(function (m) { return !m.isTyping; }).slice(-1)[0];
      if (lastMsg) preview = trim(lastMsg.text || "").replace(/\s+/g, " ");
      var title = trim(s.title) || "New chat";
      var msgCount = (s.messages || []).filter(function (m) { return !m.isTyping; }).length;
      var when = relTime(s.updatedAt);
      /* Outer is a div with role=button (NOT a <button>) because we nest a
       * real <button> for "delete chat" inside, and nested buttons are
       * invalid HTML5. Keyboard support is provided via tabindex+keydown. */
      return '<div role="button" tabindex="0" data-ai-session-id="' + esc(s.sessionId) + '" aria-label="Open chat: ' + esc(title) + '" ' +
        'style="position:relative;display:block;width:100%;text-align:left;border-radius:10px;border:1px solid ' + (isActive ? t.cardPrice : t.actionBorder) + ';' +
        'background:' + (isActive ? t.citeBg : t.histItemBg) + ';padding:10px 30px 10px 12px;cursor:pointer;margin-bottom:6px;transition:transform .12s,border-color .12s">' +
        '<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:' + (isActive ? t.citeText : t.histItemText) + '">' +
        (isActive ? '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:' + t.cardPrice + ';box-shadow:0 0 0 2px ' + t.cardPrice + '33"></span>' : '') +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(title) + '</span>' +
        '</div>' +
        (preview ? '<p style="margin:3px 0 0;font-size:10px;color:' + t.histItemSub + ';line-height:1.4;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">' + esc(preview) + '</p>' : '') +
        '<p style="margin:4px 0 0;font-size:9px;color:' + t.timestamp + ';font-weight:600;letter-spacing:0.04em">' + esc(when) + ' \u2022 ' + esc(String(msgCount)) + ' message' + (msgCount === 1 ? '' : 's') + '</p>' +
        '<button type="button" data-ai-session-delete="' + esc(s.sessionId) + '" aria-label="Delete chat" title="Delete chat" ' +
        'style="position:absolute;top:6px;right:6px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:none;background:transparent;color:' + t.timestamp + ';cursor:pointer">' +
        '<svg viewBox="0 0 16 16" style="width:12px;height:12px" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h10M6 5V3.5A0.5 0.5 0 0 1 6.5 3h3a0.5 0.5 0 0 1 0.5 0.5V5M5 5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5"/></svg>' +
        '</button>' +
        '</div>';
    }).join("");

    if (!sessions.length) {
      sessionsHtml = '<p style="border-radius:8px;border:1px dashed ' + t.panelBorder + ';background:' + t.histItemBg + ';padding:12px;text-align:center;font-size:12px;color:' + t.timestamp + '">No chats yet \u2014 start a new one!</p>';
    }

    var newChatBtn = '<button type="button" data-ai-new-session ' +
      'style="display:flex;width:100%;align-items:center;justify-content:center;gap:6px;border-radius:10px;border:1px dashed ' + t.cardPrice + ';background:' + t.citeBg + ';padding:9px 12px;font-size:12px;font-weight:700;color:' + t.citeText + ';cursor:pointer;margin-bottom:10px">' +
      '<svg viewBox="0 0 16 16" style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v10M3 8h10"/></svg>' +
      'Start a new chat' +
      '</button>';

    /* ─── Recent searches ─── */
    var searches = state.searches || [];
    var searchHtml = searches.length
      ? searches.slice(0, 8).map(function (s, i) {
          return '<button type="button" data-ai-search-val="' + esc(s) + '" ' +
            'style="display:flex;width:100%;align-items:center;gap:8px;border-radius:8px;border:1px solid ' + t.actionBorder + ';background:' + t.histItemBg + ';padding:7px 10px;text-align:left;font-size:12px;color:' + t.histItemText + ';cursor:pointer;margin-bottom:5px">' +
            '<span style="flex-shrink:0;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:' + t.citeBg + ';font-size:9px;font-weight:700;color:' + t.citeText + '">' + (i + 1) + "</span>" +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s) + "</span></button>";
        }).join("")
      : '<p style="border-radius:8px;border:1px dashed ' + t.panelBorder + ';background:' + t.histItemBg + ';padding:10px;text-align:center;font-size:11px;color:' + t.timestamp + '">No searches yet</p>';

    ui.historyBody.innerHTML =
      '<section style="margin-bottom:14px">' +
      '<h5 style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' + t.headerSub + '">Your Chats</h5>' +
      newChatBtn +
      sessionsHtml +
      "</section>" +
      '<section><h5 style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' + t.headerSub + '">Recent Searches</h5>' +
      '<div>' + searchHtml + "</div></section>";
  }

  /* ─── Input Lock ─── */
  function lockInput(ui) {
    ui.input.disabled = true;
    ui.send.disabled = true;
    ui.input.style.opacity = "0.6";
  }

  function unlockInput(ui) {
    ui.input.disabled = false;
    ui.send.disabled = false;
    ui.input.style.opacity = "1";
    ui.input.focus();
  }

  /* ─── Trip Wizard ─── */
  function startTripWizard(ui, state, library, mode) {
    state.tripWizard = { mode: mode === "multi" ? "multi" : "single", step: 0, answers: {} };
    save(state, library);
    showWizardStep(ui, state, library);
  }

  function showWizardStep(ui, state, library) {
    var wiz = state.tripWizard;
    if (!wiz) return;
    var steps = getWizardSteps(wiz.mode);
    if (wiz.step >= steps.length) return;
    var step = steps[wiz.step];
    pushMsg(state, {
      id: uid("m"), role: "assistant", text: step.question,
      timestamp: new Date().toISOString(), citations: [], actions: [],
      wizardOptions: step.options,
      wizardAllowTyping: step.allowTyping,
    }, library);
    save(state, library);
    renderThread(ui, state);
  }

  function advanceWizard(ui, state, library, answer) {
    var wiz = state.tripWizard;
    if (!wiz) return;
    var steps = getWizardSteps(wiz.mode);
    if (wiz.step >= steps.length) return;
    var step = steps[wiz.step];

    /* Remove wizard options from the last AI message to avoid re-clicking */
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].wizardOptions) {
        state.messages[i].wizardOptions = null;
        break;
      }
    }

    /* Show user's answer */
    pushMsg(state, {
      id: uid("m"), role: "user", text: answer,
      timestamp: new Date().toISOString(), citations: [], actions: [],
    }, library);

    wiz.answers[step.key] = answer;
    wiz.step++;
    save(state, library);
    renderThread(ui, state);

    if (wiz.step >= steps.length) {
      /* All steps done — build query and call AI */
      var query = buildWizardQuery(wiz.answers, wiz.mode);
      state.tripWizard = null;
      save(state, library);
      handleSubmit(ui, state, library, query);
    } else {
      showWizardStep(ui, state, library);
    }
  }

  function buildWizardQuery(answers, mode) {
    /* Multi-stop: lead with the itinerary so the backend's stop parser fires
     * (handleMultiLegQuote requires 2+ stops to engage). */
    if (mode === "multi" && answers.stops) {
      var parts = ["Plan a multi-stop trip: " + answers.stops];
      if (answers.people) parts.push("for " + answers.people);
      if (answers.fuel) parts.push("prefer " + answers.fuel + " vehicle");
      if (answers.budget) parts.push(answers.budget);
      return parts.join(", ");
    }

    var parts2 = ["I want to plan a trip"];
    if (answers.people) parts2.push("for " + answers.people);
    if (answers.fuel) parts2.push("prefer " + answers.fuel + " vehicle");
    if (answers.budget) parts2.push(answers.budget);
    if (answers.destination) parts2.push("destination type " + answers.destination);
    return parts2.join(", ");
  }

  /* ─── Fallback ─── */
  function fallbackMsg(reason) {
    return {
      id: uid("m"), role: "assistant",
      text: "I couldn't resolve that right now." + (reason ? " " + reason : "") + "\nWould you like me to connect you with support?",
      timestamp: new Date().toISOString(), citations: [],
      actions: [{ type: "contact_support", label: "Connect to Support", href: "mailto:support@rentavehiclenepal.com" }],
    };
  }

  /* ─── Submit ─── */
  async function handleSubmit(ui, state, library, query) {
    trackSearch(state, query, library);
    pushMsg(state, {
      id: uid("m"), role: "user", text: query,
      timestamp: new Date().toISOString(), citations: [], actions: [],
    }, library);
    pushMsg(state, {
      id: uid("m"), role: "assistant", text: "",
      timestamp: new Date().toISOString(), citations: [], actions: [], isTyping: true,
    }, library);
    renderThread(ui, state);
    lockInput(ui);

    try {
      var data = await askAI(query, state);
      var text = trim(data && data.answer);
      if (!text) throw new Error("Empty AI response.");
      replaceTyping(state, {
        id: uid("m"), role: "assistant", text: text,
        timestamp: new Date().toISOString(),
        citations: normCitations(data && data.citations),
        actions: normActions(data && data.actions),
      }, library);
      bumpUnread(ui, state, library);
    } catch (err) {
      replaceTyping(state, fallbackMsg(trim(err && err.message)), library);
      bumpUnread(ui, state, library);
    }

    unlockInput(ui);
    renderThread(ui, state);
    renderHistory(ui, state, library);
  }

  /* ─── Session switching helpers ─────────────────────────────────────
   * These helpers operate on the closure-captured state via `ref` so any
   * listener attached to the panel always reads/writes the *currently
   * active* session (not the one captured at attach time). */
  function activateSession(ref, ui, sessionId) {
    if (!ref.library.sessions[sessionId]) return;
    /* Persist the current state before switching so we don't lose updates. */
    save(ref.state, ref.library);
    ref.library.activeId = sessionId;
    ref.state = ref.library.sessions[sessionId];
    saveLibrary(ref.library);
    renderThread(ui, ref.state);
    renderBadge(ui, ref.state);
    renderHistory(ui, ref.state, ref.library);
  }

  function newSession(ref, ui) {
    var fresh = freshState();
    ref.library.sessions[fresh.sessionId] = fresh;
    ref.library.activeId = fresh.sessionId;
    ref.state = fresh;
    saveLibrary(ref.library);
    renderThread(ui, ref.state);
    renderBadge(ui, ref.state);
    renderHistory(ui, ref.state, ref.library);
  }

  function deleteSession(ref, ui, sessionId) {
    if (!ref.library.sessions[sessionId]) return;
    delete ref.library.sessions[sessionId];
    /* If we deleted the active session, switch to the next most recent or
     * create a fresh one when the library is empty. */
    if (ref.library.activeId === sessionId) {
      var remaining = listSessions(ref.library);
      if (remaining.length) {
        ref.library.activeId = remaining[0].sessionId;
        ref.state = remaining[0];
      } else {
        var fresh = freshState();
        ref.library.sessions[fresh.sessionId] = fresh;
        ref.library.activeId = fresh.sessionId;
        ref.state = fresh;
      }
    }
    saveLibrary(ref.library);
    renderThread(ui, ref.state);
    renderBadge(ui, ref.state);
    renderHistory(ui, ref.state, ref.library);
  }

  /* ─── Init ─── */
  function init() {
    if (!document.body || document.body.classList.contains("vrs-admin-page")) return;
    injectStyles();
    var ui = buildUi();

    /* `ref` is shared across every listener so that handlers always operate
     * on the *currently active* state/library, even after the user switches
     * to a different session via the history panel. */
    var library = loadLibrary();
    var state = library.sessions[library.activeId];
    var ref = { state: state, library: library };

    renderThread(ui, ref.state);
    renderHistory(ui, ref.state, ref.library);
    renderBadge(ui, ref.state);

    /* FAB toggle */
    ui.fab.addEventListener("click", function () {
      if (isOpen(ui)) { closePanel(ui); }
      else { openPanel(ui); clearUnread(ui, ref.state, ref.library); }
    });

    ui.closeBtn.addEventListener("click", function () { closePanel(ui); });

    /* Header "+" — open a new session straight away (does NOT delete the
     * current one; it stays in history). */
    if (ui.newHeaderBtn) {
      ui.newHeaderBtn.addEventListener("click", function () {
        newSession(ref, ui);
      });
    }

    /* Clear chat — replaces the active session's content with a fresh welcome
     * (without removing the session from history). */
    ui.clearBtn.addEventListener("click", function () {
      var fresh = freshState({ id: ref.state.sessionId });
      ref.library.sessions[fresh.sessionId] = fresh;
      ref.state = fresh;
      saveLibrary(ref.library);
      renderThread(ui, ref.state);
      renderHistory(ui, ref.state, ref.library);
      renderBadge(ui, ref.state);
    });

    /* History panel */
    ui.historyToggle.addEventListener("click", function () { ui.historyPanel.classList.toggle("is-hidden"); });
    ui.historyClose.addEventListener("click", function () { ui.historyPanel.classList.add("is-hidden"); });

    /* Action clicks inside thread (including vehicle cards, wizard picks) */
    ui.thread.addEventListener("click", function (e) {
      /* Wizard option pick */
      var wizBtn = e.target && e.target.closest("button[data-wizard-pick]");
      if (wizBtn && ref.state.tripWizard) {
        var wizVal = wizBtn.getAttribute("data-wizard-pick");
        advanceWizard(ui, ref.state, ref.library, wizVal);
        return;
      }

      /* Vehicle cards */
      var card = e.target && e.target.closest(".vrs-vehicle-card[data-action-vehicle-id]");
      if (card) { runAction(card); return; }
      var btn = e.target && e.target.closest("button[data-action-type]");
      if (btn) { runAction(btn); return; }

      /* Suggestion chips */
      var suggest = e.target && e.target.closest("button[data-ai-suggest]");
      if (suggest) {
        var val = trim(suggest.getAttribute("data-ai-suggest"));
        if (val) {
          /* Remove suggestion chips from welcome message */
          if (ref.state.messages.length && ref.state.messages[0].showSuggestions) {
            ref.state.messages[0].showSuggestions = false; save(ref.state, ref.library);
          }
          var lvSuggest = val.toLowerCase();
          /* Intercept "Plan a trip" / "Multi-stop trip" to start the wizard.
           * (Also catches plural/spacing variants for safety.) */
          if (/^plan\s+a?\s*trip$/.test(lvSuggest) || /^multi[\s-]?stop\s*trips?$/.test(lvSuggest)) {
            pushMsg(ref.state, {
              id: uid("m"), role: "user", text: val,
              timestamp: new Date().toISOString(), citations: [], actions: [],
            }, ref.library);
            renderThread(ui, ref.state);
            startTripWizard(ui, ref.state, ref.library, lvSuggest === "plan a trip" ? "single" : "multi");
            return;
          }
          handleSubmit(ui, ref.state, ref.library, val);
        }
      }
    });

    /* History-panel clicks: session switch / delete / search re-fill */
    ui.historyBody.addEventListener("click", function (e) {
      /* Delete button — must be checked BEFORE the session-row check because
       * it sits inside one. */
      var deleteBtn = e.target && e.target.closest("button[data-ai-session-delete]");
      if (deleteBtn) {
        var delId = deleteBtn.getAttribute("data-ai-session-delete");
        if (delId) deleteSession(ref, ui, delId);
        e.stopPropagation();
        return;
      }

      var sessRow = e.target && e.target.closest("[data-ai-session-id]");
      if (sessRow) {
        var sid = sessRow.getAttribute("data-ai-session-id");
        if (sid && sid !== ref.library.activeId) activateSession(ref, ui, sid);
        return;
      }

      var newBtn = e.target && e.target.closest("button[data-ai-new-session]");
      if (newBtn) { newSession(ref, ui); return; }

      var btn = e.target && e.target.closest("button[data-ai-search-val]");
      if (!btn) return;
      var val = trim(btn.getAttribute("data-ai-search-val"));
      if (val) { ui.input.value = val; ui.input.focus(); ui.historyPanel.classList.add("is-hidden"); }
    });

    /* Keyboard support for the role=button session rows (Enter/Space). */
    ui.historyBody.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var sessRow = e.target && e.target.closest && e.target.closest("[data-ai-session-id][role='button']");
      if (!sessRow) return;
      e.preventDefault();
      var sid = sessRow.getAttribute("data-ai-session-id");
      if (sid && sid !== ref.library.activeId) activateSession(ref, ui, sid);
    });

    /* Form submit */
    ui.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = trim(ui.input.value);
      if (!q || ui.input.disabled) return;
      ui.input.value = "";

      /* If wizard is active, feed typed answer into wizard */
      if (ref.state.tripWizard) {
        advanceWizard(ui, ref.state, ref.library, q);
        return;
      }

      /* Remove suggestion chips from welcome message */
      if (ref.state.messages.length && ref.state.messages[0].showSuggestions) {
        ref.state.messages[0].showSuggestions = false; save(ref.state, ref.library);
      }

      /* Intercept trip-planning keywords to start the wizard. Multi-stop
       * keywords ("multi-stop", "multiple stops", "few places", "round trip")
       * jump straight into the multi-stop branch; bare "plan a trip" goes to
       * the single branch. We accept both singular ("multiple stop") and
       * plural ("multiple stops") since users phrase it both ways. */
      var lq = q.toLowerCase();
      var isMultiStop = /(multi[\s-]?stops?|multiple\s+(stops?|places?|destinations?|cities|locations?)|many\s+(stops?|places?)|few\s+(stops?|places?)|several\s+(stops?|places?|cities)|package\s+price|package\s+(quote|deal)|estimate.*package|itinerary|round[\s-]?trip|tour\s+(around|of)|hop\s+(between|across))/i.test(lq);
      /* Detect single-trip intent. We removed the length cap because users
       * typing longer phrases like "i want to plan a trip" should still hit
       * the wizard. Multi-stop check above takes priority for itinerary words. */
      var hasTripWord = /\b(trip|travel|journey|vacation|holiday|tour|road\s*trip)\b/.test(lq);
      var hasPlanIntent = /(plan|book|arrange|organize|recommend|suggest|find\s+(me\s+)?a)\s+(a\s+)?(trip|travel|journey|vacation|holiday|tour|vehicle|car)/.test(lq) ||
        /(want|need|looking)\s+(to|for)\s+(plan|book|go|travel|rent)/.test(lq);
      var isSingleTrip = !isMultiStop && (
        /^plan\s*(a\s*)?trip$/i.test(lq) ||
        (hasTripWord && hasPlanIntent) ||
        /^(i\s+want\s+to\s+)?plan\s*(a\s*)?trip/i.test(lq)
      );
      if (isMultiStop || isSingleTrip) {
        pushMsg(ref.state, {
          id: uid("m"), role: "user", text: q,
          timestamp: new Date().toISOString(), citations: [], actions: [],
        }, ref.library);
        renderThread(ui, ref.state);
        startTripWizard(ui, ref.state, ref.library, isMultiStop ? "multi" : "single");
        return;
      }

      handleSubmit(ui, ref.state, ref.library, q);
    });

    /* Escape to close */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen(ui)) closePanel(ui);
    });

    /* Theme observer — re-render on dark/light toggle */
    function applyTheme() {
      var t = T();
      ui.panel.style.background = t.panelBg;
      ui.panel.style.borderColor = t.panelBorder;
      var header = ui.panel.querySelector("[data-ai-header]");
      if (header) {
        header.style.background = t.headerBg;
        header.style.borderColor = t.headerBorder;
        var h3 = header.querySelector("h3");
        if (h3) h3.style.color = t.headerTitle;
        var sub = header.querySelector("p");
        if (sub) sub.style.color = t.headerSub;
        var btns = header.querySelectorAll("button");
        for (var bi = 0; bi < btns.length; bi++) btns[bi].style.color = t.headerBtn;
      }
      var thread = ui.thread;
      if (thread) thread.style.background = t.threadBg;
      var form = ui.form;
      if (form) { form.style.background = t.composerBg; form.style.borderColor = t.composerBorder; }
      ui.input.style.background = t.inputBg;
      ui.input.style.borderColor = t.inputBorder;
      ui.input.style.color = t.inputText;
      var hist = ui.historyPanel;
      if (hist) hist.style.background = t.histBg;
      renderThread(ui, ref.state);
      renderHistory(ui, ref.state, ref.library);
    }
    try {
      var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.attributeName === "class" || m.attributeName === "data-theme") applyTheme();
        });
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    } catch (_) { /* old browser */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
