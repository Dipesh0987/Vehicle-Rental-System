/**
 * Search UI Manager
 * Handles all UI rendering and DOM updates for the advanced search system
 */

class SearchUIManager {
    constructor(filterManager, apiClient) {
        this.filterManager = filterManager;
        this.apiClient = apiClient;
        this.filterCategories = this.defineFilterCategories();
        this.filterSections = this.defineFilterSections();
        this.isFiltersPanelOpen = false;
    }

    /**
     * Define the visual groupings for the filter rail.
     */
    defineFilterSections() {
        return [
            {
                key: "priority",
                title: "Priority Controls",
                description: "Use these sliders first to narrow the fleet by budget, comfort, and review quality.",
                cards: ["priceRange", "seating", "rating"],
                layoutClass: "grid gap-3 lg:grid-cols-3",
            },
            {
                key: "vehicle",
                title: "Vehicle Specs",
                description: "Match the vehicle style, powertrain, and cabin layout to your trip.",
                cards: ["brand", "vehicleType", "transmission", "fuelType"],
                layoutClass: "grid gap-3 lg:grid-cols-2",
            },
            {
                key: "experience",
                title: "Experience Filters",
                description: "Refine the rental policy, amenities, and availability rules.",
                cards: ["features", "insurance", "driverOption", "mileage", "availability"],
                layoutClass: "grid gap-3 lg:grid-cols-2",
            },
        ];
    }

    /**
     * Define all filter categories and their options
     */
    defineFilterCategories() {
        return {
            searchText: {
                label: "Keyword Search",
                icon: "fa-magnifying-glass",
                type: "text",
                filterKey: "searchText",
                placeholder: "Search by brand, model, or feature",
            },
            brand: {
                label: "Brand",
                icon: "fa-industry",
                type: "checkbox",
                options: [],
                filterKey: "brands",
                dynamicOptions: true,
            },
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
                icon: "fa-money-bill-wave",
                type: "range",
                min: 0,
                max: 50000,
                step: 100,
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

        // Simpler, sequential panel layout (restored visual design)
        let html = `
            <div class="space-y-5">
                <section class="rounded-3xl border border-[#d4ddd7] bg-[linear-gradient(145deg,#ffffff,#f6f2ea)] px-4 py-4 shadow-[0_12px_24px_rgba(9,30,34,0.1)]">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7376]">Refine Results</p>
                    <p class="mt-1 text-[15px] font-bold text-[#1f4043]">Search Filters</p>
                    <button id="clearPanelFilters" class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#f0cdb4] bg-[#fff2e8] py-2.5 text-sm font-semibold text-[#b26431] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffe8d7]">
                        <i class="fas fa-rotate-left"></i> Reset All Filters
                    </button>
                </section>

                <div>
                    <input type="text" id="filterSearch" placeholder="Search filter categories..." class="w-full rounded-2xl border border-[#d4ddd7] bg-white px-4 py-2.5 text-sm font-medium text-[#203f42] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
                </div>
        `;

        // Render each filter category in the original sequential order to preserve the prior visual layout
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
     * Render a grouped filter section.
     */
    renderFilterSection(section) {
        const cards = (section.cards || [])
            .map((key) => this.renderFilterCategory(key, this.filterCategories[key]))
            .filter(Boolean)
            .join("");

        return `
            <section class="space-y-3 rounded-3xl border border-[#d7e0da] bg-[linear-gradient(150deg,#ffffff,#f7f4ee)] px-4 py-4 shadow-[0_10px_20px_rgba(9,30,34,0.08)]">
                <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7376]">${section.title}</p>
                    <p class="mt-1 text-[12px] leading-5 text-[#607a7d]">${section.description}</p>
                </div>
                <div class="${section.layoutClass || "space-y-3"}">
                    ${cards}
                </div>
            </section>
        `;
    }

    /**
     * Render a single filter category
     */
    renderFilterCategory(key, config) {
        let html = `
            <div class="filter-category rounded-2xl border border-[#d7e0da] bg-white/85 px-4 py-4 shadow-[0_8px_18px_rgba(9,30,34,0.07)]">
                <div class="filter-toggle mb-3 flex cursor-pointer items-center gap-2" data-filter="${key}">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#d1ddd8] bg-white text-[#2f5e62]">
                        <i class="fas ${config.icon} text-[12px]"></i>
                    </span>
                    <h3 class="flex-1 text-sm font-semibold text-[#1f4043]">${config.label}</h3>
                    <i class="fas fa-chevron-down toggle-icon text-xs text-[#698083] transition-transform duration-200"></i>
                </div>
                <div class="filter-content space-y-2 pl-1">
        `;

        switch (config.type) {
            case "text":
                html += this.renderTextFilter(config);
                break;
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
     * Render a text filter control.
     */
    renderTextFilter(config) {
        const currentValue = this.filterManager.filters[config.filterKey] || "";

        return `
            <label class="block space-y-2 rounded-2xl border border-[#d4ddd7] bg-white/85 px-4 py-4 text-sm text-[#30484b] shadow-[0_8px_18px_rgba(9,30,34,0.07)]">
                <span class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5b7376]">
                    <i class="fas ${config.icon} text-[12px]"></i>
                    ${config.label}
                </span>
                <input type="text" class="filter-text-input w-full rounded-xl border border-[#d4ddd7] bg-white px-3 py-2 text-sm font-medium text-[#203f42] outline-none transition placeholder:text-[#8ca0a3] focus:border-accent focus:ring-2 focus:ring-accent/25" data-filter="${config.filterKey}" placeholder="${config.placeholder || config.label}" value="${currentValue}" />
            </label>
        `;
    }

    /**
     * Render checkbox filter options
     */
    renderCheckboxOptions(config) {
        const options = config.dynamicOptions ? this.getDynamicCheckboxOptions(config) : config.options;
        let html = "";
        for (const option of options) {
            const isChecked = this.filterManager.filters[config.filterKey]?.includes(option.value);
            html += `
                <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white/80 p-2 text-sm text-[#30484b] transition hover:border-[#d4ddd8] hover:bg-white">
                    <input type="checkbox" class="filter-checkbox h-4 w-4 rounded border-[#c7d5cf] text-accent focus:ring-accent/30" data-filter="${config.filterKey}" data-value="${option.value}" ${isChecked ? "checked" : ""} />
                    ${option.icon ? `<i class="fas ${option.icon} text-[#6a8184] text-sm"></i>` : ""}
                    <span class="text-sm font-medium">${option.label}</span>
                </label>
            `;
        }
        return html;
    }

    /**
     * Build dynamic checkbox options from the current vehicle catalog.
     */
    getDynamicCheckboxOptions(config) {
        const vehicles = Array.isArray(this.filterManager.allVehicles) ? this.filterManager.allVehicles : [];
        const seen = new Set();
        const options = [];

        // Debug: Log vehicle count and first vehicle
        console.log('[Brand Filter Debug] Total vehicles:', vehicles.length);
        if (vehicles.length > 0) {
            console.log('[Brand Filter Debug] First vehicle brand:', vehicles[0]?.brand);
        }

        for (const vehicle of vehicles) {
            const rawBrand = String(vehicle?.brand || "").trim();
            if (!rawBrand) {
                continue;
            }

            const value = rawBrand.toLowerCase();
            if (seen.has(value)) {
                continue;
            }

            seen.add(value);
            options.push({
                value,
                label: rawBrand,
                icon: config.icon,
            });
        }

        options.sort((a, b) => a.label.localeCompare(b.label));

        console.log('[Brand Filter Debug] Brand options found:', options.length, options.map(o => o.label));

        // If no brands found, show a loading message
        if (options.length === 0) {
            return [{
                value: "loading",
                label: "Loading brands...",
                icon: config.icon,
            }];
        }

        return options;
    }

    /**
     * Render range filter
     */
    renderRangeFilter(config) {
        const minKey = config.minKey;
        const maxKey = config.maxKey;
        const currentMin = this.filterManager.filters[minKey];
        const currentMax = this.filterManager.filters[maxKey];
        const minDisplay = this.formatRangeDisplay(config, currentMin, minKey);
        const maxDisplay = maxKey ? this.formatRangeDisplay(config, currentMax, maxKey) : "";

        let html = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="rounded-full border border-[#d6e0da] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#4a6568]">
                        <span data-range-value-for="${minKey}" data-range-role="${maxKey ? 'min' : 'value'}">${minDisplay}</span>
                    </span>
                    ${maxKey ? `<span class="rounded-full border border-[#d6e0da] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#4a6568]"><span data-range-value-for="${maxKey}" data-range-role="max">${maxDisplay}</span></span>` : ""}
                </div>
        `;

        if (maxKey) {
            html += `
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${minKey}" data-range-role="min" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" aria-label="${config.label} minimum" />
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${maxKey}" data-range-role="max" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMax}" aria-label="${config.label} maximum" />
            `;
        } else {
            html += `
                <input type="range" class="filter-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#d4ded9] accent-accent" data-filter="${minKey}" data-range-role="value" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentMin}" aria-label="${config.label}" />
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
            <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white/80 p-2 text-sm text-[#30484b] transition hover:border-[#d4ddd8] hover:bg-white">
                <input type="checkbox" class="filter-toggle-checkbox h-4 w-4 rounded border-[#c7d5cf] text-accent focus:ring-accent/30" data-filter="${config.filterKey}" ${isChecked ? "checked" : ""} />
                <span class="text-sm font-medium">${config.label2}</span>
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

        // Text filters
        document.querySelectorAll(".filter-text-input").forEach((input) => {
            if (input.dataset.listenerBound === "true") return;
            input.dataset.listenerBound = "true";
            input.addEventListener("input", (e) => {
                const filterKey = e.target.dataset.filter;
                this.filterManager.updateFilter(filterKey, String(e.target.value || "").trim());
                this.updateActiveFilterTags();
            });
        });

        // Range filters
        document.querySelectorAll(".filter-range").forEach((slider) => {
            if (slider.dataset.listenerBound === "true") return;
            slider.dataset.listenerBound = "true";
            slider.addEventListener("input", (e) => {
                const filterKey = e.target.dataset.filter;
                const value = Number(e.target.value);
                this.filterManager.updateFilter(filterKey, value);
                this.syncRangeLabel(filterKey, e.target.dataset.rangeRole || "value", value);
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
                this.filterManager.setSortOrder("relevance");
                const sortEl = document.getElementById("sortBy");
                if (sortEl) sortEl.value = "relevance";
                this.renderFilterPanel();
                this.updateActiveFilterTags();
            });
        }
    }

    /**
     * Keep the on-screen slider labels in sync during drag.
     */
    syncRangeLabel(filterKey, role, value) {
        const target = document.querySelector(`[data-range-value-for="${filterKey}"][data-range-role="${role}"]`);
        if (!target) return;

        const config = this.getRangeConfigForKey(filterKey);
        target.textContent = this.formatRangeDisplay(config, value, filterKey);
    }

    /**
     * Resolve the range config for a filter key.
     */
    getRangeConfigForKey(filterKey) {
        return Object.values(this.filterCategories).find((config) => config.minKey === filterKey || config.maxKey === filterKey) || null;
    }

    /**
     * Format the value displayed next to a slider.
     */
    formatRangeDisplay(config, value, filterKey) {
        if (config && typeof config.display === "function") {
            return config.display(value);
        }

        if (String(filterKey || "").toLowerCase().includes("price")) {
            return formatNpr(value);
        }

        return String(value ?? "");
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
            <div class="inline-flex items-center gap-2 rounded-full border border-[#d4ddd7] bg-white px-3 py-1 text-xs font-semibold text-[#2f5458] shadow-[0_6px_14px_rgba(9,30,34,0.08)]">
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
        if (filterKey === "minPrice") return `Min: ${formatNpr(value)}`;
        if (filterKey === "maxPrice") return `Max: ${formatNpr(value)}`;
        if (filterKey === "minSeats") return `${value}+ seats`;
        if (filterKey === "maxSeats") return `Up to ${value} seats`;
        if (filterKey === "minRating") return `${value}★+`;
        if (filterKey === "maxRating") return `Up to ${value}★`;

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

        const safeVehicles = Array.isArray(vehicles) ? vehicles : [];

        // Update result count
        if (resultCountDiv) {
            resultCountDiv.textContent = safeVehicles.length;
        }

        // Show no results message
        if (safeVehicles.length === 0) {
            resultsDiv.innerHTML = "";
            if (noResultsDiv) {
                noResultsDiv.classList.remove("hidden");
            }
            return;
        }

        if (noResultsDiv) {
            noResultsDiv.classList.add("hidden");
        }

        let html = "";
        for (let index = 0; index < safeVehicles.length; index += 1) {
            html += this.createVehicleCard(safeVehicles[index], index);
        }

        resultsDiv.innerHTML = html;
        this.attachVehicleCardListeners();
        this.animateVehicleCards();
    }

    /**
     * Create a vehicle card
     */
    createVehicleCard(vehicle, index) {
        const price = this.filterManager.extractPrice(vehicle.pricing?.dailyRate || "0");
        const rating = parseFloat(vehicle.rating || 0);
        const isWishlisted = this.isVehicleWishlisted(vehicle.id);
        const imageUrl = this.getVehicleImageUrl(vehicle);
        const fallbackImage = "assets/images/car-transparent.png";
        const reviewCount = this.getReviewCount(vehicle);
        const animationDelay = Math.min(index * 55, 420);
        const displayName = this.getVehicleDisplayName(vehicle);

        let html = `
            <div class="vehicle-result-card group cursor-pointer overflow-hidden rounded-[24px] border border-[#d4ddd7] bg-[linear-gradient(165deg,#ffffff,#f8f3ea)] shadow-[0_14px_30px_rgba(10,31,34,0.1)] transition-[box-shadow,border-color] duration-300 hover:shadow-[0_24px_42px_rgba(10,31,34,0.16)]" style="--card-stagger-delay:${animationDelay}ms" data-vehicle-id="${vehicle.id}" role="link" tabindex="0" aria-label="Open details for ${displayName}">
                <div class="relative h-52 overflow-hidden bg-gradient-to-br from-panel to-[#1f5659]">
                    <img src="${imageUrl || fallbackImage}" alt="${displayName}" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" onerror="this.src='${fallbackImage}'" />
                    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d2528]/62 via-[#0d2528]/10 to-transparent"></div>
                    ${vehicle.available !== false ? '<div class="absolute left-4 top-4 rounded-full border border-[#b7e1c7] bg-[#e9fff1] px-3 py-1 text-[11px] font-semibold text-[#1b6a3d]"><i class="fas fa-check-circle mr-1"></i>Available</div>' : '<div class="absolute left-4 top-4 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"><i class="fas fa-clock mr-1"></i>Booked</div>'}
                    <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 rounded-xl border border-white/25 bg-[#10292b]/52 px-3 py-2 text-white backdrop-blur-sm">
                        <p class="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">${vehicle.type || "Vehicle"}</p>
                        <p class="text-[11px] font-semibold">${formatNpr(price)} / day</p>
                    </div>
                </div>

                <div class="p-5">
                    <div class="mb-2 flex items-start justify-between gap-2">
                        <div>
                            <h3 class="text-[20px] font-bold leading-tight text-ink">${displayName}</h3>
                            <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#628083]">${vehicle.vehicleNumber ? `Vehicle No. ${vehicle.vehicleNumber}` : "Verified fleet listing"}</p>
                        </div>
                        <button class="wishlist-icon rounded-full border border-[#d5ddd8] p-2 transition ${isWishlisted ? "bg-red-50 text-red-500" : "text-muted hover:bg-white hover:text-red-500"}" data-vehicle-id="${vehicle.id}">
                            <i class="${isWishlisted ? "fas" : "far"} fa-heart text-lg"></i>
                        </button>
                    </div>

                    <div class="mb-4 grid grid-cols-2 gap-2 text-[12px] text-[#4f686b] font-semibold">
                        <div class="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i class="fas fa-gears mr-1 text-[#5a7477]"></i>${vehicle.transmission || "Auto"}</div>
                        <div class="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i class="fas fa-gas-pump mr-1 text-[#5a7477]"></i>${vehicle.fuelType || "Petrol"}</div>
                        <div class="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i class="fas fa-person mr-1 text-[#5a7477]"></i>${vehicle.seats || 5} Seats</div>
                        ${vehicle.features ? `<div class="rounded-xl border border-[#d7dfda] bg-white px-2.5 py-2"><i class="fas fa-list-check mr-1 text-[#5a7477]"></i>${vehicle.features.length} Features</div>` : ""}
                    </div>

                    <div class="mb-4 flex items-center justify-between gap-2 rounded-xl border border-[#dde5df] bg-white px-3 py-2">
                        <div class="flex gap-1">
                            ${this.renderStars(rating)}
                        </div>
                        <span class="text-[12px] font-semibold text-[#2d4e52]">${rating.toFixed(1)} rating · ${reviewCount} reviews</span>
                    </div>

                    ${vehicle.features ? `
                        <div class="mb-4 flex flex-wrap gap-1.5">
                            ${vehicle.features.slice(0, 3).map(f => `<span class="rounded-full border border-[#d7dfda] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#406064]">${this.formatFeatureLabel(f)}</span>`).join("")}
                            ${vehicle.features.length > 3 ? `<span class="rounded-full border border-[#d7dfda] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6a8184]">+${vehicle.features.length - 3}</span>` : ""}
                        </div>
                    ` : ""}

                    <div class="flex gap-2">
                        <button class="view-details flex-1 rounded-xl border border-[#d7dfda] bg-white py-2.5 font-semibold text-[#22494d] transition duration-200 hover:-translate-y-0.5 hover:border-[#8ea8ab]" data-vehicle-id="${vehicle.id}">
                            View Details
                        </button>
                        <button class="book-vehicle book-now-btn flex-1 rounded-xl border border-[#1f7668] bg-white py-2.5 font-semibold text-[#1f7668] transition duration-200 hover:-translate-y-0.5 hover:border-[#16584d] hover:bg-[#1f7668] hover:text-white hover:shadow-[0_10px_22px_rgba(31,118,104,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(44,118,110,0.38)]" data-vehicle-id="${vehicle.id}">
                            Book Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    getVehicleDisplayName(vehicle) {
        const brand = String(vehicle?.brand || "").trim();
        const name = String(vehicle?.name || "").trim();
        const brandLower = brand.toLowerCase();
        const nameLower = name.toLowerCase();

        if (name) {
            if (!brand || brandLower === "general") {
                return name;
            }

            if (nameLower === brandLower || nameLower.startsWith(`${brandLower} `)) {
                return name;
            }
        }

        if (brand && name) {
            return `${brand} ${name}`.trim();
        }

        return name || brand || "Vehicle";
    }

    /**
     * Resolve image URL from normalized catalog vehicles.
     */
    getVehicleImageUrl(vehicle) {
        if (!vehicle || typeof vehicle !== "object") {
            return "";
        }

        const primary = String(vehicle.primaryImageUrl || "").trim();
        if (primary) {
            return primary;
        }

        if (Array.isArray(vehicle.imageUrls) && vehicle.imageUrls.length > 0) {
            const first = String(vehicle.imageUrls[0] || "").trim();
            if (first) {
                return first;
            }
        }

        return "";
    }

    /**
     * Deterministic review count avoids jitter across rerenders.
     */
    getReviewCount(vehicle) {
        const seed = String(vehicle?.id || vehicle?.name || "vehicle");
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) {
            hash = (hash * 31 + seed.charCodeAt(i)) | 0;
        }
        return 10 + Math.abs(hash % 51);
    }

    /**
     * Format feature chips for display.
     */
    formatFeatureLabel(feature) {
        return String(feature || "")
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    /**
     * Stagger card reveal for smoother perceived rendering.
     */
    animateVehicleCards() {
        const cards = document.querySelectorAll("#vehicleResults .vehicle-result-card");
        if (!cards.length) {
            return;
        }

        const reduceMotion =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (reduceMotion) {
            cards.forEach((card) => card.classList.add("is-visible"));
            return;
        }

        requestAnimationFrame(() => {
            cards.forEach((card) => {
                card.classList.add("is-visible");
            });
        });
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
        const openVehicleDetails = (vehicleId) => {
            if (!vehicleId) return;
            window.location.href = `vehicle-details.html?id=${encodeURIComponent(vehicleId)}`;
        };

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
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const vehicleId = btn.dataset.vehicleId;
                openVehicleDetails(vehicleId);
            });
        });

        // Book now buttons
        document.querySelectorAll(".book-vehicle").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();

                if (
                    window.VehicleAuthUI &&
                    typeof window.VehicleAuthUI.requireBookingAccess === "function" &&
                    !window.VehicleAuthUI.requireBookingAccess({
                        message: "Please register or sign in before booking a vehicle. Redirecting to registration...",
                        autoRedirect: true,
                        delayMs: 700,
                    })
                ) {
                    return;
                }

                const vehicleId = btn.dataset.vehicleId;
                // Navigate to booking page with vehicle pre-selected
                window.location.href = `booking.html?vehicle=${vehicleId}`;
            });
        });

        // Whole card click and keyboard support
        document.querySelectorAll(".vehicle-result-card[data-vehicle-id]").forEach((card) => {
            card.addEventListener("click", (e) => {
                if (e.target.closest(".wishlist-icon, .view-details, .book-vehicle")) {
                    return;
                }

                openVehicleDetails(card.dataset.vehicleId);
            });

            card.addEventListener("keydown", (e) => {
                if (e.target.closest(".wishlist-icon, .view-details, .book-vehicle")) {
                    return;
                }

                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openVehicleDetails(card.dataset.vehicleId);
                }
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
                <article class="overflow-hidden rounded-[24px] border border-[#d4ddd7] bg-[linear-gradient(165deg,#ffffff,#f8f3ea)] shadow-[0_12px_24px_rgba(10,31,34,0.08)]">
                    <div class="h-[230px] animate-pulse bg-gradient-to-r from-[#ecf2ef] via-[#f8fbfa] to-[#ecf2ef]"></div>
                    <div class="space-y-3 p-5">
                        <div class="h-5 w-[55%] animate-pulse rounded-full bg-[#edf3f0]"></div>
                        <div class="h-3 w-[42%] animate-pulse rounded-full bg-[#edf3f0]"></div>
                        <div class="grid grid-cols-2 gap-2 pt-1">
                            <div class="h-10 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                            <div class="h-10 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                            <div class="h-10 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                            <div class="h-10 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                        </div>
                        <div class="h-10 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="h-11 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                            <div class="h-11 animate-pulse rounded-xl bg-[#edf3f0]"></div>
                        </div>
                    </div>
                </article>
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

function formatNpr(value) {
    const amount = Number(value || 0);
    const normalized = Number.isFinite(amount) ? amount : 0;
    return `NPR ${Math.round(normalized).toLocaleString()}`;
}
