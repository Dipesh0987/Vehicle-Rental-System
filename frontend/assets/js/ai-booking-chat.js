(function () {
  "use strict";

  var STORAGE_KEY = "vrs:ai-chat-session-v1";
  var WELCOME_MESSAGE = "Welcome to Booking Assistant. Ask me about your upcoming dates, vehicle details, cancellation policy, refund status, or invoice availability.";
  var MAX_MESSAGES = 80;
  var MAX_SEARCHES = 20;

  function uid(prefix) {
    return [prefix || "id", Date.now().toString(36), Math.random().toString(36).slice(2, 8)].join("-");
  }

  function safeJsonParse(raw, fallback) {
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }

  function loadState() {
    var payload = safeJsonParse(sessionStorage.getItem(STORAGE_KEY), null);
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.messages)) {
      return createFreshState();
    }

    return {
      sessionId: String(payload.sessionId || uid("chat-session")).trim(),
      startedAt: String(payload.startedAt || new Date().toISOString()),
      messages: payload.messages.slice(0, MAX_MESSAGES),
      searches: Array.isArray(payload.searches) ? payload.searches.slice(0, MAX_SEARCHES) : [],
      unreadCount: Number.isFinite(Number(payload.unreadCount)) ? Math.max(0, Number(payload.unreadCount)) : 0,
    };
  }

  function createFreshState() {
    return {
      sessionId: uid("chat-session"),
      startedAt: new Date().toISOString(),
      messages: [
        {
          id: uid("msg"),
          role: "assistant",
          text: WELCOME_MESSAGE,
          timestamp: new Date().toISOString(),
          citations: [],
          actions: [],
        },
      ],
      searches: [],
      unreadCount: 0,
    };
  }

  function persistState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // Ignore session storage write failures.
    }
  }

  function trimText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function appendMessage(state, message) {
    state.messages.push(message);
    if (state.messages.length > MAX_MESSAGES) {
      state.messages = state.messages.slice(state.messages.length - MAX_MESSAGES);
    }
    persistState(state);
  }

  function trackSearch(state, query) {
    var text = trimText(query);
    if (!text) {
      return;
    }

    state.searches = [text].concat(
      (state.searches || []).filter(function (entry) {
        return trimText(entry).toLowerCase() !== text.toLowerCase();
      })
    ).slice(0, MAX_SEARCHES);
    persistState(state);
  }

  function replaceTypingMessage(state, replacement) {
    for (var index = state.messages.length - 1; index >= 0; index -= 1) {
      if (state.messages[index] && state.messages[index].isTyping) {
        state.messages.splice(index, 1, replacement);
        persistState(state);
        return;
      }
    }

    appendMessage(state, replacement);
  }

  function renderMessage(message) {
    var roleClass = message.role === "user"
      ? "ml-auto rounded-2xl rounded-br-md bg-[linear-gradient(135deg,#166a61,#1f7c72)] text-white"
      : "mr-auto rounded-2xl rounded-bl-md border border-[#d7e7e1] bg-white text-[#143a3f]";
    var safeText = escapeHtml(message.text || "").replace(/\n/g, "<br />");
    var bodyHtml = safeText;

    if (message.isTyping) {
      bodyHtml =
        "<span class=\"inline-flex items-center gap-1.5\">" +
        "<span class=\"h-2 w-2 rounded-full bg-[#1b625c] animate-pulse\"></span>" +
        "<span class=\"h-2 w-2 rounded-full bg-[#1b625c] animate-pulse [animation-delay:120ms]\"></span>" +
        "<span class=\"h-2 w-2 rounded-full bg-[#1b625c] animate-pulse [animation-delay:240ms]\"></span>" +
        "</span>";
    }
    var citations = Array.isArray(message.citations) ? message.citations : [];
    var actions = Array.isArray(message.actions) ? message.actions : [];

    var citationsHtml = "";
    if (citations.length) {
      citationsHtml = "<div class=\"mt-2 flex flex-wrap gap-1.5\">" + citations.map(function (citation) {
        return "<span class=\"inline-flex rounded-full bg-[#e4f3ef] px-2 py-1 text-[10px] font-semibold text-[#1f665f]\">Source: " + escapeHtml(citation.bookingCode || "booking") + " (" + escapeHtml(citation.source || "vehicle_bookings") + ")</span>";
      }).join("") + "</div>";
    }

    var actionsHtml = "";
    if (actions.length) {
      actionsHtml = "<div class=\"mt-2 flex flex-wrap gap-2\">" + actions.map(function (action) {
        return (
          "<button type=\"button\" class=\"rounded-full border border-[#c7e1db] bg-[#edf8f5] px-3 py-1.5 text-[11px] font-semibold text-[#16524f] transition hover:-translate-y-[1px] hover:bg-[#dbf1ec]\" data-action-type=\"" + escapeHtml(action.type || "") + "\"" +
          " data-action-booking-id=\"" + escapeHtml(action.bookingId || "") + "\"" +
          " data-action-vehicle-id=\"" + escapeHtml(action.vehicleId || "") + "\"" +
          " data-action-href=\"" + escapeHtml(action.href || "") + "\">" +
          escapeHtml(action.label || "Open") +
          "</button>"
        );
      }).join("") + "</div>";
    }

    return (
      "<article class=\"max-w-[92%] px-3 py-2.5 text-[13px] leading-relaxed shadow-[0_4px_12px_rgba(10,37,40,0.08)] " + roleClass + "\">" +
      "<p>" + bodyHtml + "</p>" +
      citationsHtml +
      actionsHtml +
      "</article>"
    );
  }

  function isPanelOpen(ui) {
    return !ui.panel.classList.contains("pointer-events-none");
  }

  function renderUnreadBadge(ui, state) {
    if (!ui.unreadBadge) {
      return;
    }

    var count = Math.max(0, Number(state.unreadCount || 0));
    if (!count) {
      ui.unreadBadge.classList.add("hidden");
      ui.unreadBadge.textContent = "";
      if (ui.launchButton) {
        ui.launchButton.classList.remove("animate-pulse", "ring-4", "ring-[#f15a29]/35");
      }
      return;
    }

    ui.unreadBadge.classList.remove("hidden");
    ui.unreadBadge.textContent = count > 99 ? "99+" : String(count);
    if (ui.launchButton) {
      ui.launchButton.classList.add("animate-pulse", "ring-4", "ring-[#f15a29]/35");
    }
  }

  function markRead(ui, state) {
    state.unreadCount = 0;
    persistState(state);
    renderUnreadBadge(ui, state);
  }

  function bumpUnread(ui, state) {
    if (isPanelOpen(ui)) {
      return;
    }

    state.unreadCount = Math.max(0, Number(state.unreadCount || 0)) + 1;
    persistState(state);
    renderUnreadBadge(ui, state);
  }

  function renderHistoryPanel(ui, state) {
    var searches = Array.isArray(state.searches) ? state.searches : [];
    var recentSearchesHtml = searches.length
      ? searches.map(function (item, index) {
          return "<button type=\"button\" data-ai-search-value=\"" + escapeHtml(item) + "\" class=\"w-full rounded-xl border border-[#d8e7e2] bg-white px-3 py-2 text-left text-[12px] text-[#1a4348] transition hover:bg-[#f1f8f6]\"><span class=\"mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e9f4f1] text-[10px] font-bold text-[#1d6660]\">" + String(index + 1) + "</span>" + escapeHtml(item) + "</button>";
        }).join("")
      : "<p class=\"rounded-xl border border-dashed border-[#cddfda] bg-white px-3 py-2 text-[12px] text-[#5a7478]\">No searches yet. Ask your first booking question.</p>";

    var chatHistoryItems = state.messages.slice(-20).map(function (message) {
      var label = message.role === "user" ? "You" : "AI";
      var tone = message.role === "user" ? "text-[#175e59]" : "text-[#2c5a61]";
      return "<li class=\"rounded-lg bg-white px-2.5 py-2\"><p class=\"text-[11px] font-semibold " + tone + "\">" + label + "</p><p class=\"mt-1 line-clamp-2 text-[11px] text-[#35565b]\">" + escapeHtml(trimText(message.text || "-")) + "</p></li>";
    }).join("");

    ui.historyBody.innerHTML =
      "<section>" +
      "<h4 class=\"mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3a6668]\">Recent Searches</h4>" +
      "<div class=\"space-y-2\">" + recentSearchesHtml + "</div>" +
      "</section>" +
      "<section class=\"mt-4\">" +
      "<h4 class=\"mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3a6668]\">Chat History</h4>" +
      "<ul class=\"space-y-2\">" + chatHistoryItems + "</ul>" +
      "</section>";
  }

  function renderChat(ui, state) {
    ui.thread.innerHTML = state.messages.map(renderMessage).join("");
    ui.thread.scrollTop = ui.thread.scrollHeight;
  }

  function openPanel(ui) {
    ui.panel.classList.remove("opacity-0", "translate-y-2", "pointer-events-none", "scale-95");
    ui.panel.classList.add("is-open");
    ui.launchButton.setAttribute("aria-expanded", "true");
    ui.input.focus();
  }

  function closePanel(ui) {
    ui.panel.classList.add("opacity-0", "translate-y-2", "pointer-events-none", "scale-95");
    ui.panel.classList.remove("is-open");
    ui.launchButton.setAttribute("aria-expanded", "false");
    ui.historyPanel.classList.add("hidden");
  }

  function toggleHistoryPanel(ui) {
    ui.historyPanel.classList.toggle("hidden");
  }

  async function getSupabaseClient() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client is unavailable.");
    }

    return window.SupabaseClient.init();
  }

  async function callBookingChatApi(query) {
    var client = await getSupabaseClient();
    var response = await client.functions.invoke("booking-chat", {
      body: {
        query: query,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        nowIso: new Date().toISOString(),
      },
    });

    if (response.error) {
      throw new Error(String(response.error.message || "Chat API call failed."));
    }

    return response.data || {};
  }

  function normalizeActions(actions) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions.map(function (action) {
      return {
        type: trimText(action && action.type),
        label: trimText(action && action.label) || "Open",
        bookingId: trimText(action && action.bookingId),
        vehicleId: trimText(action && action.vehicleId),
        href: trimText(action && action.href),
      };
    });
  }

  function normalizeCitations(citations) {
    if (!Array.isArray(citations)) {
      return [];
    }

    return citations.map(function (citation) {
      return {
        bookingId: trimText(citation && citation.bookingId),
        bookingCode: trimText(citation && citation.bookingCode) || "booking",
        source: trimText(citation && citation.source) || "vehicle_bookings",
      };
    });
  }

  function openBookingDetail(bookingId) {
    if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
      window.VehicleAuthUI.openBookingsPanel({ bookingId: bookingId });
      return;
    }

    var fallbackLink = document.querySelector("[data-open-bookings-panel]");
    if (fallbackLink) {
      fallbackLink.click();
    }
  }

  function navigateToVehicle(vehicleId) {
    if (!vehicleId) {
      return;
    }

    window.location.assign("vehicle-details.html?id=" + encodeURIComponent(vehicleId));
  }

  function navigateToModification(bookingId, href) {
    var base = trimText(href) || "modify-booking.html";
    if (!bookingId) {
      window.location.assign(base);
      return;
    }

    var glue = base.indexOf("?") >= 0 ? "&" : "?";
    window.location.assign(base + glue + "bookingId=" + encodeURIComponent(bookingId));
  }

  function runAction(actionButton) {
    if (!actionButton) {
      return;
    }

    var type = trimText(actionButton.getAttribute("data-action-type"));
    var bookingId = trimText(actionButton.getAttribute("data-action-booking-id"));
    var vehicleId = trimText(actionButton.getAttribute("data-action-vehicle-id"));
    var href = trimText(actionButton.getAttribute("data-action-href"));

    if (type === "view_booking") {
      openBookingDetail(bookingId);
      return;
    }

    if (type === "open_vehicle") {
      navigateToVehicle(vehicleId);
      return;
    }

    if (type === "confirmation_cta") {
      navigateToModification(bookingId, href);
      return;
    }

    if (type === "contact_support") {
      if (href) {
        window.location.assign(href);
      }
      return;
    }
  }

  function buildUi() {
    var shell = document.createElement("section");
    shell.className = "vrs-ai-chat fixed bottom-16 right-3 z-[320] sm:bottom-20 sm:right-4";
    shell.innerHTML =
      "<button type=\"button\" class=\"vrs-ai-chat__launch group inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#166a61,#1f7c72)] text-white shadow-[0_16px_32px_rgba(7,35,39,0.34)] transition hover:-translate-y-[2px]\" aria-expanded=\"false\" aria-controls=\"vrsAiChatPanel\" aria-label=\"Open booking chat\">" +
      "<svg viewBox=\"0 0 24 24\" class=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 5h16v10H7l-3 3V5z\"></path></svg>" +
      "<span data-ai-unread-badge class=\"absolute -right-1 -top-1 hidden min-w-[1.2rem] rounded-full bg-[#f15a29] px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white shadow-[0_6px_12px_rgba(104,32,18,0.3)]\"></span>" +
      "</button>" +
      "<div id=\"vrsAiChatPanel\" class=\"vrs-ai-chat__panel pointer-events-none absolute bottom-16 right-0 grid h-[min(74vh,620px)] w-[min(95vw,420px)] scale-95 grid-rows-[auto_1fr_auto] overflow-hidden rounded-3xl border border-[#cfe4de] bg-[linear-gradient(170deg,rgba(255,255,255,0.99),rgba(245,251,249,0.97))] opacity-0 shadow-[0_28px_56px_rgba(8,33,37,0.28)] transition duration-200 sm:bottom-16\" role=\"dialog\" aria-label=\"Booking AI Chat\">" +
      "<header class=\"vrs-ai-chat__header flex items-start justify-between border-b border-[#d8e7e2] bg-[#ebf7f4] px-4 py-3\">" +
      "<div><h3 class=\"text-[15px] font-bold text-[#12353a]\">Booking Assistant</h3><p class=\"mt-0.5 text-[11px] text-[#496b6f]\">Session-only chat history on this device</p></div>" +
      "<div class=\"flex items-center gap-1\">" +
      "<button type=\"button\" class=\"inline-flex h-8 w-8 items-center justify-center rounded-full text-[#1d5f5a] transition hover:bg-[#daf0ea]\" data-ai-history-toggle aria-label=\"Open searches and history\">" +
      "<svg viewBox=\"0 0 24 24\" class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 7h16M4 12h16M4 17h16\"/></svg>" +
      "</button>" +
      "<button type=\"button\" class=\"inline-flex h-8 w-8 items-center justify-center rounded-full text-[#1d5f5a] transition hover:bg-[#daf0ea]\" data-ai-clear-chat aria-label=\"Clear chat\">" +
      "<svg viewBox=\"0 0 24 24\" class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18M8 6V4h8v2m-9 0v14h10V6\"/></svg>" +
      "</button>" +
      "<button type=\"button\" class=\"inline-flex h-8 w-8 items-center justify-center rounded-full text-[#1d5f5a] transition hover:bg-[#daf0ea]\" data-ai-close-chat aria-label=\"Close chat\">" +
      "<svg viewBox=\"0 0 24 24\" class=\"h-4 w-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>" +
      "</button>" +
      "</div>" +
      "</header>" +
      "<div class=\"relative min-h-0\">" +
      "<div class=\"h-full space-y-2 overflow-y-auto bg-[linear-gradient(180deg,rgba(246,252,250,0.95),rgba(239,248,245,0.95))] px-3 py-3 vrs-ai-chat__thread\" data-ai-thread></div>" +
      "<aside class=\"vrs-ai-chat__history-panel absolute hidden w-[78%] border-l border-[#d7e6e1] bg-[#f3faf8] p-3 overflow-y-auto\" data-ai-history-panel>" +
      "<div class=\"mb-2 flex items-center justify-between\"><h3 class=\"text-[12px] font-bold text-[#17484b]\">Searches & History</h3><button type=\"button\" class=\"rounded-md px-2 py-1 text-[10px] font-semibold text-[#28595e] hover:bg-[#dff0ec]\" data-ai-history-close>Hide</button></div>" +
      "<div class=\"max-h-full overflow-y-auto pr-1\" data-ai-history-body></div>" +
      "</aside>" +
      "</div>" +
      "<form class=\"vrs-ai-chat__composer grid grid-cols-[1fr_auto] gap-2 border-t border-[#d6e6e0] bg-white px-3 py-3\" data-ai-form>" +
      "<input type=\"text\" data-ai-input maxlength=\"320\" placeholder=\"Ask about my booking dates, refund or invoice...\" autocomplete=\"off\" class=\"w-full rounded-full border border-[#c9dfd9] px-4 py-2 text-[13px] text-[#174248] outline-none transition focus:border-[#4ea598] focus:ring-2 focus:ring-[#4ea598]/25\" />" +
      "<button type=\"submit\" class=\"rounded-full bg-[#1c756b] px-4 py-2 text-[12px] font-bold text-white transition hover:-translate-y-[1px] hover:brightness-105\">Send</button>" +
      "</form>" +
      "</div>";

    document.body.appendChild(shell);

    return {
      root: shell,
      launchButton: shell.querySelector("button[aria-controls='vrsAiChatPanel']"),
      panel: shell.querySelector("#vrsAiChatPanel"),
      thread: shell.querySelector("[data-ai-thread]"),
      form: shell.querySelector("[data-ai-form]"),
      input: shell.querySelector("[data-ai-input]"),
      clearButton: shell.querySelector("[data-ai-clear-chat]"),
      closeButton: shell.querySelector("[data-ai-close-chat]"),
      unreadBadge: shell.querySelector("[data-ai-unread-badge]"),
      historyToggleButton: shell.querySelector("[data-ai-history-toggle]"),
      historyCloseButton: shell.querySelector("[data-ai-history-close]"),
      historyPanel: shell.querySelector("[data-ai-history-panel]"),
      historyBody: shell.querySelector("[data-ai-history-body]"),
    };
  }

  function buildFallbackAssistantMessage(reason) {
    var suffix = reason ? " " + reason : "";
    return {
      id: uid("msg"),
      role: "assistant",
      text: "I could not resolve that right now. I can connect you to support." + suffix,
      timestamp: new Date().toISOString(),
      citations: [],
      actions: [
        {
          type: "contact_support",
          label: "Connect to Support",
          href: "mailto:support@rentavehiclenepal.com",
        },
      ],
    };
  }

  function init() {
    if (!document.body || document.body.classList.contains("vrs-admin-page")) {
      return;
    }

    var ui = buildUi();
    var state = loadState();
    renderChat(ui, state);
    renderHistoryPanel(ui, state);
    renderUnreadBadge(ui, state);

    ui.launchButton.addEventListener("click", function () {
      if (!ui.panel.classList.contains("pointer-events-none")) {
        closePanel(ui);
      } else {
        openPanel(ui);
        markRead(ui, state);
      }
    });

    ui.closeButton.addEventListener("click", function () {
      closePanel(ui);
    });

    ui.clearButton.addEventListener("click", function () {
      state = createFreshState();
      persistState(state);
      renderChat(ui, state);
      renderHistoryPanel(ui, state);
      renderUnreadBadge(ui, state);
    });

    ui.historyToggleButton.addEventListener("click", function () {
      toggleHistoryPanel(ui);
    });

    ui.historyCloseButton.addEventListener("click", function () {
      ui.historyPanel.classList.add("hidden");
    });

    ui.thread.addEventListener("click", function (event) {
      var target = event.target;
      if (!target) {
        return;
      }

      var actionTarget = target.closest("button[data-action-type]");
      if (!actionTarget) {
        return;
      }
      runAction(actionTarget);
    });

    ui.historyBody.addEventListener("click", function (event) {
      var target = event.target;
      if (!target) {
        return;
      }

      var searchButton = target.closest("button[data-ai-search-value]");
      if (!searchButton) {
        return;
      }

      var searchValue = trimText(searchButton.getAttribute("data-ai-search-value"));
      if (!searchValue) {
        return;
      }

      ui.input.value = searchValue;
      ui.input.focus();
      ui.historyPanel.classList.add("hidden");
    });

    ui.form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var query = trimText(ui.input.value);
      if (!query) {
        return;
      }

      ui.input.value = "";
      trackSearch(state, query);
      appendMessage(state, {
        id: uid("msg"),
        role: "user",
        text: query,
        timestamp: new Date().toISOString(),
        citations: [],
        actions: [],
      });

      appendMessage(state, {
        id: uid("msg"),
        role: "assistant",
        text: "Checking your booking data...",
        timestamp: new Date().toISOString(),
        citations: [],
        actions: [],
        isTyping: true,
      });

      renderChat(ui, state);
      renderHistoryPanel(ui, state);

      try {
        var apiResponse = await callBookingChatApi(query);
        var text = trimText(apiResponse && apiResponse.answer);
        if (!text) {
          throw new Error("Empty AI response.");
        }

        replaceTypingMessage(state, {
          id: uid("msg"),
          role: "assistant",
          text: text,
          timestamp: new Date().toISOString(),
          citations: normalizeCitations(apiResponse && apiResponse.citations),
          actions: normalizeActions(apiResponse && apiResponse.actions),
        });
        bumpUnread(ui, state);
      } catch (error) {
        replaceTypingMessage(state, buildFallbackAssistantMessage(trimText(error && error.message)));
        bumpUnread(ui, state);
      }

      renderChat(ui, state);
      renderHistoryPanel(ui, state);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && ui.panel.classList.contains("is-open")) {
        closePanel(ui);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
