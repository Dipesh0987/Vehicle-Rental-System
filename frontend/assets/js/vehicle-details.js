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

  function init() {
    getVehicleFromQuery();
  }

  window.VehicleDetailsPage = {
    init: init
  };
})();
