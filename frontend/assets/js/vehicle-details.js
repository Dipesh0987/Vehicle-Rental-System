(function () {
  "use strict";

  var DEFAULT_FALLBACK_IMAGE = "assets/images/car-transparent.png";

  function getCatalogService() {
    return window.VehicleCatalogService || null;
  }

  function getVehicleIdFromQuery() {
    var params = new URLSearchParams(window.location.search);
    return String(params.get("id") || "").trim();
  }

  function formatDetailCurrency(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "$0.00";
    }
    return "$" + numeric.toFixed(2);
  }

  function formatFeatureLabel(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    var normalized = raw.toLowerCase();
    if (normalized === "ac") return "Air Conditioning";
    if (normalized === "gps") return "GPS Navigation";
    if (normalized === "bluetooth") return "Bluetooth";
    if (normalized === "reverse-camera") return "Reverse Camera";
    if (normalized === "child-seat") return "Child Seat Support";

    return raw
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function normalizeFeatureHighlights(rawFeatures) {
    var source = Array.isArray(rawFeatures) ? rawFeatures : [];
    var seen = Object.create(null);
    var normalized = [];

    source.forEach(function (item) {
      var label = formatFeatureLabel(item);
      if (!label) {
        return;
      }

      var key = label.toLowerCase();
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      normalized.push(label);
    });

    return normalized;
  }

  function normalizeGallery(vehicle) {
    var gallery = Array.isArray(vehicle && vehicle.imageUrls) ? vehicle.imageUrls.filter(Boolean) : [];
    var heroImage = String(vehicle && vehicle.primaryImageUrl ? vehicle.primaryImageUrl : (gallery[0] || DEFAULT_FALLBACK_IMAGE));

    if (!gallery.length) {
      gallery = [heroImage];
    }

    return {
      heroImage: heroImage,
      gallery: gallery,
    };
  }

  function normalizeVehicleIdentityForDetail(brandValue, nameValue, typeValue) {
    var brand = String(brandValue || "").trim();
    var name = String(nameValue || "").trim();
    var type = String(typeValue || "Vehicle").trim() || "Vehicle";
    var brandLower = brand.toLowerCase();
    var nameLower = name.toLowerCase();

    if (!name) {
      name = "Vehicle";
    }

    if (brand && brandLower !== "general") {
      if (nameLower === brandLower || nameLower.indexOf(brandLower + " ") === 0) {
        return {
          brand: brand,
          name: name,
        };
      }

      return {
        brand: brand,
        name: name,
      };
    }

    return {
      brand: type,
      name: name,
    };
  }

  function mapCatalogVehicleToDetail(vehicle, similarVehicles) {
    var pricePerDay = Number(vehicle && vehicle.pricePerDay ? vehicle.pricePerDay : 0);
    var seats = Number(vehicle && vehicle.seats ? vehicle.seats : 5);
    var fuelType = String(vehicle && vehicle.fuelType ? vehicle.fuelType : "Petrol");
    var type = String(vehicle && vehicle.type ? vehicle.type : "Vehicle");
    var rating = Number(vehicle && vehicle.rating ? vehicle.rating : 4.6);
    var images = normalizeGallery(vehicle || {});

    var identity = normalizeVehicleIdentityForDetail(
      vehicle && vehicle.brand,
      vehicle && vehicle.name,
      type
    );

    var featureHighlights = normalizeFeatureHighlights(vehicle && vehicle.features);

    return {
      id: String(vehicle && vehicle.id ? vehicle.id : ""),
      brand: identity.brand,
      name: identity.name,
      meta: type + " | Automatic | " + seats + " Seats | " + fuelType,
      tagline: "Book this " + type.toLowerCase() + " instantly with transparent pricing and verified images.",
      heroImage: images.heroImage,
      gallery: images.gallery,
      featureHighlights: featureHighlights,
      badges: [type, fuelType, seats + " Seats"],
      quickSpecs: {
        "Fuel Type": fuelType,
        Transmission: "Automatic",
        Mileage: "As per vehicle profile",
        Seats: String(seats),
        Luggage: "Standard",
        Year: "Latest fleet"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Transparent digital booking summary"
      ],
      pricing: {
        dailyRate: formatDetailCurrency(pricePerDay) + " / day",
        securityDeposit: "$500 refundable",
        extraKm: "$0.50 / km",
        estimatedTotal: formatDetailCurrency(pricePerDay * 3) + " for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 1 year old)",
        "Government photo ID or passport",
        "Minimum age: 23 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 24 hours before pickup",
        "Late return fee applies after 30 minute grace period",
        "No smoking policy inside vehicle",
        "Fuel level must match pickup level on return"
      ],
      reviews: [
        { name: "Fleet Customer", rating: 4.8, text: "Vehicle condition matched photos and pickup was smooth." },
        { name: "Business Traveler", rating: 4.7, text: "Reliable booking experience with clear pricing." }
      ],
      similar: Array.isArray(similarVehicles) ? similarVehicles : []
    };
  }

  function buildNotFoundDetail(requestedId) {
    var label = requestedId ? requestedId : "selected vehicle";
    return {
      id: "",
      brand: "Vehicle",
      name: "Vehicle Not Found",
      meta: "No matching vehicle",
      tagline: "We could not find " + label + ". Browse the latest available fleet instead.",
      heroImage: DEFAULT_FALLBACK_IMAGE,
      gallery: [DEFAULT_FALLBACK_IMAGE],
      featureHighlights: [],
      badges: ["Catalog", "Live Fleet"],
      quickSpecs: {
        Status: "Unavailable",
        Action: "Browse Fleet",
      },
      included: [
        "Visit the Vehicles page to view all available options."
      ],
      pricing: {
        dailyRate: "$0.00 / day",
        securityDeposit: "$0.00",
        extraKm: "$0.00 / km",
        estimatedTotal: "$0.00"
      },
      requirements: ["Select another vehicle from the catalog."],
      policies: ["Live availability is shown on the Vehicles page."],
      reviews: [],
      similar: [
        { id: "", name: "Browse All Vehicles", type: "Catalog", priceLabel: "Check availability" }
      ]
    };
  }

  async function getVehicleFromQuery() {
    var requestedId = getVehicleIdFromQuery();
    var catalog = getCatalogService();

    if (!catalog || typeof catalog.listVehicles !== "function") {
      return buildNotFoundDetail(requestedId);
    }

    try {
      var catalogList = await catalog.listVehicles({ includeInactive: false });
      var rows = Array.isArray(catalogList) ? catalogList : [];

      if (!rows.length) {
        return buildNotFoundDetail(requestedId);
      }

      var selected = null;

      if (requestedId && typeof catalog.getVehicleById === "function") {
        selected = await catalog.getVehicleById(requestedId, { includeInactive: false });
      }

      if (!selected && requestedId) {
        selected = rows.find(function (entry) {
          return String(entry && entry.id ? entry.id : "") === requestedId;
        }) || null;
      }

      if (!selected && !requestedId) {
        selected = rows[0];
      }

      if (!selected) {
        return buildNotFoundDetail(requestedId);
      }

      var similar = rows
        .filter(function (entry) {
          return String(entry && entry.id ? entry.id : "") !== String(selected.id || "");
        })
        .slice(0, 3)
        .map(function (entry) {
          var entryType = String(entry && entry.type ? entry.type : "Vehicle");
          var entryPrice = Number(entry && entry.pricePerDay ? entry.pricePerDay : 0);
          return {
            id: String(entry && entry.id ? entry.id : ""),
            name: String(entry && entry.name ? entry.name : "Vehicle"),
            type: entryType,
            priceLabel: formatDetailCurrency(entryPrice) + " / day",
          };
        });

      return mapCatalogVehicleToDetail(selected, similar);
    } catch (error) {
      console.warn("Catalog-backed vehicle details unavailable:", error);
      return buildNotFoundDetail(requestedId);
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function renderIdentity(vehicle) {
    var hero = document.getElementById("vehicleDetailHero");

    setText("vehicleDetailMeta", vehicle.meta);
    setText("vehicleBrand", vehicle.brand);
    setText("vehicleName", vehicle.name);
    setText("vehicleTagline", vehicle.tagline);

    if (hero) {
      hero.src = vehicle.heroImage;
      hero.alt = vehicle.name;
    }
  }

  function renderGallery(vehicle) {
    var hero = document.getElementById("vehicleDetailHero");
    var rail = document.getElementById("vehicleThumbnailRail");
    var prevBtn = document.getElementById("vehicleHeroPrev");
    var nextBtn = document.getElementById("vehicleHeroNext");
    var counter = document.getElementById("vehicleHeroCounter");

    if (!hero || !rail) {
      return;
    }

    var images = Array.isArray(vehicle.gallery) ? vehicle.gallery.filter(Boolean) : [];
    if (!images.length) {
      images = [vehicle.heroImage || DEFAULT_FALLBACK_IMAGE];
    }

    var activeIndex = 0;

    function updateHero(nextIndex) {
      activeIndex = ((nextIndex % images.length) + images.length) % images.length;

      hero.classList.add("opacity-70");
      window.setTimeout(function () {
        hero.src = images[activeIndex] || images[0];
        hero.alt = vehicle.name + " view " + (activeIndex + 1);
        hero.classList.remove("opacity-70");
      }, 110);

      if (counter) {
        counter.textContent = (activeIndex + 1) + " / " + images.length;
      }

      rail.querySelectorAll(".vehicle-thumb").forEach(function (node, idx) {
        var isActive = idx === activeIndex;
        node.classList.toggle("border-[#2c766e]", isActive);
        node.classList.toggle("bg-[#edf6f3]", isActive);
        node.classList.toggle("border-[#d3dfda]", !isActive);
        node.classList.toggle("bg-white", !isActive);
      });
    }

    rail.innerHTML = images.map(function (src, index) {
      var active = index === 0
        ? "border-[#2c766e] bg-[#edf6f3]"
        : "border-[#d3dfda] bg-white";

      return '<button type="button" data-thumb-index="' + index + '" style="min-width:136px;" class="vehicle-thumb rounded-xl border p-1 transition hover:-translate-y-[1px] ' + active + '">' +
        '<img src="' + src + '" alt="' + vehicle.name + ' view ' + (index + 1) + '" class="h-[84px] w-full rounded-lg object-cover" />' +
        '</button>';
    }).join("");

    rail.querySelectorAll(".vehicle-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        var idx = Number(thumb.getAttribute("data-thumb-index") || "0");
        updateHero(idx);
      });
    });

    var showControls = images.length > 1;

    if (prevBtn) {
      prevBtn.classList.toggle("hidden", !showControls);
      prevBtn.classList.add("inline-flex");
      prevBtn.onclick = function () {
        updateHero(activeIndex - 1);
      };
    }

    if (nextBtn) {
      nextBtn.classList.toggle("hidden", !showControls);
      nextBtn.classList.add("inline-flex");
      nextBtn.onclick = function () {
        updateHero(activeIndex + 1);
      };
    }

    if (counter) {
      counter.classList.toggle("hidden", !showControls);
    }

    updateHero(0);
  }

  function renderBadges(vehicle) {
    var target = document.getElementById("vehicleBadges");
    if (!target) {
      return;
    }

    target.innerHTML = (vehicle.badges || []).map(function (badge) {
      return '<span class="rounded-full border border-[#d2dfd9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#355255]">' + badge + '</span>';
    }).join("");
  }

  function renderQuickSpecs(vehicle) {
    var target = document.getElementById("vehicleQuickSpecs");
    if (!target) {
      return;
    }

    var specs = vehicle.quickSpecs || {};
    target.innerHTML = Object.keys(specs).map(function (key) {
      return '<div class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-3 py-2">' +
        '<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#597175]">' + key + '</p>' +
        '<p class="mt-1 text-[14px] font-semibold text-[#244447]">' + specs[key] + '</p>' +
        '</div>';
    }).join("");
  }

  function renderIncluded(vehicle) {
    var target = document.getElementById("vehicleIncluded");
    if (!target) {
      return;
    }

    target.innerHTML = (vehicle.included || []).map(function (item) {
      return '<div class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-medium text-[#2f4d50]">' + item + '</div>';
    }).join("");
  }

  function renderFeatures(vehicle) {
    var target = document.getElementById("vehicleFeatures");
    if (!target) {
      return;
    }

    var features = Array.isArray(vehicle.featureHighlights) ? vehicle.featureHighlights : [];
    if (!features.length) {
      target.innerHTML = '<p class="rounded-2xl border border-dashed border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-medium text-[#466367]">Feature details will be updated soon.</p>';
      return;
    }

    target.innerHTML = features.map(function (feature) {
      return '<span class="rounded-full border border-[#cfe0d9] bg-[#eef6f2] px-3 py-1.5 text-[12px] font-semibold text-[#2a5b57]">' + feature + '</span>';
    }).join("");
  }

  function renderPricing(vehicle) {
    var target = document.getElementById("vehiclePricing");
    if (!target) {
      return;
    }

    var rows = [
      ["Daily Rate", vehicle.pricing.dailyRate],
      ["Security Deposit", vehicle.pricing.securityDeposit],
      ["Extra Kilometer", vehicle.pricing.extraKm],
      ["Estimated Total", vehicle.pricing.estimatedTotal]
    ];

    target.innerHTML = rows.map(function (row, index) {
      var tone = index === rows.length - 1
        ? "border-[#f2c8ab] bg-[#fff6ef]"
        : "border-[#d8e3de] bg-[#fbfdfc]";

      return '<div class="flex items-center justify-between rounded-2xl border px-4 py-3 ' + tone + '">' +
        '<p class="text-[13px] font-medium text-[#385356]">' + row[0] + '</p>' +
        '<p class="text-[13px] font-semibold text-[#1f4043]">' + row[1] + '</p>' +
        '</div>';
    }).join("");
  }

  function renderBulletList(targetId, items) {
    var target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    target.innerHTML = (items || []).map(function (item) {
      return '<li class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-medium text-[#2f4d50]">' + item + '</li>';
    }).join("");
  }

  function renderSimilar(vehicle) {
    var target = document.getElementById("vehicleSimilar");
    if (!target) {
      return;
    }

    var items = Array.isArray(vehicle.similar) && vehicle.similar.length
      ? vehicle.similar
      : [{ id: "", name: "Browse All Vehicles", type: "Catalog", priceLabel: "Check availability" }];

    target.innerHTML = items.map(function (item) {
      var id = String(item && item.id ? item.id : "").trim();
      var name = String(item && item.name ? item.name : "Vehicle");
      var type = String(item && item.type ? item.type : "Vehicle");
      var priceLabel = String(item && item.priceLabel ? item.priceLabel : "View pricing");
      var href = id ? "vehicle-details.html?id=" + encodeURIComponent(id) : "vehicles.html";

      return '<a href="' + href + '" class="flex items-center justify-between gap-3 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 transition hover:-translate-y-[1px]">' +
        '<span class="min-w-0">' +
          '<span class="block truncate text-[13px] font-semibold text-[#29494c]">' + name + '</span>' +
          '<span class="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5a7376]">' + type + '</span>' +
        '</span>' +
        '<span class="text-[12px] font-semibold text-[#1f5b57]">' + priceLabel + '</span>' +
        '</a>';
    }).join("");
  }

  function renderReviewSnippets(vehicle) {
    var target = document.getElementById("vehicleReviewSnippets");
    if (!target) {
      return;
    }

    var reviews = Array.isArray(vehicle.reviews) ? vehicle.reviews.slice(0, 2) : [];
    if (!reviews.length) {
      target.innerHTML = '<p class="rounded-2xl border border-dashed border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-medium text-[#466367]">No public reviews yet for this listing.</p>';
      return;
    }

    target.innerHTML = reviews.map(function (review) {
      var reviewer = String(review && review.name ? review.name : "Renter");
      var text = String(review && review.text ? review.text : "Great rental experience.");
      var rating = Number(review && review.rating ? review.rating : 0);
      var ratingLabel = rating > 0 ? rating.toFixed(1) + " / 5" : "Verified";

      return '<article class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3">' +
        '<div class="flex items-center justify-between gap-2">' +
          '<p class="text-[12px] font-semibold text-[#2f4d50]">' + reviewer + '</p>' +
          '<p class="text-[11px] font-semibold text-[#1f5b57]">' + ratingLabel + '</p>' +
        '</div>' +
        '<p class="mt-2 text-[12px] leading-relaxed text-[#4d686b]">' + text + '</p>' +
        '</article>';
    }).join("");
  }

  function wireRevealAnimations() {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (node) {
        node.classList.add("animate-cardIn");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("animate-cardIn");
        currentObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.12
    });

    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function parseDailyRate(value) {
    var numeric = Number(String(value || "0").replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatCurrency(amount) {
    return "$" + amount.toFixed(2);
  }

  function wireBookingSidebar(vehicle) {
    var summary = document.getElementById("bookingSummary");
    if (!summary) {
      return;
    }

    var pickupDate = document.getElementById("bookingPickupDate");
    var pickupTime = document.getElementById("bookingPickupTime");
    var durationInput = document.getElementById("bookingDuration");
    var couponInput = document.getElementById("bookingCouponCode");
    var applyBtn = document.getElementById("bookingApplyCoupon");
    var couponStatus = document.getElementById("bookingCouponStatus");
    var proceedBtn = document.getElementById("bookingProceedBtn");

    var dailyRateEl = document.getElementById("bookingDailyRate");
    var baseEl = document.getElementById("bookingBaseAmount");
    var serviceEl = document.getElementById("bookingServiceFee");
    var taxEl = document.getElementById("bookingTaxAmount");
    var discountEl = document.getElementById("bookingDiscountAmount");
    var totalEl = document.getElementById("bookingTotalAmount");

    var state = {
      couponCode: "",
      couponType: "none"
    };

    var COUPONS = {
      SAVE10: { type: "percent", value: 0.10, label: "10% off applied" },
      WEEKEND50: { type: "flat", value: 50, label: "$50 off applied" }
    };

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

    function getDurationDays() {
      var value = Number(durationInput && durationInput.value ? durationInput.value : "1");
      if (!Number.isFinite(value) || value < 1) {
        return 1;
      }
      return Math.floor(value);
    }

    function compute() {
      var dailyRate = parseDailyRate(vehicle.pricing && vehicle.pricing.dailyRate);
      var days = getDurationDays();
      var base = dailyRate * days;
      var serviceFee = Math.max(15, base * 0.05);
      var tax = (base + serviceFee) * 0.13;
      var discount = 0;

      if (state.couponType === "percent") {
        discount = base * COUPONS[state.couponCode].value;
      } else if (state.couponType === "flat") {
        discount = COUPONS[state.couponCode].value;
      }

      var subtotal = base + serviceFee + tax;
      var total = Math.max(0, subtotal - discount);

      if (dailyRateEl) {
        dailyRateEl.textContent = vehicle.pricing.dailyRate;
      }
      if (baseEl) {
        baseEl.textContent = formatCurrency(base);
      }
      if (serviceEl) {
        serviceEl.textContent = formatCurrency(serviceFee);
      }
      if (taxEl) {
        taxEl.textContent = formatCurrency(tax);
      }
      if (discountEl) {
        discountEl.textContent = "-" + formatCurrency(discount);
      }
      if (totalEl) {
        totalEl.textContent = formatCurrency(total);
      }

      summary.setAttribute("data-booking-payload", JSON.stringify({
        vehicleId: vehicle.id,
        pickupDate: pickupDate ? pickupDate.value : "",
        pickupTime: pickupTime ? pickupTime.value : "",
        durationDays: days,
        couponCode: state.couponCode,
        baseAmount: base,
        serviceFee: serviceFee,
        taxAmount: tax,
        discountAmount: discount,
        totalAmount: total
      }));
    }

    function applyCoupon() {
      var raw = String(couponInput && couponInput.value ? couponInput.value : "").trim().toUpperCase();
      if (!raw) {
        state.couponCode = "";
        state.couponType = "none";
        if (couponStatus) {
          couponStatus.textContent = "Coupon cleared";
        }
        compute();
        return;
      }

      var coupon = COUPONS[raw];
      if (!coupon) {
        state.couponCode = "";
        state.couponType = "none";
        if (couponStatus) {
          couponStatus.textContent = "Invalid coupon code";
        }
        compute();
        return;
      }

      state.couponCode = raw;
      state.couponType = coupon.type;
      if (couponStatus) {
        couponStatus.textContent = coupon.label;
      }
      compute();
    }

    if (durationInput) {
      durationInput.addEventListener("input", compute);
    }
    if (pickupDate) {
      pickupDate.addEventListener("input", compute);
    }
    if (pickupTime) {
      pickupTime.addEventListener("input", compute);
    }
    if (couponInput) {
      couponInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          applyCoupon();
        }
      });
    }
    if (applyBtn) {
      applyBtn.addEventListener("click", applyCoupon);
    }

    if (proceedBtn) {
      proceedBtn.addEventListener("click", function () {
        if (
          window.VehicleAuthUI &&
          typeof window.VehicleAuthUI.requireBookingAccess === "function" &&
          !window.VehicleAuthUI.requireBookingAccess({
            message: "Please register or sign in before booking a vehicle. Redirecting to registration...",
            autoRedirect: true,
            delayMs: 700,
          })
        ) {
          return;
        }

        var startDate = pickupDate ? String(pickupDate.value || "") : "";
        var durationDays = getDurationDays();
        if (!startDate) {
          if (couponStatus) {
            couponStatus.textContent = "Choose a pick-up date before checkout.";
          }
          return;
        }

        var endDate = addDaysToIsoDate(startDate, Math.max(0, durationDays - 1));
        var target = new URL("booking.html", window.location.href);
        target.searchParams.set("vehicle", String(vehicle.id || ""));
        target.searchParams.set("start", startDate);
        if (endDate) {
          target.searchParams.set("end", endDate);
        }
        if (pickupTime && pickupTime.value) {
          target.searchParams.set("pickupTime", String(pickupTime.value));
        }
        if (state.couponCode) {
          target.searchParams.set("coupon", state.couponCode);
        }

        window.location.href = target.toString();
      });
    }

    compute();
  }

  async function init() {
    var vehicle = await getVehicleFromQuery();
    renderIdentity(vehicle);
    renderGallery(vehicle);
    renderBadges(vehicle);
    renderQuickSpecs(vehicle);
    renderFeatures(vehicle);
    renderIncluded(vehicle);
    renderPricing(vehicle);
    renderBulletList("vehicleRequirements", vehicle.requirements);
    renderBulletList("vehiclePolicies", vehicle.policies);
    renderSimilar(vehicle);
    renderReviewSnippets(vehicle);
    wireBookingSidebar(vehicle);
    wireRevealAnimations();
  }

  window.VehicleDetailsPage = {
    init: init
  };
})();