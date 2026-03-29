(function () {
  "use strict";

  // Filter state management
  const FilterState = {
    search: "",
    type: "",
    fuel: "",
    transmission: "",
    availability: "",
    minPrice: null,
    maxPrice: null,

    reset() {
      this.search = "";
      this.type = "";
      this.fuel = "";
      this.transmission = "";
      this.availability = "";
      this.minPrice = null;
      this.maxPrice = null;
    },

    hasActiveFilters() {
      return (
        this.search ||
        this.type ||
        this.fuel ||
        this.transmission ||
        this.availability ||
        this.minPrice !== null ||
        this.maxPrice !== null
      );
    },

    getActiveFilterTags() {
      const tags = [];
      if (this.search) tags.push({ label: `Search: "${this.search}"`, key: "search" });
      if (this.type) tags.push({ label: `Type: ${this.capitalize(this.type)}`, key: "type" });
      if (this.fuel) tags.push({ label: `Fuel: ${this.capitalize(this.fuel)}`, key: "fuel" });
      if (this.transmission) tags.push({ label: `${this.capitalize(this.transmission)}`, key: "transmission" });
      if (this.availability) tags.push({ label: `${this.availability === 'available' ? 'Available Now' : 'Limited Stock'}`, key: "availability" });
      if (this.minPrice !== null) tags.push({ label: `Min: $${this.minPrice}`, key: "minPrice" });
      if (this.maxPrice !== null) tags.push({ label: `Max: $${this.maxPrice}`, key: "maxPrice" });
      return tags;
    },

    capitalize(text) {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  };

  // Extract price from daily rate string
  function extractPrice(pricingText) {
    const match = String(pricingText || "").match(/\$(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Determine vehicle type from meta
  function getVehicleType(meta) {
    const lower = String(meta || "").toLowerCase();
    if (lower.includes("sedan")) return "sedan";
    if (lower.includes("suv")) return "suv";
    if (lower.includes("sport")) return "sport";
    if (lower.includes("luxury")) return "luxury";
    if (lower.includes("off-road")) return "off-road";
    return "";
  }

  // Determine fuel type from meta
  function getFuelType(meta) {
    const lower = String(meta || "").toLowerCase();
    if (lower.includes("hybrid")) return "hybrid";
    if (lower.includes("diesel")) return "diesel";
    if (lower.includes("electric")) return "electric";
    if (lower.includes("petrol")) return "petrol";
    return "";
  }

  // Determine transmission from meta
  function getTransmission(meta) {
    const lower = String(meta || "").toLowerCase();
    if (lower.includes("automatic")) return "automatic";
    if (lower.includes("manual")) return "manual";
    return "";
  }

  // Check vehicle availability (dummy logic)
  function getAvailability(vehicleData) {
    if (!vehicleData || !vehicleData.pricing) return "limited";
    const price = extractPrice(vehicleData.pricing.dailyRate);
    return price > 0 ? "available" : "limited";
  }

  // Filter a single vehicle based on current filters
  function matchesFilters(vehicle) {
    if (!vehicle) return false;

    // Search filter - match brand, name, meta, or badges
    if (FilterState.search) {
      const searchLower = FilterState.search.toLowerCase().trim();
      const inBrand = String(vehicle.brand || "").toLowerCase().includes(searchLower);
      const inName = String(vehicle.name || "").toLowerCase().includes(searchLower);
      const inMeta = String(vehicle.meta || "").toLowerCase().includes(searchLower);
      const inBadges = Array.isArray(vehicle.badges) && vehicle.badges.some(b =>
        String(b || "").toLowerCase().includes(searchLower)
      );
      const inTagline = String(vehicle.tagline || "").toLowerCase().includes(searchLower);

      if (!inBrand && !inName && !inMeta && !inBadges && !inTagline) return false;
    }

    // Type filter - validate value before comparing
    if (FilterState.type && FilterState.type.trim()) {
      const vehicleType = getVehicleType(vehicle.meta);
      if (vehicleType !== FilterState.type) return false;
    }

    // Fuel filter - validate value before comparing
    if (FilterState.fuel && FilterState.fuel.trim()) {
      const fuelType = getFuelType(vehicle.meta);
      if (fuelType !== FilterState.fuel) return false;
    }

    // Transmission filter - validate value before comparing
    if (FilterState.transmission && FilterState.transmission.trim()) {
      const transmission = getTransmission(vehicle.meta);
      if (transmission !== FilterState.transmission) return false;
    }

    // Availability filter - validate value before comparing
    if (FilterState.availability && FilterState.availability.trim()) {
      const availability = getAvailability(vehicle);
      if (availability !== FilterState.availability) return false;
    }

    // Price filter - validate numeric values
    if (FilterState.minPrice !== null || FilterState.maxPrice !== null) {
      const price = extractPrice(vehicle.pricing && vehicle.pricing.dailyRate);
      
      // Validate minPrice
      if (FilterState.minPrice !== null) {
        const minPrice = parseInt(FilterState.minPrice, 10);
        if (!isNaN(minPrice) && price < minPrice) return false;
      }
      
      // Validate maxPrice
      if (FilterState.maxPrice !== null) {
        const maxPrice = parseInt(FilterState.maxPrice, 10);
        if (!isNaN(maxPrice) && price > maxPrice) return false;
      }
    }

    return true;
  }

  // Apply filters to vehicle list
  function applyFilters() {
    const articles = document.querySelectorAll(".fleet-grid article");
    const vehicleData = window.VehicleDetailsData || {};
    let visibleCount = 0;
    const totalCount = articles.length;

    articles.forEach(article => {
      const vehicleUrl = article.getAttribute("data-detail-url") || "";
      const vehicleId = vehicleUrl.split("=").pop();
      const vehicle = vehicleData[vehicleId];

      const isVisible = vehicle ? matchesFilters(vehicle) : true;
      article.style.display = isVisible ? "" : "none";
      article.classList.toggle("hidden", !isVisible);

      if (isVisible) visibleCount++;
    });

    updateFilterTags();
    updateResultCount(visibleCount, totalCount);
  }

  // Update filter tags display
  function updateFilterTags() {
    const container = document.getElementById("activeTags");
    if (!container) return;

    container.innerHTML = "";
    const tags = FilterState.getActiveFilterTags();

    tags.forEach(tag => {
      const tagEl = document.createElement("div");
      tagEl.className =
        "inline-flex items-center gap-2 rounded-full border border-accent/30 bg-[#fff4eb] px-3 py-1.5 text-[11px] font-semibold text-[#9f5825] animate-fadeUp";
      tagEl.innerHTML = `
        <span>${tag.label}</span>
        <button type="button" class="ml-1 font-bold text-[#c87030] hover:text-[#a05820] transition" data-remove-tag="${tag.key}">×</button>
      `;
      container.appendChild(tagEl);

      tagEl.querySelector("[data-remove-tag]").addEventListener("click", e => {
        e.preventDefault();
        removeFilter(tag.key);
      });
    });
  }

  // Remove specific filter
  function removeFilter(key) {
    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const fuelFilter = document.getElementById("fuelFilter");
    const transmissionFilter = document.getElementById("transmissionFilter");
    const availabilityFilter = document.getElementById("availabilityFilter");
    const minPrice = document.getElementById("minPrice");
    const maxPrice = document.getElementById("maxPrice");

    switch (key) {
      case "search":
        FilterState.search = "";
        if (searchInput) searchInput.value = "";
        break;
      case "type":
        FilterState.type = "";
        if (typeFilter) typeFilter.value = "";
        break;
      case "fuel":
        FilterState.fuel = "";
        if (fuelFilter) fuelFilter.value = "";
        break;
      case "transmission":
        FilterState.transmission = "";
        if (transmissionFilter) transmissionFilter.value = "";
        break;
      case "availability":
        FilterState.availability = "";
        if (availabilityFilter) availabilityFilter.value = "";
        break;
      case "minPrice":
        FilterState.minPrice = null;
        if (minPrice) minPrice.value = "";
        break;
      case "maxPrice":
        FilterState.maxPrice = null;
        if (maxPrice) maxPrice.value = "";
        break;
    }
    applyFilters();
  }

  // Update result counter
  function updateResultCount(visibleCount, totalCount) {
    const resultsDiv = document.getElementById("filterResults");
    const visibleCountEl = document.getElementById("visibleCount");
    
    if (!resultsDiv) return;

    if (visibleCount === 0 && FilterState.hasActiveFilters()) {
      // Show "no results" message
      resultsDiv.innerHTML = `
        <div class="text-center">
          <p class="text-[13px] font-semibold text-[#c05823]">No vehicles match your filters</p>
          <p class="text-[12px] text-[#6C7074] mt-1">Try adjusting your search criteria or <button class="text-accent font-semibold hover:underline" onclick="document.getElementById('clearFilters').click()">clear filters</button></p>
        </div>
      `;
      resultsDiv.classList.remove("hidden");
    } else if (FilterState.hasActiveFilters()) {
      // Show result count
      resultsDiv.classList.remove("hidden");
      if (visibleCountEl) {
        visibleCountEl.textContent = visibleCount;
      }
    } else {
      // Hide when no filters applied
      resultsDiv.classList.add("hidden");
    }
  }

  // Initialize event listeners
  function init() {
    // Restore saved filter state if available
    restoreFilterState();

    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const fuelFilter = document.getElementById("fuelFilter");
    const transmissionFilter = document.getElementById("transmissionFilter");
    const availabilityFilter = document.getElementById("availabilityFilter");
    const minPrice = document.getElementById("minPrice");
    const maxPrice = document.getElementById("maxPrice");
    const applyBtn = document.getElementById("applyFilters");
    const clearBtn = document.getElementById("clearFilters");

    // Update filter state on input change - with real-time updates
    if (searchInput) {
      searchInput.addEventListener("input", e => {
        FilterState.search = e.target.value;
        saveFilterState();
        applyFilters(); // Real-time filter for search
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener("change", e => {
        FilterState.type = e.target.value;
        saveFilterState();
        applyFilters(); // Real-time filter for type
      });
    }

    if (fuelFilter) {
      fuelFilter.addEventListener("change", e => {
        FilterState.fuel = e.target.value;
        saveFilterState();
        applyFilters(); // Real-time filter for fuel
      });
    }

    if (transmissionFilter) {
      transmissionFilter.addEventListener("change", e => {
        FilterState.transmission = e.target.value;
        saveFilterState();
        applyFilters(); // Real-time filter for transmission
      });
    }

    if (availabilityFilter) {
      availabilityFilter.addEventListener("change", e => {
        FilterState.availability = e.target.value;
        saveFilterState();
        applyFilters(); // Real-time filter for availability
      });
    }

    if (minPrice) {
      minPrice.addEventListener("change", e => {
        const value = e.target.value.trim();
        const numValue = value ? parseInt(value, 10) : null;
        
        // Validate: must be a positive number
        if (numValue !== null && isNaN(numValue)) {
          console.warn("Invalid minimum price value");
          minPrice.value = "";
          FilterState.minPrice = null;
        } else if (numValue !== null && numValue < 0) {
          console.warn("Minimum price cannot be negative");
          minPrice.value = FilterState.minPrice || "";
        } else {
          FilterState.minPrice = numValue;
        }
        saveFilterState();
        applyFilters(); // Real-time filter for min price
      });
    }

    if (maxPrice) {
      maxPrice.addEventListener("change", e => {
        const value = e.target.value.trim();
        const numValue = value ? parseInt(value, 10) : null;
        
        // Validate: must be a positive number
        if (numValue !== null && isNaN(numValue)) {
          console.warn("Invalid maximum price value");
          maxPrice.value = "";
          FilterState.maxPrice = null;
        } else if (numValue !== null && numValue < 0) {
          console.warn("Maximum price cannot be negative");
          maxPrice.value = FilterState.maxPrice || "";
        } else {
          FilterState.maxPrice = numValue;
        }
        saveFilterState();
        applyFilters(); // Real-time filter for max price
      });
    }

    // Apply filters button - kept for explicit apply action
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        saveFilterState();
        applyFilters();
      });
    }

    // Clear all filters
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        FilterState.reset();
        if (searchInput) searchInput.value = "";
        if (typeFilter) typeFilter.value = "";
        if (fuelFilter) fuelFilter.value = "";
        if (transmissionFilter) transmissionFilter.value = "";
        if (availabilityFilter) availabilityFilter.value = "";
        if (minPrice) minPrice.value = "";
        if (maxPrice) maxPrice.value = "";
        saveFilterState();
        applyFilters();
      });
    }
  }

  // Save filter state to localStorage
  function saveFilterState() {
    const state = {
      search: FilterState.search,
      type: FilterState.type,
      fuel: FilterState.fuel,
      transmission: FilterState.transmission,
      availability: FilterState.availability,
      minPrice: FilterState.minPrice,
      maxPrice: FilterState.maxPrice
    };
    try {
      localStorage.setItem("vehicleFilters", JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save filter state to localStorage", e);
    }
  }

  // Restore filter state from localStorage
  function restoreFilterState() {
    try {
      const saved = localStorage.getItem("vehicleFilters");
      if (saved) {
        const state = JSON.parse(saved);
        FilterState.search = state.search || "";
        FilterState.type = state.type || "";
        FilterState.fuel = state.fuel || "";
        FilterState.transmission = state.transmission || "";
        FilterState.availability = state.availability || "";
        FilterState.minPrice = state.minPrice;
        FilterState.maxPrice = state.maxPrice;

        // Update UI with restored values
        const searchInput = document.getElementById("searchInput");
        const typeFilter = document.getElementById("typeFilter");
        const fuelFilter = document.getElementById("fuelFilter");
        const transmissionFilter = document.getElementById("transmissionFilter");
        const availabilityFilter = document.getElementById("availabilityFilter");
        const minPrice = document.getElementById("minPrice");
        const maxPrice = document.getElementById("maxPrice");

        if (searchInput) searchInput.value = FilterState.search;
        if (typeFilter) typeFilter.value = FilterState.type;
        if (fuelFilter) fuelFilter.value = FilterState.fuel;
        if (transmissionFilter) transmissionFilter.value = FilterState.transmission;
        if (availabilityFilter) availabilityFilter.value = FilterState.availability;
        if (minPrice) minPrice.value = FilterState.minPrice || "";
        if (maxPrice) maxPrice.value = FilterState.maxPrice || "";

        applyFilters();
      }
    } catch (e) {
      console.warn("Could not restore filter state from localStorage", e);
    }
  }
  window.VehicleFilters = {
    FilterState,
    applyFilters,
    matchesFilters,
    extractPrice,
    getVehicleType,
    getFuelType,
    getTransmission,
    getAvailability,
    saveFilterState,
    restoreFilterState,
    init
  };

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
