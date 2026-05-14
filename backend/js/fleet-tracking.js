"use strict";

const DEFAULT_RPC_NAME = "get_active_fleet_tracking";

function readConfig(overrides) {
  const config = overrides || {};
  const url = String(config.supabaseUrl || process.env.SUPABASE_URL || "").trim();
  const key = String(
    config.supabaseServiceKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url) {
    throw new Error("Supabase URL is required (SUPABASE_URL).");
  }

  if (!key) {
    throw new Error(
      "Supabase service key is required (SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return { url: url.replace(/\/$/, ""), key };
}

function buildHeaders(key, extraHeaders) {
  const headers = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: "Bearer " + key,
  };

  if (extraHeaders && typeof extraHeaders === "object") {
    Object.keys(extraHeaders).forEach(function (headerName) {
      headers[headerName] = extraHeaders[headerName];
    });
  }

  return headers;
}

function assertFiniteNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(name + " must be a finite number.");
  }
  return n;
}

function normalizeTelemetryRow(row) {
  if (!row || typeof row !== "object") {
    throw new Error("Telemetry payload must be an object.");
  }

  const vehicleId = String(row.vehicle_id || row.vehicleId || "").trim();
  if (!vehicleId) {
    throw new Error("vehicle_id is required.");
  }

  const latitude = assertFiniteNumber(row.latitude, "latitude");
  const longitude = assertFiniteNumber(row.longitude, "longitude");
  const recordedAtRaw = row.recorded_at || row.recordedAt;
  const source = String(row.source || "device").trim() || "device";

  const normalized = {
    vehicle_id: vehicleId,
    latitude: latitude,
    longitude: longitude,
    source: source,
  };

  if (recordedAtRaw) {
    const asIso = new Date(recordedAtRaw).toISOString();
    normalized.recorded_at = asIso;
  }

  return normalized;
}

async function runRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_err) {
    json = null;
  }

  if (!response.ok) {
    const message =
      (json && (json.message || json.error_description || json.error)) ||
      "Supabase request failed with status " + response.status;
    const error = new Error(message);
    error.status = response.status;
    error.responseBody = json || text;
    throw error;
  }

  return json;
}

function createFleetTrackingService(overrides) {
  const config = readConfig(overrides);

  async function getActiveFleetTracking(params) {
    const input = params || {};
    const limit = Number.isFinite(Number(input.limit)) ? Number(input.limit) : 100;
    const offset = Number.isFinite(Number(input.offset)) ? Number(input.offset) : 0;
    const rpcName = String(input.rpcName || DEFAULT_RPC_NAME).trim() || DEFAULT_RPC_NAME;

    const rpcUrl = config.url + "/rest/v1/rpc/" + rpcName;
    const headers = buildHeaders(config.key, input.headers);

    const payload = {
      p_limit: limit,
      p_offset: offset,
    };

    const data = await runRequest(rpcUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal: input.signal,
    });

    return Array.isArray(data) ? data : [];
  }

  async function insertVehicleLocation(row, params) {
    const input = params || {};
    const url = config.url + "/rest/v1/vehicle_locations";
    const headers = buildHeaders(config.key, input.headers);
    headers.Prefer = "return=representation";

    const payload = [normalizeTelemetryRow(row)];
    const data = await runRequest(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal: input.signal,
    });

    if (!Array.isArray(data) || !data.length) {
      return null;
    }

    return data[0];
  }

  async function insertVehicleLocations(rows, params) {
    const input = params || {};
    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      return [];
    }

    const url = config.url + "/rest/v1/vehicle_locations";
    const headers = buildHeaders(config.key, input.headers);
    headers.Prefer = "return=representation";

    const payload = list.map(normalizeTelemetryRow);

    const data = await runRequest(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal: input.signal,
    });

    return Array.isArray(data) ? data : [];
  }

  return {
    getActiveFleetTracking,
    insertVehicleLocation,
    insertVehicleLocations,
  };
}

module.exports = {
  createFleetTrackingService,
};
