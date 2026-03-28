export function renderLineChart(canvasId, labels, datasetLabel, data, color = '#1f7668') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#cbd5e1' : '#64748b';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.22)';

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data,
          borderColor: color,
          borderWidth: 2,
          fill: true,
          pointRadius: 3,
          tension: 0.32,
          backgroundColor: `${color}33`,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisColor },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: axisColor },
        },
      },
    },
  });
}

export function renderBarChart(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#cbd5e1' : '#64748b';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(100, 116, 139, 0.2)';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data,
          borderRadius: 8,
          backgroundColor: ['#1f7668', '#2f866e', '#4b9a77', '#72b085', '#97c296'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisColor },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: axisColor },
        },
      },
    },
  });
}

export function renderPieChart(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const legendColor = isDark ? '#cbd5e1' : '#64748b';

  new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ['#f08f5f', '#1f7668', '#5d90a5', '#e5bb5d', '#8f95b2'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: legendColor,
            usePointStyle: true,
            boxWidth: 8,
          },
        },
      },
    },
  });
}
