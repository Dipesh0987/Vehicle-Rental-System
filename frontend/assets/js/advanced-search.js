/**
 * Advanced Search System - Main Initialization
 * Coordinates all modules and handles the complete search workflow
 */

class AdvancedSearchSystem {
    constructor() {
        this.apiClient = new SearchAPIClient();
        this.filterManager = new SearchFilterManager();
        this.uiManager = new SearchUIManager(this.filterManager, this.apiClient);
        this.analytics = new window.SearchAnalytics();
        this.locationAutocomplete = new window.LocationAutocomplete(this.apiClient);
        this.pricingCalculator = new window.PricingCalculator();
        this.catalogService = window.VehicleCatalogService || null;
        this.bookingService = window.VehicleBookingService || null;
        this.vehicles = [];
        this.isInitialized = false;
        this.unsubscribeCatalogSync = null;
        this.vehicleCacheKey = "vrs:search:vehicles:cache:v2";
        this.catalogVersionKey = "vrs:vehicle-catalog-version";
        this.homeSearchPrefillKey = "vrs:home-hero-search-prefill:v1";
        this.vehicleCacheTTL = 3 * 60 * 1000;
        this.lastDateFilterKey = "";
        this.lastAvailabilityRangeKey = "";
        this.availabilityRequestId = 0;
    }

    normalizeString(value, fallback = "") {
        if (value === null || value === undefined) {
            return fallback;
        }

        const text = String(value).trim();
        return text || fallback;
    }

    canonicalizeVehicleType(value) {
        const text = this.normalizeString(value, "").toLowerCase();
        if (!text) {
            return "";
        }

        if (text === "suv" || text.includes("sport utility") || text.includes("jeep")) {
            return "suv";
        }

        if (text === "sedan") {
            return "sedan";
        }

        if (text === "luxury" || text.includes("premium")) {
            return "luxury";
        }

        if (text === "van" || text.includes("mini van") || text.includes("minivan")) {
            return "van";
        }

        if (text === "economy" || text === "compact" || text === "hatchback" || text === "city") {
            return "economy";
        }

        return text;
    }

    readHomeSearchPrefillFromQuery() {
        try {
            const params = new URLSearchParams(window.location.search || "");
            const vehicleType = this.canonicalizeVehicleType(params.get("vehicleType"));
            const pickupLocation = this.normalizeString(params.get("pickupLocation"), "");
            const pickupDateTime = this.normalizeString(params.get("pickupDateTime"), "");
            const dropoffDateTime = this.normalizeString(params.get("dropoffDateTime"), "");

            if (!vehicleType && !pickupLocation && !pickupDateTime && !dropoffDateTime) {
                return null;
            }

            return {
                source: "query",
                vehicleType,
                pickupLocation,
                pickupDateTime,
                dropoffDateTime,
            };
        } catch (_error) {
            return null;
        }
    }

    consumeHomeSearchPrefillFromSession() {
        try {
            const raw = sessionStorage.getItem(this.homeSearchPrefillKey);
            if (!raw) {
                return null;
            }

            sessionStorage.removeItem(this.homeSearchPrefillKey);
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                return null;
            }

            return {
                source: this.normalizeString(parsed.source, "session"),
                vehicleType: this.canonicalizeVehicleType(parsed.vehicleType),
                pickupLocation: this.normalizeString(parsed.pickupLocation, ""),
                pickupDateTime: this.normalizeString(parsed.pickupDateTime, ""),
                dropoffDateTime: this.normalizeString(parsed.dropoffDateTime, ""),
            };
        } catch (_error) {
            return null;
        }
    }

    readHomeSearchPrefill() {
        const queryPayload = this.readHomeSearchPrefillFromQuery();
        if (queryPayload) {
            return queryPayload;
        }

        return this.consumeHomeSearchPrefillFromSession();
    }

    clearHomeSearchQueryFromUrl() {
        try {
            const url = new URL(window.location.href);
            const keys = ["vehicleType", "pickupLocation", "pickupDateTime", "dropoffDateTime"];
            let changed = false;

            keys.forEach((key) => {
                if (url.searchParams.has(key)) {
                    url.searchParams.delete(key);
                    changed = true;
                }
            });

            if (!changed) {
                return;
            }

            const nextUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
            window.history.replaceState({}, "", nextUrl);
        } catch (_error) {
            // Ignore URL rewrite failures.
        }
    }

    async applyHomeSearchPrefill(payload) {
        if (!payload) {
            return false;
        }

        const vehicleType = this.canonicalizeVehicleType(payload.vehicleType);
        const pickupLocation = this.normalizeString(payload.pickupLocation, "");
        const pickupDateTime = this.normalizeString(payload.pickupDateTime, "");
        const dropoffDateTime = this.normalizeString(payload.dropoffDateTime, "");

        if (!vehicleType && !pickupLocation && !pickupDateTime && !dropoffDateTime) {
            return false;
        }

        const update = {
            pickupDateTime,
            dropoffDateTime,
        };

        if (vehicleType) {
            update.vehicleTypes = [vehicleType];
        }

        this.filterManager.updateFilters(update);

        const pickupLocationInput = document.getElementById("pickupLocation");
        const dropoffLocationInput = document.getElementById("dropoffLocation");
        const pickupDateTimeInput = document.getElementById("pickupDateTime");
        const dropoffDateTimeInput = document.getElementById("dropoffDateTime");

        if (pickupLocationInput) {
            pickupLocationInput.value = pickupLocation;
        }
        if (dropoffLocationInput) {
            dropoffLocationInput.value = pickupLocation;
        }
        if (pickupDateTimeInput && pickupDateTime) {
            pickupDateTimeInput.value = pickupDateTime;
        }
        if (dropoffDateTimeInput && dropoffDateTime) {
            dropoffDateTimeInput.value = dropoffDateTime;
        }

        this.uiManager.renderFilterPanel();
        this.uiManager.updateActiveFilterTags();

        this.lastDateFilterKey = this.buildDateFilterKey();
        await this.performSearch();
        this.filterManager.saveState();
        this.clearHomeSearchQueryFromUrl();

        return true;
    }

    readCatalogVersion() {
        try {
            const raw = localStorage.getItem(this.catalogVersionKey);
            const numeric = Number(raw || 0);
            return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
        } catch (_error) {
            return 0;
        }
    }

    readVehicleCache() {
        try {
            const raw = localStorage.getItem(this.vehicleCacheKey);
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            const timestamp = Number(parsed?.timestamp || 0);
            const rows = Array.isArray(parsed?.vehicles) ? parsed.vehicles : [];
            if (!rows.length) return [];

            if (!Number.isFinite(timestamp) || Date.now() - timestamp > this.vehicleCacheTTL) {
                return [];
            }

            const latestCatalogVersion = this.readCatalogVersion();
            if (latestCatalogVersion > 0 && timestamp < latestCatalogVersion) {
                return [];
            }

            return rows;
        } catch (_error) {
            return [];
        }
    }

    writeVehicleCache(rows) {
        if (!Array.isArray(rows)) {
            return;
        }

        try {
            if (!rows.length) {
                localStorage.removeItem(this.vehicleCacheKey);
                return;
            }

            localStorage.setItem(
                this.vehicleCacheKey,
                JSON.stringify({
                    timestamp: Date.now(),
                    vehicles: rows,
                })
            );
        } catch (_error) {
            // Ignore localStorage failures.
        }
    }

    async refreshCatalogVehiclesInBackground() {
        if (!this.catalogService || typeof this.catalogService.listVehiclesForSearch !== "function") {
            return;
        }

        try {
            const fresh = await this.catalogService.listVehiclesForSearch();
            if (!Array.isArray(fresh)) {
                return;
            }

            this.writeVehicleCache(fresh);
            this.vehicles = fresh;

            if (this.isInitialized) {
                this.applyFiltersAndRender();
            }
        } catch (_error) {
            // Keep existing list when background refresh fails.
        }
    }

    /**
     * Use local /api fallback only when explicitly enabled.
     */
    shouldUseHttpApiFallback() {
        return window.SEARCH_API_ENABLED === true;
    }

    buildDateFilterKey() {
        const pickup = String(this.filterManager?.filters?.pickupDateTime || "").trim();
        const dropoff = String(this.filterManager?.filters?.dropoffDateTime || "").trim();
        return `${pickup}::${dropoff}`;
    }

    toIsoDateText(value) {
        const text = String(value || "").trim();
        if (!text) {
            return "";
        }

        return text.split("T")[0] || "";
    }

    parseLocalDateTime(value) {
        const text = String(value || "").trim();
        if (!text) {
            return null;
        }

        const parsed = new Date(text);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return parsed;
    }

    getDateRangeContext() {
        const pickupRaw = String(this.filterManager?.filters?.pickupDateTime || "").trim();
        const dropoffRaw = String(this.filterManager?.filters?.dropoffDateTime || "").trim();

        if (!pickupRaw && !dropoffRaw) {
            return {
                hasRange: false,
                valid: true,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "",
            };
        }

        if (!pickupRaw || !dropoffRaw) {
            return {
                hasRange: true,
                valid: false,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "Select both pickup and return dates.",
            };
        }

        const pickupDateTime = this.parseLocalDateTime(pickupRaw);
        const dropoffDateTime = this.parseLocalDateTime(dropoffRaw);

        if (!pickupDateTime || !dropoffDateTime) {
            return {
                hasRange: true,
                valid: false,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "Please provide valid pickup and return dates.",
            };
        }

        const now = new Date();
        if (pickupDateTime <= now || dropoffDateTime <= now) {
            return {
                hasRange: true,
                valid: false,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "Pickup and return dates must be in the future.",
            };
        }

        if (dropoffDateTime < pickupDateTime) {
            return {
                hasRange: true,
                valid: false,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "Return date must be after pickup date.",
            };
        }

        const startDate = this.toIsoDateText(pickupRaw);
        const endDate = this.toIsoDateText(dropoffRaw);

        if (!startDate || !endDate) {
            return {
                hasRange: true,
                valid: false,
                rangeKey: "",
                startDate: "",
                endDate: "",
                message: "Please provide valid pickup and return dates.",
            };
        }

        return {
            hasRange: true,
            valid: true,
            rangeKey: `${startDate}::${endDate}`,
            startDate,
            endDate,
            message: "",
        };
    }

    formatLocalDateTimeForInput(value) {
        const date = value instanceof Date ? value : new Date();
        const normalized = new Date(date.getTime());
        normalized.setSeconds(0, 0);
        const yyyy = normalized.getFullYear();
        const mm = String(normalized.getMonth() + 1).padStart(2, "0");
        const dd = String(normalized.getDate()).padStart(2, "0");
        const hh = String(normalized.getHours()).padStart(2, "0");
        const min = String(normalized.getMinutes()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    applyDateInputConstraints(pickupInput, dropoffInput) {
        if (!pickupInput && !dropoffInput) {
            return;
        }

        const refreshMin = () => {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            const minNow = this.formatLocalDateTimeForInput(now);

            if (pickupInput) {
                pickupInput.min = minNow;
            }

            if (dropoffInput) {
                const pickupValue = pickupInput ? String(pickupInput.value || "").trim() : "";
                dropoffInput.min = pickupValue || minNow;

                if (pickupValue && dropoffInput.value && dropoffInput.value < pickupValue) {
                    dropoffInput.value = pickupValue;
                    this.filterManager.updateFilter("dropoffDateTime", pickupValue);
                }
            }
        };

        refreshMin();

        [pickupInput, dropoffInput].forEach((input) => {
            if (!input) {
                return;
            }

            input.addEventListener("focus", refreshMin);
            input.addEventListener("input", refreshMin);
            input.addEventListener("change", refreshMin);
        });
    }

    async refreshDateAvailabilitySnapshot(options = {}) {
        const context = this.getDateRangeContext();
        const quiet = Boolean(options.quiet);
        const force = Boolean(options.force);

        if (!context.hasRange) {
            this.filterManager.clearDateAvailability();
            this.lastAvailabilityRangeKey = "";
            if (!quiet && this.uiManager?.hideReloadStatus) {
                this.uiManager.hideReloadStatus();
            }
            return { applied: false, reason: "no-range" };
        }

        if (!context.valid) {
            this.filterManager.clearDateAvailability();
            this.lastAvailabilityRangeKey = "";
            if (this.uiManager?.showReloadStatus) {
                this.uiManager.showReloadStatus(context.message);
            }
            return { applied: false, reason: "invalid-range", message: context.message };
        }

        if (!force && context.rangeKey === this.lastAvailabilityRangeKey && this.filterManager?.dateAvailability?.active) {
            return { applied: true, reason: "cached" };
        }

        if (!this.bookingService || typeof this.bookingService.listBookings !== "function") {
            this.filterManager.clearDateAvailability();
            this.lastAvailabilityRangeKey = "";
            if (this.uiManager?.showReloadStatus) {
                this.uiManager.showReloadStatus("Availability service is currently unavailable.");
            }
            return { applied: false, reason: "booking-service-unavailable" };
        }

        const requestId = this.availabilityRequestId + 1;
        this.availabilityRequestId = requestId;

        if (!quiet && this.uiManager?.showReloadStatus) {
            this.uiManager.showReloadStatus("Checking vehicle availability for selected dates...");
        }

        try {
            const rows = await this.bookingService.listBookings({
                rangeStart: context.startDate,
                rangeEnd: context.endDate,
            });

            if (requestId !== this.availabilityRequestId) {
                return { applied: false, reason: "stale-request" };
            }

            const activeStatuses = Array.isArray(this.bookingService.activeStatuses) && this.bookingService.activeStatuses.length
                ? this.bookingService.activeStatuses.map((status) => String(status || "").toLowerCase())
                : ["pending", "confirmed"];

            const unavailableVehicleIds = new Set();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const status = String(row && row.status ? row.status : "").toLowerCase();
                if (!activeStatuses.includes(status)) {
                    return;
                }

                const vehicleId = String(row && row.vehicleId ? row.vehicleId : "").trim();
                if (vehicleId) {
                    unavailableVehicleIds.add(vehicleId);
                }
            });

            this.filterManager.setDateAvailability({
                startDate: context.startDate,
                endDate: context.endDate,
                unavailableVehicleIds,
            });
            this.lastAvailabilityRangeKey = context.rangeKey;

            if (this.uiManager?.showReloadStatus) {
                const blockedCount = unavailableVehicleIds.size;
                const message = blockedCount
                    ? `Hiding ${blockedCount} booked vehicle${blockedCount === 1 ? "" : "s"} for selected dates.`
                    : "All listed vehicles are available for selected dates.";
                this.uiManager.showReloadStatus(message);
            }

            return { applied: true, reason: "fetched" };
        } catch (error) {
            if (requestId !== this.availabilityRequestId) {
                return { applied: false, reason: "stale-request" };
            }

            console.warn("Failed to evaluate booking availability for search dates (non-blocking):", error);
            // Silently clear availability so vehicles still show even if booking table has missing columns
            this.filterManager.clearDateAvailability();
            this.lastAvailabilityRangeKey = "";
            return { applied: false, reason: "fetch-error" };
        }
    }

    applyFiltersAndRender(options = {}) {
        const shouldPersist = Boolean(options.persist);
        const filtered = this.filterManager.applyFilters(this.vehicles);
        this.uiManager.renderVehicleResults(filtered);

        if (shouldPersist) {
            this.filterManager.saveState();
        }

        return filtered;
    }


    /**
     * Initialize the entire search system
     */
    async init() {
        try {
            // Show loading skeleton
            this.uiManager.showLoadingSkeleton();

            // Load vehicles (from test data or API)
            await this.loadVehicles();

            // Restore saved filters before first paint to avoid showing unfiltered
            // vehicles briefly and then replacing them with restored results.
            this.filterManager.restoreState();

            // If restored state includes dates, refresh availability before initial render.
            const restoredPickupDateTime = String(this.filterManager?.filters?.pickupDateTime || "").trim();
            const restoredDropoffDateTime = String(this.filterManager?.filters?.dropoffDateTime || "").trim();
            if (restoredPickupDateTime || restoredDropoffDateTime) {
                await this.refreshDateAvailabilitySnapshot({ force: true, quiet: true });
            }

            // Render UI components
            this.applyFiltersAndRender();
            this.uiManager.renderFilterPanel();

            // Setup event listeners
            this.setupEventListeners();

            // Apply homepage booking prefill if user arrived from home hero search flow.
            const homePrefill = this.readHomeSearchPrefill();
            if (homePrefill) {
                await this.applyHomeSearchPrefill(homePrefill);
            }

            // Update wishlist count
            window.SearchWishlist.updateWishlistCount();

            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize search system:", error);
            this.handleInitError();
        }
    }


    /**
     * Load vehicles from API or cache
     */
    async loadVehicles() {
        const cachedVehicles = this.readVehicleCache();
        let catalogFailed = false;
        const hasCatalogService = this.catalogService && typeof this.catalogService.listVehiclesForSearch === "function";

        // Preferred source: Supabase-backed catalog service
        if (hasCatalogService) {
            if (cachedVehicles.length) {
                this.vehicles = cachedVehicles;
            }

            try {
                const catalogVehicles = await this.catalogService.listVehiclesForSearch();
                if (Array.isArray(catalogVehicles)) {
                    this.vehicles = catalogVehicles;
                    this.writeVehicleCache(this.vehicles);
                    return;
                }

                catalogFailed = true;
            } catch (error) {
                catalogFailed = true;
                console.warn("Failed to load vehicles from catalog service:", error);
            }

            if (cachedVehicles.length) {
                return;
            }
        } else if (cachedVehicles.length) {
            this.vehicles = cachedVehicles;
            return;
        }

        // In static setups, avoid /api fallback unless explicitly enabled.
        if (!this.shouldUseHttpApiFallback()) {
            if (catalogFailed) {
                console.warn("HTTP API fallback disabled and catalog load failed.");
            }
            this.vehicles = [];
            return;
        }

        // Otherwise try to load from API
        try {
            const response = await this.apiClient.searchVehicles({});
            this.vehicles = response.vehicles || [];
            this.writeVehicleCache(this.vehicles);
        } catch (error) {
            console.warn("Failed to load vehicles from API:", error);
            this.vehicles = [];
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Search bar
        this.setupSearchBar();

        // Sort dropdown
        this.setupSorting();

        // Clear filters button
        this.setupClearFilters();

        // Mobile filter button
        this.setupMobileFilters();

        // Reset search button
        this.setupResetButton();

        // Filter changes
        this.filterManager.onFilterChange(async () => {
            const nextDateFilterKey = this.buildDateFilterKey();
            const hasDateChange = nextDateFilterKey !== this.lastDateFilterKey;

            this.lastDateFilterKey = nextDateFilterKey;

            if (hasDateChange) {
                await this.refreshDateAvailabilitySnapshot();
            }

            this.applyFiltersAndRender({ persist: true });
        });

        // Wishlist changes
        window.SearchWishlist.onWishlistChange(() => {
            if (this.filterManager.filteredVehicles.length > 0) {
                this.uiManager.renderVehicleResults(this.filterManager.filteredVehicles);
            }
        });

        this.setupCatalogSync();
    }

    /**
     * Keep search results in sync with admin catalog changes.
     */
    setupCatalogSync() {
        if (!this.catalogService || typeof this.catalogService.subscribeToVehicleCatalogChanges !== "function") {
            return;
        }

        if (this.unsubscribeCatalogSync) {
            this.unsubscribeCatalogSync();
            this.unsubscribeCatalogSync = null;
        }

        this.unsubscribeCatalogSync = this.catalogService.subscribeToVehicleCatalogChanges(async () => {
            await this.reloadVehiclesFromCatalog();
        });
    }

    /**
     * Reload from catalog and preserve current filter context.
     */
    async reloadVehiclesFromCatalog() {
        if (!this.catalogService || typeof this.catalogService.listVehiclesForSearch !== "function") {
            return;
        }

        try {
            const catalogVehicles = await this.catalogService.listVehiclesForSearch();
            if (!Array.isArray(catalogVehicles)) {
                return;
            }

            this.vehicles = catalogVehicles;
            this.writeVehicleCache(this.vehicles);
            
            // Re-render filter panel to update dynamic brand options
            this.uiManager.renderFilterPanel();
            
            this.applyFiltersAndRender();
        } catch (error) {
            console.warn("Failed to refresh vehicles from catalog service:", error);
        }
    }

    /**
     * Setup search bar listeners
     */
    setupSearchBar() {
        const pickupLocation = document.getElementById("pickupLocation");
        const dropoffLocation = document.getElementById("dropoffLocation");
        const pickupDateTime = document.getElementById("pickupDateTime");
        const dropoffDateTime = document.getElementById("dropoffDateTime");
        const searchBtn = document.getElementById("searchBtn");

        this.applyDateInputConstraints(pickupDateTime, dropoffDateTime);

        // Location fields are display-only, they do NOT filter vehicles
        // No event listeners needed for pickupLocation / dropoffLocation

        // Date/time changes
        if (pickupDateTime) {
            pickupDateTime.addEventListener("change", (e) => {
                this.filterManager.updateFilter("pickupDateTime", e.target.value);
            });
        }

        if (dropoffDateTime) {
            dropoffDateTime.addEventListener("change", (e) => {
                this.filterManager.updateFilter("dropoffDateTime", e.target.value);
            });
        }

        // Search button
        if (searchBtn) {
            searchBtn.addEventListener("click", () => {
                void this.performSearch();
            });
        }
    }

    /**
     * Setup quick filter buttons
     */
    setupQuickFilters() {
        const quickFilterBtns = document.querySelectorAll(".quick-filter-btn");

        const setQuickFilterButtonState = (btn, isActive) => {
            btn.classList.toggle("bg-accent", isActive);
            btn.classList.toggle("text-white", isActive);
            btn.classList.toggle("border-accent", isActive);
            btn.classList.toggle("shadow-[0_8px_16px_rgba(229,140,78,0.28)]", isActive);
            btn.classList.toggle("text-ink", !isActive);
            btn.classList.toggle("bg-white", !isActive);
            btn.classList.toggle("border-[#d4ded9]", !isActive);
        };

        quickFilterBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                const preset = btn.dataset.preset;

                // Remove active state from all buttons
                quickFilterBtns.forEach((b) => setQuickFilterButtonState(b, false));

                // Add active state to clicked button
                setQuickFilterButtonState(btn, true);

                // Apply preset filters
                this.applyQuickFilter(preset);
            });
        });
    }

    /**
     * Apply quick filter preset
     */
    applyQuickFilter(preset) {
        switch (preset) {
            case "budget":
                this.filterManager.updateFilters({
                    minPrice: 0,
                    maxPrice: 7000,
                    vehicleTypes: ["economy"],
                });
                break;

            case "family":
                this.filterManager.updateFilters({
                    minSeats: 6,
                    features: ["child-seat"],
                });
                break;

            case "luxury":
                this.filterManager.updateFilters({
                    minPrice: 12000,
                    maxPrice: 50000,
                    vehicleTypes: ["luxury"],
                    minRating: 4.5,
                });
                break;

            case "eco":
                this.filterManager.updateFilters({
                    fuelTypes: ["electric", "hybrid"],
                });
                break;
        }

        this.uiManager.updateActiveFilterTags();
    }

    /**
     * Setup sorting dropdown
     */
    setupSorting() {
        const sortDropdown = document.getElementById("sortBy");

        if (sortDropdown) {
            sortDropdown.addEventListener("change", (e) => {
                this.filterManager.setSortOrder(e.target.value);
                this.uiManager.renderVehicleResults(this.filterManager.filteredVehicles);
            });
        }
    }

    /**
     * Setup clear filters button
     */
    setupClearFilters() {
        const clearBtn = document.getElementById("clearFiltersBtn");

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                this.filterManager.clearAllFilters();
                this.filterManager.setSortOrder("relevance");
                this.uiManager.renderFilterPanel();
                this.uiManager.updateActiveFilterTags();

                // Reset sort dropdown
                const sortEl = document.getElementById("sortBy");
                if (sortEl) sortEl.value = "relevance";

                // Reset search inputs
                const pLoc = document.getElementById("pickupLocation");
                const dLoc = document.getElementById("dropoffLocation");
                const pDt = document.getElementById("pickupDateTime");
                const dDt = document.getElementById("dropoffDateTime");
                if (pLoc) pLoc.value = "";
                if (dLoc) dLoc.value = "";
                if (pDt) pDt.value = "";
                if (dDt) dDt.value = "";

                // Remove quick filter active state
                document.querySelectorAll(".quick-filter-btn").forEach((btn) => {
                    btn.classList.remove("bg-accent", "text-white", "border-accent", "shadow-[0_8px_16px_rgba(229,140,78,0.28)]");
                    btn.classList.add("bg-white", "text-ink", "border-[#d4ded9]");
                });

                // Filter with empty criteria
                this.lastDateFilterKey = this.buildDateFilterKey();
                this.applyFiltersAndRender();
            });
        }
    }

    /**
     * Setup mobile filter toggle
     */
    setupMobileFilters() {
        // Mobile filter modal interactions are handled in mobile-filter-modal.js.
    }

    /**
     * Setup reset button
     */
    setupResetButton() {
        const resetBtn = document.getElementById("resetSearchBtn");

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                this.filterManager.clearAllFilters();
                this.filterManager.setSortOrder("relevance");
                this.uiManager.renderFilterPanel();
                this.uiManager.updateActiveFilterTags();
                const sortEl = document.getElementById("sortBy");
                if (sortEl) sortEl.value = "relevance";
                this.lastDateFilterKey = this.buildDateFilterKey();
                this.applyFiltersAndRender();
            });
        }
    }

    /**
     * Perform search with current filters
     */
    async performSearch() {

        if (this.uiManager && typeof this.uiManager.showReloadStatus === "function") {
            this.uiManager.showReloadStatus("Refining results...");
        }

        if (this.uiManager && typeof this.uiManager.showLoadingSkeleton === "function") {
            this.uiManager.showLoadingSkeleton();
        }

        const availabilityState = await this.refreshDateAvailabilitySnapshot({ force: true, quiet: true });

        window.setTimeout(() => {
            this.applyFiltersAndRender();

            const shouldKeepStatusVisible =
                availabilityState &&
                ["invalid-range", "booking-service-unavailable", "fetch-error"].includes(availabilityState.reason);

            if (!shouldKeepStatusVisible && this.uiManager && typeof this.uiManager.hideReloadStatus === "function") {
                this.uiManager.hideReloadStatus();
            }
        }, 260);
    }

    /**
     * Handle initialization errors
     */
    handleInitError() {
        const resultsDiv = document.getElementById("vehicleResults");
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="text-center py-16 col-span-full">
                    <i class="fas fa-exclamation-circle text-6xl text-red-500 mb-4"></i>
                    <h3 class="text-2xl font-bold text-ink mb-2">Error Loading Search</h3>
                    <p class="text-muted mb-6">Please refresh the page and try again</p>
                    <button onclick="location.reload()" class="bg-accent text-white px-6 py-3 rounded-full font-semibold hover:brightness-110 transition">
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    /**
     * Get search statistics
     */
    getStats() {
        return {
            totalVehicles: this.vehicles.length,
            filteredVehicles: this.filterManager.filteredVehicles.length,
            activeFilters: Object.keys(this.filterManager.getActiveFilters()).length,
            wishlisted: window.SearchWishlist.getCount(),
        };
    }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", async () => {
    window.AdvancedSearch = new AdvancedSearchSystem();
    await window.AdvancedSearch.init();
});
