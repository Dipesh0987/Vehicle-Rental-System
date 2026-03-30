const FALLBACK_FUEL_TYPES = ["Petrol", "Diesel", "Electric"];

function getCatalogService() {
  return window.VehicleCatalogService || null;
}

function normalizeStatus(status) {
  const value = String(status || "available").toLowerCase();
  if (value === "maintenance") return "Maintenance";
  if (value === "inactive") return "Inactive";
  return "Available";
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapCatalogVehicle(row) {
  const images = Array.isArray(row?.imageUrls) ? row.imageUrls.filter(Boolean) : [];
  const primaryImage = String(row?.primaryImageUrl || images[0] || "");

  return {
    id: String(row?.id || ""),
    name: String(row?.name || ""),
    type: String(row?.type || ""),
    seats: toNumber(row?.seats),
    pricePerDay: toNumber(row?.pricePerDay),
    fuelType: String(row?.fuelType || ""),
    status: normalizeStatus(row?.status),
    createdAt: row?.createdAt || null,
    primaryImage,
    images: images.length ? images : (primaryImage ? [primaryImage] : []),
  };
}

function mapSeedVehicle(seed) {
  return {
    id: String(seed?.id || ""),
    name: String(seed?.name || ""),
    type: String(seed?.category || seed?.type || ""),
    seats: toNumber(seed?.seats, 5),
    pricePerDay: toNumber(seed?.daily),
    fuelType: String(seed?.fuelType || "Petrol"),
    status: normalizeStatus(seed?.status),
    createdAt: null,
    primaryImage: String(seed?.image || ""),
    images: seed?.image ? [seed.image] : [],
  };
}

export function getFuelTypeOptions() {
  const catalog = getCatalogService();
  if (catalog && Array.isArray(catalog.fuelTypes) && catalog.fuelTypes.length) {
    return catalog.fuelTypes.slice();
  }
  return FALLBACK_FUEL_TYPES.slice();
}

export function validateVehicleDraft(draft) {
  const catalog = getCatalogService();
  if (!catalog || typeof catalog.validateVehicleInput !== "function") {
    return {
      valid: false,
      errors: {
        service: "Vehicle catalog service is unavailable on this page.",
      },
      normalized: null,
    };
  }

  return catalog.validateVehicleInput(draft || {});
}

export function normalizeVehicleServiceError(error, fallbackMessage = "Vehicle operation failed.") {
  const catalog = getCatalogService();
  if (catalog && typeof catalog.toPublicError === "function") {
    return catalog.toPublicError(error, fallbackMessage);
  }

  return fallbackMessage;
}

export async function loadAdminVehicles(seedVehicles = []) {
  const catalog = getCatalogService();
  if (!catalog || typeof catalog.listVehicles !== "function") {
    return (seedVehicles || []).map(mapSeedVehicle);
  }

  const vehicles = await catalog.listVehicles({ includeInactive: true });
  return (vehicles || []).map(mapCatalogVehicle);
}

export async function createAdminVehicle(draft) {
  const catalog = getCatalogService();
  if (!catalog || typeof catalog.createVehicle !== "function") {
    throw new Error("Vehicle catalog service is unavailable on this page.");
  }

  const created = await catalog.createVehicle(draft || {});
  return mapCatalogVehicle(created);
}
