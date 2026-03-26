(function () {
  "use strict";

  var VEHICLES = {
    camry-hybrid: {
      id: "camry-hybrid",
      brand: "Toyota",
      name: "Camry Hybrid",
      meta: "Sedan | Automatic | 5 Seats | Hybrid",
      tagline: "Executive comfort sedan built for efficient city and highway rentals.",
      heroImage: "assets/images/car-transparent.png",
      gallery: [
        "assets/images/car-transparent.png",
        "assets/images/car.jpg",
        "assets/images/car-transparent.png"
      ],
      badges: ["Fuel Efficient", "Airport Pickup", "Corporate Favorite"],
      quickSpecs: {
        "Fuel Type": "Hybrid",
        Transmission: "Automatic",
        Mileage: "22 km/l",
        Seats: "5",
        Luggage: "2 Large + 1 Cabin",
        Year: "2023"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Basic toll support tag"
      ],
      pricing: {
        dailyRate: "$82 / day",
        securityDeposit: "$350 refundable",
        extraKm: "$0.45 / km",
        estimatedTotal: "$246 for 3 days"
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
        { name: "Aarav S.", rating: 4.9, text: "Very smooth handover process and excellent fuel economy." },
        { name: "Nina K.", rating: 4.8, text: "Ideal for business travel, clean and comfortable interior." }
      ],
      similar: ["Honda CR-V Touring", "Nissan Altima SV", "BMW 3 Series"]
    },
    crv-touring: {
      id: "crv-touring",
      brand: "Honda",
      name: "CR-V Touring",
      meta: "SUV | Automatic | 5 Seats | Petrol",
      tagline: "Balanced family SUV with premium ride quality and storage space.",
      heroImage: "assets/images/car.jpg",
      gallery: ["assets/images/car.jpg", "assets/images/car-transparent.png", "assets/images/car.jpg"],
      badges: ["Family SUV", "Weekend Trips", "Top Rated"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "15 km/l",
        Seats: "5",
        Luggage: "3 Large + 2 Cabin",
        Year: "2022"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Premium infotainment package"
      ],
      pricing: {
        dailyRate: "$98 / day",
        securityDeposit: "$420 refundable",
        extraKm: "$0.55 / km",
        estimatedTotal: "$294 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 1 year old)",
        "Government photo ID or passport",
        "Minimum age: 24 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 24 hours before pickup",
        "Late return fee applies after 30 minute grace period",
        "No smoking policy inside vehicle",
        "Fuel level must match pickup level on return"
      ],
      reviews: [
        { name: "Rohan D.", rating: 4.9, text: "Spacious and super comfortable for intercity travel." },
        { name: "Sara M.", rating: 4.7, text: "Great support team and vehicle was in excellent condition." }
      ],
      similar: ["Hyundai Tucson N Line", "Audi Q5 Premium", "Jeep Wrangler Sahara"]
    },
    mustang-gt: {
      id: "mustang-gt",
      brand: "Ford",
      name: "Mustang GT",
      meta: "Sport | Automatic | 4 Seats | Petrol",
      tagline: "Performance-focused sport coupe for premium driving experiences.",
      heroImage: "assets/images/car-transparent.png",
      gallery: ["assets/images/car-transparent.png", "assets/images/car.jpg", "assets/images/car-transparent.png"],
      badges: ["Performance", "Weekend Special", "Premium Segment"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "9 km/l",
        Seats: "4",
        Luggage: "1 Large + 1 Cabin",
        Year: "2021"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Dedicated performance support line"
      ],
      pricing: {
        dailyRate: "$145 / day",
        securityDeposit: "$650 refundable",
        extraKm: "$0.85 / km",
        estimatedTotal: "$435 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 2 years old)",
        "Government photo ID or passport",
        "Minimum age: 27 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 48 hours before pickup",
        "Late return fee applies after 20 minute grace period",
        "No smoking policy inside vehicle",
        "Performance mode misuse penalty may apply"
      ],
      reviews: [
        { name: "Ethan P.", rating: 4.8, text: "Powerful drive and clean interior, perfect weekend rental." },
        { name: "Kabir V.", rating: 4.7, text: "Pickup process was fast, car was exactly as expected." }
      ],
      similar: ["BMW 3 Series", "Mercedes C 300", "Audi Q5 Premium"]
    }
  };

  function getVehicleFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "camry-hybrid";
    return VEHICLES[id] || VEHICLES["camry-hybrid"];
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
    if (!hero || !rail) {
      return;
    }

    rail.innerHTML = vehicle.gallery.map(function (src, index) {
      var active = index === 0
        ? "border-[#2c766e] bg-[#edf6f3]"
        : "border-[#d3dfda] bg-white";

      return '<button type="button" data-thumb-index="' + index + '" class="vehicle-thumb rounded-xl border p-1 transition hover:-translate-y-[1px] ' + active + '">' +
        '<img src="' + src + '" alt="' + vehicle.name + ' view ' + (index + 1) + '" class="h-[76px] w-full rounded-lg object-cover" />' +
        '</button>';
    }).join("");

    rail.querySelectorAll(".vehicle-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        var idx = Number(thumb.getAttribute("data-thumb-index") || "0");
        var selected = vehicle.gallery[idx] || vehicle.gallery[0];
        hero.src = selected;

        rail.querySelectorAll(".vehicle-thumb").forEach(function (node) {
          node.classList.remove("border-[#2c766e]", "bg-[#edf6f3]");
          node.classList.add("border-[#d3dfda]", "bg-white");
        });

        thumb.classList.remove("border-[#d3dfda]", "bg-white");
        thumb.classList.add("border-[#2c766e]", "bg-[#edf6f3]");
      });
    });
  }

  function renderBadges(vehicle) {
    var target = document.getElementById("vehicleBadges");
    if (!target) {
      return;
    }

    target.innerHTML = vehicle.badges.map(function (badge) {
      return '<span class="rounded-full border border-[#d2dfd9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#355255]">' + badge + '</span>';
    }).join("");
  }

  function renderQuickSpecs(vehicle) {
    var target = document.getElementById("vehicleQuickSpecs");
    if (!target) {
      return;
    }

    target.innerHTML = Object.keys(vehicle.quickSpecs).map(function (key) {
      return '<div class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-3 py-2">' +
        '<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#597175]">' + key + '</p>' +
        '<p class="mt-1 text-[14px] font-semibold text-[#244447]">' + vehicle.quickSpecs[key] + '</p>' +
        '</div>';
    }).join("");
  }

  function renderIncluded(vehicle) {
    var target = document.getElementById("vehicleIncluded");
    if (!target) {
      return;
    }

    target.innerHTML = vehicle.included.map(function (item) {
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

    target.innerHTML = items.map(function (item) {
      return '<li class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-medium text-[#2f4d50]">' + item + '</li>';
    }).join("");
  }

  function renderReviews(vehicle) {
    var target = document.getElementById("vehicleReviews");
    if (!target) {
      return;
    }

    target.innerHTML = vehicle.reviews.map(function (review) {
      return '<article class="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3">' +
        '<div class="flex items-center justify-between gap-3">' +
        '<p class="text-[13px] font-semibold text-[#1f4043]">' + review.name + '</p>' +
        '<p class="rounded-full border border-[#f2c8ab] bg-[#fff6ef] px-2 py-1 text-[11px] font-semibold text-[#985424]">' + review.rating.toFixed(1) + ' / 5</p>' +
        '</div>' +
        '<p class="mt-2 text-[13px] text-[#3d5a5d]">' + review.text + '</p>' +
        '</article>';
    }).join("");
  }

  function renderSimilar(vehicle) {
    var target = document.getElementById("vehicleSimilar");
    if (!target) {
      return;
    }

    target.innerHTML = vehicle.similar.map(function (name) {
      return '<a href="vehicles.html" class="flex items-center justify-between rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 text-[13px] font-semibold text-[#29494c] transition hover:-translate-y-[1px]">' +
        '<span>' + name + '</span><span class="text-[12px] text-[#5a7376]">View in Fleet</span>' +
        '</a>';
    }).join("");
  }

  function init() {
    var vehicle = getVehicleFromQuery();
    renderIdentity(vehicle);
    renderGallery(vehicle);
    renderBadges(vehicle);
    renderQuickSpecs(vehicle);
    renderIncluded(vehicle);
    renderPricing(vehicle);
    renderBulletList("vehicleRequirements", vehicle.requirements);
    renderBulletList("vehiclePolicies", vehicle.policies);
    renderReviews(vehicle);
    renderSimilar(vehicle);
  }

  window.VehicleDetailsPage = {
    init: init
  };
})();
