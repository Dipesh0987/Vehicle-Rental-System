export function renderLineChart(canvasId, labels, datasetLabel, data, color = '#1f7668') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

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
          ticks: { color: '#64748b' },
        },
        y: {
          grid: { color: 'rgba(100, 116, 139, 0.22)' },
          ticks: { color: '#64748b' },
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
          ticks: { color: '#64748b' },
        },
        y: {
          grid: { color: 'rgba(100, 116, 139, 0.2)' },
          ticks: { color: '#64748b' },
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
            color: '#64748b',
            usePointStyle: true,
            boxWidth: 8,
          },
        },
      },
    },
  });
}
