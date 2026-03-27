/**
 * Advanced Search System - Main Initialization
 * Coordinates all modules and handles the complete search workflow
 */

class AdvancedSearchSystem {
    constructor() {
        this.apiClient = new SearchAPIClient();
        this.filterManager = new SearchFilterManager();
        this.uiManager = new SearchUIManager(this.filterManager, this.apiClient);
        this.vehicles = [];
        this.isInitialized = false;

        // For testing: use vehicle data if available (from vehicle-details.js)
        if (window.VehicleDetailsData) {
            this.loadTestData();
        }
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
     * Load test vehicle data from window.VehicleDetailsData
     */
    loadTestData() {
        if (!window.VehicleDetailsData) return;

        this.vehicles = Object.values(window.VehicleDetailsData).map((vehicle) => ({
            id: vehicle.id,
            brand: vehicle.brand,
            name: vehicle.name,
            type: this.inferVehicleType(vehicle.meta),
            transmission: this.extractInfo(vehicle.meta, "Automatic|Manual") || "Automatic",
            fuelType: this.extractInfo(vehicle.meta, "Petrol|Diesel|Hybrid|Electric") || "Petrol",
            seats: this.extractInfo(vehicle.meta, "\\d+\\s+Seats") ? parseInt(this.extractInfo(vehicle.meta, "\\d+")) : 5,
            rating: parseFloat(Math.random() * 2 + 3.5).toFixed(1),
            location: "New York, USA",
            available: true,
            availability: "Available",
            pricing: vehicle.pricing,
            features: [
                "Air Conditioning",
                "GPS Navigation",
                "Bluetooth",
                vehicle.meta.includes("Automatic") ? "Reverse Camera" : null,
                Math.random() > 0.5 ? "Child Seat" : null,
            ].filter(Boolean),
            insuranceOptions: ["Basic Coverage", "Premium Coverage"],
            driverOptions: ["Self-Drive", "With Driver"],
            mileagePolicy: ["Unlimited"],
            included: vehicle.included,
            badges: vehicle.badges,
            description: vehicle.tagline,
        }));
    }

    /**
     * Infer vehicle type from metadata
     */
    inferVehicleType(meta) {
        if (meta.includes("SUV")) return "suv";
        if (meta.includes("Van")) return "van";
        if (meta.includes("Luxury")) return "luxury";
        if (meta.includes("Sedan")) return "sedan";
        return "economy";
    }

    /**
     * Extract info from meta string using regex
     */
    extractInfo(meta, pattern) {
        const regex = new RegExp(pattern, "i");
        const match = meta.match(regex);
        return match ? match[0] : null;
    }

    /**
     * Load vehicles from API or cache
     */
    async loadVehicles() {
        // If we have test data, use it
        if (this.vehicles.length > 0) {
            return;
        }

        // Otherwise try to load from API
        try {
            const response = await this.apiClient.searchVehicles({});
            this.vehicles = response.vehicles || [];
        } catch (error) {
            console.warn("Failed to load vehicles from API, using test data");
            this.loadTestData();
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

        quickFilterBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                const preset = btn.dataset.preset;

                // Remove active state from all buttons
                quickFilterBtns.forEach((b) => b.classList.remove("active"));

                // Add active state to clicked button
                btn.classList.add("active");

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
                    btn.classList.remove("active");
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
        const mobileFilterBtn = document.getElementById("mobileFilterBtn");
        const filterPanel = document.getElementById("filterPanel");

        if (mobileFilterBtn && filterPanel) {
            mobileFilterBtn.addEventListener("click", () => {
                // On mobile, we need to create a modal filter panel
                const isVisible = filterPanel.style.display !== "none";
                filterPanel.style.display = isVisible ? "none" : "block";

                // Change button appearance
                if (isVisible) {
                    mobileFilterBtn.style.opacity = "0.7";
                } else {
                    mobileFilterBtn.style.opacity = "1";
                }
            });
        }
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
        const filtered = this.filterManager.applyFilters(this.vehicles);
        this.uiManager.renderVehicleResults(filtered);
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
