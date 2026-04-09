(function () {
  "use strict";

  var HOME_SEARCH_PREFILL_KEY = "vrs:home-hero-search-prefill:v1";
  var FALLBACK_VEHICLE_TYPES = ["economy", "sedan", "suv", "luxury", "van"];

  function byId(id) {
    return document.getElementById(id);
  }

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

  function toTitleCase(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function canonicalizeVehicleType(rawValue) {
    var text = normalizeString(rawValue, "").toLowerCase();
    if (!text) {
      return "";
    }

    if (text === "suv" || text.indexOf("sport utility") >= 0 || text.indexOf("jeep") >= 0) {
      return "suv";
    }

    if (text === "sedan") {
      return "sedan";
    }

    if (text === "luxury" || text.indexOf("premium") >= 0) {
      return "luxury";
    }

    if (text === "van" || text.indexOf("mini van") >= 0 || text.indexOf("minivan") >= 0) {
      return "van";
    }

    if (
      text === "economy" ||
      text === "compact" ||
      text === "hatchback" ||
      text === "city"
    ) {
      return "economy";
    }

    return text;
  }

  function toDateTimeInputValue(date) {
    var target = date instanceof Date ? new Date(date.getTime()) : new Date();
    target.setSeconds(0, 0);

    var yyyy = target.getFullYear();
    var mm = String(target.getMonth() + 1).padStart(2, "0");
    var dd = String(target.getDate()).padStart(2, "0");
    var hh = String(target.getHours()).padStart(2, "0");
    var min = String(target.getMinutes()).padStart(2, "0");

    return yyyy + "-" + mm + "-" + dd + "T" + hh + ":" + min;
  }

  function parseDateTime(value) {
    var text = normalizeString(value, "");
    if (!text) {
      return null;
    }

    var parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  function showError(message) {
    var errorEl = byId("homeHeroBookingError");
    if (!errorEl) {
      return;
    }

    var text = normalizeString(message, "");
    if (!text) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      return;
    }

    errorEl.textContent = text;
    errorEl.classList.remove("hidden");
  }

  function setSubmitLoading(isLoading) {
    var button = byId("homeHeroBookingSubmit");
    if (!button) {
      return;
    }

    if (isLoading) {
      button.disabled = true;
      button.classList.add("opacity-80", "cursor-not-allowed");
      button.textContent = "Preparing Results...";
      return;
    }

    button.disabled = false;
    button.classList.remove("opacity-80", "cursor-not-allowed");
    button.textContent = "Browse Vehicles";
  }

  async function fetchVehicleTypes() {
    var service = window.VehicleCatalogService || null;
    var rows = [];

    if (service && typeof service.listVehiclesForSearch === "function") {
      try {
        rows = await service.listVehiclesForSearch();
      } catch (_error) {
        rows = [];
      }
    }

    if ((!Array.isArray(rows) || !rows.length) && service && typeof service.listVehicles === "function") {
      try {
        rows = await service.listVehicles({ includeInactive: false });
      } catch (_error) {
        rows = [];
      }
    }

    var unique = new Set();

    if (Array.isArray(rows)) {
      rows.forEach(function (vehicle) {
        var type = canonicalizeVehicleType(vehicle && (vehicle.type || vehicle.category));
        if (type) {
          unique.add(type);
        }
      });
    }

    if (!unique.size) {
      FALLBACK_VEHICLE_TYPES.forEach(function (type) {
        unique.add(type);
      });
    }

    return Array.from(unique).sort();
  }

  function applyDateTimeConstraints(pickupInput, dropoffInput) {
    if (!pickupInput || !dropoffInput) {
      return;
    }

    var refreshMinValues = function () {
      var now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      var minNow = toDateTimeInputValue(now);

      pickupInput.min = minNow;
      dropoffInput.min = pickupInput.value || minNow;

      if (dropoffInput.value && dropoffInput.value < dropoffInput.min) {
        dropoffInput.value = dropoffInput.min;
      }
    };

    refreshMinValues();

    [pickupInput, dropoffInput].forEach(function (input) {
      input.addEventListener("focus", refreshMinValues);
      input.addEventListener("input", refreshMinValues);
      input.addEventListener("change", refreshMinValues);
    });
  }

  function setDefaultDateTimes(pickupInput, dropoffInput) {
    if (!pickupInput || !dropoffInput) {
      return;
    }

    if (!pickupInput.value) {
      var pickup = new Date();
      pickup.setDate(pickup.getDate() + 1);
      pickup.setHours(10, 0, 0, 0);
      pickupInput.value = toDateTimeInputValue(pickup);
    }

    if (!dropoffInput.value) {
      var dropoff = parseDateTime(pickupInput.value);
      if (!dropoff) {
        dropoff = new Date();
      }

      dropoff.setDate(dropoff.getDate() + 2);
      dropoffInput.value = toDateTimeInputValue(dropoff);
    }
  }

  function persistAndRedirect(payload) {
    var target = new URL("vehicles.html", window.location.href);
    target.searchParams.set("vehicleType", payload.vehicleType);
    target.searchParams.set("pickupLocation", payload.pickupLocation);
    target.searchParams.set("pickupDateTime", payload.pickupDateTime);
    target.searchParams.set("dropoffDateTime", payload.dropoffDateTime);

    try {
      sessionStorage.setItem(HOME_SEARCH_PREFILL_KEY, JSON.stringify(payload));
    } catch (_error) {
      // Keep URL params as a fallback if storage fails.
    }

    window.location.href = target.toString();
  }

  function populateVehicleTypeSelect(select, types) {
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Choose vehicle type</option>' +
      types
        .map(function (type) {
          var value = normalizeString(type, "");
          if (!value) {
            return "";
          }

          return '<option value="' + value + '">' + toTitleCase(value) + '</option>';
        })
        .join("");
  }

  async function init() {
    var form = byId("homeHeroBookingForm");
    var typeSelect = byId("homeVehicleType");
    var pickupLocationInput = byId("homePickupLocation");
    var pickupDateTimeInput = byId("homePickupDateTime");
    var dropoffDateTimeInput = byId("homeDropoffDateTime");

    if (!form || !typeSelect || !pickupLocationInput || !pickupDateTimeInput || !dropoffDateTimeInput) {
      return;
    }

    setSubmitLoading(false);
    showError("");
    setDefaultDateTimes(pickupDateTimeInput, dropoffDateTimeInput);
    applyDateTimeConstraints(pickupDateTimeInput, dropoffDateTimeInput);

    var vehicleTypes = await fetchVehicleTypes();
    populateVehicleTypeSelect(typeSelect, vehicleTypes);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showError("");

      var vehicleType = canonicalizeVehicleType(typeSelect.value);
      var pickupLocation = normalizeString(pickupLocationInput.value, "");
      var pickupDateTime = normalizeString(pickupDateTimeInput.value, "");
      var dropoffDateTime = normalizeString(dropoffDateTimeInput.value, "");

      if (!vehicleType || !pickupLocation || !pickupDateTime || !dropoffDateTime) {
        showError("Please complete all fields before browsing vehicles.");
        return;
      }

      var pickupDate = parseDateTime(pickupDateTime);
      var dropoffDate = parseDateTime(dropoffDateTime);
      var now = new Date();

      if (!pickupDate || !dropoffDate) {
        showError("Please choose valid pickup and drop-off date/time values.");
        return;
      }

      if (pickupDate <= now) {
        showError("Pickup date/time must be in the future.");
        return;
      }

      if (dropoffDate <= pickupDate) {
        showError("Drop-off date/time must be after pickup date/time.");
        return;
      }

      setSubmitLoading(true);

      persistAndRedirect({
        source: "home-hero",
        createdAt: Date.now(),
        vehicleType: vehicleType,
        pickupLocation: pickupLocation,
        pickupDateTime: pickupDateTime,
        dropoffDateTime: dropoffDateTime,
      });
    });
  }

  window.HomeHeroBooking = {
    init: init,
  };
})();
