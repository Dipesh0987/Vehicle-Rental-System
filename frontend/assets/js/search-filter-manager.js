/**
 * Search Filter Manager
 * Handles all filtering logic for the advanced search system
 * Features: Multiple filter criteria, persistence, real-time updates
 */

class SearchFilterManager {
    constructor() {
        this.filters = this.initializeFilters();
        this.filteredVehicles = [];
        this.allVehicles = [];
        this.sortOrder = "relevance";
        this.listeners = new Set();
        this.storageKey = "searchFilters:v2";
    }

    /**
     * Initialize filter state
     */
    initializeFilters() {
        return {
            // Location filters
            pickupLocation: "",
            dropoffLocation: "",
            pickupDateTime: "",
            dropoffDateTime: "",

            // Vehicle type filters
            vehicleTypes: [], // 'economy', 'sedan', 'suv', 'luxury', 'van'
            brands: [],
            models: [],

            // Price filter
            minPrice: 0,
            maxPrice: 100000,

            // Transmission filter
            transmissions: [], // 'manual', 'automatic'

            // Fuel type filter
            fuelTypes: [], // 'petrol', 'diesel', 'electric', 'hybrid'

            // Seating capacity
            minSeats: 1,
            maxSeats: 9,

            // Features/Amenities
            features: [], // 'ac', 'gps', 'bluetooth', 'reverse-camera', 'child-seat'
            minAC: false,
            hasGPS: false,
            hasBluetooth: false,
            hasReverseCamera: false,
            hasChildSeat: false,

            // User rating filter
            minRating: 0, // 0 to 5 stars

            // Availability filter
            availabilityOnly: true,

            // Rental options
            insuranceTypes: [], // 'basic', 'premium', 'comprehensive'
            driverOptions: [], // 'self-drive', 'with-driver'
            mileagePolicy: [], // 'unlimited', 'limited'

            // EV-specific
            minEVRange: 0,

            // Search text
            searchText: "",
        };
    }

    /**
     * Update a single filter
     * @param {string} filterName - Filter name
     * @param {*} value - Filter value
     */
    updateFilter(filterName, value) {
        if (filterName in this.filters) {
            this.filters[filterName] = value;
            this.notifyListeners();
        }
    }

    /**
     * Update multiple filters at once
     * @param {Object} filterUpdates - Filter updates object
     */
    updateFilters(filterUpdates) {
        Object.assign(this.filters, filterUpdates);
        this.notifyListeners();
    }

    /**
     * Toggle array filter (like checkboxes)
     * @param {string} filterName - Filter name
     * @param {string} value - Value to toggle
     */
    toggleFilter(filterName, value) {
        if (Array.isArray(this.filters[filterName])) {
            const index = this.filters[filterName].indexOf(value);
            if (index > -1) {
                this.filters[filterName].splice(index, 1);
            } else {
                this.filters[filterName].push(value);
            }
            this.notifyListeners();
        }
    }

    /**
     * Check if a vehicle matches all filters
     * @param {Object} vehicle - Vehicle object
     * @returns {boolean} True if vehicle matches all filters
     */
    matchesFilters(vehicle) {
        // Location filter
        if (this.filters.pickupLocation) {
            const locationQuery = this.filters.pickupLocation.toLowerCase();
            const locationValue = String(vehicle.location || "").toLowerCase();
            const isGenericLocation = !locationValue || locationValue === "available" || locationValue === "all locations";

            // Keep results visible when records do not carry real location metadata yet.
            if (!isGenericLocation && !locationValue.includes(locationQuery)) {
                return false;
            }
        }

        // Vehicle type filter
        if (
            this.filters.vehicleTypes.length > 0 &&
            !this.filters.vehicleTypes.includes(vehicle.type?.toLowerCase())
        ) {
            return false;
        }

        // Brand filter
        if (
            this.filters.brands.length > 0 &&
            !this.filters.brands.includes(vehicle.brand?.toLowerCase())
        ) {
            return false;
        }

        // Model filter
        if (
            this.filters.models.length > 0 &&
            !this.filters.models.includes(vehicle.name?.toLowerCase())
        ) {
            return false;
        }

        // Price filter
        const price = this.extractPrice(vehicle.pricing?.dailyRate || "0");
        if (price < this.filters.minPrice || price > this.filters.maxPrice) {
            return false;
        }

        // Transmission filter
        if (
            this.filters.transmissions.length > 0 &&
            !this.filters.transmissions.includes(vehicle.transmission?.toLowerCase())
        ) {
            return false;
        }

        // Fuel type filter
        if (
            this.filters.fuelTypes.length > 0 &&
            !this.filters.fuelTypes.includes(vehicle.fuelType?.toLowerCase())
        ) {
            return false;
        }

        // Seating capacity filter
        const seats = parseInt(vehicle.seats || 5);
        if (seats < this.filters.minSeats || seats > this.filters.maxSeats) {
            return false;
        }

        // Features filter
        const vehicleFeatures = (vehicle.features || []).map((f) => f.toLowerCase());
        for (const feature of this.filters.features) {
            if (!vehicleFeatures.includes(feature.toLowerCase())) {
                return false;
            }
        }

        // Rating filter
        const rating = parseFloat(vehicle.rating || 0);
        if (rating < this.filters.minRating) {
            return false;
        }

        // Availability filter
        const availabilityText = String(vehicle.availability || vehicle.status || "").toLowerCase();
        const isAvailableByText = availabilityText === "available" || availabilityText === "active";

        if (
            this.filters.availabilityOnly &&
            vehicle.available !== true &&
            !isAvailableByText
        ) {
            return false;
        }

        // Insurance types filter
        if (this.filters.insuranceTypes.length > 0) {
            const vehicleInsurance = (vehicle.insuranceOptions || []).map((i) => i.toLowerCase());
            const hasInsurance = this.filters.insuranceTypes.some((type) =>
                vehicleInsurance.includes(type.toLowerCase())
            );
            if (!hasInsurance) return false;
        }

        // Driver options filter
        if (this.filters.driverOptions.length > 0) {
            const vehicleDriverOptions = (vehicle.driverOptions || []).map((d) => d.toLowerCase());
            const hasDriverOption = this.filters.driverOptions.some((option) =>
                vehicleDriverOptions.includes(option.toLowerCase())
            );
            if (!hasDriverOption) return false;
        }

        // Mileage policy filter
        if (this.filters.mileagePolicy.length > 0) {
            const vehicleMileage = (vehicle.mileagePolicy || []).map((m) => m.toLowerCase());
            const hasMilage = this.filters.mileagePolicy.some((policy) =>
                vehicleMileage.includes(policy.toLowerCase())
            );
            if (!hasMilage) return false;
        }

        // EV range filter
        if (
            this.filters.minEVRange > 0 &&
            (!vehicle.evRange || vehicle.evRange < this.filters.minEVRange)
        ) {
            return false;
        }

        // Search text filter
        if (this.filters.searchText) {
            const searchLower = this.filters.searchText.toLowerCase();
            const searchAreas = [
                vehicle.brand,
                vehicle.name,
                vehicle.type,
                vehicle.fuelType,
                vehicle.transmission,
                (vehicle.features || []).join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!searchAreas.includes(searchLower)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Apply filters to vehicle list
     * @param {Array} vehicles - Vehicle array
     * @returns {Array} Filtered vehicles
     */
    applyFilters(vehicles) {
        this.allVehicles = vehicles;
        this.filteredVehicles = vehicles.filter((v) => this.matchesFilters(v));
        this.applySort();
        return this.filteredVehicles;
    }

    /**
     * Extract price from string (e.g., "$82 / day" -> 82)
     * @param {string} priceString - Price string
     * @returns {number} Extracted price
     */
    extractPrice(priceString) {
        const match = priceString.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }

    /**
     * Apply sorting to filtered results
     */
    applySort() {
        switch (this.sortOrder) {
            case "price-low":
                this.filteredVehicles.sort((a, b) => {
                    const priceA = this.extractPrice(a.pricing?.dailyRate || "0");
                    const priceB = this.extractPrice(b.pricing?.dailyRate || "0");
                    return priceA - priceB;
                });
                break;

            case "price-high":
                this.filteredVehicles.sort((a, b) => {
                    const priceA = this.extractPrice(a.pricing?.dailyRate || "0");
                    const priceB = this.extractPrice(b.pricing?.dailyRate || "0");
                    return priceB - priceA;
                });
                break;

            case "rating":
                this.filteredVehicles.sort((a, b) => {
                    const ratingA = parseFloat(a.rating || 0);
                    const ratingB = parseFloat(b.rating || 0);
                    return ratingB - ratingA;
                });
                break;

            case "newest":
                this.filteredVehicles.sort((a, b) => {
                    const dateA = new Date(a.addedDate || 0);
                    const dateB = new Date(b.addedDate || 0);
                    return dateB - dateA;
                });
                break;

            case "relevance":
            default:
                // Keep original order
                break;
        }
    }

    /**
     * Set sort order
     * @param {string} order - Sort order
     */
    setSortOrder(order) {
        this.sortOrder = order;
        this.applySort();
        this.notifyListeners();
    }

    /**
     * Get active filters (non-empty filters)
     * @returns {Object} Active filters
     */
    getActiveFilters() {
        const active = {};
        const defaults = this.initializeFilters();

        for (const [key, value] of Object.entries(this.filters)) {
            if (Array.isArray(value)) {
                if (value.length > 0) active[key] = value;
            } else if (typeof value === "number") {
                const defaultNumber = Number(defaults[key] || 0);
                if (value !== defaultNumber) {
                    active[key] = value;
                }
            } else if (value !== defaults[key]) {
                active[key] = value;
            }
        }
        return active;
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.filters = this.initializeFilters();
        this.sortOrder = "relevance";
        this.notifyListeners();
    }

    /**
     * Clear a specific filter
     * @param {string} filterName - Filter name to clear
     */
    clearFilter(filterName) {
        const defaults = this.initializeFilters();

        if (Array.isArray(this.filters[filterName])) {
            this.filters[filterName] = [];
        } else if (typeof this.filters[filterName] === "boolean") {
            this.filters[filterName] = false;
        } else if (typeof this.filters[filterName] === "number") {
            this.filters[filterName] = Number(defaults[filterName] || 0);
        } else {
            this.filters[filterName] = "";
        }
        this.notifyListeners();
    }

    /**
     * Save filter state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.filters));
        } catch (e) {
            console.warn("Failed to save filter state:", e);
        }
    }

    /**
     * Restore filter state from localStorage
     */
    restoreState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                const defaults = this.initializeFilters();

                this.filters = { ...defaults, ...parsed };

                if (!Number.isFinite(this.filters.minPrice) || this.filters.minPrice < 0) {
                    this.filters.minPrice = defaults.minPrice;
                }

                if (!Number.isFinite(this.filters.maxPrice) || this.filters.maxPrice <= 0) {
                    this.filters.maxPrice = defaults.maxPrice;
                }

                if (this.filters.maxPrice < this.filters.minPrice) {
                    this.filters.maxPrice = defaults.maxPrice;
                }

                this.notifyListeners();
            }
        } catch (e) {
            console.warn("Failed to restore filter state:", e);
        }
    }

    /**
     * Register a listener for filter changes
     * @param {Function} callback - Callback function
     */
    onFilterChange(callback) {
        this.listeners.add(callback);
    }

    /**
     * Unregister a listener
     * @param {Function} callback - Callback function
     */
    offFilterChange(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of filter changes
     */
    notifyListeners() {
        this.listeners.forEach((callback) => {
            try {
                callback(this.filteredVehicles, this.filters);
            } catch (e) {
                console.error("Error in filter listener:", e);
            }
        });
    }

    /**
     * Get filter statistics
     * @returns {Object} Filter statistics
     */
    getStats() {
        return {
            total: this.allVehicles.length,
            filtered: this.filteredVehicles.length,
            activeFilters: Object.keys(this.getActiveFilters()).length,
            priceRange: {
                min: Math.min(...this.allVehicles.map((v) => this.extractPrice(v.pricing?.dailyRate || "0"))),
                max: Math.max(...this.allVehicles.map((v) => this.extractPrice(v.pricing?.dailyRate || "0"))),
            },
        };
    }
}

// Export as global
window.SearchFilterManager = SearchFilterManager;
