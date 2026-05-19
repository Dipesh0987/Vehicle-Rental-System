(function () {
  "use strict";

  var DEFAULT_IMAGE = "assets/images/car-transparent.png";
  var BOOKING_HANDOFF_STORAGE_KEY = "vrs_booking_handoff";

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

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readStoredAuthSession() {
    try {
      var raw = sessionStorage.getItem("vrs_auth_session") || localStorage.getItem("vrs_auth_session");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function hasRegisteredUserSession() {
    var session = readStoredAuthSession();
    return Boolean(
      session &&
      (
        String(session.userId || "").trim() ||
        String(session.email || "").trim()
      )
    );
  }

  function ensureRegisteredBookingAccess() {
    var message = "Please register or sign in to continue with vehicle booking. Redirecting to registration...";

    if (window.VehicleAuthUI && typeof window.VehicleAuthUI.requireBookingAccess === "function") {
      return window.VehicleAuthUI.requireBookingAccess({
        message: message,
        autoRedirect: true,
        delayMs: 700,
      });
    }

    if (hasRegisteredUserSession()) {
      return true;
    }

    setBannerMessage("bookingFormError", message, "error");
    window.setTimeout(function () {
      window.location.href = "registration.html";
    }, 700);
    return false;
  }

  async function readVerificationStatus() {
    if (!window.VehicleAuthService || typeof window.VehicleAuthService.getProfile !== "function") {
      return "not_submitted";
    }

    try {
      var profile = await window.VehicleAuthService.getProfile();
      return normalizeString(profile && profile.verification_status, "not_submitted").toLowerCase() || "not_submitted";
    } catch (_error) {
      return "not_submitted";
    }
  }

  function isVerificationApproved(status) {
    return normalizeString(status, "").toLowerCase() === "approved";
  }

  function getVerificationBlockedMessage() {
    return "Booking cannot be completed until your account is verified. Please complete the verification process to start booking.";
  }

  async function ensureBookingVerificationAccess(state, targetBannerId) {
    var verificationStatus = normalizeString(state && state.verificationStatus, "").toLowerCase();

    if (verificationStatus !== "approved") {
      verificationStatus = await readVerificationStatus();
      if (state) {
        state.verificationStatus = verificationStatus;
      }
    }

    if (!isVerificationApproved(verificationStatus)) {
      var bannerId = targetBannerId || "bookingFormError";
      var bannerEl = byId(bannerId);
      if (bannerEl) {
        var safeText = escapeHtml(getVerificationBlockedMessage());
        var btnId = "bookingVerifyNowBtn";
        bannerEl.classList.remove("hidden");
        bannerEl.classList.remove("border-emerald-200", "bg-emerald-50", "text-emerald-700");
        bannerEl.classList.add("border-rose-200", "bg-rose-50", "text-rose-700");
        bannerEl.innerHTML = '<span>' + safeText + '</span> <button id="' + btnId + '" class="ml-3 inline-flex items-center rounded bg-accent px-3 py-1 text-sm font-semibold text-white">Verify now</button>';

        // Attach click handler to redirect to profile verification page
        try {
          var verifyBtn = byId(btnId);
          if (verifyBtn) {
            verifyBtn.addEventListener("click", function (e) {
              e.preventDefault();
              window.location.href = "profile-verification.html";
            });
          }
        } catch (_err) {
          // ignore attach errors
        }
      }

      updateAvailabilityPill("error", "Verification required before booking");
      return false;
    }

    return true;
  }

  function formatMoney(amount) {
    var numeric = Number(amount || 0);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }

    return "NPR " + numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getQueryParam(key) {
    try {
      var params = new URLSearchParams(window.location.search);
      return normalizeString(params.get(key), "");
    } catch (_error) {
      return "";
    }
  }

  function addDaysToIsoDate(isoDate, days) {
    var parsed = new Date(String(isoDate || "") + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    parsed.setDate(parsed.getDate() + Math.max(0, Number(days || 0)));
    var yyyy = parsed.getFullYear();
    var mm = String(parsed.getMonth() + 1).padStart(2, "0");
    var dd = String(parsed.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function consumeBookingHandoffContext() {
    try {
      var raw = sessionStorage.getItem(BOOKING_HANDOFF_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      sessionStorage.removeItem(BOOKING_HANDOFF_STORAGE_KEY);

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return parsed;
    } catch (_error) {
      return null;
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

  function isoToday() {
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function ensureValidDates() {
    var startInput = byId('bookingStartDate');
    var endInput = byId('bookingEndDate');
    if (!startInput || !endInput) return;

    var today = isoToday();
    var start = normalizeString(startInput.value, '');
    var end = normalizeString(endInput.value, '');

    // If start is invalid or in the past, set to today
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(start) || start < today) {
      startInput.value = today;
      start = today;
    }

    // If end is invalid or before start, set end = start
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(end) || end < start) {
      endInput.value = start;
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

    if (!vehicle) {
      if (title) {
        title.textContent = "Vehicle";
      }
      if (meta) {
        meta.textContent = "";
      }
      if (price) {
        price.textContent = "NPR 0 / day";
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
      meta.textContent = "";
    }
    if (price) {
      price.textContent = "NPR " + Math.round(dailyRate).toLocaleString() + " / day";
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
      var totalDiscount = (quote.totalDiscount || quote.discountAmount || 0);
      discount.textContent = "-" + formatMoney(totalDiscount);
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
      driverOption: normalizeString(byId("bookingDriverOption") && byId("bookingDriverOption").value, "self_drive"),
      customerName: normalizeString(byId("bookingCustomerName") && byId("bookingCustomerName").value, ""),
      customerEmail: normalizeString(byId("bookingCustomerEmail") && byId("bookingCustomerEmail").value, ""),
      customerPhone: normalizeString(byId("bookingCustomerPhone") && byId("bookingCustomerPhone").value, ""),
      couponCode: normalizeString(byId("bookingCouponCode") && byId("bookingCouponCode").value, ""),
      pickupLocation: normalizeString(byId("bookingNotes") && byId("bookingNotes").value, ""),
    };
  }

  function setVehicleSelectionLock(isLocked, vehicleLabel) {
    var select = byId("bookingVehicleSelect");
    var lockedDisplay = byId("bookingVehicleLockedDisplay");
    var lockedHint = byId("bookingVehicleLockedHint");

    if (!select || !lockedDisplay) {
      return;
    }

    if (isLocked) {
      select.classList.add("hidden");
      select.setAttribute("aria-hidden", "true");
      select.disabled = true;

      lockedDisplay.value = normalizeString(vehicleLabel, "Selected vehicle");
      lockedDisplay.classList.remove("hidden");
      if (lockedHint) {
        lockedHint.classList.remove("hidden");
      }
      return;
    }

    select.classList.remove("hidden");
    select.removeAttribute("aria-hidden");
    select.disabled = false;

    lockedDisplay.classList.add("hidden");
    lockedDisplay.value = "";
    if (lockedHint) {
      lockedHint.classList.add("hidden");
    }
  }

  function syncVehicleSelectionLock(state) {
    var isLocked = Boolean(state && state.isVehicleSelectionLocked);
    var label = getVehicleDisplayName(state && state.selectedVehicle ? state.selectedVehicle : {});
    setVehicleSelectionLock(isLocked, label);
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
        return '<option value="' + id + '"' + selected + '>' + name + ' - NPR ' + dailyRate.toLocaleString() + '/day</option>';
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

  function buildAvailabilityConflictMessage(state, availability, values) {
    var fallback = "Vehicle is not available for the selected dates";
    var result = availability || {};
    var conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];

    if (!conflicts.length) {
      return fallback;
    }

    var first = conflicts[0] || {};
    var bookingCode = normalizeString(first.booking_code, "");
    var conflictEmail = normalizeString(first.customer_email, "").toLowerCase();
    var currentEmail = normalizeString(values && values.customerEmail, "").toLowerCase();
    var sameAsLastCreated = bookingCode && state && state.lastConfirmedBookingCode && bookingCode === state.lastConfirmedBookingCode;
    var sameCustomer = conflictEmail && currentEmail && conflictEmail === currentEmail;

    if (sameAsLastCreated || sameCustomer) {
      if (bookingCode) {
        return "These dates are already reserved in your confirmed booking " + bookingCode + ". Choose a different date range for a new reservation.";
      }

      return "These dates are already reserved under your account. Choose a different date range for a new reservation.";
    }

    return fallback;
  }

  function applyCouponStatus(text) {
    var label = byId("bookingCouponStatus");
    if (!label) {
      return;
    }

    if (!text || String(text).trim() === "") {
      label.textContent = "";
      label.classList.add("hidden");
      label.className = "hidden text-[12px] font-semibold";
    } else {
      label.textContent = text;
      label.classList.remove("hidden");
      
      // Add success/error styling based on content
      if (String(text).indexOf("✓") === 0 || String(text).indexOf("applied") > -1) {
        label.className = "text-[12px] font-semibold text-[#16a34a]";
      } else {
        label.className = "text-[12px] font-semibold text-[#dc2626]";
      }
    }
  }

  async function validateAndApplyPromoCode(state, code, baseAmount) {
    if (!code) {
      return { promoDiscount: 0, couponMessage: "", code: "" };
    }

    try {
      // Resolve Supabase client consistently
      var client = null;
      if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
        client = window.SupabaseRuntime.client;
      } else if (window.SupabaseClient && typeof window.SupabaseClient.init === 'function') {
        client = await window.SupabaseClient.init();
      } else if (window.supabase) {
        client = window.supabase;
      }

      if (!client || typeof client.rpc !== 'function') {
        // console.error('Supabase client not available for RPC', client);
        return { promoDiscount: 0, couponMessage: 'Service unavailable', code: '' };
      }

      var response = await client.rpc('validate_discount_code', {
        p_code: code.toUpperCase().trim(),
        p_booking_amount: baseAmount
      });

      if (response.error) {
        // console.error('Error validating promo code:', response.error);
        return { promoDiscount: 0, couponMessage: response.error.message || 'Unable to validate code', code: '' };
      }

      var rows = response.data;
      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        return { promoDiscount: 0, couponMessage: 'Promo code not found', code: '' };
      }

      var result = Array.isArray(rows) ? rows[0] : rows;

      if (!result.is_valid) {
        return {
          promoDiscount: 0,
          couponMessage: result.error_message || 'This code is not valid for your booking',
          code: ''
        };
      }

      var discountAmount = Number(result.discount_amount || 0);
      var discountType = result.discount_type || '';
      var discountValue = result.discount_value || 0;

      var message = discountType === 'percentage'
        ? '✓ Promo applied: ' + discountValue + '% discount'
        : '✓ Promo applied: NPR ' + discountAmount.toFixed(2) + ' discount';

      return {
        promoDiscount: discountAmount,
        couponMessage: message,
        code: code.toUpperCase().trim()
      };
    } catch (error) {
      // console.error('Error validating promo code:', error);
      return { promoDiscount: 0, couponMessage: 'Error validating code', code: '' };
    }
  }

  async function syncQuoteFromState(state) {
    var vehicle = state.selectedVehicle;
    var values = readFormValues();

    if (!vehicle || !window.VehicleBookingService || typeof window.VehicleBookingService.calculateBookingQuote !== "function") {
      renderQuote({ bookingDays: 0, baseAmount: 0, serviceFee: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 });
      return;
    }

    // First calculate quote without promo to get base amount
    var baseQuote = window.VehicleBookingService.calculateBookingQuote({
      dailyRate: parseDailyRate(vehicle),
      startDate: values.startDate,
      endDate: values.endDate,
    });

    var promoInfo = { promoDiscount: 0, couponMessage: "", code: "" };
    
    // Then validate promo code if provided
    if (values.couponCode) {
      promoInfo = await validateAndApplyPromoCode(state, values.couponCode, baseQuote.baseAmount);
    }

    // Calculate final quote with promo discount
    var quote = window.VehicleBookingService.calculateBookingQuote({
      dailyRate: parseDailyRate(vehicle),
      startDate: values.startDate,
      endDate: values.endDate,
      couponCode: values.couponCode,
      promoDiscount: state.appliedPromoDiscount || 0,
    });

    state.latestQuote = quote;
    state.appliedPromoCode = promoInfo.code;
    state.appliedPromoDiscount = promoInfo.promoDiscount;
    renderQuote(quote);

    if (values.couponCode && state.appliedPromoCode !== values.couponCode) {
      applyCouponStatus("Click Apply to validate this code.");
    } else if (state.appliedPromoCode === values.couponCode) {
      applyCouponStatus("Promo code applied: " + (state.appliedPromoDiscount || 0).toFixed(2) + " NPR discount");
    } else {
      applyCouponStatus("Enter a promo code, then click Apply.");
    }
  }

  async function validateAndApplyPromoCode(state) {
    var couponInput = byId("bookingCouponCode");
    var code = normalizeString(couponInput ? couponInput.value : "", "");

    if (!code) {
      applyCouponStatus("Enter a promo code first.");
      return;
    }

    var vehicle = state.selectedVehicle;
    var values = readFormValues();

    if (!vehicle) {
      applyCouponStatus("Please select a vehicle first.");
      return;
    }

    if (!values.startDate || !values.endDate) {
      applyCouponStatus("Please select travel dates first.");
      return;
    }

    if (!window.VehicleBookingService || typeof window.VehicleBookingService.calculateBookingQuote !== "function") {
      applyCouponStatus("Booking service unavailable.");
      return;
    }

    // Calculate base quote without promo to get the booking amount
    var baseQuote = window.VehicleBookingService.calculateBookingQuote({
      dailyRate: parseDailyRate(vehicle),
      startDate: values.startDate,
      endDate: values.endDate,
      couponCode: null,
      promoDiscount: 0,
    });

    // Validate promo code using Supabase RPC
    try {
      if (!window.supabase) {
        applyCouponStatus("This code is not valid for your booking");
        return;
      }

      var { data, error } = await window.supabase.rpc('validate_discount_code', {
        p_code: code.toUpperCase().trim(),
        p_booking_amount: baseQuote.totalAmount
      });

      if (error) {
        // console.error('Promo validation error:', error);
        applyCouponStatus("This code is not valid for your booking");
        state.appliedPromoCode = null;
        state.appliedPromoDiscount = 0;
        syncQuoteFromState(state);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        var result = data[0];
        if (result.valid) {
          state.appliedPromoCode = code;
          state.appliedPromoDiscount = parseFloat(result.discount_amount) || 0;
          applyCouponStatus("Promo code applied: NPR " + state.appliedPromoDiscount.toFixed(2) + " discount");
          syncQuoteFromState(state);
        } else {
          applyCouponStatus(result.error_message || "This code is not valid for your booking");
          state.appliedPromoCode = null;
          state.appliedPromoDiscount = 0;
          syncQuoteFromState(state);
        }
      } else {
        applyCouponStatus("This code is not valid for your booking");
        state.appliedPromoCode = null;
        state.appliedPromoDiscount = 0;
        syncQuoteFromState(state);
      }
    } catch (error) {
      // console.error('Promo code validation exception:', error);
      applyCouponStatus("This code is not valid for your booking");
      state.appliedPromoCode = null;
      state.appliedPromoDiscount = 0;
      syncQuoteFromState(state);
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
    state.appliedPromoCode = null;
    state.appliedPromoDiscount = 0;
    renderVehicleSummary(nextVehicle);
    syncQuoteFromState(state);
    syncVehicleSelectionLock(state);
  }

  function wireBaseInteractions(state) {
    var vehicleSelect = byId("bookingVehicleSelect");
    var startDate = byId("bookingStartDate");
    var endDate = byId("bookingEndDate");
    var couponCode = byId("bookingCouponCode");
    var applyCoupon = byId("bookingApplyCoupon");
    var customerName = byId("bookingCustomerName");
    var customerEmail = byId("bookingCustomerEmail");
    var customerPhone = byId("bookingCustomerPhone");

    if (vehicleSelect && !state.isVehicleSelectionLocked) {
      vehicleSelect.addEventListener("change", function () {
        clearCustomFieldError(vehicleSelect);
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
        clearCustomFieldError(input);
        setBannerMessage("bookingFormError", "", "error");
        updateAvailabilityPill("default", "Choose dates to check availability");
        // Ensure dates are valid before syncing quote
        ensureValidDates();
        syncQuoteFromState(state);
        scheduleAvailabilityCheck(state);
      });
    });

    [customerName, customerEmail, customerPhone].forEach(function (input) {
      if (!input) {
        return;
      }

      input.addEventListener("input", function () {
        clearCustomFieldError(input);
      });
    });

    if (couponCode) {
      couponCode.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        validateAndApplyPromoCode(state);
      });

      couponCode.addEventListener("change", function () {
        if (!this.value.trim()) {
          applyCouponStatus("");
          syncQuoteFromState(state);
        }
      });
    }

    if (applyCoupon) {
      applyCoupon.addEventListener("click", function () {
        validateAndApplyPromoCode(state);
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

  function getDriverOptionLabel(value) {
    var normalized = normalizeString(value, "self_drive").toLowerCase();
    if (normalized === "with_driver") {
      return "With Driver";
    }

    return "Self Drive";
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
        updateAvailabilityPill("error", buildAvailabilityConflictMessage(state, result, values));
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

  function clearCustomFieldError(input) {
    if (!input || typeof input.setCustomValidity !== "function") {
      return;
    }

    input.setCustomValidity("");
  }

  function focusField(input) {
    if (!input) {
      return;
    }

    if (typeof input.scrollIntoView === "function") {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (typeof input.focus !== "function") {
      return;
    }

    try {
      input.focus({ preventScroll: true });
    } catch (_error) {
      input.focus();
    }
  }

  function validateRequiredFields() {
    var requiredIds = [
      "bookingCustomerName",
      "bookingCustomerEmail",
      "bookingCustomerPhone",
      "bookingStartDate",
      "bookingEndDate",
    ];

    for (var i = 0; i < requiredIds.length; i += 1) {
      var input = byId(requiredIds[i]);
      if (!input || input.disabled || typeof input.checkValidity !== "function") {
        continue;
      }

      clearCustomFieldError(input);
      if (!input.checkValidity()) {
        focusField(input);
        if (typeof input.reportValidity === "function") {
          input.reportValidity();
        }
        return false;
      }
    }

    return true;
  }

  function focusFirstFieldError(errors) {
    if (!errors || typeof errors !== "object") {
      return false;
    }

    var fieldMap = {
      vehicleId: "bookingVehicleSelect",
      customerName: "bookingCustomerName",
      customerEmail: "bookingCustomerEmail",
      customerPhone: "bookingCustomerPhone",
      startDate: "bookingStartDate",
      endDate: "bookingEndDate",
    };
    var priority = ["vehicleId", "customerName", "customerEmail", "customerPhone", "startDate", "endDate"];

    for (var i = 0; i < priority.length; i += 1) {
      var key = priority[i];
      if (!Object.prototype.hasOwnProperty.call(errors, key)) {
        continue;
      }

      var input = byId(fieldMap[key]);
      if (!input) {
        continue;
      }

      var message = normalizeString(errors[key], "Please review this field.");
      if (typeof input.setCustomValidity === "function") {
        input.setCustomValidity(message);
      }

      focusField(input);
      if (typeof input.reportValidity === "function") {
        input.reportValidity();
      }
      clearCustomFieldError(input);
      return true;
    }

    return false;
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
    var bookingDays = Math.max(0, Math.round(Number(quote.bookingDays || 0)));
    var safeVehicleName = escapeHtml(vehicleName);
    var safeStartDate = escapeHtml(formatDatePretty(values.startDate));
    var safeEndDate = escapeHtml(formatDatePretty(values.endDate));
    var safePickupTime = escapeHtml(normalizeString(values.pickupTime, "10:00"));
    var safeDriverOption = escapeHtml(getDriverOptionLabel(values.driverOption));
    var safePickupLocation = escapeHtml(normalizeString(values.pickupLocation, "-"));
    var safeCustomerName = escapeHtml(normalizeString(values.customerName, "-"));
    var safeCustomerPhone = escapeHtml(normalizeString(values.customerPhone, "-"));
    var safeCustomerEmail = escapeHtml(normalizeString(values.customerEmail, "-"));
    var safeDurationText = escapeHtml(String(bookingDays) + " day" + (bookingDays === 1 ? "" : "s"));
    var safeBaseAmount = escapeHtml(formatMoney(quote.baseAmount));
    var safeServiceFee = escapeHtml(formatMoney(quote.serviceFee));
    var safeTaxAmount = escapeHtml(formatMoney(quote.taxAmount));
    var safeDiscountAmount = escapeHtml(formatMoney(quote.discountAmount));
    var safeTotalAmount = escapeHtml(formatMoney(quote.totalAmount));
    var hasDiscount = Number(quote.discountAmount) > 0;
    var promoCodeHtml = values.couponCode ? '<div class="booking-review-row flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700"><span class="font-semibold">Promo Code</span><span class="font-bold">' + escapeHtml(values.couponCode) + '</span></div>' : '';

    return [
      '<div class="grid gap-2">',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Vehicle</span><span class="font-semibold">' + safeVehicleName + '</span></div>',
      '<div class="grid gap-2 sm:grid-cols-2">',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Start Date</span><span>' + safeStartDate + '</span></div>',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">End Date</span><span>' + safeEndDate + '</span></div>',
      '</div>',
      '<div class="grid gap-2 sm:grid-cols-2">',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Pickup Time</span><span>' + safePickupTime + '</span></div>',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Driver Option</span><span>' + safeDriverOption + '</span></div>',
      '</div>',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Pick Up Location</span><span>' + safePickupLocation + '</span></div>',
      '<div class="grid gap-2 sm:grid-cols-2">',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Customer</span><span>' + safeCustomerName + '</span></div>',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Phone</span><span>' + safeCustomerPhone + '</span></div>',
      '</div>',
      '<div class="booking-review-row flex items-center justify-between rounded-xl border px-3 py-2"><span class="font-semibold">Email</span><span>' + safeCustomerEmail + '</span></div>',
      promoCodeHtml,
      '<div class="booking-review-total mt-2 rounded-xl border px-3 py-3">',
      '<div class="space-y-1 text-[12px] text-slate-600">',
      '<div class="flex items-center justify-between"><span>Duration</span><span class="font-semibold">' + safeDurationText + '</span></div>',
      '<div class="flex items-center justify-between"><span>Base</span><span class="font-semibold">' + safeBaseAmount + '</span></div>',
      '<div class="flex items-center justify-between"><span>Service Fee</span><span class="font-semibold">' + safeServiceFee + '</span></div>',
      '<div class="flex items-center justify-between"><span>Tax</span><span class="font-semibold">' + safeTaxAmount + '</span></div>',
      (hasDiscount ? '<div class="flex items-center justify-between text-green-600"><span>Discount</span><span class="font-semibold">-' + safeDiscountAmount + '</span></div>' : ''),
      '</div>',
      '<div class="mt-3 border-t border-slate-200 pt-2 flex items-center justify-between"><span class="font-semibold">Total</span><span class="text-lg font-bold">' + safeTotalAmount + '</span></div>',
      '</div>',
      '</div>'
    ].join('');
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) {
      return;
    }

    button.disabled = Boolean(isLoading);
    button.classList.toggle("opacity-70", Boolean(isLoading));
    button.classList.toggle("cursor-not-allowed", Boolean(isLoading));
    if (isLoading) {
      button.textContent = normalizeString(loadingText, "Processing...");
      return;
    }

    button.textContent = normalizeString(defaultText, "Submit Booking");
  }

  function showSuccessModal(payload) {
    var message = byId("bookingSuccessMessage");
    var detailsLink = byId("bookingSuccessDetailsLink");
    var reservationCode = byId("bookingSuccessReservationCode");
    var vehicleName = byId("bookingSuccessVehicleName");
    var dateRange = byId("bookingSuccessDateRange");
    var totalAmount = byId("bookingSuccessTotalAmount");
    var summary = payload || {};
    var readableStart = formatDatePretty(summary.startDate);
    var readableEnd = formatDatePretty(summary.endDate);
    var reservationId = normalizeString(summary.bookingCode, "-");
    var summaryVehicle = normalizeString(summary.vehicleName, "Vehicle");
    var summaryTotal = Number(summary.totalAmount || 0);
    var travelerName = normalizeString(summary.customerName, "");

    if (message) {
      message.textContent = "Reservation " + reservationId + " was submitted for " + readableStart + " to " + readableEnd + " and is currently pending admin confirmation. " + (travelerName ? ("Thank you, " + travelerName + ".") : "");
    }

    if (detailsLink && summary.vehicleId) {
      detailsLink.href = "vehicle-details.html?id=" + encodeURIComponent(summary.vehicleId);
    }

    if (reservationCode) {
      reservationCode.textContent = reservationId;
    }

    if (vehicleName) {
      vehicleName.textContent = summaryVehicle;
    }

    if (dateRange) {
      dateRange.textContent = readableStart + " to " + readableEnd;
    }

    if (totalAmount) {
      totalAmount.textContent = formatMoney(summaryTotal);
    }

    setModalState("bookingSuccessModal", "bookingSuccessCard", true);
  }

  function hideSuccessModal() {
    setModalState("bookingSuccessModal", "bookingSuccessCard", false);
  }

  function resetBookingFormForNext(state) {
    var coupon = byId("bookingCouponCode");
    var notes = byId("bookingNotes");
    var driverOption = byId("bookingDriverOption");

    if (state.availabilityTimerId) {
      window.clearTimeout(state.availabilityTimerId);
      state.availabilityTimerId = null;
    }

    if (coupon) {
      coupon.value = "";
    }
    if (notes) {
      notes.value = "";
    }
    if (driverOption) {
      driverOption.value = "self_drive";
    }

    state.pendingBookingValues = null;
    state.lastAvailability = {
      available: true,
      conflicts: [],
      reason: "Latest reservation confirmed",
    };
    syncQuoteFromState(state);
  }

  function wireSuccessModal() {
    var successModal = byId("bookingSuccessModal");
    if (!successModal) {
      return;
    }

    successModal.addEventListener("click", function (event) {
      if (event.target === successModal) {
        hideSuccessModal();
      }
    });
  }

  function wireReviewFlow(state) {
    var reviewBtn = byId("bookingReviewBtn");
    var confirmSummary = byId("bookingConfirmSummary");
    var confirmCancel = byId("bookingConfirmCancel");
    var confirmModal = byId("bookingConfirmModal");
    var confirmSubmit = byId("bookingConfirmSubmit");

    if (confirmCancel) {
      confirmCancel.addEventListener("click", function () {
        setBannerMessage("bookingConfirmError", "", "error");
        setModalState("bookingConfirmModal", "bookingConfirmCard", false);
      });
    }

    if (confirmSubmit) {
      var submitDefaultLabel = normalizeString(confirmSubmit.textContent, "Submit Booking");
      confirmSubmit.addEventListener("click", async function () {
        setBannerMessage("bookingConfirmError", "", "error");

        if (!ensureRegisteredBookingAccess()) {
          setBannerMessage("bookingConfirmError", "Please register or sign in before submitting a booking.", "error");
          return;
        }

        if (!await ensureBookingVerificationAccess(state, "bookingConfirmError")) {
          return;
        }

        if (!state.pendingBookingValues || !state.selectedVehicle) {
          setBannerMessage("bookingConfirmError", "Booking context is missing. Please review the form again.", "error");
          return;
        }

        if (!window.VehicleBookingService || typeof window.VehicleBookingService.createBooking !== "function") {
          setBannerMessage("bookingConfirmError", "Booking service is unavailable right now.", "error");
          return;
        }

        var values = state.pendingBookingValues;
        state.verificationStatus = await readVerificationStatus();
        var bookingStatus = "pending";
        var payload = {
          vehicleId: state.selectedVehicle.id,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          startDate: values.startDate,
          endDate: values.endDate,
          pickupTime: values.pickupTime,
          driverOption: values.driverOption,
          couponCode: values.couponCode,
          notes: values.pickupLocation,
          dailyRate: parseDailyRate(state.selectedVehicle),
          status: bookingStatus,
        };

        setButtonLoading(confirmSubmit, true, "Saving Booking...", submitDefaultLabel);

        try {
          var savedBooking = await window.VehicleBookingService.createBooking(payload);
          state.lastConfirmedBookingCode = normalizeString(savedBooking && savedBooking.bookingCode, "");
          setModalState("bookingConfirmModal", "bookingConfirmCard", false);

          var savedBookingId = savedBooking && savedBooking.id ? String(savedBooking.id) : "";
          var savedTotal = savedBooking && savedBooking.quote
            ? Number(savedBooking.quote.totalAmount || 0)
            : Number(state.latestQuote && state.latestQuote.totalAmount || 0);

          // If we have a real booking id and a non-zero total, send the user
          // straight to the payment page so they can complete the 60% / 100%
          // eSewa flow within the 15-minute window. The payment-return.html
          // page will surface the same confirmation modal data on success.
          if (savedBookingId && savedTotal > 0) {
            try {
              if (window.sessionStorage) {
                window.sessionStorage.setItem(
                  "vrs.recentBooking",
                  JSON.stringify({
                    bookingId: savedBookingId,
                    bookingCode: savedBooking && savedBooking.bookingCode,
                    vehicleName: getVehicleDisplayName(state.selectedVehicle || {}),
                    totalAmount: savedTotal,
                    startDate: savedBooking && savedBooking.startDate,
                    endDate: savedBooking && savedBooking.endDate,
                    customerName: values.customerName,
                    paymentDeadline: savedBooking && savedBooking.paymentDeadline,
                  })
                );
              }
            } catch (_storageError) {
              // ignore storage failures; payment page still works.
            }

            resetBookingFormForNext(state);
            setBannerMessage("bookingFormError", "", "error");
            updateAvailabilityPill("ok", "Booking saved. Redirecting to payment...");

            window.location.assign("payment.html?booking=" + encodeURIComponent(savedBookingId));
            return;
          }

          // Fallback: zero-total bookings or missing id keep the legacy
          // success modal so the user still sees a confirmation.
          showSuccessModal({
            bookingCode: savedBooking && savedBooking.bookingCode,
            startDate: savedBooking && savedBooking.startDate,
            endDate: savedBooking && savedBooking.endDate,
            vehicleId: savedBooking && savedBooking.vehicleId,
            vehicleName: getVehicleDisplayName(state.selectedVehicle || {}),
            totalAmount: savedTotal,
            customerName: values.customerName,
          });

          resetBookingFormForNext(state);
          setBannerMessage("bookingFormError", "", "error");
          updateAvailabilityPill("ok", "Booking saved successfully");
        } catch (error) {
          if (error && error.code === "VALIDATION_ERROR") {
            setBannerMessage("bookingConfirmError", firstErrorMessage(error.fields), "error");
          } else if (error && error.code === "BOOKING_CONFLICT") {
            setBannerMessage("bookingConfirmError", "These dates became unavailable. Choose a different date range.", "error");
            updateAvailabilityPill("error", "Date range is no longer available");
          } else {
            var message = window.VehicleBookingService && typeof window.VehicleBookingService.toPublicError === "function"
              ? window.VehicleBookingService.toPublicError(error, "Unable to save booking right now.")
              : "Unable to save booking right now.";
            setBannerMessage("bookingConfirmError", message, "error");
          }
        } finally {
          setButtonLoading(confirmSubmit, false, "Saving Booking...", submitDefaultLabel);
        }
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

      if (!ensureRegisteredBookingAccess()) {
        setBannerMessage("bookingFormError", "Please register or sign in before booking a vehicle.", "error");
        return;
      }

      if (!await ensureBookingVerificationAccess(state, "bookingFormError")) {
        return;
      }

      if (!state.selectedVehicle) {
        setBannerMessage("bookingFormError", "Select a vehicle before continuing.", "error");
        return;
      }

      if (!window.VehicleBookingService || typeof window.VehicleBookingService.validateBookingInput !== "function") {
        setBannerMessage("bookingFormError", "Booking service is unavailable right now.", "error");
        return;
      }

      if (!validateRequiredFields()) {
        setBannerMessage("bookingFormError", "Please complete all required fields.", "error");
        return;
      }

      var values = readFormValues();
      state.verificationStatus = await readVerificationStatus();
      var bookingStatus = "pending";
      var validation = window.VehicleBookingService.validateBookingInput({
        vehicleId: state.selectedVehicle.id,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        startDate: values.startDate,
        endDate: values.endDate,
        pickupTime: values.pickupTime,
        driverOption: values.driverOption,
        couponCode: values.couponCode,
        notes: values.pickupLocation,
        dailyRate: parseDailyRate(state.selectedVehicle),
        status: bookingStatus,
      });

      if (!validation.valid) {
        focusFirstFieldError(validation.errors);
        setBannerMessage("bookingFormError", firstErrorMessage(validation.errors), "error");
        return;
      }

      var availability = await checkAvailability(state);
      if (!availability || !availability.available) {
        setBannerMessage("bookingFormError", buildAvailabilityConflictMessage(state, availability, values), "error");
        return;
      }

      state.pendingBookingValues = values;
      if (confirmSummary) {
        confirmSummary.innerHTML = buildConfirmSummaryHtml(state, values);
      }

      setBannerMessage("bookingFormError", "Booking will be created as Pending. It becomes Confirmed only after admin approval.", "error");

      setModalState("bookingConfirmModal", "bookingConfirmCard", true);
    });
  }

  function applyQueryPrefill() {
    var handoff = consumeBookingHandoffContext();
    var queryVehicle = getQueryParam("vehicle");
    var queryStart = getQueryParam("start");
    var queryEnd = getQueryParam("end");
    var queryPickup = getQueryParam("pickupTime");
    var queryCoupon = getQueryParam("coupon");
    var queryDuration = Number(getQueryParam("duration"));
    var queryPickupLocation = getQueryParam("pickupLocation");

    var handoffVehicleId = normalizeString(handoff && handoff.vehicleId, "");
    var vehicleId = queryVehicle || handoffVehicleId;
      var lockVehicleSelection = Boolean(queryVehicle || handoffVehicleId);

    var start = queryStart || normalizeString(handoff && handoff.startDate, "");
    var end = queryEnd || normalizeString(handoff && handoff.endDate, "");
    var pickup = queryPickup || normalizeString(handoff && handoff.pickupTime, "");
    var coupon = queryCoupon || normalizeString(handoff && handoff.couponCode, "");
    var pickupLocation = queryPickupLocation || normalizeString(handoff && handoff.pickupLocation, "");
    var duration = Number.isFinite(queryDuration) && queryDuration > 0
      ? Math.floor(queryDuration)
      : Math.floor(Number(handoff && handoff.durationDays ? handoff.durationDays : 0));

    if (!end && start && duration > 0) {
      end = addDaysToIsoDate(start, Math.max(0, duration - 1));
    }

    var startInput = byId("bookingStartDate");
    var endInput = byId("bookingEndDate");
    var pickupInput = byId("bookingPickupTime");
    var couponInput = byId("bookingCouponCode");
    var notesInput = byId("bookingNotes");

    if (startInput && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      startInput.value = start;
    }
    if (endInput && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      endInput.value = end;
    }
    if (pickupInput && /^\d{2}:\d{2}$/.test(pickup)) {
      pickupInput.value = pickup;
    }
    if (couponInput && coupon) {
      couponInput.value = coupon;
    }

    if (notesInput && pickupLocation) {
      notesInput.value = pickupLocation;
    }

    return {
      vehicleId: vehicleId,
      lockVehicleSelection: lockVehicleSelection,
    };
  }

  async function prefillCustomerIdentity() {
    var nameInput = byId('bookingCustomerName');
    var emailInput = byId('bookingCustomerEmail');

    if (!nameInput && !emailInput) {
      return;
    }

    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') {
      return;
    }

    try {
      var client = window.SupabaseRuntime && window.SupabaseRuntime.client
        ? window.SupabaseRuntime.client
        : await window.SupabaseClient.init();

      if (!client || !client.auth || typeof client.auth.getSession !== 'function') {
        return;
      }

      var sessionResult = await client.auth.getSession();
      var user = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user
        ? sessionResult.data.session.user
        : null;

      if (!user) {
        return;
      }

      if (emailInput && !String(emailInput.value || '').trim()) {
        emailInput.value = String(user.email || '').trim();
      }

      if (emailInput && String(user.email || '').trim()) {
        emailInput.readOnly = true;
        emailInput.classList.add('bg-[#f3f8f6]', 'text-[#35595c]', 'cursor-not-allowed');
      }

      if (nameInput && !String(nameInput.value || '').trim()) {
        var metadataName = normalizeString(user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name), '');
        if (metadataName) {
          nameInput.value = metadataName;
        }
      }
    } catch (_error) {
      // Keep form editable even if session prefill fails.
    }
  }

  async function init() {
    var state = {
      vehicles: [],
      selectedVehicle: null,
      isVehicleSelectionLocked: false,
      pendingBookingValues: null,
      lastAvailability: null,
      availabilityTimerId: null,
      availabilityRequestId: 0,
      lastConfirmedBookingCode: "",
      appliedPromoCode: null,
      appliedPromoDiscount: 0,
      latestQuote: {
        bookingDays: 0,
        baseAmount: 0,
        serviceFee: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalDiscount: 0,
        totalAmount: 0,
      },
      verificationStatus: "not_submitted",
    };

    setDefaultDateInputs();
    var queryPrefill = applyQueryPrefill();
    await prefillCustomerIdentity();

    state.vehicles = await loadVehicles();

    var queryVehicle = normalizeString(queryPrefill && queryPrefill.vehicleId, "") || getQueryParam("vehicle");
    var shouldLockVehicleSelection = Boolean(queryPrefill && queryPrefill.lockVehicleSelection);

    if (queryVehicle) {
      var hasQueryVehicle = state.vehicles.some(function (vehicle) {
        return String(vehicle && vehicle.id ? vehicle.id : "") === String(queryVehicle);
      });

      if (!hasQueryVehicle) {
        queryVehicle = "";
        shouldLockVehicleSelection = false;
      }
    }

    var preferredVehicleId = queryVehicle || (state.vehicles[0] && state.vehicles[0].id ? state.vehicles[0].id : "");
    // Only lock the vehicle selection when the booking was opened with an explicit handoff/query lock.
    // Normal booking flow keeps the dropdown available for vehicle selection.
    state.isVehicleSelectionLocked = Boolean(shouldLockVehicleSelection && preferredVehicleId);

    fillVehicleSelect(state.vehicles, preferredVehicleId);
    selectVehicleById(state, preferredVehicleId);
    syncVehicleSelectionLock(state);
    // Make sure dates are valid after any prefill/defaults
    ensureValidDates();
    wireBaseInteractions(state);
    wireReviewFlow(state);
    wireSuccessModal();
    scheduleAvailabilityCheck(state);

    if (!hasRegisteredUserSession()) {
      setBannerMessage("bookingFormError", "Please register or sign in to submit a booking.", "error");
      updateAvailabilityPill("error", "Registration required to complete booking");
    }

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
