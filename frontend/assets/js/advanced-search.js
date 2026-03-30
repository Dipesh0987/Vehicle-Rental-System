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
        this.vehicles = [];
        this.isInitialized = false;
        this.unsubscribeCatalogSync = null;
        this.vehicleCacheKey = "vrs:search:vehicles:cache:v1";
        this.catalogVersionKey = "vrs:vehicle-catalog-version";
        this.vehicleCacheTTL = 3 * 60 * 1000;
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

        if (this.uiManager && typeof this.uiManager.showReloadStatus === "function") {
            this.uiManager.showReloadStatus("Syncing latest vehicles...");
        }

        try {
            const fresh = await this.catalogService.listVehiclesForSearch();
            if (!Array.isArray(fresh)) {
                return;
            }

            this.writeVehicleCache(fresh);
            this.vehicles = fresh;

            if (this.isInitialized) {
                const filtered = this.filterManager.applyFilters(this.vehicles);
                this.uiManager.renderVehicleResults(filtered);
            }
        } catch (_error) {
            // Keep existing list when background refresh fails.
        } finally {
            if (this.uiManager && typeof this.uiManager.hideReloadStatus === "function") {
                this.uiManager.hideReloadStatus();
            }
        }
    }

    /**
     * Use local /api fallback only when explicitly enabled.
     */
    shouldUseHttpApiFallback() {
        return window.SEARCH_API_ENABLED === true;
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

            // Render UI components
            this.uiManager.renderFilterPanel();
            this.uiManager.renderVehicleResults(this.vehicles);

            // Setup event listeners
            this.setupEventListeners();

            // Restore filter state if exists
            this.filterManager.restoreState();

            // Update wishlist count
            window.SearchWishlist.updateWishlistCount();

            this.isInitialized = true;
            console.log("Advanced Search System initialized successfully");
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

        // Quick filters
        this.setupQuickFilters();

        // Sort dropdown
        this.setupSorting();

        // Clear filters button
        this.setupClearFilters();

        // Mobile filter button
        this.setupMobileFilters();

        // Reset search button
        this.setupResetButton();

        // Filter changes
        this.filterManager.onFilterChange(() => {
            const filtered = this.filterManager.applyFilters(this.vehicles);
            this.uiManager.renderVehicleResults(filtered);
            this.filterManager.saveState();
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

        if (this.uiManager && typeof this.uiManager.showReloadStatus === "function") {
            this.uiManager.showReloadStatus("Refreshing catalog data...");
        }

        try {
            const catalogVehicles = await this.catalogService.listVehiclesForSearch();
            if (!Array.isArray(catalogVehicles)) {
                return;
            }

            this.vehicles = catalogVehicles;
            this.writeVehicleCache(this.vehicles);
            const filtered = this.filterManager.applyFilters(this.vehicles);
            this.uiManager.renderVehicleResults(filtered);
        } catch (error) {
            console.warn("Failed to refresh vehicles from catalog service:", error);
        } finally {
            if (this.uiManager && typeof this.uiManager.hideReloadStatus === "function") {
                this.uiManager.hideReloadStatus();
            }
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

        // Location autocomplete
        if (pickupLocation) {
            pickupLocation.addEventListener("input", (e) => {
                this.apiClient.debounce("pickupSearch", () => {
                    this.filterManager.updateFilter("pickupLocation", e.target.value);
                }, 300);
            });
        }

        if (dropoffLocation) {
            dropoffLocation.addEventListener("input", (e) => {
                this.apiClient.debounce("dropoffSearch", () => {
                    this.filterManager.updateFilter("dropoffLocation", e.target.value);
                }, 300);
            });
        }

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
                this.performSearch();
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
                    maxPrice: 80,
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
                    minPrice: 150,
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
                this.uiManager.renderFilterPanel();
                this.uiManager.updateActiveFilterTags();

                // Reset search inputs
                document.getElementById("pickupLocation").value = "";
                document.getElementById("dropoffLocation").value = "";
                document.getElementById("pickupDateTime").value = "";
                document.getElementById("dropoffDateTime").value = "";

                // Remove quick filter active state
                document.querySelectorAll(".quick-filter-btn").forEach((btn) => {
                    btn.classList.remove("bg-accent", "text-white", "border-accent", "shadow-[0_8px_16px_rgba(229,140,78,0.28)]");
                    btn.classList.add("bg-white", "text-ink", "border-[#d4ded9]");
                });

                // Filter with empty criteria
                const filtered = this.filterManager.applyFilters(this.vehicles);
                this.uiManager.renderVehicleResults(filtered);
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
                this.uiManager.renderFilterPanel();
                this.uiManager.updateActiveFilterTags();
                const filtered = this.filterManager.applyFilters(this.vehicles);
                this.uiManager.renderVehicleResults(filtered);
            });
        }
    }

    /**
     * Perform search with current filters
     */
    performSearch() {
        console.log("Searching with filters:", this.filterManager.filters);

        if (this.uiManager && typeof this.uiManager.showReloadStatus === "function") {
            this.uiManager.showReloadStatus("Refining results...");
        }

        if (this.uiManager && typeof this.uiManager.showLoadingSkeleton === "function") {
            this.uiManager.showLoadingSkeleton();
        }

        window.setTimeout(() => {
            const filtered = this.filterManager.applyFilters(this.vehicles);
            this.uiManager.renderVehicleResults(filtered);

            if (this.uiManager && typeof this.uiManager.hideReloadStatus === "function") {
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
