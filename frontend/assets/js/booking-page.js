(function () {
  "use strict";

  var DEFAULT_IMAGE = "assets/images/car-transparent.png";

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

  function formatMoney(amount) {
    var numeric = Number(amount || 0);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }

    return "$" + numeric.toFixed(2);
  }

  function getQueryParam(key) {
    try {
      var params = new URLSearchParams(window.location.search);
      return normalizeString(params.get(key), "");
    } catch (_error) {
      return "";
    }
  }

  function getVehicleDisplayName(vehicle) {
    var brand = normalizeString(vehicle && vehicle.brand, "");
    var name = normalizeString(vehicle && vehicle.name, "");
    var brandLower = brand.toLowerCase();
    var nameLower = name.toLowerCase();

    if (name) {
      if (!brand || brandLower === "general") {
        return name;
      }

      if (nameLower === brandLower || nameLower.indexOf(brandLower + " ") === 0) {
        return name;
      }
    }

    if (brand && name) {
      return brand + " " + name;
    }

    return name || brand || "Vehicle";
  }

  function parseDailyRate(vehicle) {
    if (Number.isFinite(Number(vehicle && vehicle.pricePerDay))) {
      return Math.max(0, Number(vehicle.pricePerDay));
    }

    var pricingText = normalizeString(
      vehicle && vehicle.pricing && vehicle.pricing.dailyRate ? vehicle.pricing.dailyRate : "0",
      "0"
    );

    var parsed = Number(pricingText.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, parsed);
  }

  function resolveImage(vehicle) {
    var primary = normalizeString(vehicle && vehicle.primaryImageUrl, "");
    if (primary) {
      return primary;
    }

    if (Array.isArray(vehicle && vehicle.imageUrls) && vehicle.imageUrls.length) {
      var first = normalizeString(vehicle.imageUrls[0], "");
      if (first) {
        return first;
      }
    }

    return DEFAULT_IMAGE;
  }

  function setDefaultDateInputs() {
    var startInput = byId("bookingStartDate");
    var endInput = byId("bookingEndDate");

    if (!startInput || !endInput) {
      return;
    }

    if (startInput.value && endInput.value) {
      return;
    }

    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

    function toIsoDate(value) {
      var yyyy = value.getFullYear();
      var mm = String(value.getMonth() + 1).padStart(2, "0");
      var dd = String(value.getDate()).padStart(2, "0");
      return yyyy + "-" + mm + "-" + dd;
    }

    if (!startInput.value) {
      startInput.value = toIsoDate(start);
    }
    if (!endInput.value) {
      endInput.value = toIsoDate(end);
    }
  }

  function setBannerMessage(targetId, text, mode) {
    var element = byId(targetId);
    if (!element) {
      return;
    }

    if (!text) {
      element.textContent = "";
      element.classList.add("hidden");
      return;
    }

    element.classList.remove("hidden");
    element.textContent = text;
    element.classList.remove("border-rose-200", "bg-rose-50", "text-rose-700", "border-emerald-200", "bg-emerald-50", "text-emerald-700");

    if (mode === "success") {
      element.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
      return;
    }

    element.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
  }

  function renderVehicleSummary(vehicle) {
    var title = byId("bookingVehicleTitle");
    var meta = byId("bookingVehicleMeta");
    var price = byId("bookingVehiclePrice");
    var image = byId("bookingVehicleImage");

    if (!vehicle) {
      if (title) {
        title.textContent = "Vehicle";
      }
      if (meta) {
        meta.textContent = "Select a vehicle to continue";
      }
      if (price) {
        price.textContent = "$0 / day";
      }
      if (image) {
        image.src = DEFAULT_IMAGE;
      }
      return;
    }

    var displayName = getVehicleDisplayName(vehicle);
    var dailyRate = parseDailyRate(vehicle);
    var type = normalizeString(vehicle.category || vehicle.type, "Vehicle");
    var transmission = normalizeString(vehicle.transmission, "Automatic");
    var fuel = normalizeString(vehicle.fuelType, "Petrol");

    if (title) {
      title.textContent = displayName;
    }
    if (meta) {
      meta.textContent = type + " | " + transmission + " | " + fuel;
    }
    if (price) {
      price.textContent = "$" + Math.round(dailyRate) + " / day";
    }
    if (image) {
      image.src = resolveImage(vehicle);
      image.alt = displayName;
      image.onerror = function () {
        image.src = DEFAULT_IMAGE;
      };
    }
  }

  function renderQuote(quote) {
    var duration = byId("bookingDurationText");
    var base = byId("bookingBaseAmount");
    var service = byId("bookingServiceFee");
    var tax = byId("bookingTaxAmount");
    var discount = byId("bookingDiscountAmount");
    var total = byId("bookingTotalAmount");

    if (duration) {
      duration.textContent = String(quote.bookingDays || 0) + " day" + ((quote.bookingDays || 0) === 1 ? "" : "s");
    }
    if (base) {
      base.textContent = formatMoney(quote.baseAmount);
    }
    if (service) {
      service.textContent = formatMoney(quote.serviceFee);
    }
    if (tax) {
      tax.textContent = formatMoney(quote.taxAmount);
    }
    if (discount) {
      discount.textContent = "-" + formatMoney(quote.discountAmount);
    }
    if (total) {
      total.textContent = formatMoney(quote.totalAmount);
    }
  }

  function readFormValues() {
    return {
      vehicleId: normalizeString(byId("bookingVehicleSelect") && byId("bookingVehicleSelect").value, ""),
      startDate: normalizeString(byId("bookingStartDate") && byId("bookingStartDate").value, ""),
      endDate: normalizeString(byId("bookingEndDate") && byId("bookingEndDate").value, ""),
      pickupTime: normalizeString(byId("bookingPickupTime") && byId("bookingPickupTime").value, "10:00"),
      customerName: normalizeString(byId("bookingCustomerName") && byId("bookingCustomerName").value, ""),
      customerEmail: normalizeString(byId("bookingCustomerEmail") && byId("bookingCustomerEmail").value, ""),
      customerPhone: normalizeString(byId("bookingCustomerPhone") && byId("bookingCustomerPhone").value, ""),
      couponCode: normalizeString(byId("bookingCouponCode") && byId("bookingCouponCode").value, ""),
      notes: normalizeString(byId("bookingNotes") && byId("bookingNotes").value, ""),
    };
  }

  async function loadVehicles() {
    if (!window.VehicleCatalogService || typeof window.VehicleCatalogService.listVehicles !== "function") {
      return [];
    }

    try {
      var rows = await window.VehicleCatalogService.listVehicles({ includeInactive: false });
      if (!Array.isArray(rows)) {
        return [];
      }

      return rows.filter(function (vehicle) {
        return vehicle && vehicle.id;
      });
    } catch (_error) {
      return [];
    }
  }

  function fillVehicleSelect(vehicles, selectedId) {
    var select = byId("bookingVehicleSelect");
    if (!select) {
      return;
    }

    if (!vehicles.length) {
      select.innerHTML = '<option value="">No active vehicles</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = vehicles
      .map(function (vehicle) {
        var id = normalizeString(vehicle.id, "");
        var name = getVehicleDisplayName(vehicle);
        var dailyRate = Math.round(parseDailyRate(vehicle));
        var selected = id === selectedId ? " selected" : "";
        return '<option value="' + id + '"' + selected + '>' + name + ' - $' + dailyRate + '/day</option>';
      })
      .join("");
  }

  function updateAvailabilityPill(mode, text) {
    var pill = byId("bookingAvailabilityStatus");
    if (!pill) {
      return;
    }

    pill.classList.remove("border-[#d5e2dc]", "bg-[#f6faf8]", "text-[#2e5e5a]", "border-rose-200", "bg-rose-50", "text-rose-700", "border-emerald-200", "bg-emerald-50", "text-emerald-700");
    if (mode === "error") {
      pill.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
    } else if (mode === "ok") {
      pill.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700");
    } else {
      pill.classList.add("border-[#d5e2dc]", "bg-[#f6faf8]", "text-[#2e5e5a]");
    }

    pill.innerHTML = '<span class="inline-flex h-2.5 w-2.5 rounded-full bg-current"></span><span>' + text + '</span>';
  }

  function applyCouponStatus(text) {
    var label = byId("bookingCouponStatus");
    if (!label) {
      return;
    }

    label.textContent = text;
  }

  function syncQuoteFromState(state) {
    var vehicle = state.selectedVehicle;
    var values = readFormValues();

    if (!vehicle || !window.VehicleBookingService || typeof window.VehicleBookingService.calculateBookingQuote !== "function") {
      renderQuote({ bookingDays: 0, baseAmount: 0, serviceFee: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 });
      return;
    }

    var quote = window.VehicleBookingService.calculateBookingQuote({
      dailyRate: parseDailyRate(vehicle),
      startDate: values.startDate,
      endDate: values.endDate,
      couponCode: values.couponCode,
    });

    state.latestQuote = quote;
    renderQuote(quote);

    if (values.couponCode) {
      if (quote.couponCode) {
        applyCouponStatus(quote.couponMessage);
      } else {
        applyCouponStatus("Coupon not recognized");
      }
    } else {
      applyCouponStatus("Try SAVE10 or WEEKEND50");
    }
  }

  function selectVehicleById(state, vehicleId) {
    var nextVehicle = null;
    for (var i = 0; i < state.vehicles.length; i += 1) {
      if (String(state.vehicles[i].id) === String(vehicleId)) {
        nextVehicle = state.vehicles[i];
        break;
      }
    }

    state.selectedVehicle = nextVehicle;
    renderVehicleSummary(nextVehicle);
    syncQuoteFromState(state);
  }

  function wireBaseInteractions(state) {
    var vehicleSelect = byId("bookingVehicleSelect");
    var startDate = byId("bookingStartDate");
    var endDate = byId("bookingEndDate");
    var couponCode = byId("bookingCouponCode");
    var applyCoupon = byId("bookingApplyCoupon");

    if (vehicleSelect) {
      vehicleSelect.addEventListener("change", function () {
        setBannerMessage("bookingFormError", "", "error");
        updateAvailabilityPill("default", "Choose dates to check availability");
        selectVehicleById(state, vehicleSelect.value);
        scheduleAvailabilityCheck(state);
      });
    }

    [startDate, endDate].forEach(function (input) {
      if (!input) {
        return;
      }

      input.addEventListener("input", function () {
        setBannerMessage("bookingFormError", "", "error");
        updateAvailabilityPill("default", "Choose dates to check availability");
        syncQuoteFromState(state);
        scheduleAvailabilityCheck(state);
      });
    });

    if (couponCode) {
      couponCode.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        syncQuoteFromState(state);
      });
    }

    if (applyCoupon) {
      applyCoupon.addEventListener("click", function () {
        syncQuoteFromState(state);
      });
    }
  }

  function setModalState(modalId, cardId, isOpen) {
    var modal = byId(modalId);
    var card = byId(cardId);

    if (!modal || !card) {
      return;
    }

    if (isOpen) {
      modal.classList.remove("pointer-events-none", "opacity-0");
      modal.classList.add("pointer-events-auto", "opacity-100");
      card.classList.remove("translate-y-2", "scale-[0.985]");
      card.classList.add("translate-y-0", "scale-100");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("overflow-hidden");
      return;
    }

    modal.classList.remove("pointer-events-auto", "opacity-100");
    modal.classList.add("pointer-events-none", "opacity-0");
    card.classList.remove("translate-y-0", "scale-100");
    card.classList.add("translate-y-2", "scale-[0.985]");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overflow-hidden");
  }

  function formatDatePretty(value) {
    var text = normalizeString(value, "");
    if (!text) {
      return "-";
    }

    var date = new Date(text + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return text;
    }

    try {
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (_error) {
      return text;
    }
  }

  async function checkAvailability(state) {
    var values = readFormValues();

    if (!state.selectedVehicle || !values.startDate || !values.endDate) {
      state.lastAvailability = null;
      updateAvailabilityPill("default", "Choose dates to check availability");
      return null;
    }

    if (!window.VehicleBookingService || typeof window.VehicleBookingService.checkAvailability !== "function") {
      updateAvailabilityPill("error", "Availability service is unavailable");
      return null;
    }

    var requestId = state.availabilityRequestId + 1;
    state.availabilityRequestId = requestId;

    try {
      var result = await window.VehicleBookingService.checkAvailability({
        vehicleId: state.selectedVehicle.id,
        startDate: values.startDate,
        endDate: values.endDate,
      });

      if (requestId !== state.availabilityRequestId) {
        return state.lastAvailability;
      }

      state.lastAvailability = result;
      if (result && result.available) {
        updateAvailabilityPill("ok", "Vehicle is available for the selected dates");
      } else {
        updateAvailabilityPill("error", "Vehicle is not available for the selected dates");
      }

      return result;
    } catch (error) {
      if (requestId !== state.availabilityRequestId) {
        return state.lastAvailability;
      }

      state.lastAvailability = null;
      var message = window.VehicleBookingService && typeof window.VehicleBookingService.toPublicError === "function"
        ? window.VehicleBookingService.toPublicError(error, "Unable to check availability right now.")
        : "Unable to check availability right now.";

      updateAvailabilityPill("error", message);
      return null;
    }
  }

  function scheduleAvailabilityCheck(state) {
    if (state.availabilityTimerId) {
      window.clearTimeout(state.availabilityTimerId);
    }

    state.availabilityTimerId = window.setTimeout(function () {
      checkAvailability(state);
    }, 220);
  }

  function firstErrorMessage(errors) {
    if (!errors || typeof errors !== "object") {
      return "Please complete the booking form before continuing.";
    }

    var keys = Object.keys(errors);
    if (!keys.length) {
      return "Please complete the booking form before continuing.";
    }

    return normalizeString(errors[keys[0]], "Please complete the booking form before continuing.");
  }

  function buildConfirmSummaryHtml(state, values) {
    var quote = state.latestQuote || {
      bookingDays: 0,
      baseAmount: 0,
      serviceFee: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    };
    var vehicleName = getVehicleDisplayName(state.selectedVehicle || {});

    return [
      '<div class="grid gap-2">',
      '<div class="flex items-center justify-between"><span class="font-semibold">Vehicle</span><span>' + vehicleName + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">Start Date</span><span>' + formatDatePretty(values.startDate) + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">End Date</span><span>' + formatDatePretty(values.endDate) + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">Pickup Time</span><span>' + normalizeString(values.pickupTime, "10:00") + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">Customer</span><span>' + normalizeString(values.customerName, "-") + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">Email</span><span>' + normalizeString(values.customerEmail, "-") + '</span></div>',
      '<div class="mt-2 border-t border-[#d7e3de] pt-2">',
      '<div class="flex items-center justify-between"><span class="font-semibold">Duration</span><span>' + quote.bookingDays + ' day' + (quote.bookingDays === 1 ? '' : 's') + '</span></div>',
      '<div class="flex items-center justify-between"><span class="font-semibold">Total</span><span class="font-bold text-[#1f5b57]">' + formatMoney(quote.totalAmount) + '</span></div>',
      '</div>',
      '</div>'
    ].join('');
  }

  function wireReviewFlow(state) {
    var reviewBtn = byId("bookingReviewBtn");
    var confirmSummary = byId("bookingConfirmSummary");
    var confirmCancel = byId("bookingConfirmCancel");
    var confirmModal = byId("bookingConfirmModal");

    if (confirmCancel) {
      confirmCancel.addEventListener("click", function () {
        setBannerMessage("bookingConfirmError", "", "error");
        setModalState("bookingConfirmModal", "bookingConfirmCard", false);
      });
    }

    if (confirmModal) {
      confirmModal.addEventListener("click", function (event) {
        if (event.target === confirmModal) {
          setBannerMessage("bookingConfirmError", "", "error");
          setModalState("bookingConfirmModal", "bookingConfirmCard", false);
        }
      });
    }

    if (!reviewBtn) {
      return;
    }

    reviewBtn.addEventListener("click", async function () {
      setBannerMessage("bookingFormError", "", "error");
      setBannerMessage("bookingConfirmError", "", "error");

      if (!state.selectedVehicle) {
        setBannerMessage("bookingFormError", "Select a vehicle before continuing.", "error");
        return;
      }

      if (!window.VehicleBookingService || typeof window.VehicleBookingService.validateBookingInput !== "function") {
        setBannerMessage("bookingFormError", "Booking service is unavailable right now.", "error");
        return;
      }

      var values = readFormValues();
      var validation = window.VehicleBookingService.validateBookingInput({
        vehicleId: state.selectedVehicle.id,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        startDate: values.startDate,
        endDate: values.endDate,
        pickupTime: values.pickupTime,
        couponCode: values.couponCode,
        notes: values.notes,
        dailyRate: parseDailyRate(state.selectedVehicle),
        status: "confirmed",
      });

      if (!validation.valid) {
        setBannerMessage("bookingFormError", firstErrorMessage(validation.errors), "error");
        return;
      }

      var availability = await checkAvailability(state);
      if (!availability || !availability.available) {
        setBannerMessage("bookingFormError", "Selected dates are unavailable for this vehicle.", "error");
        return;
      }

      state.pendingBookingValues = values;
      if (confirmSummary) {
        confirmSummary.innerHTML = buildConfirmSummaryHtml(state, values);
      }

      setModalState("bookingConfirmModal", "bookingConfirmCard", true);
    });
  }

  async function init() {
    var state = {
      vehicles: [],
      selectedVehicle: null,
      pendingBookingValues: null,
      lastAvailability: null,
      availabilityTimerId: null,
      availabilityRequestId: 0,
      latestQuote: {
        bookingDays: 0,
        baseAmount: 0,
        serviceFee: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
      },
    };

    setDefaultDateInputs();

    state.vehicles = await loadVehicles();

    var queryVehicle = getQueryParam("vehicle");
    var preferredVehicleId = queryVehicle || (state.vehicles[0] && state.vehicles[0].id ? state.vehicles[0].id : "");

    fillVehicleSelect(state.vehicles, preferredVehicleId);
    selectVehicleById(state, preferredVehicleId);
    wireBaseInteractions(state);
    wireReviewFlow(state);
    scheduleAvailabilityCheck(state);

    if (!state.vehicles.length) {
      setBannerMessage("bookingFormError", "No active vehicles are available for booking right now.", "error");
      updateAvailabilityPill("error", "No vehicles available");
    }

    var status = byId("bookingLiveStatus");
    if (status && (!window.VehicleCatalogService || !window.VehicleBookingService)) {
      status.innerHTML = '<span class="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span><span>Booking services are loading</span>';
    }
  }

  window.VehicleBookingPage = {
    init: init,
  };
})();
