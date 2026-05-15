const SESSION_KEY = 'adminAssistantSession';
const CITATION_FORMAT = 'Based on admin panel data as of';

const navigationMap = {
  bookings: 'bookings',
  payments: 'payments',
  vehicles: 'vehicles',
  maintenance: 'maintenance',
  notifications: 'notifications',
  customers: 'customers',
  overview: 'overview',
};

function formatTimestamp(date = new Date()) {
  return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${date.toLocaleDateString()}`;
}

function createMessageHtml(message, sender = 'assistant') {
  const wrapper = document.createElement('div');
  wrapper.className = `assistant-message assistant-message--${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'assistant-message__bubble';

  const text = document.createElement('div');
  text.className = 'assistant-message__text';
  text.textContent = message;

  bubble.appendChild(text);
  wrapper.appendChild(bubble);
  return wrapper;
}

function createTableHtml(headers, rows) {
  const table = document.createElement('table');
  table.className = 'assistant-table';
  const head = document.createElement('thead');
  head.innerHTML = `<tr>${headers.map((text) => `<th>${text}</th>`).join('')}</tr>`;
  const body = document.createElement('tbody');
  rows.forEach((row) => {
    body.innerHTML += `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  });
  table.appendChild(head);
  table.appendChild(body);
  return table;
}

function createChartCanvas(id) {
  const wrapper = document.createElement('div');
  wrapper.className = 'assistant-chart-wrapper';
  wrapper.innerHTML = `<canvas id="${id}" width="400" height="220"></canvas>`;
  return wrapper;
}

function persistSession(history) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Assistant session save failed', error);
  }
}

function restoreSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Assistant session restore failed', error);
    return [];
  }
}

function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

function findModuleForQuery(query) {
  for (const key of Object.keys(navigationMap)) {
    if (query.includes(key)) {
      return navigationMap[key];
    }
  }
  return null;
}

function buildCitation() {
  return `${CITATION_FORMAT} ${formatTimestamp()}.`;
}

function countBookingsByStatus(bookings) {
  return bookings.reduce((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});
}

function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function getBookingsToday(bookings) {
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  return bookings.filter((booking) => booking.start === isoToday || booking.end === isoToday).length;
}

function getPayloadFromData(data) {
  return {
    bookings: data.bookings || [],
    payments: data.payments || [],
    vehicles: data.vehicles || [],
    maintenance: data.maintenance || [],
    notifications: data.notifications || [],
    customers: data.customers || [],
    revenueTrend: data.revenueTrend || [],
    metrics: data.metrics || {},
  };
}

function bestAnswer(query, data) {
  const normalized = normalizeQuery(query);
  const payload = getPayloadFromData(data);
  const citation = buildCitation();

  if (!normalized) {
    return {
      answer: 'Please enter a question about fleet, bookings, revenue, maintenance, or notifications.',
      detail: null,
      citation,
      action: null,
    };
  }

  if (/(how many bookings|bookings were made|total bookings)/.test(normalized)) {
    const answeredToday = getBookingsToday(payload.bookings);
    const total = payload.bookings.length;
    const message = `There are ${total} bookings in the current dataset, with ${answeredToday} touching today.`;
    const table = createTableHtml(['Status', 'Count'], Object.entries(countBookingsByStatus(payload.bookings)));
    return {
      answer: `${message} ${citation}`,
      detail: table,
      citation,
      action: 'bookings',
    };
  }

  if (/(revenue trend|revenue.*week|revenue.*last|trend.*revenue)/.test(normalized)) {
    const labels = payload.revenueTrend.map((item) => item.label);
    const values = payload.revenueTrend.map((item) => item.revenue);
    return {
      answer: `Revenue trend for the last seven days is shown below. ${citation}`,
      detail: { type: 'chart', labels, values },
      citation,
      action: 'reports',
    };
  }

  if (/(payments.*pending|pending payments|unpaid|payment status)/.test(normalized)) {
    const pending = payload.payments.filter((payment) => payment.status.toLowerCase() !== 'paid');
    const table = createTableHtml(['Invoice', 'Booking', 'Amount', 'Status'], pending.map((payment) => [payment.invoice, payment.booking, `$${payment.amount}`, payment.status]));
    return {
      answer: `There are ${pending.length} non-paid payments currently pending review. ${citation}`,
      detail: table,
      citation,
      action: 'payments',
    };
  }

  if (/(maintenance|service.*scheduled|maintenance.*scheduled)/.test(normalized)) {
    const upcoming = payload.maintenance.filter((item) => item.status !== 'Completed');
    const table = createTableHtml(['Vehicle', 'Schedule', 'Status', 'Issue'], upcoming.map((item) => [item.vehicle, item.schedule, item.status, item.damage]));
    return {
      answer: `There are ${upcoming.length} maintenance items scheduled or in progress. ${citation}`,
      detail: table,
      citation,
      action: 'maintenance',
    };
  }

  if (/(notification|alerts|messages)/.test(normalized)) {
    const table = createTableHtml(['Title', 'Channel', 'Priority', 'Time'], payload.notifications.map((item) => [item.title, item.channel, item.priority, item.time]));
    return {
      answer: `Here are the latest notifications from the admin panel. ${citation}`,
      detail: table,
      citation,
      action: 'notifications',
    };
  }

  if (/(fleet.*available|available vehicles|vehicle availability)/.test(normalized)) {
    const available = payload.vehicles.filter((vehicle) => vehicle.status.toLowerCase() === 'available');
    const table = createTableHtml(['Vehicle', 'Category', 'Daily Rate', 'Status'], available.map((vehicle) => [vehicle.name, vehicle.category, `$${vehicle.daily}`, vehicle.status]));
    return {
      answer: `There are ${available.length} available vehicles right now. ${citation}`,
      detail: table,
      citation,
      action: 'vehicles',
    };
  }

  if (/(compare|vs|versus)/.test(normalized)) {
    const byCategory = payload.vehicles.reduce((acc, vehicle) => {
      acc[vehicle.category] = (acc[vehicle.category] || 0) + 1;
      return acc;
    }, {});
    const rows = Object.entries(byCategory).map(([category, count]) => [category, count]);
    const table = createTableHtml(['Fleet Category', 'Count'], rows);
    return {
      answer: `Fleet comparison by category is available below. ${citation}`,
      detail: table,
      citation,
      action: 'vehicles',
    };
  }

  if (normalized.includes('today') || normalized.includes('current')) {
    const ongoing = payload.bookings.filter((booking) => booking.status.toLowerCase() === 'ongoing').length;
    const confirmed = payload.bookings.filter((booking) => booking.status.toLowerCase() === 'confirmed').length;
    return {
      answer: `There are ${ongoing} ongoing bookings and ${confirmed} confirmed bookings in the current dataset. ${citation}`,
      detail: null,
      citation,
      action: 'bookings',
    };
  }

  return {
    answer: `I can answer bookings, fleet, revenue, maintenance, and notification questions. Try asking again with a specific topic. ${citation}`,
    detail: null,
    citation,
    action: null,
  };
}

function renderResponseDetail(container, detail) {
  if (!detail) return;

  if (detail.type === 'chart') {
    const canvasId = `assistantChart-${Date.now()}`;
    const chartWrapper = createChartCanvas(canvasId);
    container.appendChild(chartWrapper);
    const ctx = document.getElementById(canvasId);
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: detail.labels,
          datasets: [
            {
              label: 'Revenue',
              data: detail.values,
              borderColor: '#1f7668',
              backgroundColor: 'rgba(31,118,104,0.12)',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: 'rgba(148,163,184,0.18)' } },
          },
        },
      });
    }
    return;
  }

  if (detail instanceof HTMLElement) {
    container.appendChild(detail);
  }
}

function appendAssistantMessage(host, text, detailElement = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'assistant-response';

  const body = document.createElement('div');
  body.className = 'assistant-response__body';

  const textElement = document.createElement('div');
  textElement.className = 'assistant-response__text';
  textElement.textContent = text;

  const detailContainer = document.createElement('div');
  detailContainer.className = 'assistant-response__detail';

  body.appendChild(textElement);
  body.appendChild(detailContainer);
  wrapper.appendChild(body);

  if (detailElement) {
    renderResponseDetail(detailContainer, detailElement);
  }
  return wrapper;
}

function renderHistory(history, container) {
  container.innerHTML = '';
  history.forEach((entry) => {
    const userBubble = createMessageHtml(entry.query, 'user');
    container.appendChild(userBubble);
    const assistantBubble = appendAssistantMessage(container, entry.answer, entry.detail);
    container.appendChild(assistantBubble);
  });
  container.scrollTop = container.scrollHeight;
}

export function initAdminAssistant(appState, navigate) {
  const host = document.getElementById('assistantHost');
  if (!host) return;

  const openButton = document.getElementById('assistantLauncher');
  const panel = document.getElementById('assistantPanel');
  const closeButton = document.getElementById('assistantClose');
  const minimizeButton = document.getElementById('assistantMinimize');
  const input = document.getElementById('assistantInput');
  const sendButton = document.getElementById('assistantSend');
  const historyHost = document.getElementById('assistantHistory');
  const statusLabel = document.getElementById('assistantStatus');

  let chatHistory = restoreSession();
  let isOpen = false;

  function updateStatus(text) {
    if (statusLabel) statusLabel.textContent = text;
  }

  function setPanelOpen(open) {
    if (!panel) return;
    isOpen = open;
    panel.classList.toggle('assistant-panel--open', open);
    openButton?.classList.toggle('assistant-launcher--hidden', open);
    if (open) {
      panel.querySelector('input')?.focus();
    }
  }

  function showReply(answerData) {
    const entry = {
      query: answerData.query,
      answer: answerData.answer,
      detail: answerData.detail,
      action: answerData.action,
      citation: answerData.citation,
    };
    chatHistory.push(entry);
    persistSession(chatHistory);
    renderHistory(chatHistory, historyHost);
    if (answerData.action) {
      const navigation = findModuleForQuery(answerData.action) || answerData.action;
      const actionButton = document.createElement('button');
      actionButton.className = 'assistant-action-button';
      actionButton.textContent = `Go to ${navigation}`;
      actionButton.addEventListener('click', () => navigate(navigation));
      const actionWrapper = document.createElement('div');
      actionWrapper.className = 'assistant-response__action';
      actionWrapper.appendChild(actionButton);
      historyHost.appendChild(actionWrapper);
      historyHost.scrollTop = historyHost.scrollHeight;
    }
  }

  function processQuestion(query) {
    const result = bestAnswer(query, appState.data);
    result.query = query;
    result.detail = result.detail;
    return result;
  }

  function handleSend() {
    if (!input) return;
    const query = input.value.trim();
    if (!query) return;
    const userMessage = createMessageHtml(query, 'user');
    historyHost.appendChild(userMessage);
    input.value = '';
    updateStatus('Thinking...');
    window.setTimeout(() => {
      const response = processQuestion(query);
      showReply(response);
      updateStatus('Ready for your next question');
    }, 250);
  }

  openButton?.addEventListener('click', () => setPanelOpen(true));
  closeButton?.addEventListener('click', () => setPanelOpen(false));
  minimizeButton?.addEventListener('click', () => setPanelOpen(false));
  sendButton?.addEventListener('click', handleSend);
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });

  renderHistory(chatHistory, historyHost);
  updateStatus('Ready for your next question');
  setPanelOpen(false);
}
