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
    },
    bmw-3-series: {
      id: "bmw-3-series",
      brand: "BMW",
      name: "3 Series",
      meta: "Luxury Sedan | Automatic | 5 Seats | Petrol",
      tagline: "Business-class luxury sedan with sharp handling and premium cabin comfort.",
      heroImage: "assets/images/car.jpg",
      gallery: ["assets/images/car.jpg", "assets/images/car-transparent.png", "assets/images/car.jpg"],
      badges: ["Executive", "Airport Friendly", "Luxury Segment"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "13 km/l",
        Seats: "5",
        Luggage: "2 Large + 2 Cabin",
        Year: "2023"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Priority support line"
      ],
      pricing: {
        dailyRate: "$132 / day",
        securityDeposit: "$600 refundable",
        extraKm: "$0.72 / km",
        estimatedTotal: "$396 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 2 years old)",
        "Government photo ID or passport",
        "Minimum age: 25 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 24 hours before pickup",
        "Late return fee applies after 20 minute grace period",
        "No smoking policy inside vehicle",
        "Fuel level must match pickup level on return"
      ],
      reviews: [
        { name: "Shreya T.", rating: 4.9, text: "Premium finish and a very smooth long-drive experience." },
        { name: "Daniel R.", rating: 4.8, text: "Perfect for client meetings and executive city travel." }
      ],
      similar: ["Mercedes C 300", "Audi Q5 Premium", "Toyota Camry Hybrid"]
    },
    tucson-n-line: {
      id: "tucson-n-line",
      brand: "Hyundai",
      name: "Tucson N Line",
      meta: "SUV | Automatic | 5 Seats | Petrol",
      tagline: "Modern SUV package with sporty styling and practical daily usability.",
      heroImage: "assets/images/car-transparent.png",
      gallery: ["assets/images/car-transparent.png", "assets/images/car.jpg", "assets/images/car-transparent.png"],
      badges: ["Urban SUV", "Comfort Ride", "Sport Design"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "14 km/l",
        Seats: "5",
        Luggage: "3 Large + 1 Cabin",
        Year: "2022"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Wireless charging support"
      ],
      pricing: {
        dailyRate: "$104 / day",
        securityDeposit: "$460 refundable",
        extraKm: "$0.58 / km",
        estimatedTotal: "$312 for 3 days"
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
        { name: "Aniket G.", rating: 4.8, text: "Great SUV for family use and comfortable over rough roads." },
        { name: "Priya N.", rating: 4.7, text: "Loved the interiors and pickup service was right on time." }
      ],
      similar: ["Honda CR-V Touring", "Kia Seltos X-Line", "Jeep Wrangler Sahara"]
    },
    seltos-x-line: {
      id: "seltos-x-line",
      brand: "Kia",
      name: "Seltos X-Line",
      meta: "Compact SUV | Automatic | 5 Seats | Petrol",
      tagline: "Compact and connected SUV tailored for city-first rental demand.",
      heroImage: "assets/images/car.jpg",
      gallery: ["assets/images/car.jpg", "assets/images/car-transparent.png", "assets/images/car.jpg"],
      badges: ["City Ready", "Connected Tech", "Compact SUV"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "16 km/l",
        Seats: "5",
        Luggage: "2 Large + 2 Cabin",
        Year: "2023"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Smart navigation package"
      ],
      pricing: {
        dailyRate: "$94 / day",
        securityDeposit: "$430 refundable",
        extraKm: "$0.52 / km",
        estimatedTotal: "$282 for 3 days"
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
        { name: "Meera S.", rating: 4.8, text: "Good city mileage and really comfortable for traffic commutes." },
        { name: "Ritesh J.", rating: 4.6, text: "Neat condition and easy pickup-drop process." }
      ],
      similar: ["Hyundai Tucson N Line", "Honda CR-V Touring", "Toyota Camry Hybrid"]
    },
    altima-sv: {
      id: "altima-sv",
      brand: "Nissan",
      name: "Altima SV",
      meta: "Sedan | Automatic | 5 Seats | Petrol",
      tagline: "Reliable comfort sedan with balanced performance and highway stability.",
      heroImage: "assets/images/car-transparent.png",
      gallery: ["assets/images/car-transparent.png", "assets/images/car.jpg", "assets/images/car-transparent.png"],
      badges: ["Value Choice", "Highway Friendly", "Comfort Cabin"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "14 km/l",
        Seats: "5",
        Luggage: "2 Large + 2 Cabin",
        Year: "2022"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Standard toll support tag"
      ],
      pricing: {
        dailyRate: "$89 / day",
        securityDeposit: "$390 refundable",
        extraKm: "$0.48 / km",
        estimatedTotal: "$267 for 3 days"
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
        { name: "Kunal H.", rating: 4.7, text: "Smooth sedan and very practical for office commute rentals." },
        { name: "Elena B.", rating: 4.6, text: "Clean interiors and responsive customer support." }
      ],
      similar: ["Toyota Camry Hybrid", "BMW 3 Series", "Mercedes C 300"]
    },
    mercedes-c-300: {
      id: "mercedes-c-300",
      brand: "Mercedes-Benz",
      name: "C 300",
      meta: "Luxury Sedan | Automatic | 5 Seats | Petrol",
      tagline: "Premium German sedan experience for high-end and executive bookings.",
      heroImage: "assets/images/car.jpg",
      gallery: ["assets/images/car.jpg", "assets/images/car-transparent.png", "assets/images/car.jpg"],
      badges: ["Premium", "Executive Class", "Luxury Ride"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "12 km/l",
        Seats: "5",
        Luggage: "2 Large + 2 Cabin",
        Year: "2023"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Concierge-level support"
      ],
      pricing: {
        dailyRate: "$138 / day",
        securityDeposit: "$650 refundable",
        extraKm: "$0.75 / km",
        estimatedTotal: "$414 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 2 years old)",
        "Government photo ID or passport",
        "Minimum age: 26 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 48 hours before pickup",
        "Late return fee applies after 20 minute grace period",
        "No smoking policy inside vehicle",
        "Fuel level must match pickup level on return"
      ],
      reviews: [
        { name: "Ishaan P.", rating: 4.9, text: "Luxury feel throughout and very professional service team." },
        { name: "Marta L.", rating: 4.8, text: "Excellent condition, exactly what I expect from premium rentals." }
      ],
      similar: ["BMW 3 Series", "Audi Q5 Premium", "Ford Mustang GT"]
    },
    audi-q5-premium: {
      id: "audi-q5-premium",
      brand: "Audi",
      name: "Q5 Premium",
      meta: "Luxury SUV | Automatic | 5 Seats | Petrol",
      tagline: "Luxury SUV comfort with practical cargo and premium drive quality.",
      heroImage: "assets/images/car-transparent.png",
      gallery: ["assets/images/car-transparent.png", "assets/images/car.jpg", "assets/images/car-transparent.png"],
      badges: ["Luxury SUV", "Family Premium", "Long Drive"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "11 km/l",
        Seats: "5",
        Luggage: "3 Large + 2 Cabin",
        Year: "2022"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Premium cabin package"
      ],
      pricing: {
        dailyRate: "$142 / day",
        securityDeposit: "$680 refundable",
        extraKm: "$0.82 / km",
        estimatedTotal: "$426 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 2 years old)",
        "Government photo ID or passport",
        "Minimum age: 26 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 48 hours before pickup",
        "Late return fee applies after 20 minute grace period",
        "No smoking policy inside vehicle",
        "Fuel level must match pickup level on return"
      ],
      reviews: [
        { name: "Haruto N.", rating: 4.9, text: "Top-tier SUV comfort and great stability at highway speed." },
        { name: "Devika M.", rating: 4.8, text: "Premium service and very smooth pickup/return flow." }
      ],
      similar: ["Mercedes C 300", "Honda CR-V Touring", "Jeep Wrangler Sahara"]
    },
    wrangler-sahara: {
      id: "wrangler-sahara",
      brand: "Jeep",
      name: "Wrangler Sahara",
      meta: "Off-Road SUV | Automatic | 5 Seats | Petrol",
      tagline: "Adventure-ready SUV for rugged terrains and experience-focused trips.",
      heroImage: "assets/images/car.jpg",
      gallery: ["assets/images/car.jpg", "assets/images/car-transparent.png", "assets/images/car.jpg"],
      badges: ["Off-Road", "Adventure", "Weekend Escape"],
      quickSpecs: {
        "Fuel Type": "Petrol",
        Transmission: "Automatic",
        Mileage: "10 km/l",
        Seats: "5",
        Luggage: "2 Large + 2 Cabin",
        Year: "2021"
      },
      included: [
        "Comprehensive insurance coverage",
        "Roadside assistance (24/7)",
        "Sanitized vehicle handover",
        "Terrain support checklist"
      ],
      pricing: {
        dailyRate: "$126 / day",
        securityDeposit: "$550 refundable",
        extraKm: "$0.7 / km",
        estimatedTotal: "$378 for 3 days"
      },
      requirements: [
        "Valid driving license (minimum 2 years old)",
        "Government photo ID or passport",
        "Minimum age: 25 years",
        "Credit card for security authorization"
      ],
      policies: [
        "Free cancellation up to 24 hours before pickup",
        "Late return fee applies after 20 minute grace period",
        "No smoking policy inside vehicle",
        "Off-road damage policy applies"
      ],
      reviews: [
        { name: "Arjun F.", rating: 4.8, text: "Perfect for hilly routes and overall a fun drive." },
        { name: "Lina W.", rating: 4.7, text: "Strong road presence and the support team was very responsive." }
      ],
      similar: ["Audi Q5 Premium", "Hyundai Tucson N Line", "Honda CR-V Touring"]
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

  function getAvailability(vehicle) {
    return vehicle.availability || [
      "Today: Available for immediate pickup after 2 hours notice",
      "Tomorrow: High demand window, reserve early",
      "Weekend: Limited slots for premium time bands"
    ];
  }

  function getOperationalNotes(vehicle) {
    return vehicle.operationalNotes || [
      "Vehicle handover checklist is completed digitally at pickup.",
      "Dedicated support is active throughout the rental duration.",
      "Incident reporting is handled via 24/7 fleet assistance desk."
    ];
  }

  function renderAvailability(vehicle) {
    renderBulletList("vehicleAvailability", getAvailability(vehicle));
    renderBulletList("vehicleOperationalNotes", getOperationalNotes(vehicle));
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
    renderAvailability(vehicle);
    wireRevealAnimations();
  }

  window.VehicleDetailsPage = {
    init: init
  };
})();
