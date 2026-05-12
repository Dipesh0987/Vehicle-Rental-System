/* ─────────────────────────────────────────────────────────
   home-top-rated.js  –  "Top Rated Rented Cars"
   Pixel-matched to reference:
     • Serif heading (Playfair Display)
     • Flat pill tabs (active = teal fill, inactive = bordered)
     • Clean white cards: fuel badge → image → centered name
       → centered specs → left price → left CTA buttons
     • Class hooks for dark-mode overrides in theme.css
   ───────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var SECTION_ID = "homeTopRatedSection";
  var TABS_ID    = "trBrandTabs";
  var GRID_ID    = "trCardsGrid";

  /* brand logo colours match reference icon tints */
  var BRANDS = [
    { key: "honda",      label: "Honda",      color: "#CC2229",  svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5.5 4h3v7.5h7V4h3v16h-3v-7.5h-7V20h-3V4z"/></svg>' },
    { key: "chevrolet",  label: "Chevrolet",  color: "#C8A951",  svg: '<svg width="16" height="10" viewBox="0 0 32 18" fill="currentColor"><path d="M0 4h13l2 5H8l1 5H0V4zm32 0H19l-2 5h7l-1 5h8V4z"/></svg>' },
    { key: "volvo",      label: "Volvo",      color: "#003057",  svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="14" r="7"/><path d="M16 7l4-4m0 0h-4m4 0v4"/></svg>' },
    { key: "mitsubishi", label: "Mitsubishi", color: "#E60012",  svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,1 15.5,7.5 12,14 8.5,7.5"/><polygon points="4.5,9 8,15.5 4.5,22 1,15.5"/><polygon points="19.5,9 23,15.5 19.5,22 16,15.5"/></svg>' },
    { key: "volkswagen", label: "Volkswagen", color: "#001E50",  svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.3 5.5L12 11l1.3-3.5h2L13 13.5l-1 2-1-2-2.3-6h2zm-4.2 0L7.6 9l-1.7 4.8A8.1 8.1 0 014.2 11h1.5l.8-3.5zm10 0l.8 3.5h1.5a8.1 8.1 0 01-1.7 2.8L15.4 9l1.1-1.5z"/></svg>' },
  ];

  var activeBrandKey = BRANDS[0].key;
  var allVehicles    = [];

  /* ── helpers ────────────────────────────────────────── */
  function brandByKey(k) { for (var i = 0; i < BRANDS.length; i++) { if (BRANDS[i].key === k) return BRANDS[i]; } return null; }
  function vehiclesFor(label) { var l = (label || "").toLowerCase(); return allVehicles.filter(function (v) { return (v.brand || "").toLowerCase() === l; }); }
  function fmtPrice(v) { var n = Math.round(Number(v) || 0); return n ? "$" + n.toLocaleString() : "On request"; }
  function safe(v) { return String(v || ""); }

  /* ── brand pill tabs ───────────────────────────────── */
  function renderTabs() {
    var el = document.getElementById(TABS_ID);
    if (!el) return;

    el.innerHTML = BRANDS.map(function (b) {
      var active = b.key === activeBrandKey;
      return (
        '<button type="button" data-brand="' + b.key + '" class="tr-pill ' +
        (active ? "tr-pill--active" : "tr-pill--inactive") +
        ' inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-200">' +
        '<span class="tr-pill-icon" style="color:' + (active ? "#fff" : b.color) + '">' + b.svg + '</span>' +
        '<span>' + b.label + '</span>' +
        '</button>'
      );
    }).join("");

    el.querySelectorAll(".tr-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-brand");
        if (k === activeBrandKey) return;
        activeBrandKey = k;
        renderTabs();
        renderGrid();
      });
    });
  }

  /* ── single car card ───────────────────────────────── */
  function renderCard(v) {
    var img   = safe(v.primaryImageUrl || (v.imageUrls && v.imageUrls[0]) || "assets/images/car-transparent.png");
    var brand = safe(v.brand || "Vehicle");
    var model = (v.name && v.name.toLowerCase() !== brand.toLowerCase()) ? brand + " " + safe(v.name) : brand;
    var fuel  = safe(v.fuelType || "Petrol");
    var seats = Number(v.seats || 4);
    var trans = safe(v.transmission || "Manual");
    var price = fmtPrice(v.pricePerDay);
    var href  = "vehicle-details.html?id=" + encodeURIComponent(safe(v.id));

    return (
      '<article class="tr-card flex flex-col rounded-2xl transition duration-300 hover:-translate-y-1">' +

        /* image area */
        '<div class="relative px-5 pt-5">' +
          '<span class="tr-fuel absolute left-5 top-5 z-10 rounded-full px-3 py-0.5 text-[11px] font-medium">' + fuel + '</span>' +
          '<img src="' + img + '" alt="' + model + '" loading="lazy" ' +
               'class="mx-auto h-[180px] w-full object-contain" ' +
               'onerror="this.src=\'assets/images/car-transparent.png\'">' +
        '</div>' +

        /* card body */
        '<div class="px-5 pb-5 pt-2">' +
          '<h3 class="tr-card-name text-center text-[16px] font-bold">' + model + '</h3>' +

          /* specs row – centered */
          '<div class="tr-specs mt-2 flex items-center justify-center gap-4 text-[12px]">' +
            '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">person</span>' + seats + ' Seater</span>' +
            '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">settings</span>' + trans + '</span>' +
            '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">local_gas_station</span>' + fuel + '</span>' +
          '</div>' +

          /* price – left aligned */
          '<p class="tr-price mt-3 text-[14px] font-bold">Starting at ' + price + '/Day</p>' +

          /* CTA buttons – left aligned */
          '<div class="mt-3 flex gap-2">' +
            '<a href="' + href + '" class="tr-btn-details rounded-full px-5 py-2 text-[12px] font-semibold transition hover:brightness-110">Details</a>' +
            '<a href="' + href + '" class="tr-btn-book rounded-full px-5 py-2 text-[12px] font-semibold transition hover:brightness-110">Book Now</a>' +
          '</div>' +
        '</div>' +

      '</article>'
    );
  }

  /* ── grid ───────────────────────────────────────────── */
  function renderGrid() {
    var grid = document.getElementById(GRID_ID);
    if (!grid) return;
    var brand = brandByKey(activeBrandKey);
    var vehicles = brand ? vehiclesFor(brand.label) : [];

    grid.style.cssText = "opacity:0;transition:opacity 0.15s ease;";
    setTimeout(function () {
      if (!vehicles.length) {
        grid.innerHTML =
          '<div class="col-span-full py-16 text-center text-[15px]" style="color:#8a9da0">' +
            '<span class="material-symbols-outlined mb-2 block text-[40px] opacity-40">directions_car</span>' +
            'No ' + (brand ? brand.label : '') + ' vehicles available · ' +
            '<a href="vehicles.html" class="font-semibold hover:underline" style="color:#3D8F7E">Browse all</a>' +
          '</div>';
      } else {
        grid.innerHTML = vehicles.slice(0, 6).map(renderCard).join("");
      }
      requestAnimationFrame(function () { grid.style.cssText = "opacity:1;transition:opacity 0.2s ease;"; });
    }, 150);
  }

  /* ── section shell ─────────────────────────────────── */
  function renderShell(container) {
    container.innerHTML =
      '<div class="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">' +

        /* heading */
        '<div class="text-center">' +
          '<h2 class="tr-heading" style="font-family:\'Playfair Display\',Georgia,serif;font-weight:800;font-size:clamp(36px,5vw,52px);line-height:1.1;letter-spacing:-0.01em">' +
            'Top Rated<br>Rented Cars' +
          '</h2>' +
          '<p class="tr-subtitle mx-auto mt-3 max-w-[480px] text-[13.5px] leading-[1.7]">' +
            'Choose from our most popular and top-reviewed vehicles. Every car is verified, insured, and ready for your next journey.' +
          '</p>' +
        '</div>' +

        /* brand tabs */
        '<div id="' + TABS_ID + '" class="mt-8 flex flex-wrap items-center justify-center gap-3"></div>' +

        /* cards grid */
        '<div id="' + GRID_ID + '" class="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3"></div>' +

      '</div>';
  }

  /* ── loading skeleton ──────────────────────────────── */
  function renderLoading(container) {
    var card = '<div class="tr-card rounded-2xl"><div class="h-[220px] animate-pulse rounded-t-2xl" style="background:var(--tr-skel,#eaedee)"></div><div class="space-y-3 p-5"><div class="mx-auto h-4 w-24 animate-pulse rounded" style="background:var(--tr-skel,#eaedee)"></div><div class="mx-auto h-3 w-40 animate-pulse rounded" style="background:var(--tr-skel,#eaedee)"></div><div class="h-4 w-32 animate-pulse rounded" style="background:var(--tr-skel,#eaedee)"></div><div class="flex gap-2"><div class="h-9 w-20 animate-pulse rounded-full" style="background:var(--tr-skel,#eaedee)"></div><div class="h-9 w-20 animate-pulse rounded-full" style="background:var(--tr-skel,#eaedee)"></div></div></div></div>';
    var tabs = BRANDS.map(function () { return '<div class="h-10 w-28 animate-pulse rounded-full" style="background:var(--tr-skel,#eaedee)"></div>'; }).join("");
    container.innerHTML =
      '<div class="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">' +
        '<div class="text-center space-y-3"><div class="mx-auto h-14 w-64 animate-pulse rounded-xl" style="background:var(--tr-skel,#eaedee)"></div><div class="mx-auto h-4 w-80 animate-pulse rounded" style="background:var(--tr-skel,#eaedee)"></div></div>' +
        '<div class="mt-8 flex justify-center gap-3">' + tabs + '</div>' +
        '<div class="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">' + card + card + card + '</div>' +
      '</div>';
  }

  /* ── init ───────────────────────────────────────────── */
  async function init() {
    var section = document.getElementById(SECTION_ID);
    if (!section) return;
    renderLoading(section);
    try {
      var svc = window.VehicleCatalogService;
      if (!svc || typeof svc.listVehicles !== "function") throw new Error("no svc");
      var result = await svc.listVehicles({ includeInactive: false });
      allVehicles = Array.isArray(result) ? result : [];
    } catch (e) {
      console.warn("HomeTopRated:", e && e.message);
      allVehicles = [];
    }
    for (var i = 0; i < BRANDS.length; i++) {
      if (vehiclesFor(BRANDS[i].label).length > 0) { activeBrandKey = BRANDS[i].key; break; }
    }
    renderShell(section);
    renderTabs();
    renderGrid();
  }

  window.HomeTopRated = { init: init };
})();
