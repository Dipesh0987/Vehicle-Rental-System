(function () {
  "use strict";

  var STORAGE_KEY = "vrs:ai-chat-session-v1";
  var WELCOME_MESSAGE = "Welcome to Booking Assistant. Ask me about your upcoming dates, vehicle details, cancellation policy, refund status, or invoice availability.";
  var MAX_MESSAGES = 80;

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
    var roleClass = message.role === "user" ? "vrs-ai-chat__bubble--user" : "vrs-ai-chat__bubble--assistant";
    var safeText = escapeHtml(message.text || "").replace(/\n/g, "<br />");
    var citations = Array.isArray(message.citations) ? message.citations : [];
    var actions = Array.isArray(message.actions) ? message.actions : [];

    var citationsHtml = "";
    if (citations.length) {
      citationsHtml = "<div class=\"vrs-ai-chat__citations\">" + citations.map(function (citation) {
        return "<span class=\"vrs-ai-chat__citation\">Source: " + escapeHtml(citation.bookingCode || "booking") + " (" + escapeHtml(citation.source || "vehicle_bookings") + ")</span>";
      }).join("") + "</div>";
    }

    var actionsHtml = "";
    if (actions.length) {
      actionsHtml = "<div class=\"vrs-ai-chat__actions\">" + actions.map(function (action) {
        return (
          "<button type=\"button\" class=\"vrs-ai-chat__action\" data-action-type=\"" + escapeHtml(action.type || "") + "\"" +
          " data-action-booking-id=\"" + escapeHtml(action.bookingId || "") + "\"" +
          " data-action-vehicle-id=\"" + escapeHtml(action.vehicleId || "") + "\"" +
          " data-action-href=\"" + escapeHtml(action.href || "") + "\">" +
          escapeHtml(action.label || "Open") +
          "</button>"
        );
      }).join("") + "</div>";
    }

    return (
      "<article class=\"vrs-ai-chat__bubble " + roleClass + "\">" +
      "<p>" + safeText + "</p>" +
      citationsHtml +
      actionsHtml +
      "</article>"
    );
  }

  function renderChat(ui, state) {
    ui.thread.innerHTML = state.messages.map(renderMessage).join("");
    ui.thread.scrollTop = ui.thread.scrollHeight;
  }

  function openPanel(ui) {
    ui.panel.classList.add("is-open");
    ui.launchButton.setAttribute("aria-expanded", "true");
    ui.input.focus();
  }

  function closePanel(ui) {
    ui.panel.classList.remove("is-open");
    ui.launchButton.setAttribute("aria-expanded", "false");
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
    shell.className = "vrs-ai-chat";
    shell.innerHTML =
      "<button type=\"button\" class=\"vrs-ai-chat__launch\" aria-expanded=\"false\" aria-controls=\"vrsAiChatPanel\">Booking AI</button>" +
      "<div id=\"vrsAiChatPanel\" class=\"vrs-ai-chat__panel\" role=\"dialog\" aria-label=\"Booking AI Chat\">" +
      "<header class=\"vrs-ai-chat__header\">" +
      "<div><h3>Booking AI Assistant</h3><p>Session-only chat. No history sync.</p></div>" +
      "<div class=\"vrs-ai-chat__header-actions\">" +
      "<button type=\"button\" class=\"vrs-ai-chat__text-btn\" data-ai-clear-chat>Clear chat</button>" +
      "<button type=\"button\" class=\"vrs-ai-chat__text-btn\" data-ai-close-chat>Close</button>" +
      "</div>" +
      "</header>" +
      "<div class=\"vrs-ai-chat__thread\" data-ai-thread></div>" +
      "<form class=\"vrs-ai-chat__composer\" data-ai-form>" +
      "<input type=\"text\" data-ai-input maxlength=\"320\" placeholder=\"Ask about my bookings...\" autocomplete=\"off\" />" +
      "<button type=\"submit\">Send</button>" +
      "</form>" +
      "</div>";

    document.body.appendChild(shell);

    return {
      root: shell,
      launchButton: shell.querySelector(".vrs-ai-chat__launch"),
      panel: shell.querySelector(".vrs-ai-chat__panel"),
      thread: shell.querySelector("[data-ai-thread]"),
      form: shell.querySelector("[data-ai-form]"),
      input: shell.querySelector("[data-ai-input]"),
      clearButton: shell.querySelector("[data-ai-clear-chat]"),
      closeButton: shell.querySelector("[data-ai-close-chat]"),
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

    ui.launchButton.addEventListener("click", function () {
      if (ui.panel.classList.contains("is-open")) {
        closePanel(ui);
      } else {
        openPanel(ui);
      }
    });

    ui.closeButton.addEventListener("click", function () {
      closePanel(ui);
    });

    ui.clearButton.addEventListener("click", function () {
      state = createFreshState();
      persistState(state);
      renderChat(ui, state);
    });

    ui.thread.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.classList.contains("vrs-ai-chat__action")) {
        return;
      }
      runAction(target);
    });

    ui.form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var query = trimText(ui.input.value);
      if (!query) {
        return;
      }

      ui.input.value = "";
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
      } catch (error) {
        replaceTypingMessage(state, buildFallbackAssistantMessage(trimText(error && error.message)));
      }

      renderChat(ui, state);
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
