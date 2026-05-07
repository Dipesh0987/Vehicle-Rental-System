/**
 * Search Filter Manager
 * Handles all filtering logic for the advanced search system
 * Features: Multiple filter criteria, persistence, real-time updates
 * MODIFIED: Optimized for Sprint 2 Vehicle Type filtering
 */

const DEFAULT_MAX_PRICE_NPR = 50000;

class SearchFilterManager {
    constructor() {
        this.storageKey = "searchFilters:v2";
        this.legacyStorageKey = "searchFilters";
        this.filters = this.initializeFilters();
        this.dateAvailability = this.initializeDateAvailability();
        this.filteredVehicles = [];
        this.allVehicles = [];
        this.sortOrder = "relevance";
        this.listeners = new Set();
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
            maxPrice: DEFAULT_MAX_PRICE_NPR,

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

    initializeDateAvailability() {
        return {
            active: false,
            startDate: "",
            endDate: "",
            unavailableVehicleIds: new Set(),
        };
    }

    setDateAvailability(context = {}) {
        const startDate = String(context.startDate || "").trim();
        const endDate = String(context.endDate || "").trim();
        const sourceIds = context.unavailableVehicleIds;
        const normalizedIds = [];

        if (sourceIds instanceof Set) {
            sourceIds.forEach((id) => {
                const normalized = String(id || "").trim();
                if (normalized) {
                    normalizedIds.push(normalized);
                }
            });
        } else if (Array.isArray(sourceIds)) {
            sourceIds.forEach((id) => {
                const normalized = String(id || "").trim();
                if (normalized) {
                    normalizedIds.push(normalized);
                }
            });
        }

        this.dateAvailability = {
            active: Boolean(startDate && endDate),
            startDate,
            endDate,
            unavailableVehicleIds: new Set(normalizedIds),
        };
    }

    clearDateAvailability() {
        this.dateAvailability = this.initializeDateAvailability();
    }

    /**
     * Update a single filter and trigger update
     * @param {string} filterName - Filter name
     * @param {*} value - Filter value
     */
    updateFilter(filterName, value) {
        if (filterName in this.filters) {
            const numericValue = Number(value);
            const nextValue = Number.isFinite(numericValue) ? numericValue : value;

            if (filterName === "minPrice" && Number.isFinite(numericValue) && numericValue > Number(this.filters.maxPrice)) {
                this.filters.maxPrice = numericValue;
            }

            if (filterName === "maxPrice" && Number.isFinite(numericValue) && numericValue < Number(this.filters.minPrice)) {
                this.filters.minPrice = numericValue;
            }

            if (filterName === "minSeats" && Number.isFinite(numericValue) && numericValue > Number(this.filters.maxSeats)) {
                this.filters.maxSeats = numericValue;
            }

            if (filterName === "maxSeats" && Number.isFinite(numericValue) && numericValue < Number(this.filters.minSeats)) {
                this.filters.minSeats = numericValue;
            }

            this.filters[filterName] = nextValue;
            // Trigger filtering on the current dataset
            this.applyFilters(this.allVehicles);
            this.notifyListeners();
        }
    }

    /**
     * Update multiple filters at once
     * @param {Object} filterUpdates - Filter updates object
     */
    updateFilters(filterUpdates) {
        Object.assign(this.filters, filterUpdates);
        this.applyFilters(this.allVehicles);
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
            this.applyFilters(this.allVehicles);
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
        if (
            this.filters.pickupLocation &&
            !vehicle.location?.toLowerCase().includes(this.filters.pickupLocation.toLowerCase())
        ) {
            return false;
        }

        // UPDATED: Vehicle type filter
        if (this.filters.vehicleTypes.length > 0) {
            const vehicleType = vehicle.type?.toLowerCase();
            const selectedTypes = this.filters.vehicleTypes.map(t => t.toLowerCase());
            
            if (!selectedTypes.includes(vehicleType)) {
                return false;
            }
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
        if (
            this.filters.availabilityOnly &&
            vehicle.available !== true &&
            vehicle.availability !== "Available"
        ) {
            return false;
        }

        if (this.dateAvailability.active) {
            const vehicleId = String(vehicle && vehicle.id ? vehicle.id : "").trim();
            if (!vehicleId) {
                return false;
            }

            if (this.dateAvailability.unavailableVehicleIds.has(vehicleId)) {
                return false;
            }
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
     */
    applyFilters(vehicles) {
        this.allVehicles = vehicles;
        this.filteredVehicles = vehicles.filter((v) => this.matchesFilters(v));
        this.applySort();
        return this.filteredVehicles;
    }

    /**
     * Extract price from string (e.g., "NPR 4,500 / day" -> 4500)
     * @param {string} priceString - Price string
     * @returns {number} Extracted price
     */
    extractPrice(priceString) {
        const normalized = String(priceString || "").replace(/,/g, "");
        const match = normalized.match(/-?\d+(?:\.\d+)?/);
        const parsed = match ? Number(match[0]) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    }

    /**
     * Apply sorting
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
                this.filteredVehicles.sort((a, b) => 
                    parseFloat(b.rating || 0) - parseFloat(a.rating || 0)
                );
                break;
            default:
                break;
        }
    }

    setSortOrder(order) {
        this.sortOrder = order;
        this.applySort();
        this.notifyListeners();
    }

    getActiveFilters() {
        const active = {};
        const defaults = this.initializeFilters();

        for (const [key, value] of Object.entries(this.filters)) {
            if (Array.isArray(value)) {
                if (value.length > 0) active[key] = value;
            } else if (typeof value === "number") {
                if (Number(value) !== Number(defaults[key])) {
                    active[key] = value;
                }
            } else if (typeof value === "boolean") {
                if (Boolean(value) !== Boolean(defaults[key])) {
                    active[key] = value;
                }
            } else if (value !== "") {
                active[key] = value;
            }
        }
        return active;
    }

    clearAllFilters() {
        this.filters = this.initializeFilters();
        this.clearDateAvailability();
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
            this.filters[filterName] = Boolean(defaults[filterName]);
        } else if (typeof this.filters[filterName] === "number") {
            this.filters[filterName] = Number(defaults[filterName]);
        } else {
            this.filters[filterName] = defaults[filterName] || "";
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

    restoreState() {
        try {
            const saved = localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyStorageKey);
            if (saved) {
                this.filters = { ...this.filters, ...JSON.parse(saved) };

                // Ensure old persisted caps do not hide higher-priced DB vehicles.
                if (!Number.isFinite(this.filters.maxPrice) || this.filters.maxPrice < DEFAULT_MAX_PRICE_NPR) {
                    this.filters.maxPrice = DEFAULT_MAX_PRICE_NPR;
                }

                this.notifyListeners();
            }
        } catch (e) {
            console.warn("Failed to restore filter state:", e);
        }
    }

    onFilterChange(callback) {
        this.listeners.add(callback);
    }

    notifyListeners() {
        this.listeners.forEach((callback) => {
            try {
                callback(this.filteredVehicles, this.filters);
            } catch (e) {
                console.error("Error in filter listener:", e);
            }
        });
    }
}

// Export as global
window.SearchFilterManager = SearchFilterManager;