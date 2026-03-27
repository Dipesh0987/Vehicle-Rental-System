/**
 * Search UI Manager
 * Handles all UI rendering and DOM updates for the advanced search system
 */

class SearchUIManager {
    constructor(filterManager, apiClient) {
        this.filterManager = filterManager;
        this.apiClient = apiClient;
        this.filterCategories = this.defineFilterCategories();
        this.isFiltersPanelOpen = false;
    }

    /**
     * Define all filter categories and their options
     */
    defineFilterCategories() {
        return {
            vehicleType: {
                label: "Vehicle Type",
                icon: "fa-car",
                type: "checkbox",
                options: [
                    { value: "economy", label: "Economy", icon: "fa-piggy-bank" },
                    { value: "sedan", label: "Sedan", icon: "fa-car" },
                    { value: "suv", label: "SUV", icon: "fa-truck" },
                    { value: "luxury", label: "Luxury", icon: "fa-crown" },
                    { value: "van", label: "Van", icon: "fa-shuttle-van" },
                ],
                filterKey: "vehicleTypes",
            },
            transmission: {
                label: "Transmission",
                icon: "fa-gears",
                type: "checkbox",
                options: [
                    { value: "manual", label: "Manual" },
                    { value: "automatic", label: "Automatic" },
                ],
                filterKey: "transmissions",
            },
            fuelType: {
                label: "Fuel Type",
                icon: "fa-gas-pump",
                type: "checkbox",
                options: [
                    { value: "petrol", label: "Petrol" },
                    { value: "diesel", label: "Diesel" },
                    { value: "electric", label: "Electric" },
                    { value: "hybrid", label: "Hybrid" },
                ],
                filterKey: "fuelTypes",
            },
            priceRange: {
                label: "Daily Rate",
                icon: "fa-dollar-sign",
                type: "range",
                min: 0,
                max: 500,
                step: 10,
                minKey: "minPrice",
                maxKey: "maxPrice",
            },
            seating: {
                label: "Seating Capacity",
                icon: "fa-person",
                type: "range",
                min: 1,
                max: 9,
                step: 1,
                minKey: "minSeats",
                maxKey: "maxSeats",
                display: (val) => `${val} seats`,
            },
            rating: {
                label: "User Rating",
                icon: "fa-star",
                type: "range",
                min: 0,
                max: 5,
                step: 0.5,
                minKey: "minRating",
                display: (val) => `${val}★+`,
            },
            features: {
                label: "Features & Amenities",
                icon: "fa-list-check",
                type: "checkbox",
                options: [
                    { value: "ac", label: "Air Conditioning", icon: "fa-snowflake" },
                    { value: "gps", label: "GPS Navigation", icon: "fa-map" },
                    { value: "bluetooth", label: "Bluetooth", icon: "fa-bluetooth" },
                    { value: "reverse-camera", label: "Reverse Camera", icon: "fa-camera" },
                    { value: "child-seat", label: "Child Seat", icon: "fa-baby" },
                ],
                filterKey: "features",
            },
            insurance: {
                label: "Insurance Options",
                icon: "fa-shield",
                type: "checkbox",
                options: [
                    { value: "basic", label: "Basic Coverage" },
                    { value: "premium", label: "Premium Coverage" },
                    { value: "comprehensive", label: "Comprehensive" },
                ],
                filterKey: "insuranceTypes",
            },
            driverOption: {
                label: "Driver Options",
                icon: "fa-id-card",
                type: "checkbox",
                options: [
                    { value: "self-drive", label: "Self-Drive" },
                    { value: "with-driver", label: "With Driver" },
                ],
                filterKey: "driverOptions",
            },
            mileage: {
                label: "Mileage Policy",
                icon: "fa-road",
                type: "checkbox",
                options: [
                    { value: "unlimited", label: "Unlimited" },
                    { value: "limited", label: "Limited (km/day)" },
                ],
                filterKey: "mileagePolicy",
            },
            availability: {
                label: "Availability",
                icon: "fa-calendar-check",
                type: "toggle",
                filterKey: "availabilityOnly",
                label2: "Only show available vehicles",
            },
        };
    }

    /**
     * Render filter panel
     */
    renderFilterPanel() {
        const filterPanel = document.getElementById("filterPanel");
        if (!filterPanel) return;

        let html = `
            <div class="space-y-6">
                <!-- Clear Filters Button -->
                <button id="clearPanelFilters" class="w-full bg-red-50 text-red-600 py-2 rounded-lg font-semibold hover:bg-red-100 transition flex items-center justify-center gap-2">
                    <i class="fas fa-times-circle"></i> Clear All Filters
                </button>

                <!-- Search in filters -->
                <div>
                    <input type="text" id="filterSearch" placeholder="Search filters..." class="w-full px-4 py-2 border border-[#d4ded9] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent transition" />
                </div>
        `;

        // Render each filter category
        for (const [key, config] of Object.entries(this.filterCategories)) {
            html += this.renderFilterCategory(key, config);
        }

        html += `
            </div>
        `;

        filterPanel.innerHTML = html;
        this.attachFilterEventListeners();
    }

    /**
     * Render a single filter category
     */
    renderFilterCategory(key, config) {
        let html = `
            <div class="filter-category border-b border-[#d4ded9] pb-4">
                <div class="flex items-center gap-2 mb-3 cursor-pointer filter-toggle" data-filter="${key}">
                    <i class="fas ${config.icon} text-accent"></i>
                    <h3 class="font-semibold flex-1">${config.label}</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="filter-content space-y-2 pl-6">
        `;

        switch (config.type) {
            case "checkbox":
                html += this.renderCheckboxOptions(config);
                break;
            case "range":
                html += this.renderRangeFilter(config);
                break;
            case "toggle":
                html += this.renderToggleFilter(config);
                break;
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Render checkbox filter options
     */
    renderCheckboxOptions(config) {
        let html = "";
        for (const option of config.options) {
            const isChecked = this.filterManager.filters[config.filterKey]?.includes(option.value);
            html += `
                <label class="flex items-center gap-3 cursor-pointer hover:bg-[#f5f5f5] p-2 rounded transition">
                    <input type="checkbox" class="filter-checkbox" data-filter="${config.filterKey}" data-value="${option.value}" ${isChecked ? "checked" : ""} />
                    ${option.icon ? `<i class="fas ${option.icon} text-muted text-sm"></i>` : ""}
                    <span class="text-sm">${option.label}</span>
                </label>
            `;
        }
        return html;
    }

    /**
     * Render range filter
     */
    renderRangeFilter(config) {
        const minKey = config.minKey;
        const maxKey = config.maxKey;
        const currentMin = this.filterManager.filters[minKey];
        const currentMax = this.filterManager.filters[maxKey];

        let html = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold">
                        ${config.display ? config.display(currentMin) : `$${currentMin}`}
                    </span>
                    <span class="text-sm font-semibold">
                        ${config.display && maxKey ? config.display(currentMax) : maxKey ? `$${currentMax}` : ""}
                    </span>
                </div>
        `;

        if (maxKey) {
            html += `
                <input type="range" class="range-slider filter-range" data-filter="${minKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" />
                <input type="range" class="range-slider filter-range" data-filter="${maxKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMax}" />
            `;
        } else {
            html += `
                <input type="range" class="range-slider filter-range" data-filter="${minKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" />
            `;
        }

        html += `
            </div>
        `;

        return html;
    }

    /**
     * Render toggle filter
     */
    renderToggleFilter(config) {
        const isChecked = this.filterManager.filters[config.filterKey];
        return `
            <label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-[#f5f5f5] rounded transition">
                <input type="checkbox" class="filter-toggle-checkbox" data-filter="${config.filterKey}" ${isChecked ? "checked" : ""} />
                <span class="text-sm">${config.label2}</span>
            </label>
        `;
    }

    /**
     * Attach event listeners to filter controls
     */
    attachFilterEventListeners() {
        // Checkbox filters
        document.querySelectorAll(".filter-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", (e) => {
                this.filterManager.toggleFilter(e.target.dataset.filter, e.target.dataset.value);
                this.updateActiveFilterTags();
            });
        });

        // Range filters
        document.querySelectorAll(".filter-range").forEach((slider) => {
            slider.addEventListener("input", (e) => {
                const filterKey = e.target.dataset.filter;
                const value = parseInt(e.target.value);
                this.filterManager.updateFilter(filterKey, value);
                this.updateActiveFilterTags();
            });
        });

        // Toggle filters
        document.querySelectorAll(".filter-toggle-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", (e) => {
                this.filterManager.updateFilter(e.target.dataset.filter, e.target.checked);
                this.updateActiveFilterTags();
            });
        });

        // Filter category toggle
        document.querySelectorAll(".filter-toggle").forEach((toggle) => {
            toggle.addEventListener("click", () => {
                const content = toggle.nextElementSibling;
                const icon = toggle.querySelector(".toggle-icon");
                content.classList.toggle("hidden");
                icon.classList.toggle("rotate-180");
            });
        });

        // Clear filters in panel
        const clearPanelBtn = document.getElementById("clearPanelFilters");
        if (clearPanelBtn) {
            clearPanelBtn.addEventListener("click", () => {
                this.filterManager.clearAllFilters();
                this.renderFilterPanel();
                this.updateActiveFilterTags();
            });
        }
    }

    /**
     * Render active filter tags
     */
    updateActiveFilterTags() {
        const activeFiltersDiv = document.getElementById("activeFilters");
        if (!activeFiltersDiv) return;

        const activeFilters = this.filterManager.getActiveFilters();
        let html = "";

        for (const [key, value] of Object.entries(activeFilters)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    html += this.createFilterTag(key, item);
                }
            } else {
                html += this.createFilterTag(key, value);
            }
        }

        activeFiltersDiv.innerHTML = html;

        // Attach remove listeners
        document.querySelectorAll(".filter-tag-remove").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const filterKey = e.currentTarget.dataset.filter;
                const value = e.currentTarget.dataset.value;

                if (Array.isArray(this.filterManager.filters[filterKey])) {
                    this.filterManager.toggleFilter(filterKey, value);
                } else {
                    this.filterManager.clearFilter(filterKey);
                }

                this.renderFilterPanel();
                this.updateActiveFilterTags();
            });
        });
    }

    /**
     * Create a filter tag element
     */
    createFilterTag(filterKey, value) {
        const displayValue = this.getFilterDisplayName(filterKey, value);
        return `
            <div class="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-semibold">
                <span>${displayValue}</span>
                <button class="filter-tag-remove hover:text-red-600 transition" data-filter="${filterKey}" data-value="${value}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }

    /**
     * Get display name for filter value
     */
    getFilterDisplayName(filterKey, value) {
        // Handle common cases
        if (filterKey === "minPrice") return `Min: $${value}`;
        if (filterKey === "maxPrice") return `Max: $${value}`;
        if (filterKey === "minSeats") return `${value}+ seats`;
        if (filterKey === "minRating") return `${value}★+`;

        // Capitalize and format value
        return String(value)
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    /**
     * Render vehicle cards
     */
    renderVehicleResults(vehicles) {
        const resultsDiv = document.getElementById("vehicleResults");
        const noResultsDiv = document.getElementById("noResults");
        const resultCountDiv = document.getElementById("resultCount");

        if (!resultsDiv) return;

        // Update result count
        if (resultCountDiv) {
            resultCountDiv.textContent = vehicles.length;
        }

        // Show no results message
        if (vehicles.length === 0) {
            resultsDiv.innerHTML = "";
            noResultsDiv.classList.remove("hidden");
            return;
        }

        noResultsDiv.classList.add("hidden");

        let html = "";
        for (const vehicle of vehicles) {
            html += this.createVehicleCard(vehicle);
        }

        resultsDiv.innerHTML = html;
        this.attachVehicleCardListeners();
    }

    /**
     * Create a vehicle card
     */
    createVehicleCard(vehicle) {
        const price = this.filterManager.extractPrice(vehicle.pricing?.dailyRate || "0");
        const rating = parseFloat(vehicle.rating || 0);
        const isWishlisted = this.isVehicleWishlisted(vehicle.id);

        let html = `
            <div class="vehicle-card bg-white rounded-2xl overflow-hidden shadow-md border border-[#d4ded9]">
                <!-- Vehicle Image -->
                <div class="relative bg-gradient-to-br from-panel to-[#1f5659] h-48 flex items-center justify-center">
                    <i class="fas fa-car text-white text-6xl opacity-30"></i>
                    ${vehicle.available !== false ? '<div class="availability-badge absolute top-4 right-4"><i class="fas fa-check-circle mr-1"></i>Available</div>' : ""}
                </div>

                <!-- Card Content -->
                <div class="p-5">
                    <!-- Header -->
                    <div class="flex items-start justify-between mb-2">
                        <div>
                            <h3 class="font-bold text-lg text-ink">${vehicle.brand} ${vehicle.name}</h3>
                            <p class="text-xs text-muted font-semibold uppercase">${vehicle.type || "Vehicle"}</p>
                        </div>
                        <button class="wishlist-icon ${isWishlisted ? "favorited" : ""}" data-vehicle-id="${vehicle.id}">
                            <i class="fas ${isWishlisted ? "fas fa-heart" : "far fa-heart"} text-lg"></i>
                        </button>
                    </div>

                    <!-- Quick Specs -->
                    <div class="grid grid-cols-2 gap-2 mb-4 text-xs text-muted font-semibold">
                        <div><i class="fas fa-gears mr-1"></i>${vehicle.transmission || "Auto"}</div>
                        <div><i class="fas fa-gas-pump mr-1"></i>${vehicle.fuelType || "Petrol"}</div>
                        <div><i class="fas fa-person mr-1"></i>${vehicle.seats || 5} Seats</div>
                        ${vehicle.features ? `<div><i class="fas fa-list-check mr-1"></i>${vehicle.features.length} Features</div>` : ""}
                    </div>

                    <!-- Rating -->
                    <div class="flex items-center gap-2 mb-4">
                        <div class="flex gap-1">
                            ${this.renderStars(rating)}
                        </div>
                        <span class="text-sm font-bold text-ink">${rating.toFixed(1)}</span>
                        <span class="text-xs text-muted">(${Math.floor(Math.random() * 50 + 10)} reviews)</span>
                    </div>

                    <!-- Price -->
                    <div class="mb-4 flex items-baseline gap-2">
                        <span class="text-2xl font-bold text-accent">$${price}</span>
                        <span class="text-sm text-muted">/ day</span>
                    </div>

                    <!-- Features Tags -->
                    ${vehicle.features ? `
                        <div class="mb-4 flex flex-wrap gap-1">
                            ${vehicle.features.slice(0, 3).map(f => `<span class="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full font-semibold">${f}</span>`).join("")}
                            ${vehicle.features.length > 3 ? `<span class="text-xs bg-gray-100 text-muted px-2 py-1 rounded-full font-semibold">+${vehicle.features.length - 3}</span>` : ""}
                        </div>
                    ` : ""}

                    <!-- Buttons -->
                    <div class="flex gap-2">
                        <button class="flex-1 bg-accent text-white py-2 rounded-lg font-semibold hover:brightness-110 transition view-details" data-vehicle-id="${vehicle.id}">
                            View Details
                        </button>
                        <button class="flex-1 border-2 border-accent text-accent py-2 rounded-lg font-semibold hover:bg-accent hover:text-white transition book-vehicle" data-vehicle-id="${vehicle.id}">
                            Book Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Render star rating
     */
    renderStars(rating) {
        let html = "";
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(rating)) {
                html += `<i class="fas fa-star rating-star text-sm"></i>`;
            } else if (i - 0.5 <= rating) {
                html += `<i class="fas fa-star-half-alt rating-star text-sm"></i>`;
            } else {
                html += `<i class="far fa-star text-gray-300 text-sm"></i>`;
            }
        }
        return html;
    }

    /**
     * Attach vehicle card event listeners
     */
    attachVehicleCardListeners() {
        // Wishlist buttons
        document.querySelectorAll(".wishlist-icon").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const vehicleId = e.currentTarget.dataset.vehicleId;
                window.SearchWishlist?.toggleWishlist(vehicleId);
                this.renderVehicleResults(this.filterManager.filteredVehicles);
                window.SearchWishlist?.updateWishlistCount();
            });
        });

        // View details buttons
        document.querySelectorAll(".view-details").forEach((btn) => {
            btn.addEventListener("click", () => {
                const vehicleId = btn.dataset.vehicleId;
                window.location.href = `vehicle-details.html?id=${vehicleId}`;
            });
        });

        // Book now buttons
        document.querySelectorAll(".book-vehicle").forEach((btn) => {
            btn.addEventListener("click", () => {
                const vehicleId = btn.dataset.vehicleId;
                // Navigate to booking page with vehicle pre-selected
                window.location.href = `booking.html?vehicle=${vehicleId}`;
            });
        });
    }

    /**
     * Check if vehicle is wishlisted
     */
    isVehicleWishlisted(vehicleId) {
        const wishlist = JSON.parse(localStorage.getItem("vehicleWishlist") || "[]");
        return wishlist.includes(vehicleId);
    }

    /**
     * Show loading skeleton
     */
    showLoadingSkeleton() {
        const resultsDiv = document.getElementById("vehicleResults");
        if (!resultsDiv) return;

        let html = "";
        for (let i = 0; i < 6; i++) {
            html += `
                <div class="loading-skeleton rounded-2xl h-96"></div>
            `;
        }
        resultsDiv.innerHTML = html;
    }

    /**
     * Toggle mobile filters panel
     */
    toggleMobileFilters() {
        const filterPanel = document.getElementById("filterPanel");
        if (!filterPanel) return;

        // Clone filter panel into mobile modal
        const mobilePanel = document.querySelector(".filter-modal");
        if (mobilePanel) {
            mobilePanel.classList.toggle("hidden");
        }
    }
}

// Export as global
window.SearchUIManager = SearchUIManager;
