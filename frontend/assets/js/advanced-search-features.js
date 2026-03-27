/**
 * Advanced Search Features Manager
 * Handles comparison, saved searches, and advanced features
 */

class AdvancedSearchFeatures {
    constructor() {
        this.savedSearches = this.loadSavedSearches();
        this.comparingVehicles = [];
        this.maxComparison = 4;
    }

    /**
     * Save current search
     * @param {string} searchName - Name for this search
     * @param {Object} filters - Current filters
     */
    saveSearch(searchName, filters) {
        const search = {
            id: `search-${Date.now()}`,
            name: searchName,
            filters,
            savedAt: new Date().toISOString(),
        };

        this.savedSearches.push(search);
        this.persistSavedSearches();
        return search;
    }

    /**
     * Load a saved search
     * @param {string} searchId - Search ID
     * @returns {Object} Saved search filters
     */
    loadSearch(searchId) {
        return this.savedSearches.find((s) => s.id === searchId);
    }

    /**
     * Delete saved search
     * @param {string} searchId - Search ID
     */
    deleteSearch(searchId) {
        this.savedSearches = this.savedSearches.filter((s) => s.id !== searchId);
        this.persistSavedSearches();
    }

    /**
     * Get all saved searches
     * @returns {Array} Saved searches
     */
    getSavedSearches() {
        return this.savedSearches;
    }

    /**
     * Add vehicle to comparison
     * @param {Object} vehicle - Vehicle object
     * @returns {boolean} True if added successfully
     */
    addToComparison(vehicle) {
        if (this.comparingVehicles.some((v) => v.id === vehicle.id)) {
            return false; // Already in comparison
        }

        if (this.comparingVehicles.length < this.maxComparison) {
            this.comparingVehicles.push(vehicle);
            return true;
        }

        return false; // Max reached
    }

    /**
     * Remove vehicle from comparison
     * @param {string} vehicleId - Vehicle ID
     */
    removeFromComparison(vehicleId) {
        this.comparingVehicles = this.comparingVehicles.filter((v) => v.id !== vehicleId);
    }

    /**
     * Get vehicles being compared
     * @returns {Array} Comparing vehicles
     */
    getComparingVehicles() {
        return this.comparingVehicles;
    }

    /**
     * Clear comparison
     */
    clearComparison() {
        this.comparingVehicles = [];
    }

    /**
     * Generate comparison table data
     */
    generateComparisonTable() {
        if (this.comparingVehicles.length === 0) return null;

        const features = [
            "type",
            "transmission",
            "fuelType",
            "seats",
            "rating",
            "features",
            "insuranceOptions",
            "driverOptions",
        ];

        const table = {
            headers: ["Specification", ...this.comparingVehicles.map((v) => `${v.brand} ${v.name}`)],
            rows: [],
        };

        for (const feature of features) {
            const row = {
                label: feature
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim(),
                values: this.comparingVehicles.map((v) => {
                    let value = v[feature];
                    if (Array.isArray(value)) return value.join(", ");
                    if (typeof value === "object") return JSON.stringify(value);
                    return value || "N/A";
                }),
            };
            table.rows.push(row);
        }

        return table;
    }

    /**
     * Export comparison as PDF (placeholder)
     */
    exportComparison() {
        const table = this.generateComparisonTable();
        if (!table) return null;

        let csv = table.headers.join(",") + "\n";
        for (const row of table.rows) {
            csv += `"${row.label}",${row.values.map((v) => `"${v}"`).join(",")}\n`;
        }

        return csv;
    }

    /**
     * Create price alert
     * @param {string} vehicleId - Vehicle ID
     * @param {number} targetPrice - Target price
     * @param {number} daysToMonitor - Days to monitor
     */
    createPriceAlert(vehicleId, targetPrice, daysToMonitor = 7) {
        const alert = {
            id: `alert-${Date.now()}`,
            vehicleId,
            targetPrice,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + daysToMonitor * 24 * 60 * 60 * 1000).toISOString(),
            notified: false,
        };

        const alerts = this.loadPriceAlerts();
        alerts.push(alert);
        this.persistPriceAlerts(alerts);

        return alert;
    }

    /**
     * Get all price alerts
     */
    getPriceAlerts() {
        return this.loadPriceAlerts().filter((a) => new Date(a.expiresAt) > new Date());
    }

    /**
     * Delete price alert
     * @param {string} alertId - Alert ID
     */
    deletePriceAlert(alertId) {
        const alerts = this.loadPriceAlerts().filter((a) => a.id !== alertId);
        this.persistPriceAlerts(alerts);
    }

    /**
     * Create rental reminder
     * @param {string} vehicleId - Vehicle ID
     * @param {string} rentalDate - Rental date ISO string
     */
    createReminder(vehicleId, rentalDate) {
        const reminder = {
            id: `reminder-${Date.now()}`,
            vehicleId,
            rentalDate,
            createdAt: new Date().toISOString(),
            sent: false,
        };

        const reminders = this.loadReminders();
        reminders.push(reminder);
        this.persistReminders(reminders);

        return reminder;
    }

    /**
     * Get all reminders
     */
    getReminders() {
        return this.loadReminders();
    }

    /**
     * Load saved searches from localStorage
     */
    loadSavedSearches() {
        try {
            return JSON.parse(localStorage.getItem("savedSearches") || "[]");
        } catch {
            return [];
        }
    }

    /**
     * Persist saved searches to localStorage
     */
    persistSavedSearches() {
        try {
            localStorage.setItem("savedSearches", JSON.stringify(this.savedSearches));
        } catch (e) {
            console.warn("Failed to save searches:", e);
        }
    }

    /**
     * Load price alerts from localStorage
     */
    loadPriceAlerts() {
        try {
            return JSON.parse(localStorage.getItem("priceAlerts") || "[]");
        } catch {
            return [];
        }
    }

    /**
     * Persist price alerts to localStorage
     */
    persistPriceAlerts(alerts) {
        try {
            localStorage.setItem("priceAlerts", JSON.stringify(alerts));
        } catch (e) {
            console.warn("Failed to save price alerts:", e);
        }
    }

    /**
     * Load reminders from localStorage
     */
    loadReminders() {
        try {
            return JSON.parse(localStorage.getItem("rentalReminders") || "[]");
        } catch {
            return [];
        }
    }

    /**
     * Persist reminders to localStorage
     */
    persistReminders(reminders) {
        try {
            localStorage.setItem("rentalReminders", JSON.stringify(reminders));
        } catch (e) {
            console.warn("Failed to save reminders:", e);
        }
    }

    /**
     * Get dashboard metrics
     */
    getDashboardMetrics() {
        return {
            savedSearches: this.savedSearches.length,
            comparingVehicles: this.comparingVehicles.length,
            priceAlerts: this.getPriceAlerts().length,
            reminders: this.getReminders().length,
        };
    }
}

// Export as global
window.AdvancedSearchFeatures = AdvancedSearchFeatures;
