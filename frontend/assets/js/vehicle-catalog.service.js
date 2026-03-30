(function () {
  "use strict";

  var VEHICLE_IMAGE_BUCKET = "vehicle-images";
  var VEHICLE_CHANGE_EVENT = "vrs:vehicle-catalog-changed";
  var VEHICLE_CHANGE_STORAGE_KEY = "vrs:vehicle-catalog-version";

  var ALLOWED_FUEL_TYPES = ["Petrol", "Diesel", "Electric"];
  var ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  var MAX_IMAGE_COUNT = 5;
  var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

  var MIN_SEATS = 1;
  var MAX_SEATS = 15;
  var MIN_PRICE_PER_DAY = 1;
  var MAX_PRICE_PER_DAY = 100000;

  var clientInitPromise = null;

  function trim(value) {
    return String(value || "").trim();
  }

  function toLower(value) {
    return trim(value).toLowerCase();
  }

  function isFileLike(value) {
    return value && typeof value === "object" && typeof value.name === "string";
  }

  function toArray(value) {
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

  function normalizeFuelType(fuelType) {
    var normalized = toLower(fuelType);
    if (normalized === "petrol") return "Petrol";
    if (normalized === "diesel") return "Diesel";
    if (normalized === "electric") return "Electric";
    return "";
  }

  function toInteger(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return NaN;
    }
    return Math.trunc(numeric);
  }

  function toDecimal(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return NaN;
    }
    return Math.round(numeric * 100) / 100;
  }

  function formatBytes(bytes) {
    var size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return "0 MB";
    }
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  }

  function getErrorMessage(error) {
    return String(error && error.message ? error.message : "").toLowerCase();
  }

  function toPublicError(error, fallback) {
    var message = getErrorMessage(error);

    if (message.indexOf("row-level security") >= 0 || message.indexOf("permission denied") >= 0) {
      return "Your account is not authorized to manage vehicles.";
    }

    if (message.indexOf("invalid input syntax") >= 0 || message.indexOf("check constraint") >= 0) {
      return "Vehicle data did not pass server validation. Please review your inputs.";
    }

    if (message.indexOf("bucket") >= 0 && message.indexOf("vehicle-images") >= 0) {
      return "Vehicle image bucket is missing. Run database/migrations/004_vehicle_catalog.sql.";
    }

    if (message.indexOf("mime") >= 0 && message.indexOf("not allowed") >= 0) {
      return "Only JPG, PNG, and WebP files are allowed.";
    }

    if (message.indexOf("payload too large") >= 0 || message.indexOf("entity too large") >= 0) {
      return "One or more selected images are too large.";
    }

    if (message.indexOf("network") >= 0 || message.indexOf("failed to fetch") >= 0) {
      return "Network issue detected. Please retry in a moment.";
    }

    return fallback || "Unable to complete vehicle operation right now.";
  }

  function validateVehicleInput(payload) {
    var errors = {};
    var files = toArray(payload && payload.images);

    var name = trim(payload && payload.name);
    var type = trim(payload && payload.type);
    var rawSeats = Number(payload && payload.seats);
    var seats = Number.isFinite(rawSeats) ? Math.trunc(rawSeats) : NaN;
    var pricePerDay = toDecimal(payload && payload.pricePerDay);
    var fuelType = normalizeFuelType(payload && payload.fuelType);

    if (!name) {
      errors.name = "Vehicle name is required.";
    } else if (name.length < 2 || name.length > 120) {
      errors.name = "Vehicle name must be between 2 and 120 characters.";
    }

    if (!type) {
      errors.type = "Vehicle type is required.";
    } else if (type.length < 2 || type.length > 50) {
      errors.type = "Vehicle type must be between 2 and 50 characters.";
    }

    if (!Number.isFinite(rawSeats) || !Number.isInteger(rawSeats)) {
      errors.seats = "Seats must be a whole number.";
    } else if (rawSeats < MIN_SEATS || rawSeats > MAX_SEATS) {
      errors.seats = "Seats must be between " + MIN_SEATS + " and " + MAX_SEATS + ".";
    }

    if (!Number.isFinite(pricePerDay)) {
      errors.pricePerDay = "Price per day must be a valid number.";
    } else if (pricePerDay < MIN_PRICE_PER_DAY || pricePerDay > MAX_PRICE_PER_DAY) {
      errors.pricePerDay = "Price per day must be between " + MIN_PRICE_PER_DAY + " and " + MAX_PRICE_PER_DAY + ".";
    }

    if (!fuelType || ALLOWED_FUEL_TYPES.indexOf(fuelType) < 0) {
      errors.fuelType = "Fuel type must be Petrol, Diesel, or Electric.";
    }

    if (!files.length) {
      errors.images = "At least one vehicle image is required.";
    } else if (files.length > MAX_IMAGE_COUNT) {
      errors.images = "You can upload up to " + MAX_IMAGE_COUNT + " images.";
    }

    if (!errors.images) {
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var mime = toLower(file.type);
        var size = Number(file.size || 0);

        if (ALLOWED_MIME_TYPES.indexOf(mime) < 0) {
          errors.images = "Only JPG, PNG, and WebP images are allowed.";
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
        name: name,
        type: type,
        seats: seats,
        pricePerDay: pricePerDay,
        fuelType: fuelType,
        images: files.slice(0, MAX_IMAGE_COUNT),
      },
    };
  }

  function buildValidationError(validationResult) {
    var error = new Error("Please correct the highlighted fields.");
    error.code = "VALIDATION_ERROR";
    error.fields = validationResult.errors;
    return error;
  }

  async function getClient() {
    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (window.VehicleAuthService && typeof window.VehicleAuthService.getClient === "function") {
      return window.VehicleAuthService.getClient();
    }

    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase runtime is unavailable on this page.");
    }

    if (!clientInitPromise) {
      clientInitPromise = window.SupabaseClient.init();
    }

    return clientInitPromise;
  }

  async function getSession() {
    if (window.VehicleAuthService && typeof window.VehicleAuthService.getSession === "function") {
      return window.VehicleAuthService.getSession();
    }

    var client = await getClient();
    var result = await client.auth.getSession();
    if (result.error) {
      throw result.error;
    }

    return result.data && result.data.session ? result.data.session : null;
  }

  async function assertAdminSession(client, session) {
    var activeSession = session;

    if (!activeSession || !activeSession.user) {
      activeSession = await getSession();
    }

    if (!activeSession || !activeSession.user) {
      throw new Error("You must be signed in as an admin to add vehicles.");
    }

    var adminCheck = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", activeSession.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminCheck.error) {
      throw adminCheck.error;
    }

    if (!adminCheck.data) {
      throw new Error("Your account is not authorized to manage vehicles.");
    }

    return activeSession;
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

  function buildStoragePath(userId, vehicleId, sortOrder, mimeType) {
    var extension = extensionFromMimeType(mimeType);
    return userId + "/" + vehicleId + "/vehicle-" + Date.now() + "-" + sortOrder + "-" + randomSuffix() + "." + extension;
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

  async function uploadVehicleImages(client, userId, vehicleId, files) {
    var storage = client.storage.from(VEHICLE_IMAGE_BUCKET);
    var uploaded = [];

    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      var storagePath = buildStoragePath(userId, vehicleId, i, file.type);
      var upload = await storage.upload(storagePath, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });

      if (upload.error) {
        throw upload.error;
      }

      var urlResponse = storage.getPublicUrl(storagePath);
      var publicUrl = urlResponse && urlResponse.data ? trim(urlResponse.data.publicUrl) : "";
      if (!publicUrl) {
        throw new Error("Image upload completed but URL generation failed.");
      }

      uploaded.push({
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: i,
      });
    }

    return uploaded;
  }

  function vehicleSelectColumns() {
    return "id, name, type, seats, price_per_day, fuel_type, status, primary_image_url, created_at, vehicle_images(image_url, storage_path, sort_order)";
  }

  function normalizeStatus(status) {
    var value = toLower(status || "available");
    if (value === "maintenance") return "maintenance";
    if (value === "inactive") return "inactive";
    return "available";
  }

  function deriveBrand(name) {
    var tokens = trim(name).split(/\s+/).filter(Boolean);
    if (!tokens.length) return "Vehicle";
    return tokens[0];
  }

  function deriveModel(name) {
    var tokens = trim(name).split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      return trim(name) || "Model";
    }
    return tokens.slice(1).join(" ");
  }

  function mapVehicleRecord(row) {
    var imageRows = Array.isArray(row && row.vehicle_images) ? row.vehicle_images.slice() : [];

    imageRows.sort(function (a, b) {
      return Number(a && a.sort_order ? a.sort_order : 0) - Number(b && b.sort_order ? b.sort_order : 0);
    });

    var imageUrls = imageRows
      .map(function (image) {
        return trim(image && image.image_url);
      })
      .filter(Boolean);

    var primaryImageUrl = trim(row && row.primary_image_url) || (imageUrls[0] || "");
    var name = trim(row && row.name);
    var type = trim(row && row.type);
    var seats = Number(row && row.seats ? row.seats : 0);
    var pricePerDay = Number(row && row.price_per_day ? row.price_per_day : 0);
    var fuelType = normalizeFuelType(row && row.fuel_type) || trim(row && row.fuel_type);
    var status = normalizeStatus(row && row.status);

    return {
      id: String(row && row.id ? row.id : ""),
      name: name,
      brand: deriveBrand(name),
      model: deriveModel(name),
      type: type,
      seats: Number.isFinite(seats) ? seats : 0,
      pricePerDay: Number.isFinite(pricePerDay) ? pricePerDay : 0,
      fuelType: fuelType,
      status: status,
      primaryImageUrl: primaryImageUrl,
      imageUrls: imageUrls.length ? imageUrls : (primaryImageUrl ? [primaryImageUrl] : []),
      createdAt: row && row.created_at ? row.created_at : null,
      addedDate: row && row.created_at ? row.created_at : null,
    };
  }

  async function fetchVehicles(client, includeInactive) {
    var query = client
      .from("vehicles")
      .select(vehicleSelectColumns())
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("status", "available");
    }

    var response = await query;

    if (response.error) {
      var message = getErrorMessage(response.error);
      if (
        message.indexOf("relationship") >= 0 ||
        message.indexOf("foreign key") >= 0 ||
        message.indexOf("cannot embed") >= 0
      ) {
        var fallback = client
          .from("vehicles")
          .select("id, name, type, seats, price_per_day, fuel_type, status, primary_image_url, created_at")
          .order("created_at", { ascending: false });

        if (!includeInactive) {
          fallback = fallback.eq("status", "available");
        }

        response = await fallback;
        if (response.error) {
          throw response.error;
        }

        var rows = Array.isArray(response.data) ? response.data : [];
        var vehicleIds = rows.map(function (row) {
          return row.id;
        });

        var imagesByVehicle = {};
        if (vehicleIds.length) {
          var imageResponse = await client
            .from("vehicle_images")
            .select("vehicle_id, image_url, storage_path, sort_order")
            .in("vehicle_id", vehicleIds)
            .order("sort_order", { ascending: true });

          if (!imageResponse.error) {
            (imageResponse.data || []).forEach(function (imageRow) {
              var vehicleId = String(imageRow.vehicle_id || "");
              if (!imagesByVehicle[vehicleId]) {
                imagesByVehicle[vehicleId] = [];
              }
              imagesByVehicle[vehicleId].push(imageRow);
            });
          }
        }

        return rows.map(function (row) {
          row.vehicle_images = imagesByVehicle[String(row.id)] || [];
          return mapVehicleRecord(row);
        });
      }

      throw response.error;
    }

    return (response.data || []).map(mapVehicleRecord);
  }

  async function listVehicles(options) {
    var includeInactive = !!(options && options.includeInactive);
    var client = await getClient();
    return fetchVehicles(client, includeInactive);
  }

  async function getVehicleById(vehicleId, options) {
    var targetId = trim(vehicleId);
    if (!targetId) {
      return null;
    }

    var includeInactive = !!(options && options.includeInactive);
    var rows = await listVehicles({ includeInactive: includeInactive });
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].id === targetId) {
        return rows[i];
      }
    }
    return null;
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
      status: "available",
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
      uploadedImages = await uploadVehicleImages(
        client,
        session.user.id,
        vehicleId,
        validation.normalized.images
      );

      var imageInsertPayload = uploadedImages.map(function (image) {
        return {
          vehicle_id: vehicleId,
          image_url: image.image_url,
          storage_path: image.storage_path,
          sort_order: image.sort_order,
        };
      });

      var imageInsert = await client
        .from("vehicle_images")
        .insert(imageInsertPayload)
        .select("id");

      if (imageInsert.error) {
        throw imageInsert.error;
      }

      var primaryImageUrl = uploadedImages[0] ? uploadedImages[0].image_url : null;
      if (primaryImageUrl) {
        var updated = await client
          .from("vehicles")
          .update({ primary_image_url: primaryImageUrl })
          .eq("id", vehicleId);

        if (updated.error) {
          throw updated.error;
        }
      }
    } catch (error) {
      await removeUploadedStorageObjects(
        client,
        uploadedImages.map(function (image) {
          return image.storage_path;
        })
      );

      await client.from("vehicle_images").delete().eq("vehicle_id", vehicleId);
      await client.from("vehicles").delete().eq("id", vehicleId);
      throw error;
    }

    var createdVehicle = await getVehicleById(vehicleId, { includeInactive: true });
    broadcastVehicleCatalogChanged();

    return createdVehicle;
  }

  function mapVehicleToSearchItem(vehicle) {
    var safeVehicle = vehicle || {};
    var price = Number(safeVehicle.pricePerDay || 0);
    var status = normalizeStatus(safeVehicle.status);
    var seats = Number(safeVehicle.seats || 0);
    var fuelType = safeVehicle.fuelType || "Petrol";

    return {
      id: String(safeVehicle.id || ""),
      brand: safeVehicle.brand || deriveBrand(safeVehicle.name),
      name: safeVehicle.model || deriveModel(safeVehicle.name),
      type: toLower(safeVehicle.type || "vehicle"),
      transmission: "Automatic",
      fuelType: fuelType,
      seats: Number.isFinite(seats) && seats > 0 ? seats : 5,
      rating: 4.7,
      location: "Available",
      available: status === "available",
      availability: status === "available" ? "Available" : "Unavailable",
      pricing: {
        dailyRate: "$" + Math.round(Number.isFinite(price) ? price : 0) + " / day",
      },
      features: [
        "ac",
        "gps",
        "bluetooth",
        fuelType.toLowerCase(),
      ],
      insuranceOptions: ["basic", "premium", "comprehensive"],
      driverOptions: ["self-drive", "with-driver"],
      mileagePolicy: ["unlimited"],
      imageUrl: safeVehicle.primaryImageUrl || "",
      addedDate: safeVehicle.createdAt || new Date().toISOString(),
    };
  }

  async function listVehiclesForSearch() {
    var vehicles = await listVehicles({ includeInactive: false });
    return vehicles.map(mapVehicleToSearchItem);
  }

  function broadcastVehicleCatalogChanged() {
    var version = String(Date.now());

    try {
      window.localStorage.setItem(VEHICLE_CHANGE_STORAGE_KEY, version);
    } catch (_error) {
      // Ignore storage write errors in private mode.
    }

    try {
      window.dispatchEvent(
        new CustomEvent(VEHICLE_CHANGE_EVENT, {
          detail: { version: version },
        })
      );
    } catch (_eventError) {
      window.dispatchEvent(new Event(VEHICLE_CHANGE_EVENT));
    }

    return version;
  }

  function subscribeToVehicleCatalogChanges(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    function onStorage(event) {
      if (event.key !== VEHICLE_CHANGE_STORAGE_KEY || !event.newValue) {
        return;
      }
      callback(event.newValue);
    }

    function onCustom(event) {
      var detail = event && event.detail ? event.detail : {};
      callback(detail.version || String(Date.now()));
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(VEHICLE_CHANGE_EVENT, onCustom);

    return function unsubscribe() {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(VEHICLE_CHANGE_EVENT, onCustom);
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
    getClient: getClient,
    getSession: getSession,
    listVehicles: listVehicles,
    getVehicleById: getVehicleById,
    createVehicle: createVehicle,
    listVehiclesForSearch: listVehiclesForSearch,
    mapVehicleToSearchItem: mapVehicleToSearchItem,
    broadcastVehicleCatalogChanged: broadcastVehicleCatalogChanged,
    subscribeToVehicleCatalogChanges: subscribeToVehicleCatalogChanges,
  };
})();
