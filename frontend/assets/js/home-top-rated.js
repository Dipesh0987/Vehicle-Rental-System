/* ============================================================
   home-top-rated.js  –  "Top Rated Rented Cars" section
   Premium redesign: card-style brand tabs, fade-switch grid,
   star ratings, spec chips, gradient CTAs, Popular badge.
   ============================================================ */
(function () {
  "use strict";

  var SECTION_ID   = "homeTopRatedSection";
  var TABS_WRAP_ID = "trTabsWrap";
  var TABS_ID      = "trBrandTabs";
  var GRID_ID      = "trCardsGrid";

  // ── Brand definitions with SVG logos ─────────────────────────────────
  var BRANDS = [
    {
      key: "honda", label: "Honda", color: "#CC0000",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.5 4h3v7.5h7V4h3v16h-3v-7.5h-7V20h-3V4z"/></svg>',
    },
    {
      key: "chevrolet", label: "Chevrolet", color: "#C8A951",
      svg: '<svg width="22" height="14" viewBox="0 0 32 18" fill="currentColor" aria-hidden="true"><path d="M0 4h13l2 5H8l1 5H0V4zm32 0H19l-2 5h7l-1 5h8V4z"/></svg>',
    },
    {
      key: "volvo", label: "Volvo", color: "#003057",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="14" r="7"/><path d="M16 7l4-4m0 0h-4m4 0v4"/></svg>',
    },
    {
      key: "mitsubishi", label: "Mitsubishi", color: "#E4001B",
      svg: '<svg width="20" height="20" viewBox="0 0 36 32" fill="currentColor" aria-hidden="true"><polygon points="18,0 22,8 18,16 14,8"/><polygon points="7,13 11,21 7,29 3,21"/><polygon points="29,13 33,21 29,29 25,21"/></svg>',
    },
    {
      key: "volkswagen", label: "Volkswagen", color: "#001E50",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1.3 5.5L12 11l1.3-3.5h2L13 13.5l-1 2-1-2L8.7 7.5h2zm-4.2 0L7.6 9l-1.7 4.8A8.1 8.1 0 014.2 11h1.5l.8-3.5zm10 0l.8 3.5h1.5a8.1 8.1 0 01-1.7 2.8L15.4 9l1.1-1.5h-.6z"/></svg>',
    },
  ];

  var activeBrandKey = BRANDS[0].key;
  var allVehicles    = [];

  // ── Helpers ───────────────────────────────────────────────────────────
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

  function renderStars(rating) {
    var r     = Math.min(5, Math.max(0, Number(rating || 4.5)));
    var full  = Math.floor(r);
    var half  = (r - full) >= 0.3 ? 1 : 0;
    var empty = 5 - full - half;
    var s     = "";
    var GOLD  = "#F5A623";
    var GREY  = "#D1D9DC";
    for (var i = 0; i < full;  i++) { s += '<span style="color:' + GOLD + ';font-size:13px;line-height:1">&#9733;</span>'; }
    if  (half)                       { s += '<span style="color:' + GOLD + ';font-size:13px;line-height:1">&#9733;</span>'; }
    for (var i = 0; i < empty; i++) { s += '<span style="color:' + GREY + ';font-size:13px;line-height:1">&#9733;</span>'; }
    return s;
  }

  // ── Brand tab cards ───────────────────────────────────────────────────
  function renderTabs() {
    var el = document.getElementById(TABS_ID);
    if (!el) { return; }

    el.innerHTML = BRANDS.map(function (b) {
      var active = b.key === activeBrandKey;
      var count  = vehiclesForLabel(b.label).length;
      var countTxt = count ? count + " car" + (count > 1 ? "s" : "") : "No cars";

      return (
        '<button type="button" data-brand="' + b.key + '" ' +
        'class="tr-brand-btn group flex-shrink-0 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-250 ' +
        (active
          ? "border-accent bg-gradient-to-br from-accent to-[#D87E3E] text-white shadow-[0_8px_24px_rgba(229,140,78,0.35)]"
          : "border-[#DDE5E0] bg-white text-[#3E4448] hover:border-[#2A7E72] hover:shadow-[0_6px_18px_rgba(12,35,38,0.1)]") +
        '">' +
          // Logo circle
          '<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ' +
               (active ? "bg-white/20" : "bg-[#EEF2F0]") + '"' +
               (active ? "" : ' style="color:' + b.color + '"') + '>' +
            b.svg +
          "</div>" +
          // Label + count
          '<div>' +
            '<p class="text-[13px] font-bold leading-tight">' + b.label + "</p>" +
            '<p class="mt-0.5 text-[11px] font-semibold ' + (active ? "text-white/75" : "text-[#8A9DA0]") + '">' + countTxt + "</p>" +
          "</div>" +
        "</button>"
      );
    }).join("");

    el.querySelectorAll(".tr-brand-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-brand");
        if (key === activeBrandKey) { return; }
        activeBrandKey = key;
        renderTabs();
        renderGrid();
      });
    });
  }

  // ── Single car card ───────────────────────────────────────────────────
  function renderCard(v) {
    var img      = safe(v.primaryImageUrl || (v.imageUrls && v.imageUrls[0]) || "assets/images/car-transparent.png");
    var brand    = safe(v.brand || "Vehicle");
    var model    = (v.name && v.name.toLowerCase() !== brand.toLowerCase()) ? safe(v.name) : brand;
    var fullName = (model !== brand) ? brand + " " + model : brand;
    var fuel     = safe(v.fuelType || "Petrol");
    var seats    = Number(v.seats || 5);
    var trans    = safe(v.transmission || "Automatic");
    var category = safe(v.category || v.type || "Car");
    var rating   = Number(v.rating || 4.5);
    var price    = formatNpr(v.pricePerDay);
    var popular  = rating >= 4.7;
    var avail    = v.available !== false;
    var href     = "vehicle-details.html?id=" + encodeURIComponent(safe(v.id));

    return (
      '<article class="group relative flex flex-col overflow-hidden rounded-[20px] bg-white ' +
               'shadow-[0_2px_14px_rgba(12,35,38,0.08)] transition-all duration-300 ' +
               'hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(12,35,38,0.16)]">' +

        // ── Image area ──
        '<div class="relative overflow-hidden" style="background:linear-gradient(135deg,#EEF2EF,#E4EBE5)">' +

          // Fuel badge
          '<span class="absolute left-3 top-3 z-10 rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#3E4448] backdrop-blur-sm">' +
            fuel +
          "</span>" +

          // Popular / Availability badge
          (popular
            ? '<span class="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-[#2A7E72] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">' +
              '<span style="font-size:10px;line-height:1">&#9733;</span>Popular</span>'
            : (avail
              ? '<span class="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[#b7e1c7] bg-[#e9fff1] px-2.5 py-1 text-[10px] font-bold text-[#1b6a3d]">' +
                '<span class="h-1.5 w-1.5 rounded-full bg-[#1b6a3d]"></span>Available</span>'
              : '<span class="absolute right-3 top-3 z-10 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">Booked</span>'
            )
          ) +

          // Car image
          '<img src="' + img + '" alt="' + fullName + '" loading="lazy" ' +
               'class="h-[200px] w-full object-contain px-6 py-4 transition-transform duration-500 group-hover:scale-[1.06]" ' +
               'onerror="this.src=\'assets/images/car-transparent.png\'">' +

          // Bottom category strip
          '<div class="absolute bottom-0 inset-x-0 flex items-center justify-between bg-gradient-to-t from-[#0d2528]/12 to-transparent px-4 py-2.5">' +
            '<span class="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#2A3E40]">' + category + '</span>' +
            '<span class="text-[10.5px] font-bold text-[#2A3E40]">' + price + '<span class="font-medium">/day</span></span>' +
          '</div>' +

        "</div>" +

        // ── Card body ──
        '<div class="flex flex-1 flex-col p-5">' +

          // Brand tag + model name
          '<p class="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2A7E72]">' + brand + "</p>" +
          '<h3 class="mt-0.5 truncate text-[17px] font-extrabold leading-snug text-ink">' + model + "</h3>" +

          // Star rating row
          '<div class="mt-2 flex items-center gap-2">' +
            '<span class="flex items-center gap-0.5">' + renderStars(rating) + "</span>" +
            '<span class="text-[12px] font-bold text-[#4A6568]">' + rating.toFixed(1) + "</span>" +
            '<span class="text-[11px] text-[#8A9DA0] font-medium">· Verified</span>' +
          "</div>" +

          // Spec chips
          '<div class="mt-3.5 flex flex-wrap gap-2">' +
            '<span class="inline-flex items-center gap-1 rounded-xl bg-[#EEF2F0] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#3A5255]">' +
              '<span class="material-symbols-outlined text-[13px]">person</span>' + seats + ' Seater' +
            "</span>" +
            '<span class="inline-flex items-center gap-1 rounded-xl bg-[#EEF2F0] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#3A5255]">' +
              '<span class="material-symbols-outlined text-[13px]">settings</span>' + trans +
            "</span>" +
            '<span class="inline-flex items-center gap-1 rounded-xl bg-[#EEF2F0] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#3A5255]">' +
              '<span class="material-symbols-outlined text-[13px]">local_gas_station</span>' + fuel +
            "</span>" +
          "</div>" +

          // Divider
          '<hr class="my-4 border-[#EEF2F0]">' +

          // Price row
          '<div class="flex items-baseline gap-1.5">' +
            '<span class="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8A9DA0]">Starting at</span>' +
            '<span class="text-[19px] font-extrabold text-ink">' + price + "</span>" +
            '<span class="text-[11.5px] font-semibold text-[#8A9DA0]">/Day</span>' +
          "</div>" +

          // CTA buttons
          '<div class="mt-4 grid grid-cols-2 gap-2.5">' +
            '<a href="' + href + '" ' +
               'class="flex items-center justify-center rounded-full bg-gradient-to-r from-accent to-[#D87E3E] py-2.5 text-[13px] font-semibold text-white ' +
               'shadow-[0_4px_14px_rgba(229,140,78,0.26)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_8px_22px_rgba(229,140,78,0.40)]">' +
              "Details" +
            "</a>" +
            '<a href="' + href + '" ' +
               'class="flex items-center justify-center rounded-full border-2 border-[#1A3235]/15 py-2.5 text-[13px] font-semibold text-ink ' +
               'transition duration-200 hover:-translate-y-0.5 hover:border-[#2A7E72] hover:text-[#2A7E72]">' +
              "Book Now" +
            "</a>" +
          "</div>" +

        "</div>" +
      "</article>"
    );
  }

  // ── Empty brand state ─────────────────────────────────────────────────
  function renderEmpty(brand) {
    return (
      '<div class="col-span-full flex flex-col items-center justify-center gap-4 py-20">' +
        '<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2F0]">' +
          '<span class="material-symbols-outlined text-[32px] text-[#8A9DA0]">directions_car</span>' +
        "</div>" +
        '<div class="text-center">' +
          '<p class="text-[17px] font-bold text-ink">No ' + (brand ? brand.label : "") + " vehicles right now</p>" +
          '<p class="mt-1.5 text-[14px] text-[#6C7074]">Check back soon or explore our full fleet</p>' +
        "</div>" +
        '<a href="vehicles.html" ' +
           'class="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-[#D87E3E] px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(229,140,78,0.28)] transition hover:brightness-105">' +
          'Browse All Vehicles<span class="material-symbols-outlined text-[15px] leading-none">arrow_forward</span>' +
        "</a>" +
      "</div>"
    );
  }

  // ── Grid with fade-switch animation ──────────────────────────────────
  function renderGrid() {
    var grid = document.getElementById(GRID_ID);
    if (!grid) { return; }

    var brand    = brandByKey(activeBrandKey);
    var vehicles = brand ? vehiclesForLabel(brand.label) : [];

    grid.style.cssText = "opacity:0;transform:translateY(10px);transition:opacity 0.18s ease,transform 0.18s ease;";

    setTimeout(function () {
      grid.innerHTML = vehicles.length
        ? vehicles.slice(0, 6).map(renderCard).join("")
        : renderEmpty(brand);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          grid.style.cssText = "opacity:1;transform:translateY(0);transition:opacity 0.22s ease,transform 0.22s ease;";
        });
      });
    }, 180);
  }

  // ── Full section HTML shell ───────────────────────────────────────────
  function renderShell(container) {
    container.innerHTML =
      // Decorative bg blobs
      '<div class="relative overflow-hidden">' +
        '<div class="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full" ' +
             'style="background:radial-gradient(circle,rgba(42,126,114,0.06) 0%,transparent 70%)" aria-hidden="true"></div>' +
        '<div class="pointer-events-none absolute -bottom-40 -left-40 h-[460px] w-[460px] rounded-full" ' +
             'style="background:radial-gradient(circle,rgba(229,140,78,0.05) 0%,transparent 70%)" aria-hidden="true"></div>' +

        '<div class="relative py-20 lg:py-28">' +

          // ── Section heading ──
          '<div class="px-4 text-center">' +
            '<div class="mb-4 inline-flex items-center gap-2 rounded-full bg-[#2A7E72]/10 px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2A7E72]">' +
              '<span class="h-1.5 w-1.5 rounded-full bg-[#2A7E72] animate-pulseDot"></span>' +
              'Fleet Favorites' +
            '</div>' +
            '<h2 class="text-[38px] font-extrabold leading-[1.06] tracking-[-0.025em] text-ink lg:text-[52px]">' +
              'Top Rated<br><span style="color:#2A7E72">Rented Cars</span>' +
            '</h2>' +
            '<div class="mx-auto mt-4 h-[3px] w-16 rounded-full" style="background:linear-gradient(90deg,#2A7E72,#E58C4E)"></div>' +
            '<p class="mx-auto mt-4 max-w-[500px] text-[15px] leading-[1.7] text-[#6C7074]">' +
              'Handpicked vehicles with verified ratings — inspected, insured, and ready for your next adventure.' +
            '</p>' +
            // Stats strip
            '<div class="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[13px] font-semibold text-[#5a7075]">' +
              '<span style="display:flex;align-items:center;gap:6px"><span style="color:#2A7E72;font-size:16px;font-weight:800">✓</span>500+ Verified Vehicles</span>' +
              '<span style="display:flex;align-items:center;gap:6px"><span style="color:#2A7E72;font-size:16px;font-weight:800">✓</span>5,000+ Happy Customers</span>' +
              '<span style="display:flex;align-items:center;gap:6px"><span style="color:#2A7E72;font-size:16px;font-weight:800">✓</span>Free Cancellation</span>' +
            '</div>' +
          '</div>' +

          // ── Brand tabs ──
          '<div class="mt-12 overflow-x-auto px-4 pb-1" style="-ms-overflow-style:none;scrollbar-width:none;">' +
            '<div id="' + TABS_ID + '" class="flex gap-3" style="width:fit-content;margin-left:auto;margin-right:auto;"></div>' +
          '</div>' +

          // ── Cards grid ──
          '<div id="' + GRID_ID + '" ' +
               'class="mx-auto mt-10 grid max-w-[1390px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">' +
          '</div>' +

          // ── View all ──
          '<div class="mt-12 flex justify-center px-4">' +
            '<a href="vehicles.html" ' +
               'class="inline-flex items-center gap-2.5 rounded-full border-2 border-[#2A7E72]/25 bg-white px-7 py-3 text-[14px] font-bold text-ink ' +
               'shadow-[0_4px_16px_rgba(12,35,38,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-[#2A7E72] hover:text-[#2A7E72] hover:shadow-[0_10px_24px_rgba(12,35,38,0.12)]">' +
              'Explore Full Fleet' +
              '<span class="material-symbols-outlined text-[18px] leading-none">arrow_forward</span>' +
            '</a>' +
          '</div>' +

        '</div>' +
      '</div>';
  }

  // ── Skeleton loading ──────────────────────────────────────────────────
  function renderLoading(container) {
    var cards = "";
    for (var i = 0; i < 3; i++) {
      cards +=
        '<div class="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_14px_rgba(12,35,38,0.07)]">' +
          '<div class="h-[200px] w-full animate-pulse" style="background:#E5EAEB"></div>' +
          '<div class="p-5 space-y-3">' +
            '<div class="h-3 w-20 animate-pulse rounded" style="background:#E5EAEB"></div>' +
            '<div class="h-5 w-3/4 animate-pulse rounded" style="background:#E5EAEB"></div>' +
            '<div class="h-3 w-28 animate-pulse rounded" style="background:#E5EAEB"></div>' +
            '<div class="mt-3 flex gap-2">' +
              '<div class="h-8 w-20 animate-pulse rounded-xl" style="background:#E5EAEB"></div>' +
              '<div class="h-8 w-20 animate-pulse rounded-xl" style="background:#E5EAEB"></div>' +
              '<div class="h-8 w-20 animate-pulse rounded-xl" style="background:#E5EAEB"></div>' +
            '</div>' +
            '<div class="h-px w-full mt-3" style="background:#E5EAEB"></div>' +
            '<div class="h-6 w-36 animate-pulse rounded" style="background:#E5EAEB"></div>' +
            '<div class="mt-3 flex gap-2.5">' +
              '<div class="h-10 flex-1 animate-pulse rounded-full" style="background:#E5EAEB"></div>' +
              '<div class="h-10 flex-1 animate-pulse rounded-full" style="background:#E5EAEB"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    var tabs = BRANDS.map(function () {
      return '<div class="h-[60px] w-36 flex-shrink-0 animate-pulse rounded-2xl" style="background:#E5EAEB"></div>';
    }).join("");

    container.innerHTML =
      '<div class="py-20 lg:py-28">' +
        '<div class="px-4 text-center space-y-3">' +
          '<div class="mx-auto h-5 w-32 animate-pulse rounded-full" style="background:#E5EAEB"></div>' +
          '<div class="mx-auto h-12 w-72 animate-pulse rounded-xl" style="background:#E5EAEB"></div>' +
          '<div class="mx-auto h-4 w-96 animate-pulse rounded" style="background:#E5EAEB"></div>' +
        '</div>' +
        '<div class="mt-12 flex justify-center gap-3 px-4 overflow-x-auto">' + tabs + '</div>' +
        '<div class="mx-auto mt-10 grid max-w-[1390px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">' + cards + '</div>' +
      '</div>';
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
