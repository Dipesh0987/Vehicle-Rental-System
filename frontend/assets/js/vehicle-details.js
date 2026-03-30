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

  function mapCatalogVehicleToDetail(vehicle, similarVehicles) {
    var pricePerDay = Number(vehicle && vehicle.pricePerDay ? vehicle.pricePerDay : 0);
    var seats = Number(vehicle && vehicle.seats ? vehicle.seats : 5);
    var fuelType = String(vehicle && vehicle.fuelType ? vehicle.fuelType : "Petrol");
    var type = String(vehicle && vehicle.type ? vehicle.type : "Vehicle");
    var images = normalizeGallery(vehicle || {});

    return {
      id: String(vehicle && vehicle.id ? vehicle.id : ""),
      brand: String(vehicle && vehicle.brand ? vehicle.brand : "Vehicle"),
      name: String(vehicle && vehicle.name ? vehicle.name : "Vehicle"),
      meta: type + " | Automatic | " + seats + " Seats | " + fuelType,
      tagline: "Book this " + type.toLowerCase() + " instantly with transparent pricing and verified images.",
      heroImage: images.heroImage,
      gallery: images.gallery,
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
        { id: "", name: "Browse All Vehicles" }
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
          return {
            id: String(entry && entry.id ? entry.id : ""),
            name: String(entry && entry.name ? entry.name : "Vehicle"),
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
      : [{ id: "", name: "Browse All Vehicles" }];

    target.innerHTML = items.map(function (item) {
      var id = String(item && item.id ? item.id : "").trim();
      var name = String(item && item.name ? item.name : "Vehicle");
      var href = id ? "vehicle-details.html?id=" + encodeURIComponent(id) : "vehicles.html";

      return '<a href="' + href + '" class="flex items-center justify-between rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-semibold text-[#29494c] transition hover:-translate-y-[1px]">' +
        '<span>' + name + '</span><span class="text-[12px] text-[#5a7376]">View Details</span>' +
        '</a>';
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

    compute();
  }

  function hideDetailsLoader() {
    var loader = document.getElementById("vehicleDetailsLoader");
    if (!loader) {
      return;
    }

    loader.classList.add("is-hidden");
    window.setTimeout(function () {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 320);
  }

  async function init() {
    var vehicle = await getVehicleFromQuery();
    renderIdentity(vehicle);
    renderGallery(vehicle);
    renderBadges(vehicle);
    renderQuickSpecs(vehicle);
    renderIncluded(vehicle);
    renderPricing(vehicle);
    renderBulletList("vehicleRequirements", vehicle.requirements);
    renderBulletList("vehiclePolicies", vehicle.policies);
    renderSimilar(vehicle);
    wireBookingSidebar(vehicle);
    wireRevealAnimations();
    hideDetailsLoader();
  }

  window.VehicleDetailsPage = {
    init: init
  };
})();