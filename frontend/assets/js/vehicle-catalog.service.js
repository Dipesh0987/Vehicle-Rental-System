(function () {
  "use strict";

  var DEFAULT_IMAGE_URL =
    "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=960&q=80";
  var VEHICLE_TABLE_CANDIDATES = ["vehicles", "vehicle_catalog"];
  var IMAGE_TABLE_CANDIDATES = ["vehicle_images"];
  var CATALOG_VERSION_KEY = "vrs:vehicle-catalog-version";
  var CATALOG_CHANGE_EVENT = "vrs:vehicle-catalog-changed";
  var VEHICLE_IMAGE_BUCKET = "vehicle-images";

  var ALLOWED_FUEL_TYPES = ["Petrol", "Diesel", "Electric"];
  var ALLOWED_STATUS_VALUES = ["available", "maintenance", "inactive", "unavailable"];
  var ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  var MAX_IMAGE_COUNT = 5;
  var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
  var MIN_SEATS = 1;
  var MAX_SEATS = 15;
  var MIN_PRICE_PER_DAY = 1;
  var MAX_PRICE_PER_DAY = 100000;

  var cachedVehicleTable = null;
  var cachedImageTable = null;

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

  function isFileLike(value) {
    return Boolean(value && typeof value === "object" && typeof value.name === "string");
  }

  function toFileArray(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(isFileLike);
    }

    if (typeof FileList !== "undefined" && value instanceof FileList) {
      return Array.from(value).filter(isFileLike);
    }

    return [];
  }

  function formatBytes(bytes) {
    var numeric = Number(bytes || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "0 MB";
    }

    return (numeric / (1024 * 1024)).toFixed(2) + " MB";
  }

  function normalizeFuelTypeValue(value) {
    var normalized = toLower(value);
    if (!normalized) {
      return "";
    }

    if (normalized === "petrol") return "Petrol";
    if (normalized === "diesel") return "Diesel";
    if (normalized === "electric") return "Electric";

    return "";
  }

  function normalizeVehicleNumber(value) {
    return normalizeString(value, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatNprAmount(value) {
    var numeric = toNumber(value, 0);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }

    return "NPR " + Math.round(Math.max(0, numeric)).toLocaleString();
  }

  function deriveBrandFromName(name) {
    var normalizedName = normalizeString(name, "");
    if (!normalizedName) {
      return "General";
    }

    var firstToken = normalizedName.split(/\s+/)[0];
    return normalizeString(firstToken, "General");
  }

  function normalizeVehicleIdentity(brandValue, nameValue, deriveBrandWhenMissing) {
    var rawBrand = normalizeString(brandValue, "");
    var rawName = normalizeString(nameValue, "");
    var brand = toTitleCase(rawBrand);
    var name = toTitleCase(rawName);

    if (!name && brand) {
      name = brand;
    }

    if (!name) {
      name = "Vehicle";
    }

    if (!brand && deriveBrandWhenMissing) {
      var tokens = rawName.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        brand = toTitleCase(tokens[0]);
        name = toTitleCase(tokens.slice(1).join(" "));
      } else {
        brand = "General";
      }
    }

    if (brand) {
      var brandLower = brand.toLowerCase();
      var nameLower = name.toLowerCase();

      if (nameLower.indexOf(brandLower + " ") === 0) {
        var trimmedName = name.slice(brand.length).trim();
        if (trimmedName) {
          name = toTitleCase(trimmedName);
        }
      }

      if (name.toLowerCase() === brandLower && deriveBrandWhenMissing) {
        brand = "General";
      }
    }

    return {
      brand: brand || "General",
      name: name || "Vehicle",
    };
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (event) {
        resolve(String(event && event.target && event.target.result ? event.target.result : ""));
      };
      reader.onerror = function () {
        reject(new Error("Unable to read selected image."));
      };
      reader.readAsDataURL(file);
    });
  }

  function extensionFromMimeType(mimeType) {
    var normalized = toLower(mimeType);
    if (normalized === "image/png") return "png";
    if (normalized === "image/webp") return "webp";
    return "jpg";
  }

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  function buildVehicleImageStoragePath(userId, vehicleHint, sortOrder, mimeType) {
    var extension = extensionFromMimeType(mimeType);
    return userId + "/" + vehicleHint + "/vehicle-" + Date.now() + "-" + sortOrder + "-" + randomSuffix() + "." + extension;
  }

  function toNumber(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    var normalized = Number(String(value === undefined || value === null ? "" : value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(normalized)) {
      return fallback;
    }

    return normalized;
  }

  function toInteger(value, fallback) {
    var numeric = toNumber(value, fallback);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.round(numeric));
  }

  function toTitleCase(value) {
    return normalizeString(value, "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function pickFirst(source, keys, fallback) {
    if (!source || typeof source !== "object") {
      return fallback;
    }

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        var value = source[key];
        if (value !== undefined && value !== null && String(value) !== "") {
          return value;
        }
      }
    }

    return fallback;
  }

  function uniqueStrings(values) {
    var seen = new Set();
    var unique = [];

    for (var i = 0; i < values.length; i += 1) {
      var value = normalizeString(values[i], "");
      if (!value) {
        continue;
      }

      if (seen.has(value)) {
        continue;
      }

      seen.add(value);
      unique.push(value);
    }

    return unique;
  }

  function parseMaybeJson(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function normalizeList(raw) {
    if (Array.isArray(raw)) {
      return raw.slice();
    }

    if (typeof raw === "string") {
      var parsed = parseMaybeJson(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }

      return raw
        .split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);
    }

    if (raw && typeof raw === "object") {
      return Object.values(raw);
    }

    return [];
  }

  function normalizeFeatureToken(feature) {
    var text = normalizeString(feature, "").toLowerCase();
    if (!text) {
      return "";
    }

    if (text === "ac" || text.indexOf("air") >= 0) {
      return "ac";
    }

    if (text.indexOf("gps") >= 0 || text.indexOf("navigation") >= 0) {
      return "gps";
    }

    if (text.indexOf("blue") >= 0) {
      return "bluetooth";
    }

    if (text.indexOf("reverse") >= 0 || text.indexOf("camera") >= 0) {
      return "reverse-camera";
    }

    if (text.indexOf("child") >= 0) {
      return "child-seat";
    }

    return text
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeFeatureList(raw) {
    var list = normalizeList(raw)
      .map(normalizeFeatureToken)
      .filter(Boolean);

    return uniqueStrings(list);
  }

  function normalizeStringList(raw) {
    var list = normalizeList(raw)
      .map(function (entry) {
        return toTitleCase(entry);
      })
      .filter(Boolean);

    return uniqueStrings(list);
  }

  function normalizeImageUrls(raw, fallbackImage) {
    var list = normalizeList(raw)
      .map(function (entry) {
        return normalizeString(entry, "");
      })
      .filter(Boolean);

    var urls = uniqueStrings(list);

    if (!urls.length && fallbackImage) {
      urls = [fallbackImage];
    }

    return urls;
  }

  function normalizeStatus(row) {
    var explicit = toTitleCase(
      pickFirst(row, ["status", "availability", "state"], "")
    );

    if (explicit) {
      return explicit;
    }

    var available = pickFirst(row, ["available", "is_available", "isActive", "is_active"], true);
    if (available === false || String(available).toLowerCase() === "false") {
      return "Unavailable";
    }

    return "Available";
  }

  function isActiveStatus(status) {
    var normalized = normalizeString(status, "Available").toLowerCase();
    return normalized !== "inactive" && normalized !== "archived";
  }

  function errorMessage(error) {
    if (!error) {
      return "Unknown database error.";
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

    return "Unknown database error.";
  }

  function toPublicError(error, fallback) {
    var message = errorMessage(error).toLowerCase();

    if (String(error && error.code || "") === "23505" && message.indexOf("vehicle_number") >= 0) {
      return "Vehicle number already exists. Please use a unique vehicle number.";
    }

    if (message.indexOf("permission denied") >= 0 || message.indexOf("row-level security") >= 0) {
      return "Your account is not authorized to manage vehicles.";
    }

    if (message.indexOf("bucket") >= 0 && message.indexOf("vehicle") >= 0) {
      return "Vehicle image storage bucket is missing. Configure the vehicle image bucket in Supabase.";
    }

    if (String(error && error.code || "") === "23503" || Number(error && error.status ? error.status : 0) === 409) {
      return "Vehicle cannot be hard-deleted because related booking records exist. It has been marked inactive instead.";
    }

    if (message.indexOf("mime") >= 0 && message.indexOf("not allowed") >= 0) {
      return "Only JPG, PNG, and WEBP vehicle images are allowed.";
    }

    if (message.indexOf("payload too large") >= 0 || message.indexOf("entity too large") >= 0) {
      return "One or more selected images are too large.";
    }

    if (isRelationMissingError(error)) {
      return "Vehicle tables are missing in Supabase. Run the vehicle catalog migration for this project.";
    }

    if (message.indexOf("violates check constraint") >= 0 && message.indexOf("status") >= 0) {
      return "Vehicle status is invalid for your database constraint. Use Available, Unavailable, Maintenance, or Inactive.";
    }

    return fallback || "Unable to save vehicle right now.";
  }

  function normalizeStatusForWrite(value) {
    var normalized = normalizeString(value, "available").toLowerCase();

    if (normalized === "available") return "available";
    if (normalized === "unavailable") return "unavailable";
    if (normalized === "maintenance") return "maintenance";
    if (normalized === "inactive") return "inactive";
    if (normalized === "rented") return "unavailable";

    return "available";
  }

  function isStatusConstraintError(error) {
    var text = errorMessage(error).toLowerCase();
    return text.indexOf("violates check constraint") >= 0 && text.indexOf("status") >= 0;
  }

  function validationError(errors) {
    var err = new Error("Please resolve vehicle form validation errors.");
    err.code = "VALIDATION_ERROR";
    err.fields = errors || {};
    return err;
  }

  function validateVehicleInput(input) {
    var payload = input || {};
    var errors = {};

    var brand = normalizeString(payload.brand, "");
    var name = normalizeString(payload.name, "");
    var vehicleNumber = normalizeVehicleNumber(payload.vehicleNumber || payload.vehicle_number);
    var type = normalizeString(payload.type || payload.category, "");
    var seatsRaw = Number(payload.seats);
    var seats = Number.isFinite(seatsRaw) ? Math.trunc(seatsRaw) : NaN;
    var priceRaw = toNumber(payload.pricePerDay || payload.daily || payload.dailyRate, NaN);
    var fuelType = normalizeFuelTypeValue(payload.fuelType || payload.fuel);
    var images = toFileArray(payload.images).slice(0, MAX_IMAGE_COUNT);

    if (!name) {
      errors.name = "Vehicle name is required.";
    }

    if (!vehicleNumber) {
      errors.vehicleNumber = "Vehicle number is required.";
    }

    var identity = normalizeVehicleIdentity(brand, name, true);
    brand = identity.brand;
    name = identity.name;

    if (!type) {
      errors.type = "Vehicle category is required.";
    }

    if (!Number.isFinite(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
      errors.seats = "Seats must be between " + MIN_SEATS + " and " + MAX_SEATS + ".";
    }

    if (!Number.isFinite(priceRaw) || priceRaw < MIN_PRICE_PER_DAY || priceRaw > MAX_PRICE_PER_DAY) {
      errors.pricePerDay = "Daily price must be between " + MIN_PRICE_PER_DAY + " and " + MAX_PRICE_PER_DAY + ".";
    }

    if (!fuelType || ALLOWED_FUEL_TYPES.indexOf(fuelType) < 0) {
      errors.fuelType = "Fuel type must be Petrol, Diesel, or Electric.";
    }

    if (!images.length) {
      errors.images = "At least one vehicle image is required.";
    } else if (images.length > MAX_IMAGE_COUNT) {
      errors.images = "You can upload up to " + MAX_IMAGE_COUNT + " images.";
    }

    if (!errors.images) {
      for (var i = 0; i < images.length; i += 1) {
        var file = images[i];
        var mime = toLower(file.type);
        var size = Number(file.size || 0);

        if (ALLOWED_MIME_TYPES.indexOf(mime) < 0) {
          errors.images = "Only JPG, PNG, and WEBP images are allowed.";
          break;
        }

        if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_SIZE_BYTES) {
          errors.images = "Each image must be less than 5 MB. \"" + file.name + "\" is " + formatBytes(size) + ".";
          break;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      normalized: {
        brand: brand,
        name: name,
        vehicleNumber: vehicleNumber,
        type: type,
        seats: seats,
        pricePerDay: Number.isFinite(priceRaw) ? Math.round(priceRaw * 100) / 100 : 0,
        fuelType: fuelType,
        images: images,
        status: normalizeString(payload.status, "Available") || "Available",
        transmission: normalizeString(payload.transmission, "Automatic") || "Automatic",
        location: normalizeString(payload.location, ""),
        features: normalizeList(payload.features || []),
      },
    };
  }

  async function getSessionUserId(client) {
    try {
      var authResult = await client.auth.getSession();
      var uid = normalizeString(
        authResult && authResult.data && authResult.data.session && authResult.data.session.user
          ? authResult.data.session.user.id
          : "",
        ""
      );
      if (uid) {
        return uid;
      }
    } catch (_error) {
      // Fallback below.
    }

    return "public";
  }

  function isBucketNotFoundStorageError(error) {
    var message = errorMessage(error).toLowerCase();
    var status = Number(error && (error.status || error.statusCode));
    return message.indexOf("bucket not found") >= 0 || (status === 404 && message.indexOf("bucket") >= 0);
  }

  async function removeUploadedStorageObjects(client, objectPaths) {
    var paths = Array.isArray(objectPaths) ? objectPaths.filter(Boolean) : [];
    if (!paths.length) {
      return;
    }

    try {
      await client.storage.from(VEHICLE_IMAGE_BUCKET).remove(paths);
    } catch (_error) {
      // Best effort cleanup only.
    }
  }

  async function uploadVehicleImagesToStorage(client, userId, vehicleHint, files) {
    var storage = client.storage.from(VEHICLE_IMAGE_BUCKET);
    var uploaded = [];

    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      var objectPath = buildVehicleImageStoragePath(userId, vehicleHint, i, file.type);

      var upload = await storage.upload(objectPath, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });

      if (upload.error) {
        throw upload.error;
      }

      var publicResponse = storage.getPublicUrl(objectPath);
      var publicUrl = normalizeString(
        publicResponse && publicResponse.data ? publicResponse.data.publicUrl : "",
        ""
      );

      if (!publicUrl) {
        throw new Error("Vehicle image upload succeeded but URL generation failed.");
      }

      uploaded.push({
        publicUrl: publicUrl,
        storagePath: objectPath,
        sortOrder: i,
      });
    }

    return uploaded;
  }

  async function insertVehicleImageRowWithPruning(client, tableName, payload) {
    var workingPayload = Object.assign({}, payload || {});
    var attempts = 0;
    var lastError = null;

    while (attempts < 16) {
      attempts += 1;
      var result = await client.from(tableName).insert(workingPayload).select("*").limit(1);
      if (!result.error) {
        return true;
      }

      lastError = result.error;

      var missingColumn = extractMissingColumn(result.error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
        delete workingPayload[missingColumn];
        continue;
      }

      throw new Error(errorMessage(lastError));
    }

    throw new Error(errorMessage(lastError) || "Unable to write vehicle images.");
  }

  async function writeVehicleImages(client, vehicleId, uploadedImages) {
    if (!vehicleId || !Array.isArray(uploadedImages) || !uploadedImages.length) {
      return;
    }

    var imageTable = await resolveImageTable(client);
    if (!imageTable) {
      return;
    }

    try {
      await client.from(imageTable).delete().eq("vehicle_id", vehicleId);
    } catch (_cleanupError) {
      // Ignore cleanup errors and continue writing image rows.
    }

    for (var i = 0; i < uploadedImages.length; i += 1) {
      var image = uploadedImages[i] || {};
      await insertVehicleImageRowWithPruning(client, imageTable, {
        vehicle_id: vehicleId,
        image_url: image.publicUrl,
        url: image.publicUrl,
        storage_path: image.storagePath,
        path: image.storagePath,
        sort_order: i,
        position: i,
        is_primary: i === 0,
      });
    }
  }

  async function createVehicle(payload) {
    var validation = validateVehicleInput(payload || {});
    if (!validation.valid) {
      throw buildValidationError(validation);
    }

    var client = await getClient();
    var session = await assertAdminSession(client);

    var insertPayload = {
      name: validation.normalized.name,
      type: validation.normalized.type,
      seats: validation.normalized.seats,
      price_per_day: validation.normalized.pricePerDay,
      fuel_type: validation.normalized.fuelType,
      status: validation.normalized.status,
      created_by: session.user.id,
    };

    var insertedVehicle = await client
      .from("vehicles")
      .insert(insertPayload)
      .select("id, name, type, seats, price_per_day, fuel_type, status, primary_image_url, created_at")
      .single();

    if (insertedVehicle.error) {
      throw insertedVehicle.error;
    }

    var vehicleId = String(insertedVehicle.data.id);
    var uploadedImages = [];

    try {
      await client.from(imageTable).delete().eq("vehicle_id", vehicleId);
    } catch (_error) {
      // Ignore cleanup errors and continue inserting.
    }

    for (var i = 0; i < uploadedImages.length; i += 1) {
      var image = uploadedImages[i];
      await insertVehicleImageRowWithPruning(client, imageTable, {
        vehicle_id: vehicleId,
        image_url: image.publicUrl,
        url: image.publicUrl,
        storage_path: image.storagePath,
        path: image.storagePath,
        sort_order: i,
        position: i,
        is_primary: i === 0,
      });
    }
  }

  async function convertFilesToDataUrls(files) {
    var urls = [];

    for (var i = 0; i < files.length; i += 1) {
      var nextUrl = await readFileAsDataUrl(files[i]);
      if (nextUrl) {
        urls.push(nextUrl);
      }
    }

    return urls;
  }

  async function createVehicle(input) {
    var validation = validateVehicleInput(input || {});
    if (!validation.valid) {
      throw validationError(validation.errors);
    }

    var client = await getClient();
    var normalized = validation.normalized;
    var userId = await getSessionUserId(client);
    var vehicleHint = String(Date.now()) + "-" + randomSuffix();
    var uploadedImages = [];
    var imageUrls = [];

    try {
      if (normalized.images.length) {
        try {
          uploadedImages = await uploadVehicleImagesToStorage(client, userId, vehicleHint, normalized.images);
          imageUrls = uploadedImages.map(function (item) {
            return item.publicUrl;
          });
        } catch (storageError) {
          if (!isBucketNotFoundStorageError(storageError)) {
            throw storageError;
          }

          imageUrls = await convertFilesToDataUrls(normalized.images);
        }
      }

      var saved = await saveVehicle({
        brand: normalized.brand,
        name: normalized.name,
        vehicleNumber: normalized.vehicleNumber,
        category: normalized.type,
        type: normalized.type,
        transmission: normalized.transmission,
        fuelType: normalized.fuelType,
        seats: normalized.seats,
        status: normalized.status,
        pricePerDay: normalized.pricePerDay,
        daily: normalized.pricePerDay,
        imageUrls: imageUrls,
        primaryImageUrl: imageUrls[0] || "",
        features: normalized.features,
        location: normalized.location,
      });

      if (saved && saved.id && uploadedImages.length) {
        await writeVehicleImages(client, saved.id, uploadedImages);
        var latest = await getVehicleById(saved.id, { includeInactive: true });
        return latest || saved;
      }

      return saved;
    } catch (error) {
      await removeUploadedStorageObjects(
        client,
        uploadedImages.map(function (item) {
          return item.storagePath;
        })
      );
      throw error;
    }
  }

  function isPermissionError(error) {
    var text = errorMessage(error).toLowerCase();
    return text.indexOf("permission denied") >= 0 || String(error && error.code || "") === "42501";
  }

  function isRelationMissingError(error) {
    var text = errorMessage(error).toLowerCase();
    return (
      String(error && error.code || "") === "PGRST205" ||
      (text.indexOf("relation") >= 0 && text.indexOf("does not exist") >= 0)
    );
  }

  function extractMissingColumn(error) {
    var text = errorMessage(error);

    var postgrestMatch = text.match(/Could not find the '([^']+)' column/i);
    if (postgrestMatch && postgrestMatch[1]) {
      return postgrestMatch[1];
    }

    var postgresMatch = text.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+(?:of relation|does not exist)/i);
    if (postgresMatch && postgresMatch[1]) {
      return postgresMatch[1];
    }

    return "";
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

  async function resolveVehicleTable(client) {
    if (cachedVehicleTable) {
      return cachedVehicleTable;
    }

    for (var i = 0; i < VEHICLE_TABLE_CANDIDATES.length; i += 1) {
      var candidate = VEHICLE_TABLE_CANDIDATES[i];
      var probe = await client.from(candidate).select("id,name,type").limit(1);

      var missingColumn = extractMissingColumn(probe.error);
      if (missingColumn && ["id", "name", "type"].indexOf(missingColumn) >= 0) {
        continue;
      }

      if (!probe.error || isPermissionError(probe.error)) {
        cachedVehicleTable = candidate;
        return cachedVehicleTable;
      }

      if (isRelationMissingError(probe.error)) {
        continue;
      }
    }

    return null;
  }

  async function resolveImageTable(client) {
    if (cachedImageTable === false) {
      return null;
    }

    if (cachedImageTable) {
      return cachedImageTable;
    }

    for (var i = 0; i < IMAGE_TABLE_CANDIDATES.length; i += 1) {
      var candidate = IMAGE_TABLE_CANDIDATES[i];
      var probe = await client.from(candidate).select("*").limit(1);

      if (!probe.error || isPermissionError(probe.error)) {
        cachedImageTable = candidate;
        return cachedImageTable;
      }

      if (isRelationMissingError(probe.error)) {
        continue;
      }
    }

    cachedImageTable = false;
    return null;
  }

  async function fetchVehicleRows(client, tableName) {
    var orderCandidates = ["created_at", "updated_at", "id", ""];
    var lastError = null;

    for (var i = 0; i < orderCandidates.length; i += 1) {
      var orderColumn = orderCandidates[i];
      var query = client.from(tableName).select("*");

      if (orderColumn) {
        query = query.order(orderColumn, { ascending: false });
      }

      var result = await query;
      if (!result.error) {
        return Array.isArray(result.data) ? result.data : [];
      }

      lastError = result.error;
      var missingColumn = extractMissingColumn(lastError);
      if (orderColumn && missingColumn === orderColumn) {
        continue;
      }

      break;
    }

    throw new Error(errorMessage(lastError));
  }

  async function fetchVehicleImageRows(client, vehicleIds) {
    if (!Array.isArray(vehicleIds) || !vehicleIds.length) {
      return [];
    }

    var imageTable = await resolveImageTable(client);
    if (!imageTable) {
      return [];
    }

    var result = await client
      .from(imageTable)
      .select("*")
      .in("vehicle_id", vehicleIds);

    if (result.error) {
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  function buildImageMap(imageRows) {
    var map = {};

    for (var i = 0; i < imageRows.length; i += 1) {
      var row = imageRows[i] || {};
      var vehicleId = normalizeString(
        pickFirst(row, ["vehicle_id", "vehicleId", "car_id", "vehicle"], ""),
        ""
      );

      if (!vehicleId) {
        continue;
      }

      var url = normalizeString(
        pickFirst(row, ["url", "image_url", "src", "path"], ""),
        ""
      );

      if (!url) {
        continue;
      }

      if (!map[vehicleId]) {
        map[vehicleId] = [];
      }

      map[vehicleId].push({
        url: url,
        sortOrder: toInteger(pickFirst(row, ["sort_order", "position", "sort"], 0), 0),
        isPrimary: Boolean(pickFirst(row, ["is_primary", "isPrimary"], false)),
      });
    }

    Object.keys(map).forEach(function (vehicleId) {
      map[vehicleId].sort(function (a, b) {
        if (a.isPrimary !== b.isPrimary) {
          return a.isPrimary ? -1 : 1;
        }
        return a.sortOrder - b.sortOrder;
      });
    });

    return map;
  }

  function normalizeVehicleRecord(row, imageMap) {
    var id = normalizeString(
      pickFirst(row, ["id", "vehicle_id", "slug"], ""),
      ""
    );

    var identity = normalizeVehicleIdentity(
      pickFirst(row, ["brand", "make"], ""),
      pickFirst(row, ["name", "model", "title"], ""),
      false
    );
    var brand = identity.brand;
    var name = identity.name;
    var vehicleNumber = normalizeVehicleNumber(
      pickFirst(
        row,
        [
          "vehicle_number",
          "vehicleNumber",
          "registration_number",
          "registrationNumber",
          "plate_number",
          "plateNumber",
        ],
        ""
      )
    );

    var rawType = normalizeString(
      pickFirst(row, ["type", "category", "vehicle_type"], "sedan"),
      "sedan"
    );

    var type = rawType.toLowerCase().replace(/\s+/g, "-");
    var category = toTitleCase(rawType);

    var transmission = toTitleCase(
      pickFirst(row, ["transmission", "gearbox"], "Automatic")
    );

    var fuelType = toTitleCase(
      pickFirst(row, ["fuel_type", "fuelType", "fuel"], "Petrol")
    );

    var seats = Math.max(1, toInteger(pickFirst(row, ["seats", "seat_count"], 5), 5));
    var rating = Math.min(5, Math.max(0, toNumber(pickFirst(row, ["rating", "avg_rating"], 4.6), 4.6)));

    var status = normalizeStatus(row);
    var available = status.toLowerCase() === "available";

    var pricePerDay = Math.max(
      0,
      toNumber(
        pickFirst(
          row,
          ["price_per_day", "pricePerDay", "daily_rate", "daily_price", "daily"],
          0
        ),
        0
      )
    );

    var rowImages = normalizeImageUrls(
      pickFirst(row, ["image_urls", "images", "gallery", "imageUrls"], []),
      ""
    );

    var mappedImages = [];
    if (id && imageMap && Array.isArray(imageMap[id])) {
      mappedImages = imageMap[id]
        .map(function (entry) {
          return normalizeString(entry.url, "");
        })
        .filter(Boolean);
    }

    var primaryImageUrl = normalizeString(
      pickFirst(row, ["primary_image_url", "primaryImageUrl", "image_url", "image"], ""),
      ""
    );

    var imageUrls = uniqueStrings(
      [primaryImageUrl].concat(mappedImages).concat(rowImages).filter(Boolean)
    );

    if (!imageUrls.length) {
      imageUrls = [DEFAULT_IMAGE_URL];
    }

    if (!primaryImageUrl) {
      primaryImageUrl = imageUrls[0];
    }

    if (imageUrls.indexOf(primaryImageUrl) < 0) {
      imageUrls.unshift(primaryImageUrl);
      imageUrls = uniqueStrings(imageUrls);
    }

    var features = normalizeFeatureList(
      pickFirst(row, ["features", "amenities", "feature_list"], [])
    );

    var insuranceOptions = normalizeStringList(
      pickFirst(row, ["insurance_options", "insuranceOptions"], [
        "Basic Coverage",
      ])
    );

    var driverOptions = normalizeStringList(
      pickFirst(row, ["driver_options", "driverOptions"], ["Self-Drive"])
    );

    var mileagePolicy = normalizeStringList(
      pickFirst(row, ["mileage_policy", "mileagePolicy"], ["Unlimited"])
    );

    var location = toTitleCase(
      pickFirst(row, ["location", "city", "pickup_location"], "")
    );

    var createdAt = normalizeString(
      pickFirst(row, ["created_at", "createdAt"], ""),
      ""
    );

    return {
      id: id,
      brand: brand,
      name: name,
      vehicleNumber: vehicleNumber,
      type: type,
      category: category,
      transmission: transmission,
      fuelType: fuelType,
      seats: seats,
      rating: rating,
      status: status,
      available: available,
      isActive: isActiveStatus(status),
      location: location,
      pricePerDay: pricePerDay,
      pricing: {
        dailyRate: formatNprAmount(pricePerDay) + " / day",
      },
      features: features,
      insuranceOptions: insuranceOptions,
      driverOptions: driverOptions,
      mileagePolicy: mileagePolicy,
      primaryImageUrl: primaryImageUrl,
      imageUrls: imageUrls,
      addedDate: createdAt || new Date().toISOString(),
      raw: row,
    };
  }

  function mapVehicleForSearch(vehicle) {
    var pricePerDay = Math.max(0, toNumber(vehicle && vehicle.pricePerDay, 0));
    var identity = normalizeVehicleIdentity(vehicle && vehicle.brand, vehicle && vehicle.name, false);
    var brand = identity.brand;
    var name = identity.name;

    return {
      id: normalizeString(vehicle && vehicle.id, ""),
      brand: brand,
      name: name,
      vehicleNumber: normalizeVehicleNumber(vehicle && vehicle.vehicleNumber),
      type: normalizeString(vehicle && vehicle.type, "sedan"),
      transmission: toTitleCase(vehicle && vehicle.transmission || "Automatic"),
      fuelType: toTitleCase(vehicle && vehicle.fuelType || "Petrol"),
      seats: Math.max(1, toInteger(vehicle && vehicle.seats, 5)),
      rating: Math.min(5, Math.max(0, toNumber(vehicle && vehicle.rating, 4.6))),
      location: toTitleCase(vehicle && vehicle.location || ""),
      available: vehicle && vehicle.available !== false,
      availability: toTitleCase(vehicle && vehicle.status || "Available"),
      pricePerDay: pricePerDay,
      pricing: {
        dailyRate: formatNprAmount(pricePerDay) + " / day",
        securityDeposit: formatNprAmount(Math.max(200, Math.round(pricePerDay * 3))) + " refundable",
      },
      features: Array.isArray(vehicle && vehicle.features) ? vehicle.features.slice() : [],
      insuranceOptions: Array.isArray(vehicle && vehicle.insuranceOptions)
        ? vehicle.insuranceOptions.slice()
        : ["Basic Coverage"],
      driverOptions: Array.isArray(vehicle && vehicle.driverOptions)
        ? vehicle.driverOptions.slice()
        : ["Self-Drive"],
      mileagePolicy: Array.isArray(vehicle && vehicle.mileagePolicy)
        ? vehicle.mileagePolicy.slice()
        : ["Unlimited"],
      primaryImageUrl: normalizeString(vehicle && vehicle.primaryImageUrl, ""),
      imageUrls: Array.isArray(vehicle && vehicle.imageUrls) ? vehicle.imageUrls.slice() : [],
      addedDate: normalizeString(vehicle && vehicle.addedDate, new Date().toISOString()),
    };
  }

  function notifyCatalogChanged(source) {
    var version = Date.now();

    try {
      localStorage.setItem(CATALOG_VERSION_KEY, String(version));
    } catch (_error) {
      // Ignore localStorage failures.
    }

    try {
      window.dispatchEvent(
        new CustomEvent(CATALOG_CHANGE_EVENT, {
          detail: {
            source: source || "catalog",
            version: version,
          },
        })
      );
    } catch (_error2) {
      // Ignore event dispatch issues.
    }

    return version;
  }

  function removeUndefinedFields(payload) {
    var clean = {};

    Object.keys(payload || {}).forEach(function (key) {
      var value = payload[key];
      if (value === undefined) {
        return;
      }
      clean[key] = value;
    });

    return clean;
  }

  function buildWritePayload(input, includeCreatedAt) {
    var identity = normalizeVehicleIdentity(input.brand, input.name, true);
    var brand = identity.brand;
    var name = identity.name;
    var hasVehicleNumberInput =
      Object.prototype.hasOwnProperty.call(input, "vehicleNumber") ||
      Object.prototype.hasOwnProperty.call(input, "vehicle_number") ||
      Object.prototype.hasOwnProperty.call(input, "registrationNumber") ||
      Object.prototype.hasOwnProperty.call(input, "registration_number");
    var vehicleNumber = normalizeVehicleNumber(
      input.vehicleNumber || input.vehicle_number || input.registrationNumber || input.registration_number
    );

    var rawType = normalizeString(input.type || input.category || "sedan", "sedan");
    var type = rawType.toLowerCase().replace(/\s+/g, "-");

    var statusValue = input.status || (input.available === false ? "unavailable" : "available");
    var status = normalizeStatusForWrite(statusValue);

    var imageUrls = normalizeImageUrls(
      input.imageUrls || input.images || input.gallery || [],
      ""
    );

    var primaryImageUrl = normalizeString(
      input.primaryImageUrl || input.imageUrl || imageUrls[0] || "",
      ""
    );

    if (primaryImageUrl && imageUrls.indexOf(primaryImageUrl) < 0) {
      imageUrls.unshift(primaryImageUrl);
    }

    var nowIso = new Date().toISOString();

    var payload = {
      name: name,
      brand: brand,
      type: type,
      category: toTitleCase(rawType),
      transmission: toTitleCase(input.transmission || "Automatic"),
      fuel_type: toTitleCase(input.fuelType || input.fuel || "Petrol"),
      seats: Math.max(1, toInteger(input.seats, 5)),
      price_per_day: Math.max(0, toNumber(input.pricePerDay || input.daily || input.dailyRate, 0)),
      rating: Math.min(5, Math.max(0, toNumber(input.rating, 4.6))),
      location: toTitleCase(input.location || ""),
      status: status,
      available: status === "available",
      is_active: isActiveStatus(status),
      features: normalizeFeatureList(input.features || []),
      image_url: primaryImageUrl,
      primary_image_url: primaryImageUrl,
      image_urls: imageUrls,
      updated_at: nowIso,
    };

    if (hasVehicleNumberInput || includeCreatedAt) {
      payload.vehicle_number = vehicleNumber || null;
    }

    if (includeCreatedAt) {
      payload.created_at = nowIso;
    }

    return removeUndefinedFields(payload);
  }

  async function executeWriteWithColumnPruning(client, tableName, mode, payload, recordId) {
    var workingPayload = Object.assign({}, payload || {});
    var attempts = 0;
    var lastError = null;

    while (attempts < 24) {
      attempts += 1;

      if (mode === "insert" && Object.keys(workingPayload).length === 0) {
        throw new Error("No writable fields are available for vehicle creation.");
      }

      var result;
      if (mode === "update") {
        if (Object.keys(workingPayload).length === 0) {
          result = await client.from(tableName).select("*").eq("id", recordId).limit(1);
        } else {
          result = await client
            .from(tableName)
            .update(workingPayload)
            .eq("id", recordId)
            .select("*");
        }
      } else {
        result = await client.from(tableName).insert(workingPayload).select("*");
      }

      if (!result.error) {
        return Array.isArray(result.data) ? result.data : [];
      }

      lastError = result.error;
      var missingColumn = extractMissingColumn(lastError);

      if (isStatusConstraintError(lastError) && Object.prototype.hasOwnProperty.call(workingPayload, "status")) {
        if (workingPayload.status !== "available") {
          workingPayload.status = "available";
          workingPayload.available = true;
          if (Object.prototype.hasOwnProperty.call(workingPayload, "is_active")) {
            workingPayload.is_active = true;
          }
          continue;
        }
      }

      if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
        delete workingPayload[missingColumn];
        continue;
      }

      throw new Error(errorMessage(lastError));
    }

    throw new Error(errorMessage(lastError));
  }

  async function listVehicles(options) {
    var includeInactive = Boolean(options && options.includeInactive);

    var client = await getClient();
    var tableName = await resolveVehicleTable(client);
    if (!tableName) {
      return [];
    }

    var rows = await fetchVehicleRows(client, tableName);
    var ids = rows
      .map(function (row) {
        return normalizeString(pickFirst(row, ["id", "vehicle_id", "slug"], ""), "");
      })
      .filter(Boolean);

    var imageRows = await fetchVehicleImageRows(client, ids);
    var imageMap = buildImageMap(imageRows);

    var normalized = rows.map(function (row) {
      return normalizeVehicleRecord(row, imageMap);
    });

    if (!includeInactive) {
      normalized = normalized.filter(function (vehicle) {
        return vehicle.isActive;
      });
    }

    return normalized;
  }

  async function listVehiclesForSearch() {
    var rows = await listVehicles({ includeInactive: false });
    return rows.map(mapVehicleForSearch);
  }

  async function getVehicleById(vehicleId, options) {
    var id = normalizeString(vehicleId, "");
    if (!id) {
      return null;
    }

    var vehicles = await listVehicles({ includeInactive: Boolean(options && options.includeInactive) });
    for (var i = 0; i < vehicles.length; i += 1) {
      if (String(vehicles[i].id) === id) {
        return vehicles[i];
      }
    }

    return null;
  }

  async function saveVehicle(input) {
    var payloadInput = input || {};
    var name = normalizeString(payloadInput.name, "");
    if (!name) {
      throw new Error("Vehicle name is required.");
    }

    var client = await getClient();
    var tableName = await resolveVehicleTable(client);
    if (!tableName) {
      throw new Error("Vehicle table is not available in Supabase.");
    }

    var recordId = normalizeString(payloadInput.id, "");
    var wroteRows;

    if (recordId) {
      var updatePayload = buildWritePayload(payloadInput, false);
      wroteRows = await executeWriteWithColumnPruning(
        client,
        tableName,
        "update",
        updatePayload,
        recordId
      );

      if (!wroteRows.length) {
        var existing = await getVehicleById(recordId, { includeInactive: true });
        if (!existing) {
          throw new Error("Vehicle could not be updated because it no longer exists.");
        }
      }
    } else {
      var insertPayload = buildWritePayload(payloadInput, true);
      wroteRows = await executeWriteWithColumnPruning(
        client,
        tableName,
        "insert",
        insertPayload,
        ""
      );
    }

    notifyCatalogChanged(recordId ? "update" : "create");

    if (Array.isArray(wroteRows) && wroteRows.length) {
      return normalizeVehicleRecord(wroteRows[0], {});
    }

    if (recordId) {
      return await getVehicleById(recordId, { includeInactive: true });
    }

    return null;
  }

  async function deleteVehicle(vehicleId) {
    var id = normalizeString(vehicleId, "");
    if (!id) {
      throw new Error("Vehicle id is required for deletion.");
    }

    var client = await getClient();
    var tableName = await resolveVehicleTable(client);
    if (!tableName) {
      throw new Error("Vehicle table is not available in Supabase.");
    }

    var softDeletePayload = buildWritePayload({
      status: "inactive",
      available: false,
      is_active: false,
    }, false);

    await executeWriteWithColumnPruning(
      client,
      tableName,
      "update",
      softDeletePayload,
      id
    );

    notifyCatalogChanged("delete");
    return true;
  }

  function subscribeToVehicleCatalogChanges(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    var onCatalogEvent = function (event) {
      callback(event && event.detail ? event.detail : { source: "catalog-event" });
    };

    var onStorage = function (event) {
      if (!event || event.key !== CATALOG_VERSION_KEY) {
        return;
      }

      callback({
        source: "storage",
        version: toNumber(event.newValue, 0),
      });
    };

    window.addEventListener(CATALOG_CHANGE_EVENT, onCatalogEvent);
    window.addEventListener("storage", onStorage);

    return function () {
      window.removeEventListener(CATALOG_CHANGE_EVENT, onCatalogEvent);
      window.removeEventListener("storage", onStorage);
    };
  }

  window.VehicleCatalogService = {
    limits: {
      maxImages: MAX_IMAGE_COUNT,
      maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
      minSeats: MIN_SEATS,
      maxSeats: MAX_SEATS,
      minPricePerDay: MIN_PRICE_PER_DAY,
      maxPricePerDay: MAX_PRICE_PER_DAY,
    },
    fuelTypes: ALLOWED_FUEL_TYPES.slice(),
    allowedImageMimeTypes: ALLOWED_MIME_TYPES.slice(),
    validateVehicleInput: validateVehicleInput,
    toPublicError: toPublicError,
    listVehicles: listVehicles,
    listVehiclesForSearch: listVehiclesForSearch,
    getVehicleById: getVehicleById,
    createVehicle: createVehicle,
    saveVehicle: saveVehicle,
    deleteVehicle: deleteVehicle,
    broadcastVehicleCatalogChanged: function () {
      return notifyCatalogChanged("manual");
    },
    subscribeToVehicleCatalogChanges: subscribeToVehicleCatalogChanges,
    touchCatalogVersion: function () {
      return notifyCatalogChanged("manual");
    },
  };
})();
