export function sortRows(rows, field, direction = 'asc') {
  const copy = [...rows];
  const dir = direction === 'desc' ? -1 : 1;

  copy.sort((a, b) => {
    const aValue = normalize(a[field]);
    const bValue = normalize(b[field]);

    if (aValue > bValue) return 1 * dir;
    if (aValue < bValue) return -1 * dir;
    return 0;
  });

  return copy;
}

export function filterRows(rows, query, fields) {
  const text = query.trim().toLowerCase();
  if (!text) return rows;

  return rows.filter((row) => fields.some((field) => String(row[field] ?? '').toLowerCase().includes(text)));
}

export function paginateRows(rows, page = 1, pageSize = 5) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const active = Math.min(Math.max(page, 1), pages);
  const start = (active - 1) * pageSize;

  return {
    page: active,
    pageSize,
    pages,
    total,
    rows: rows.slice(start, start + pageSize),
  };
}

export function renderPagination({ page, pages }, onClick) {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-2 text-sm font-semibold';

  const prev = document.createElement('button');
  prev.className = 'rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-white/10';
  prev.textContent = 'Prev';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => onClick(page - 1));

  const next = document.createElement('button');
  next.className = 'rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-white/10';
  next.textContent = 'Next';
  next.disabled = page >= pages;
  next.addEventListener('click', () => onClick(page + 1));

  const label = document.createElement('span');
  label.className = 'text-slate-500 dark:text-slate-400';
  label.textContent = `Page ${page} / ${pages}`;

  container.append(prev, label, next);
  return container;
}

function normalize(value) {
  if (typeof value === 'number') return value;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;
  return String(value ?? '').toLowerCase();
}
