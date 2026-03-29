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
                <button id="clearPanelFilters" class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition duration-200 hover:-translate-y-0.5 hover:bg-red-100">
                    <i class="fas fa-times-circle"></i> Clear All Filters
                </button>

                <!-- Search in filters -->
                <div>
                    <input type="text" id="filterSearch" placeholder="Search filters..." class="w-full rounded-xl border border-[#d4ded9] bg-white px-4 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
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
            <div class="filter-category rounded-2xl border border-[#e2e9e5] bg-[#f8fbf9] px-4 py-4">
                <div class="filter-toggle mb-3 flex cursor-pointer items-center gap-2" data-filter="${key}">
                    <i class="fas ${config.icon} text-accent"></i>
                    <h3 class="flex-1 text-sm font-semibold text-ink">${config.label}</h3>
                    <i class="fas fa-chevron-down toggle-icon text-xs text-muted transition-transform duration-200"></i>
                </div>
                <div class="filter-content space-y-2 pl-1">
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
                <label class="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm text-[#30484b] transition hover:bg-white">
                    <input type="checkbox" class="filter-checkbox h-4 w-4 rounded border-[#c7d5cf] text-accent focus:ring-accent/30" data-filter="${config.filterKey}" data-value="${option.value}" ${isChecked ? "checked" : ""} />
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
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-[#4a6568]">
                        ${config.display ? config.display(currentMin) : `$${currentMin}`}
                    </span>
                    <span class="text-xs font-semibold uppercase tracking-wide text-[#4a6568]">
                        ${config.display && maxKey ? config.display(currentMax) : maxKey ? `$${currentMax}` : ""}
                    </span>
                </div>
        `;

        if (maxKey) {
            html += `
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${minKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" />
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${maxKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMax}" />
            `;
        } else {
            html += `
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${minKey}" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" />
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
            <label class="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm text-[#30484b] transition hover:bg-white">
                <input type="checkbox" class="filter-toggle-checkbox h-4 w-4 rounded border-[#c7d5cf] text-accent focus:ring-accent/30" data-filter="${config.filterKey}" ${isChecked ? "checked" : ""} />
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
            if (checkbox.dataset.listenerBound === "true") return;
            checkbox.dataset.listenerBound = "true";
            checkbox.addEventListener("change", (e) => {
                this.filterManager.toggleFilter(e.target.dataset.filter, e.target.dataset.value);
                this.updateActiveFilterTags();
            });
        });

        // Range filters
        document.querySelectorAll(".filter-range").forEach((slider) => {
            if (slider.dataset.listenerBound === "true") return;
            slider.dataset.listenerBound = "true";
            slider.addEventListener("input", (e) => {
                const filterKey = e.target.dataset.filter;
                const value = parseInt(e.target.value);
                this.filterManager.updateFilter(filterKey, value);
                this.updateActiveFilterTags();
            });
        });

        // Toggle filters
        document.querySelectorAll(".filter-toggle-checkbox").forEach((checkbox) => {
            if (checkbox.dataset.listenerBound === "true") return;
            checkbox.dataset.listenerBound = "true";
            checkbox.addEventListener("change", (e) => {
                this.filterManager.updateFilter(e.target.dataset.filter, e.target.checked);
                this.updateActiveFilterTags();
            });
        });

        // Filter category toggle
        document.querySelectorAll(".filter-toggle").forEach((toggle) => {
            if (toggle.dataset.listenerBound === "true") return;
            toggle.dataset.listenerBound = "true";
            toggle.addEventListener("click", () => {
                const content = toggle.nextElementSibling;
                const icon = toggle.querySelector(".toggle-icon");
                content.classList.toggle("hidden");
                icon.classList.toggle("rotate-180");
            });
        });

        // Clear filters in panel
        const clearPanelBtn = document.getElementById("clearPanelFilters");
        if (clearPanelBtn && clearPanelBtn.dataset.listenerBound !== "true") {
            clearPanelBtn.dataset.listenerBound = "true";
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
            <div class="inline-flex items-center gap-2 rounded-full border border-[#f4cfb3] bg-[#fff4eb] px-3 py-1 text-xs font-semibold text-[#b26530]">
                <span>${displayValue}</span>
                <button class="filter-tag-remove text-[#c7773d] transition hover:text-red-600" data-filter="${filterKey}" data-value="${value}">
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
            <div class="group overflow-hidden rounded-2xl border border-[#d4ded9] bg-white shadow-[0_12px_28px_rgba(10,31,34,0.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_rgba(10,31,34,0.15)]">
                <!-- Vehicle Image -->
                <div class="relative bg-gradient-to-br from-panel to-[#1f5659] h-48 flex items-center justify-center">
                    <i class="fas fa-car text-white text-6xl opacity-30"></i>
                    ${vehicle.available !== false ? '<div class="absolute right-4 top-4 rounded-full border border-[#b7e1c7] bg-[#e9fff1] px-3 py-1 text-[11px] font-semibold text-[#1b6a3d]"><i class="fas fa-check-circle mr-1"></i>Available</div>' : ""}
                </div>

                <!-- Card Content -->
                <div class="p-5">
                    <!-- Header -->
                    <div class="flex items-start justify-between mb-2">
                        <div>
                            <h3 class="font-bold text-lg text-ink">${vehicle.brand} ${vehicle.name}</h3>
                            <p class="text-xs text-muted font-semibold uppercase">${vehicle.type || "Vehicle"}</p>
                        </div>
                        <button class="wishlist-icon rounded-full p-2 transition ${isWishlisted ? "bg-red-50 text-red-500" : "text-muted hover:bg-[#f5f8f7] hover:text-red-500"}" data-vehicle-id="${vehicle.id}">
                            <i class="${isWishlisted ? "fas" : "far"} fa-heart text-lg"></i>
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
                        <button class="view-details flex-1 rounded-lg bg-accent py-2 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105" data-vehicle-id="${vehicle.id}">
                            View Details
                        </button>
                        <button class="book-vehicle flex-1 rounded-lg border-2 border-accent py-2 font-semibold text-accent transition duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-white" data-vehicle-id="${vehicle.id}">
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
                html += `<i class="fas fa-star text-sm text-[#FDB913]"></i>`;
            } else if (i - 0.5 <= rating) {
                html += `<i class="fas fa-star-half-alt text-sm text-[#FDB913]"></i>`;
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
                <div class="h-96 animate-pulse rounded-2xl border border-[#d4ded9] bg-gradient-to-r from-[#eef3f1] via-[#f7faf9] to-[#eef3f1]"></div>
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
