(function () {
  "use strict";

  var SECTION_ID = "homeTopRatedSection";
  var TABS_ID    = "trBrandTabs";
  var GRID_ID    = "trCardsGrid";

  var BRANDS = [
    {
      key: "honda",
      label: "Honda",
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.5 4h3v7.5h7V4h3v16h-3v-7.5h-7V20h-3V4z"/></svg>',
    },
    {
      key: "chevrolet",
      label: "Chevrolet",
      svg: '<svg width="22" height="13" viewBox="0 0 32 18" fill="currentColor" aria-hidden="true"><path d="M0 4h13l2 5H8l1 5H0V4zm32 0H19l-2 5h7l-1 5h8V4z"/></svg>',
    },
    {
      key: "volvo",
      label: "Volvo",
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="14" r="7"/><path d="M16 7l4-4m0 0h-4m4 0v4"/></svg>',
    },
    {
      key: "mitsubishi",
      label: "Mitsubishi",
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12,1 15.5,7.5 12,14 8.5,7.5"/><polygon points="4,9 7.5,15.5 4,22 0.5,15.5"/><polygon points="20,9 23.5,15.5 20,22 16.5,15.5"/></svg>',
    },
    {
      key: "volkswagen",
      label: "Volkswagen",
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1.3 5.5L12 11l1.3-3.5h2L13 13.5l-1 2-1-2L8.7 7.5h2zm-4.2 0L7.6 9l-1.7 4.8A8.1 8.1 0 014.2 11h1.5l.8-3.5zm10 0l.8 3.5h1.5a8.1 8.1 0 01-1.7 2.8L15.4 9l1.1-1.5h-.6z"/></svg>',
    },
  ];

  var activeBrandKey = BRANDS[0].key;
  var allVehicles    = [];

  function brandByKey(key) {
    for (var i = 0; i < BRANDS.length; i++) {
      if (BRANDS[i].key === key) { return BRANDS[i]; }
    }
    return null;
  }

  function vehiclesForLabel(label) {
    var lbl = String(label || "").toLowerCase();
    return allVehicles.filter(function (v) {
      return String(v.brand || "").toLowerCase() === lbl;
    });
  }

  function formatNpr(value) {
    var n = Math.round(Number(value) || 0);
    return n ? "NPR\u00a0" + n.toLocaleString() : "On request";
  }

  function safe(v) { return String(v || ""); }

  // ── Brand tab pills ───────────────────────────────────────────────────
  function renderTabs() {
    var el = document.getElementById(TABS_ID);
    if (!el) { return; }

    el.innerHTML = BRANDS.map(function (b) {
      var active = b.key === activeBrandKey;
      var count  = vehiclesForLabel(b.label).length;
      return (
        '<button type="button" data-brand="' + b.key + '" ' +
        'class="brand-pill inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 ' +
        (active
          ? "border-accent bg-accent text-white shadow-[0_4px_14px_rgba(229,140,78,0.32)]"
          : "border-[#CBD4CE] bg-white text-[#4a545b] hover:border-accent hover:text-accent") +
        '">' +
        b.svg +
        "<span>" + b.label + "</span>" +
        (count
          ? '<span class="min-w-[18px] rounded-full ' + (active ? "bg-white/25" : "bg-[#f0f3f1]") + ' px-1.5 py-0.5 text-center text-[10px] leading-tight">' + count + "</span>"
          : "") +
        "</button>"
      );
    }).join("");

    el.querySelectorAll(".brand-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeBrandKey = btn.getAttribute("data-brand");
        renderTabs();
        renderGrid();
      });
    });
  }

  // ── Car card ──────────────────────────────────────────────────────────
  function renderCard(v) {
    var img    = safe(v.primaryImageUrl || (v.imageUrls && v.imageUrls[0]) || "assets/images/car-transparent.png");
    var name   = (v.brand && v.name && v.name.toLowerCase() !== v.brand.toLowerCase())
                 ? v.brand + " " + v.name
                 : (v.brand || v.name || "Vehicle");
    var fuel   = safe(v.fuelType || "Petrol");
    var seats  = Number(v.seats || 5);
    var trans  = safe(v.transmission || "Automatic");
    var price  = formatNpr(v.pricePerDay);
    var href   = "vehicle-details.html?id=" + encodeURIComponent(safe(v.id));

    return (
      '<article class="group flex flex-col overflow-hidden rounded-2xl border border-[#e4ecee] bg-white shadow-[0_4px_18px_rgba(12,35,38,0.07)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_36px_rgba(12,35,38,0.13)]">' +

        // image
        '<div class="relative overflow-hidden bg-[#F5F6F4]">' +
          '<span class="absolute left-3 top-3 z-10 rounded-full border border-[#d7e3e0] bg-white/90 px-2.5 py-[3px] text-[11px] font-semibold text-[#3E4448] backdrop-blur-sm">' + fuel + "</span>" +
          '<img src="' + img + '" alt="' + name + '" loading="lazy" ' +
               'class="h-[190px] w-full object-contain p-5 transition duration-300 group-hover:scale-[1.04]" ' +
               'onerror="this.src=\'assets/images/car-transparent.png\'">' +
        "</div>" +

        // body
        '<div class="flex flex-1 flex-col p-5">' +

          '<h3 class="truncate text-[16px] font-bold leading-tight text-ink">' + name + "</h3>" +

          // specs
          '<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-[#628083]">' +
            '<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">person</span>' + seats + ' Seater</span>' +
            '<span class="h-3 w-px bg-[#d0dbd7]"></span>' +
            '<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">settings</span>' + trans + "</span>" +
            '<span class="h-3 w-px bg-[#d0dbd7]"></span>' +
            '<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">local_gas_station</span>' + fuel + "</span>" +
          "</div>" +

          // price
          '<p class="mt-3 text-[14px] font-semibold text-[#628083]">Starting at ' +
            '<span class="text-[16px] font-bold text-ink">' + price + "</span>" +
            '<span class="text-[12px] font-medium text-[#8a9da0]">/Day</span>' +
          "</p>" +

          // CTA buttons
          '<div class="mt-4 flex gap-2">' +
            '<a href="' + href + '" class="flex-1 rounded-full bg-accent py-2.5 text-center text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(229,140,78,0.22)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_8px_18px_rgba(229,140,78,0.34)]">Details</a>' +
            '<a href="' + href + '" class="flex-1 rounded-full border border-[#CBD4CE] py-2.5 text-center text-[13px] font-semibold text-[#4a545b] transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent">Book Now</a>' +
          "</div>" +

        "</div>" +
      "</article>"
    );
  }

  // ── Cards grid ────────────────────────────────────────────────────────
  function renderGrid() {
    var grid = document.getElementById(GRID_ID);
    if (!grid) { return; }

    var brand    = brandByKey(activeBrandKey);
    var vehicles = brand ? vehiclesForLabel(brand.label) : [];

    if (!vehicles.length) {
      grid.innerHTML =
        '<div class="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-[#8a9da0]">' +
          '<span class="material-symbols-outlined text-[48px] opacity-40">directions_car</span>' +
          '<p class="text-[15px] font-semibold">No ' + (brand ? brand.label : "") + " vehicles available right now</p>" +
          '<a href="vehicles.html" class="mt-1 text-[13px] font-semibold text-accent hover:underline">Browse all vehicles →</a>' +
        "</div>";
      return;
    }

    grid.innerHTML = vehicles.slice(0, 6).map(renderCard).join("");
  }

  // ── Full section skeleton (called once after data loads) ──────────────
  function renderShell(container) {
    container.innerHTML =
      '<div class="py-16 lg:py-20">' +

        // heading
        '<div class="px-4 text-center">' +
          '<h2 class="text-[36px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink lg:text-[44px]">' +
            'Top Rated<br>Rented Cars' +
          "</h2>" +
          '<p class="mx-auto mt-3 max-w-[520px] text-[14.5px] leading-[1.65] text-[#6C7074]">' +
            'Handpicked vehicles with verified ratings. Every car is inspected, insured, and ready for your next journey.' +
          "</p>" +
        "</div>" +

        // brand tabs
        '<div id="' + TABS_ID + '" class="mt-8 flex flex-wrap items-center justify-center gap-3 px-4"></div>' +

        // cards grid
        '<div id="' + GRID_ID + '" ' +
             'class="mx-auto mt-10 grid max-w-[1390px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3"></div>' +

        // view all
        '<div class="mt-10 flex justify-center px-4">' +
          '<a href="vehicles.html" ' +
             'class="inline-flex items-center gap-2 rounded-full border border-[#CBD4CE] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#4a545b] transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent">' +
            'View All Vehicles' +
            '<span class="material-symbols-outlined text-[16px] leading-none">arrow_forward</span>' +
          "</a>" +
        "</div>" +

      "</div>";
  }

  // ── Loading skeletons ─────────────────────────────────────────────────
  function renderLoading(container) {
    var skeletonCards = "";
    for (var i = 0; i < 3; i++) {
      skeletonCards +=
        '<div class="overflow-hidden rounded-2xl border border-[#e4ecee] bg-white">' +
          '<div class="h-[190px] w-full animate-pulse bg-[#e5eaeb]"></div>' +
          '<div class="p-5 space-y-3">' +
            '<div class="h-4 w-3/4 animate-pulse rounded bg-[#e5eaeb]"></div>' +
            '<div class="h-3 w-full animate-pulse rounded bg-[#e5eaeb]"></div>' +
            '<div class="h-4 w-1/2 animate-pulse rounded bg-[#e5eaeb]"></div>' +
            '<div class="mt-4 flex gap-2">' +
              '<div class="h-10 flex-1 animate-pulse rounded-full bg-[#e5eaeb]"></div>' +
              '<div class="h-10 flex-1 animate-pulse rounded-full bg-[#e5eaeb]"></div>' +
            "</div>" +
          "</div>" +
        "</div>";
    }

    var skeletonTabs = BRANDS.map(function () {
      return '<div class="h-10 w-28 animate-pulse rounded-full bg-[#e5eaeb]"></div>';
    }).join("");

    container.innerHTML =
      '<div class="py-16 lg:py-20">' +
        '<div class="px-4 text-center">' +
          '<div class="mx-auto h-10 w-64 animate-pulse rounded-lg bg-[#e5eaeb]"></div>' +
          '<div class="mx-auto mt-3 h-4 w-80 animate-pulse rounded bg-[#e5eaeb]"></div>' +
        "</div>" +
        '<div class="mt-8 flex flex-wrap justify-center gap-3 px-4">' + skeletonTabs + "</div>" +
        '<div class="mx-auto mt-10 grid max-w-[1390px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">' + skeletonCards + "</div>" +
      "</div>";
  }

  // ── Entry point ───────────────────────────────────────────────────────
  async function init() {
    var section = document.getElementById(SECTION_ID);
    if (!section) { return; }

    renderLoading(section);

    try {
      var svc = window.VehicleCatalogService;
      if (!svc || typeof svc.listVehicles !== "function") {
        throw new Error("VehicleCatalogService not ready");
      }
      var result = await svc.listVehicles({ includeInactive: false });
      allVehicles = Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn("HomeTopRated: vehicle load failed –", err && err.message);
      allVehicles = [];
    }

    // Default to first brand that has vehicles; otherwise keep Honda selected
    for (var i = 0; i < BRANDS.length; i++) {
      if (vehiclesForLabel(BRANDS[i].label).length > 0) {
        activeBrandKey = BRANDS[i].key;
        break;
      }
    }

    renderShell(section);
    renderTabs();
    renderGrid();
  }

  window.HomeTopRated = { init: init };
})();
