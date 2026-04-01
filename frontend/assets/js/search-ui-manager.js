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
                max: 100000,
                step: 50,
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
                <button id="clearPanelFilters" class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition duration-200 hover:-translate-y-0.5 hover:bg-red-100">
                    <i class="fas fa-times-circle"></i> Clear All Filters
                </button>

                <!-- Search in filters -->
                <div>
                    <input type="text" id="filterSearch" placeholder="Search filters..." class="w-full rounded-xl border border-[#d4ded9] bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
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
        const expandedByDefault = ["vehicleType", "priceRange", "availability"].includes(key);

        let html = `
            <div class="filter-category rounded-2xl border border-[#e2e9e5] bg-[#f8fbf9] px-4 py-4" data-filter-title="${String(config.label || "").toLowerCase()}">
                <div class="filter-toggle mb-3 flex cursor-pointer items-center gap-2" data-filter="${key}">
                    <i class="fas ${config.icon} text-accent"></i>
                    <h3 class="flex-1 text-sm font-semibold text-ink">${config.label}</h3>
                    <i class="fas fa-chevron-down toggle-icon text-xs text-muted transition-transform duration-200 ${expandedByDefault ? "rotate-180" : ""}"></i>
                </div>
                <div class="filter-content space-y-2 pl-1 ${expandedByDefault ? "" : "hidden"}">
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
                <label class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-[#30484b] transition hover:bg-white">
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

        // Search categories in filter panel
        const filterSearchInput = document.getElementById("filterSearch");
        if (filterSearchInput && filterSearchInput.dataset.listenerBound !== "true") {
            filterSearchInput.dataset.listenerBound = "true";
            filterSearchInput.addEventListener("input", (event) => {
                const query = String(event.target.value || "").trim().toLowerCase();
                document.querySelectorAll(".filter-category").forEach((category) => {
                    const title = String(category.dataset.filterTitle || "");
                    const shouldHide = query.length > 0 && !title.includes(query);
                    category.classList.toggle("hidden", shouldHide);
                });
            });
        }

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
        vehicles.forEach((vehicle, index) => {
            html += this.createVehicleCard(vehicle, index);
        });

        resultsDiv.innerHTML = html;
        this.attachVehicleCardListeners();
    }

    /**
     * Create a vehicle card
     */
    createVehicleCard(vehicle, index = 0) {
        const price = this.filterManager.extractPrice(vehicle.pricing?.dailyRate || "0");
        const parsedRating = parseFloat(vehicle.rating || 0);
        const rating = Number.isFinite(parsedRating) ? parsedRating : 0;
        const isWishlisted = this.isVehicleWishlisted(vehicle.id);
        const imageUrl = vehicle.imageUrl || vehicle.image || "";
        const galleryImages = Array.isArray(vehicle.imageUrls) && vehicle.imageUrls.length
            ? vehicle.imageUrls.filter(Boolean)
            : (imageUrl ? [imageUrl] : []);
        const galleryPayload = encodeURIComponent(JSON.stringify(galleryImages));
        const hasGallery = galleryImages.length > 1;
        const activeImage = galleryImages[0] || imageUrl;
        const vehicleTitle = [vehicle.brand, vehicle.name].filter(Boolean).join(" ").trim() || "Vehicle";
        const featureList = Array.isArray(vehicle.features) ? vehicle.features : [];
        const reviewSeedSource = String(vehicle.id || vehicleTitle).replace(/\D/g, "");
        const reviewSeed = Number.parseInt(reviewSeedSource.slice(-3), 10);
        const reviewCount = Number.isFinite(reviewSeed) ? 18 + (reviewSeed % 83) : 42;
        const staggerDelay = Math.min(index, 10) * 70;

        let html = `
            <article class="vehicle-result-card group relative cursor-pointer overflow-hidden rounded-2xl border border-[#d4ded9] bg-white shadow-[0_12px_28px_rgba(10,31,34,0.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_rgba(10,31,34,0.15)] animate-cardLift opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c766e]/35" style="animation-delay:${staggerDelay}ms;animation-fill-mode:forwards;" data-vehicle-id="${vehicle.id}" tabindex="0" role="link" aria-label="Open details for ${vehicleTitle}">
                <div class="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#E58C4E,#2C766E)]"></div>
                <!-- Vehicle Image -->
                <div class="relative bg-gradient-to-br from-panel to-[#1f5659] h-[240px] flex items-center justify-center" data-gallery-index="0" data-gallery-images="${galleryPayload}">
                    ${activeImage
                        ? `<img src="${activeImage}" alt="${vehicleTitle}" class="vehicle-card-image h-full w-full object-cover transition-opacity duration-300" />`
                        : '<i class="fas fa-car text-white text-6xl opacity-30"></i>'}
                    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent"></div>
                          ${hasGallery
                                ? `<button type="button" style="left:12px;" class="vehicle-image-prev vehicle-gallery-nav absolute z-10 inline-flex items-center justify-center" aria-label="Previous image">&#8592;</button>
                                    <button type="button" style="right:12px;" class="vehicle-image-next vehicle-gallery-nav absolute z-10 inline-flex items-center justify-center" aria-label="Next image">&#8594;</button>`
                                : ""}
                    ${vehicle.available !== false ? '<div class="absolute right-4 top-4 rounded-full border border-[#b7e1c7] bg-[#e9fff1] px-3 py-1 text-[11px] font-semibold text-[#1b6a3d]"><i class="fas fa-check-circle mr-1"></i>Available</div>' : ""}
                </div>

                <!-- Card Content -->
                <div class="p-5 sm:p-6">
                    <!-- Header -->
                    <div class="mb-4 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h3 class="font-bold text-lg text-ink" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${vehicleTitle}</h3>
                            <p class="mt-1 text-[11px] text-[#4a6568] font-semibold uppercase tracking-[0.11em]">${vehicle.type || "Vehicle"}</p>
                        </div>
                        <button class="wishlist-icon rounded-full p-2 transition ${isWishlisted ? "bg-red-50 text-red-500" : "text-muted hover:bg-[#f5f8f7] hover:text-red-500"}" data-vehicle-id="${vehicle.id}">
                            <i class="${isWishlisted ? "fas" : "far"} fa-heart text-lg"></i>
                        </button>
                    </div>

                    <!-- Quick Specs -->
                    <div class="mb-5 grid grid-cols-2 gap-2.5 text-[13px] text-muted font-semibold">
                        <div class="flex items-center gap-1"><i class="fas fa-gears mr-1"></i><span>${vehicle.transmission || "Auto"}</span></div>
                        <div class="flex items-center gap-1"><i class="fas fa-gas-pump mr-1"></i><span>${vehicle.fuelType || "Petrol"}</span></div>
                        <div class="flex items-center gap-1"><i class="fas fa-person mr-1"></i><span>${vehicle.seats || 5} Seats</span></div>
                        ${featureList.length ? `<div class="flex items-center gap-1"><i class="fas fa-list-check mr-1"></i><span>${featureList.length} Features</span></div>` : ""}
                    </div>

                    <!-- Rating -->
                    <div class="mb-5 flex items-center gap-2">
                        <div class="flex gap-1">
                            ${this.renderStars(rating)}
                        </div>
                        <span class="text-sm font-bold text-ink">${rating.toFixed(1)}</span>
                        <span class="text-xs text-muted">(${reviewCount} reviews)</span>
                    </div>

                    <!-- Price -->
                    <div class="mb-5 flex items-baseline gap-2 rounded-xl bg-[#f8fcfa] px-3 py-2">
                        <span class="text-2xl font-bold text-accent">$${price}</span>
                        <span class="text-sm font-medium text-muted">/ day</span>
                    </div>

                    <!-- Features Tags -->
                    ${featureList.length ? `
                        <div class="mb-6 flex flex-wrap gap-2">
                            ${featureList.slice(0, 3).map(f => `<span class="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full font-semibold">${this.formatFeatureLabel(f)}</span>`).join("")}
                        </div>
                    ` : ""}

                    <!-- Buttons -->
                    <div class="mt-1 flex flex-col gap-2 sm:flex-row">
                        <button class="view-details flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_10px_18px_rgba(229,140,78,0.28)]" data-vehicle-id="${vehicle.id}">
                            View Details
                        </button>
                        <button class="book-vehicle flex-1 rounded-xl border-2 border-accent px-4 py-3 text-sm font-semibold text-accent transition duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-white" data-vehicle-id="${vehicle.id}">
                            Book Now
                        </button>
                    </div>
                </div>
            </article>
        `;

        return html;
    }

    /**
     * Convert feature keys into readable labels.
     */
    formatFeatureLabel(feature) {
        return String(feature || "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
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
        const parseGallery = (container) => {
            if (!container) return [];

            try {
                const raw = String(container.dataset.galleryImages || "");
                const decoded = decodeURIComponent(raw);
                const parsed = JSON.parse(decoded);
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch (_error) {
                return [];
            }
        };

        const setGalleryFrame = (container, nextIndex) => {
            if (!container) return;

            const gallery = parseGallery(container);
            if (!gallery.length) return;

            const imageNode = container.querySelector(".vehicle-card-image");

            const current = Number(container.dataset.galleryIndex || 0);
            const normalized = Number.isFinite(nextIndex) ? nextIndex : current;
            const wrappedIndex = ((normalized % gallery.length) + gallery.length) % gallery.length;

            container.dataset.galleryIndex = String(wrappedIndex);

            if (imageNode) {
                imageNode.classList.add("opacity-70");
                imageNode.src = gallery[wrappedIndex];
                window.setTimeout(() => {
                    imageNode.classList.remove("opacity-70");
                }, 120);
            }

        };

        document.querySelectorAll(".vehicle-image-prev").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const container = btn.closest("[data-gallery-images]");
                const current = Number(container?.dataset.galleryIndex || 0);
                setGalleryFrame(container, current - 1);
            });
        });

        document.querySelectorAll(".vehicle-image-next").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const container = btn.closest("[data-gallery-images]");
                const current = Number(container?.dataset.galleryIndex || 0);
                setGalleryFrame(container, current + 1);
            });
        });

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
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const vehicleId = btn.dataset.vehicleId;
                window.location.href = `vehicle-details.html?id=${vehicleId}`;
            });
        });

        // Book now buttons
        document.querySelectorAll(".book-vehicle").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const vehicleId = btn.dataset.vehicleId;
                // Navigate to booking page with vehicle pre-selected
                window.location.href = `booking.html?vehicle=${vehicleId}`;
            });
        });

        // Whole card click opens vehicle details
        document.querySelectorAll(".vehicle-result-card").forEach((card) => {
            card.addEventListener("click", (event) => {
                if (event.target.closest("button, a, input, select, textarea, label")) {
                    return;
                }

                const vehicleId = card.dataset.vehicleId;
                if (!vehicleId) {
                    return;
                }

                window.location.href = `vehicle-details.html?id=${vehicleId}`;
            });

            card.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();
                const vehicleId = card.dataset.vehicleId;
                if (!vehicleId) {
                    return;
                }

                window.location.href = `vehicle-details.html?id=${vehicleId}`;
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
