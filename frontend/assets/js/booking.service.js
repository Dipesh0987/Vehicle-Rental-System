(function () {
  "use strict";

  var BOOKING_TABLE_CANDIDATES = ["vehicle_bookings", "bookings"];
  var BOOKING_CHANGE_EVENT = "vrs:vehicle-booking-changed";
  var BOOKING_VERSION_KEY = "vrs:vehicle-booking-version";
  var ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];
  var ALL_BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

  var COUPON_RULES = {
    SAVE10: { type: "percent", value: 0.1, label: "10% off applied" },
    WEEKEND50: { type: "flat", value: 50, label: "$50 off applied" },
  };

  var cachedBookingTable = null;

  function normalizeString(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }

    var text = String(value).trim();
    if (!text) {
      return fallback || "";
    }

    return text;
  }

  function toLower(value) {
    return normalizeString(value, "").toLowerCase();
  }

  function toNumber(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    var numeric = Number(String(value === undefined || value === null ? "" : value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return numeric;
  }

  function toFixedAmount(value) {
    var numeric = toNumber(value, 0);
    return Math.round(Math.max(0, numeric) * 100) / 100;
  }

  function roundMoney(value) {
    return Math.round(toNumber(value, 0) * 100) / 100;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function todayIsoDate() {
    var now = new Date();
    return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(normalizeString(value, ""));
  }

  function normalizeDate(value) {
    var dateText = normalizeString(value, "");
    if (!isIsoDate(dateText)) {
      return "";
    }

    var parsed = new Date(dateText + "T00:00:00Z");
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return dateText;
  }

  function normalizeTime(value) {
    var input = normalizeString(value, "10:00");
    var normalized = input.slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(normalized)) {
      return "10:00";
    }

    return normalized;
  }

  function countBookingDays(startDate, endDate) {
    var start = normalizeDate(startDate);
    var end = normalizeDate(endDate);

    if (!start || !end) {
      return 0;
    }

    var startMs = Date.parse(start + "T00:00:00Z");
    var endMs = Date.parse(end + "T00:00:00Z");

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return 0;
    }

    return Math.floor((endMs - startMs) / 86400000) + 1;
  }

  function normalizeCoupon(code) {
    var couponCode = normalizeString(code, "").toUpperCase();
    if (!couponCode) {
      return "";
    }

    if (!Object.prototype.hasOwnProperty.call(COUPON_RULES, couponCode)) {
      return "";
    }

    return couponCode;
  }

  function bookingStatusLabel(status) {
    var normalized = toLower(status);
    if (normalized === "pending") return "Pending";
    if (normalized === "confirmed") return "Confirmed";
    if (normalized === "cancelled") return "Cancelled";
    if (normalized === "completed") return "Completed";
    return "Confirmed";
  }

  function sanitizeStatus(value) {
    var normalized = toLower(value);
    if (ALL_BOOKING_STATUSES.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "confirmed";
  }

  function normalizeEmail(value) {
    return normalizeString(value, "").toLowerCase();
  }

  function normalizePhone(value) {
    return normalizeString(value, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function phoneDigitCount(value) {
    return normalizePhone(value).replace(/[^\d]/g, "").length;
  }

  function isValidEmail(value) {
    var email = normalizeEmail(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function pickFirst(source, keys, fallback) {
    if (!source || typeof source !== "object") {
      return fallback;
    }

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }

      var value = source[key];
      if (value === undefined || value === null || String(value) === "") {
        continue;
      }

      return value;
    }

    return fallback;
  }

  function errorMessage(error) {
    if (!error) {
      return "Unknown booking error.";
    }

    if (typeof error === "string") {
      return error;
    }

    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }

    if (typeof error.details === "string" && error.details.trim()) {
      return error.details;
    }

    return "Unknown booking error.";
  }

  function extractMissingColumn(error) {
    var message = errorMessage(error);

    var postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
    if (postgrestMatch && postgrestMatch[1]) {
      return postgrestMatch[1];
    }

    var postgresMatch = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+(?:of relation|does not exist)/i);
    if (postgresMatch && postgresMatch[1]) {
      return postgresMatch[1];
    }

    return "";
  }

  function isRelationMissingError(error) {
    var code = String(error && error.code ? error.code : "");
    var text = errorMessage(error).toLowerCase();
    return code === "PGRST205" || (text.indexOf("relation") >= 0 && text.indexOf("does not exist") >= 0);
  }

  function isOverlapConstraintError(error) {
    var text = errorMessage(error).toLowerCase();
    return text.indexOf("vehicle_bookings_no_overlap") >= 0 || text.indexOf("already booked") >= 0;
  }

  function toPublicError(error, fallback) {
    var text = errorMessage(error).toLowerCase();
    var code = String(error && error.code ? error.code : "").toUpperCase();

    if (isOverlapConstraintError(error)) {
      return "The selected dates are no longer available for this vehicle.";
    }

    if (code === "PGRST202" || text.indexOf("admin_update_booking_status") >= 0) {
      return "Booking status update endpoint is missing. Run migration 008_admin_booking_status_updates.sql.";
    }

    if (isRelationMissingError(error)) {
      return "Booking schema is not ready. Run migration 006_vehicle_bookings_system.sql first.";
    }

    if (text.indexOf("email") >= 0 && text.indexOf("check") >= 0) {
      return "Please enter a valid customer email address.";
    }

    if (text.indexOf("status") >= 0 && text.indexOf("check") >= 0) {
      return "Booking status is invalid for the current database constraints.";
    }

    if (text.indexOf("permission denied") >= 0 || text.indexOf("row-level security") >= 0) {
      return "Booking action could not be completed due to database permission rules.";
    }

    return fallback || "Unable to save booking right now.";
  }

  function validationError(fields) {
    var error = new Error("Booking form validation failed.");
    error.code = "VALIDATION_ERROR";
    error.fields = fields || {};
    return error;
  }

  function normalizeName(value) {
    return normalizeString(value, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function calculateBookingQuote(input) {
    var payload = input || {};
    var dailyRate = Math.max(0, toNumber(payload.dailyRate, 0));
    var startDate = normalizeDate(payload.startDate);
    var endDate = normalizeDate(payload.endDate);
    var couponCode = normalizeCoupon(payload.couponCode);

    var bookingDays = countBookingDays(startDate, endDate);
    var baseAmount = roundMoney(dailyRate * bookingDays);
    var serviceFee = roundMoney(Math.max(15, baseAmount * 0.05));
    var taxAmount = roundMoney((baseAmount + serviceFee) * 0.13);
    var discountAmount = 0;
    var couponMessage = "";

    if (couponCode) {
      var coupon = COUPON_RULES[couponCode];
      if (coupon.type === "percent") {
        discountAmount = roundMoney(baseAmount * coupon.value);
      } else if (coupon.type === "flat") {
        discountAmount = roundMoney(coupon.value);
      }

      couponMessage = coupon.label;
    }

    var subtotal = roundMoney(baseAmount + serviceFee + taxAmount);
    var totalAmount = Math.max(0, roundMoney(subtotal - discountAmount));

    return {
      bookingDays: bookingDays,
      baseAmount: baseAmount,
      serviceFee: serviceFee,
      taxAmount: taxAmount,
      discountAmount: discountAmount,
      totalAmount: totalAmount,
      couponCode: couponCode,
      couponMessage: couponMessage,
      currency: "USD",
      dailyRate: dailyRate,
    };
  }

  function validateBookingInput(input) {
    var payload = input || {};
    var errors = {};

    var vehicleId = normalizeString(payload.vehicleId, "");
    var customerName = normalizeName(payload.customerName);
    var customerEmail = normalizeEmail(payload.customerEmail);
    var customerPhone = normalizePhone(payload.customerPhone);
    var startDate = normalizeDate(payload.startDate);
    var endDate = normalizeDate(payload.endDate);
    var pickupTime = normalizeTime(payload.pickupTime);
    var status = sanitizeStatus(payload.status || "confirmed");
    var notes = normalizeString(payload.notes, "");

    if (!vehicleId) {
      errors.vehicleId = "Vehicle selection is required.";
    }

    if (!customerName || customerName.length < 2) {
      errors.customerName = "Customer name is required.";
    }

    if (!isValidEmail(customerEmail)) {
      errors.customerEmail = "A valid email address is required.";
    }

    if (!customerPhone) {
      errors.customerPhone = "Phone number is required.";
    } else {
      var digitCount = phoneDigitCount(customerPhone);
      if (digitCount < 7 || digitCount > 15) {
        errors.customerPhone = "Phone number must contain 7 to 15 digits.";
      }
    }

    if (!startDate) {
      errors.startDate = "Start date is required.";
    }

    if (!endDate) {
      errors.endDate = "End date is required.";
    }

    if (startDate && endDate && endDate < startDate) {
      errors.endDate = "End date must be on or after start date.";
    }

    if (startDate && startDate < todayIsoDate()) {
      errors.startDate = "Start date cannot be in the past.";
    }

    var quote = calculateBookingQuote({
      dailyRate: payload.dailyRate,
      startDate: startDate,
      endDate: endDate,
      couponCode: payload.couponCode,
    });

    if (quote.bookingDays < 1) {
      errors.duration = "Booking duration must be at least one day.";
    }

    if (!Number.isFinite(quote.dailyRate) || quote.dailyRate <= 0) {
      errors.dailyRate = "Vehicle pricing is unavailable.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      normalized: {
        vehicleId: vehicleId,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        startDate: startDate,
        endDate: endDate,
        pickupTime: pickupTime,
        status: status,
        notes: notes,
        couponCode: quote.couponCode,
        quote: quote,
      },
    };
  }

  async function getClient() {
    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client runtime is unavailable.");
    }

    var client = await window.SupabaseClient.init();
    if (!client) {
      throw new Error("Supabase client failed to initialize.");
    }

    return client;
  }

  async function resolveBookingTable(client) {
    if (cachedBookingTable) {
      return cachedBookingTable;
    }

    for (var i = 0; i < BOOKING_TABLE_CANDIDATES.length; i += 1) {
      var candidate = BOOKING_TABLE_CANDIDATES[i];
      var probe = await client
        .from(candidate)
        .select("id,vehicle_id,start_date,end_date,status")
        .limit(1);

      var missingColumn = extractMissingColumn(probe.error);
      if (missingColumn && ["vehicle_id", "start_date", "end_date", "status", "id"].indexOf(missingColumn) >= 0) {
        continue;
      }

      if (!probe.error || String(probe.error && probe.error.code ? probe.error.code : "") === "42501") {
        cachedBookingTable = candidate;
        return cachedBookingTable;
      }

      if (isRelationMissingError(probe.error)) {
        continue;
      }
    }

    return null;
  }

  function broadcastBookingChanged(source) {
    var version = Date.now();

    try {
      localStorage.setItem(BOOKING_VERSION_KEY, String(version));
    } catch (_storageError) {
      // Ignore localStorage failures.
    }

    try {
      window.dispatchEvent(
        new CustomEvent(BOOKING_CHANGE_EVENT, {
          detail: {
            source: source || "booking-service",
            version: version,
          },
        })
      );
    } catch (_eventError) {
      // Ignore custom event failures.
    }

    return version;
  }

  async function readSessionUser(client) {
    try {
      var result = await client.auth.getSession();
      if (result && result.data && result.data.session && result.data.session.user) {
        return result.data.session.user;
      }
    } catch (_error) {
      // Ignore auth session failures.
    }

    return null;
  }

  function mapBookingRow(row, vehiclesById) {
    var vehicleId = normalizeString(pickFirst(row, ["vehicle_id", "vehicleId"], ""), "");
    var vehicle = vehiclesById && vehiclesById[vehicleId] ? vehiclesById[vehicleId] : null;
    var vehicleName = vehicle
      ? normalizeString(vehicle.brand, "") + " " + normalizeString(vehicle.name, "")
      : "Vehicle";

    var cleanedVehicleName = normalizeString(vehicleName, "Vehicle")
      .replace(/\s+/g, " ")
      .trim();

    var status = sanitizeStatus(pickFirst(row, ["status"], "confirmed"));
    var type = vehicle ? normalizeString(vehicle.category || vehicle.type, "Vehicle") : "Vehicle";

    return {
      id: normalizeString(row.id, ""),
      bookingCode: normalizeString(row.booking_code, ""),
      vehicleId: vehicleId,
      customerName: normalizeString(row.customer_name, ""),
      customerEmail: normalizeEmail(row.customer_email),
      customerPhone: normalizeString(row.customer_phone, ""),
      pickupLocation: normalizeString(row.notes, ""),
      startDate: normalizeDate(row.start_date),
      endDate: normalizeDate(row.end_date),
      pickupTime: normalizeTime(row.pickup_time),
      status: status,
      statusLabel: bookingStatusLabel(status),
      type: type,
      vehicleName: cleanedVehicleName,
      quote: {
        baseAmount: toFixedAmount(row.base_amount),
        serviceFee: toFixedAmount(row.service_fee),
        taxAmount: toFixedAmount(row.tax_amount),
        discountAmount: toFixedAmount(row.discount_amount),
        totalAmount: toFixedAmount(row.total_amount),
        currency: normalizeString(row.currency, "USD"),
      },
      createdAt: normalizeString(row.created_at, ""),
    };
  }

  async function buildVehicleMap() {
    if (!window.VehicleCatalogService || typeof window.VehicleCatalogService.listVehicles !== "function") {
      return {};
    }

    try {
      var vehicles = await window.VehicleCatalogService.listVehicles({ includeInactive: true });
      if (!Array.isArray(vehicles)) {
        return {};
      }

      return vehicles.reduce(function (acc, vehicle) {
        var id = normalizeString(vehicle && vehicle.id, "");
        if (!id) {
          return acc;
        }

        acc[id] = vehicle;
        return acc;
      }, {});
    } catch (_error) {
      return {};
    }
  }

  async function listBookings(options) {
    var opts = options || {};
    var client = await getClient();
    var tableName = await resolveBookingTable(client);

    if (!tableName) {
      return [];
    }

    var query = client
      .from(tableName)
      .select("id,booking_code,vehicle_id,customer_name,customer_email,customer_phone,notes,start_date,end_date,pickup_time,status,currency,base_amount,service_fee,tax_amount,discount_amount,total_amount,created_at")
      .order("created_at", { ascending: false });

    if (opts.vehicleId) {
      query = query.eq("vehicle_id", normalizeString(opts.vehicleId, ""));
    }

    if (opts.status) {
      query = query.eq("status", sanitizeStatus(opts.status));
    }

    if (opts.rangeStart) {
      query = query.gte("end_date", normalizeDate(opts.rangeStart));
    }

    if (opts.rangeEnd) {
      query = query.lte("start_date", normalizeDate(opts.rangeEnd));
    }

    var result = await query;
    if (result.error) {
      throw new Error(errorMessage(result.error));
    }

    var rows = Array.isArray(result.data) ? result.data : [];
    var vehiclesById = await buildVehicleMap();

    return rows.map(function (row) {
      return mapBookingRow(row, vehiclesById);
    });
  }

  async function checkAvailability(input) {
    var payload = input || {};
    var vehicleId = normalizeString(payload.vehicleId, "");
    var startDate = normalizeDate(payload.startDate);
    var endDate = normalizeDate(payload.endDate);
    var excludeBookingId = normalizeString(payload.excludeBookingId, "");

    if (!vehicleId || !startDate || !endDate || endDate < startDate) {
      return {
        available: false,
        conflicts: [],
        reason: "Invalid availability range.",
      };
    }

    var client = await getClient();
    var tableName = await resolveBookingTable(client);

    if (!tableName) {
      throw new Error("Booking table is not available in Supabase.");
    }

    var query = client
      .from(tableName)
      .select("id,booking_code,vehicle_id,customer_email,start_date,end_date,status")
      .eq("vehicle_id", vehicleId)
      .in("status", ACTIVE_BOOKING_STATUSES)
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    if (excludeBookingId) {
      query = query.neq("id", excludeBookingId);
    }

    var result = await query;
    if (result.error) {
      throw new Error(errorMessage(result.error));
    }

    var rows = Array.isArray(result.data) ? result.data : [];
    return {
      available: rows.length === 0,
      conflicts: rows,
      reason: rows.length ? "Vehicle already reserved for overlapping dates." : "",
    };
  }

  async function createBooking(input) {
    var validation = validateBookingInput(input);
    if (!validation.valid) {
      throw validationError(validation.errors);
    }

    var normalized = validation.normalized;
    var client = await getClient();
    var tableName = await resolveBookingTable(client);

    if (!tableName) {
      throw new Error("Booking table is not available in Supabase.");
    }

    var availability = await checkAvailability({
      vehicleId: normalized.vehicleId,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
    });

    if (!availability.available) {
      var conflictError = new Error("Selected dates are no longer available.");
      conflictError.code = "BOOKING_CONFLICT";
      conflictError.conflicts = availability.conflicts;
      throw conflictError;
    }

    var sessionUser = await readSessionUser(client);
    var userId = normalizeString(sessionUser && sessionUser.id, "");

    var insertPayload = {
      vehicle_id: normalized.vehicleId,
      customer_user_id: userId || null,
      customer_name: normalized.customerName,
      customer_email: normalized.customerEmail,
      customer_phone: normalized.customerPhone,
      start_date: normalized.startDate,
      end_date: normalized.endDate,
      pickup_time: normalized.pickupTime,
      status: normalized.status,
      currency: normalized.quote.currency,
      base_amount: normalized.quote.baseAmount,
      service_fee: normalized.quote.serviceFee,
      tax_amount: normalized.quote.taxAmount,
      discount_amount: normalized.quote.discountAmount,
      total_amount: normalized.quote.totalAmount,
      coupon_code: normalized.couponCode || null,
      notes: normalized.notes,
    };

    var result = await client
      .from(tableName)
      .insert(insertPayload)
      .select("id,booking_code,vehicle_id,customer_name,customer_email,customer_phone,notes,start_date,end_date,pickup_time,status,currency,base_amount,service_fee,tax_amount,discount_amount,total_amount,created_at")
      .limit(1)
      .single();

    if (result.error) {
      if (isOverlapConstraintError(result.error)) {
        var overlapError = new Error("Selected dates are no longer available.");
        overlapError.code = "BOOKING_CONFLICT";
        throw overlapError;
      }

      throw new Error(errorMessage(result.error));
    }

    broadcastBookingChanged("create");

    var vehiclesById = await buildVehicleMap();
    return mapBookingRow(result.data || {}, vehiclesById);
  }

  async function updateBookingStatus(input) {
    var payload = input || {};
    var bookingId = normalizeString(payload.bookingId || payload.id, "");
    var requestedStatus = toLower(payload.status);

    if (!bookingId) {
      throw validationError({ bookingId: "Booking id is required." });
    }

    if (ALL_BOOKING_STATUSES.indexOf(requestedStatus) < 0) {
      throw validationError({ status: "Booking status is invalid." });
    }

    var client = await getClient();

    var rpcResult = await client.rpc("admin_update_booking_status", {
      p_booking_id: bookingId,
      p_status: requestedStatus,
    });

    if (rpcResult.error) {
      if (isOverlapConstraintError(rpcResult.error)) {
        var conflictError = new Error("Selected dates conflict with another active booking.");
        conflictError.code = "BOOKING_CONFLICT";
        throw conflictError;
      }

      throw new Error(errorMessage(rpcResult.error));
    }

    var updatedRow = Array.isArray(rpcResult.data)
      ? (rpcResult.data[0] || null)
      : rpcResult.data;

    if (!updatedRow || !updatedRow.id) {
      throw new Error("Booking could not be found for status update.");
    }

    broadcastBookingChanged("status-update");

    var vehiclesById = await buildVehicleMap();
    return mapBookingRow(updatedRow, vehiclesById);
  }

  function subscribeToBookingChanges(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    var onChange = function (event) {
      callback(event && event.detail ? event.detail : { source: "booking-event" });
    };

    var onStorage = function (event) {
      if (!event || event.key !== BOOKING_VERSION_KEY) {
        return;
      }

      callback({
        source: "storage",
        version: toNumber(event.newValue, 0),
      });
    };

    window.addEventListener(BOOKING_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);

    return function () {
      window.removeEventListener(BOOKING_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  window.VehicleBookingService = {
    statuses: ALL_BOOKING_STATUSES.slice(),
    activeStatuses: ACTIVE_BOOKING_STATUSES.slice(),
    coupons: Object.keys(COUPON_RULES),
    calculateBookingQuote: calculateBookingQuote,
    validateBookingInput: validateBookingInput,
    listBookings: listBookings,
    checkAvailability: checkAvailability,
    createBooking: createBooking,
    updateBookingStatus: updateBookingStatus,
    subscribeToBookingChanges: subscribeToBookingChanges,
    touchBookingVersion: function () {
      return broadcastBookingChanged("manual");
    },
    toPublicError: toPublicError,
  };
})();
