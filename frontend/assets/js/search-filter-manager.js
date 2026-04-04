/**
 * Search Filter Manager
 * Handles all filtering logic for the advanced search system
 * Features: Multiple filter criteria, persistence, real-time updates
 * MODIFIED: Optimized for Sprint 2 Vehicle Type filtering
 */

class SearchFilterManager {
    constructor() {
        this.filters = this.initializeFilters();
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
            maxPrice: 500,

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
     * Update a single filter and trigger update
     * @param {string} filterName - Filter name
     * @param {*} value - Filter value
     */
    updateFilter(filterName, value) {
        if (filterName in this.filters) {
            this.filters[filterName] = value;
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
     * Extract price from string (e.g., "$82 / day" -> 82)
     */
    extractPrice(priceString) {
        if (typeof priceString === 'number') return priceString;
        const match = priceString.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
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
        for (const [key, value] of Object.entries(this.filters)) {
            if (Array.isArray(value) && value.length > 0) active[key] = value;
            else if (value !== "" && value !== 0 && value !== false) active[key] = value;
        }
        return active;
    }

    clearAllFilters() {
        this.filters = this.initializeFilters();
        this.applyFilters(this.allVehicles);
        this.notifyListeners();
    }

    saveState() {
        localStorage.setItem("searchFilters", JSON.stringify(this.filters));
    }

    restoreState() {
        const saved = localStorage.getItem("searchFilters");
        if (saved) {
            this.filters = { ...this.filters, ...JSON.parse(saved) };
            this.notifyListeners();
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