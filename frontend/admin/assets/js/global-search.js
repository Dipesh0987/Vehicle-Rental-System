function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSearchEntry({ entity, entityLabel, module, id, title, subtitle, meta, hash, tokens }) {
  return {
    entity,
    entityLabel,
    module,
    id,
    title,
    subtitle,
    meta,
    hash,
    tokens: (Array.isArray(tokens) ? tokens : []).map(normalizeText).filter(Boolean),
  };
}

function entryFromBooking(row) {
  const id = String(row && row.id ? row.id : '').trim();
  const bookingId = String(row && row.bookingId ? row.bookingId : '').trim();
  const title = id || bookingId || 'Booking';
  const subtitleParts = [row && row.customer ? row.customer : '', row && row.vehicle ? row.vehicle : ''].filter(Boolean);
  const metaParts = [row && row.status ? row.status : '', row && row.paymentLabel ? `Paid ${row.paymentLabel}` : ''].filter(Boolean);

  return makeSearchEntry({
    entity: 'bookings',
    entityLabel: 'Bookings',
    module: 'bookings',
    id: bookingId || id,
    title,
    subtitle: subtitleParts.join(' · '),
    meta: metaParts.join(' · '),
    hash: bookingId || id ? `#booking:${encodeURIComponent(bookingId || id)}` : '',
    tokens: [id, bookingId, row && row.customer, row && row.customerEmail, row && row.customerPhone, row && row.vehicle, row && row.pickupLocation, row && row.status, row && row.type, row && row.paymentLabel],
  });
}

function entryFromCustomer(row) {
  const id = String(row && row.id ? row.id : '').trim();
  const title = row && row.name ? row.name : id || 'Customer';
  const subtitleParts = [row && row.email ? row.email : '', row && row.city ? row.city : ''].filter(Boolean);
  const metaParts = [row && row.status ? row.status : '', row && row.phoneNumber ? row.phoneNumber : ''].filter(Boolean);

  return makeSearchEntry({
    entity: 'customers',
    entityLabel: 'Customers',
    module: 'customers',
    id,
    title,
    subtitle: subtitleParts.join(' · '),
    meta: metaParts.join(' · '),
    hash: id ? `#customer:${encodeURIComponent(id)}` : '',
    tokens: [id, row && row.name, row && row.email, row && row.phoneNumber, row && row.city, row && row.country, row && row.status, row && row.documentNumber],
  });
}

function entryFromVehicle(row) {
  const id = String(row && row.id ? row.id : '').trim();
  const title = row && row.name ? row.name : id || 'Vehicle';
  const subtitleParts = [row && row.vehicleNumber ? row.vehicleNumber : '', row && row.category ? row.category : ''].filter(Boolean);
  const metaParts = [row && row.status ? row.status : '', row && row.location ? row.location : ''].filter(Boolean);

  return makeSearchEntry({
    entity: 'vehicles',
    entityLabel: 'Vehicles',
    module: 'vehicles',
    id,
    title,
    subtitle: subtitleParts.join(' · '),
    meta: metaParts.join(' · '),
    hash: id ? `#vehicle:${encodeURIComponent(id)}` : '',
    tokens: [id, row && row.name, row && row.vehicleNumber, row && row.brand, row && row.category, row && row.status, row && row.transmission, row && row.fuelType, row && row.location],
  });
}

function entryFromInvoice(row) {
  const id = String(row && row.invoice ? row.invoice : row && row.id ? row.id : '').trim();
  const title = id || 'Invoice';
  const subtitleParts = [row && row.booking ? row.booking : '', row && row.method ? row.method : ''].filter(Boolean);
  const metaParts = [row && row.status ? row.status : '', Number.isFinite(Number(row.amount)) ? `NPR ${Number(row.amount).toLocaleString()}` : ''].filter(Boolean);

  return makeSearchEntry({
    entity: 'invoices',
    entityLabel: 'Invoices',
    module: 'payments',
    id,
    title,
    subtitle: subtitleParts.join(' · '),
    meta: metaParts.join(' · '),
    hash: id ? `#invoice:${encodeURIComponent(id)}` : '',
    tokens: [id, row && row.booking, row && row.method, row && row.status, row && row.amount],
  });
}

function scoreEntry(entry, queryText) {
  if (!entry || !queryText) {
    return 0;
  }

  const haystack = [entry.id, entry.title, entry.subtitle, entry.meta, ...(entry.tokens || [])]
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  haystack.forEach((value) => {
    if (value === queryText) {
      score = Math.max(score, 4);
      return;
    }

    if (value.startsWith(queryText)) {
      score = Math.max(score, 3);
      return;
    }

    if (value.includes(queryText)) {
      score = Math.max(score, 2);
    }
  });

  return score;
}

export function createAdminGlobalSearchIndex(data) {
  const bookings = Array.isArray(data && data.bookings) ? data.bookings : [];
  const customers = Array.isArray(data && data.customers) ? data.customers : [];
  const vehicles = Array.isArray(data && data.vehicles) ? data.vehicles : [];
  const payments = Array.isArray(data && data.payments) ? data.payments : [];

  return [
    ...bookings.map(entryFromBooking),
    ...customers.map(entryFromCustomer),
    ...vehicles.map(entryFromVehicle),
    ...payments.map(entryFromInvoice),
  ];
}

export function searchAdminGlobalIndex(data, query, { groupLimit = 4 } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  const entries = createAdminGlobalSearchIndex(data)
    .map((entry) => ({ ...entry, score: scoreEntry(entry, normalizedQuery) }))
    .filter((entry) => entry.score > 0);

  const grouped = new Map();
  entries
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .forEach((entry) => {
      if (!grouped.has(entry.entity)) {
        grouped.set(entry.entity, {
          key: entry.entity,
          label: entry.entityLabel,
          items: [],
        });
      }

      const bucket = grouped.get(entry.entity);
      if (bucket.items.length < groupLimit) {
        bucket.items.push(entry);
      }
    });

  return Array.from(grouped.values()).filter((group) => group.items.length > 0);
}
