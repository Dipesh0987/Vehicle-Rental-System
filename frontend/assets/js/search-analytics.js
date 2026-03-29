/**
 * Search Analytics Tracker
 * Tracks user interactions and search patterns for analytics
 */

class SearchAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.userProfile = {
            filters: {},
            searches: 0,
            vehiclesViewed: [],
            timeSpent: 0,
        };
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Track search event
     * @param {Object} filters - Applied filters
     * @param {number} resultsCount - Number of results
     */
    trackSearch(filters, resultsCount) {
        this.events.push({
            type: "search",
            timestamp: new Date().toISOString(),
            filters,
            resultsCount,
        });

        this.userProfile.filters = filters;
        this.userProfile.searches++;
    }

    /**
     * Track filter change
     * @param {string} filterName - Filter name
     * @param {*} value - Filter value
     */
    trackFilterChange(filterName, value) {
        this.events.push({
            type: "filter_change",
            timestamp: new Date().toISOString(),
            filterName,
            value,
        });
    }

    /**
     * Track vehicle view
     * @param {string} vehicleId - Vehicle ID
     * @param {string} vehicleName - Vehicle name
     */
    trackVehicleView(vehicleId, vehicleName) {
        this.events.push({
            type: "vehicle_view",
            timestamp: new Date().toISOString(),
            vehicleId,
            vehicleName,
        });

        if (!this.userProfile.vehiclesViewed.includes(vehicleId)) {
            this.userProfile.vehiclesViewed.push(vehicleId);
        }
    }

    /**
     * Track wishlist action
     * @param {string} vehicleId - Vehicle ID
     * @param {string} action - 'added' or 'removed'
     */
    trackWishlist(vehicleId, action) {
        this.events.push({
            type: "wishlist_action",
            timestamp: new Date().toISOString(),
            vehicleId,
            action,
        });
    }

    /**
     * Track booking click
     * @param {string} vehicleId - Vehicle ID
     * @param {number} pricePerDay - Daily price
     */
    trackBookingClick(vehicleId, pricePerDay) {
        this.events.push({
            type: "booking_click",
            timestamp: new Date().toISOString(),
            vehicleId,
            pricePerDay,
        });
    }

    /**
     * Track sort change
     * @param {string} sortOption - Sort option
     */
    trackSortChange(sortOption) {
        this.events.push({
            type: "sort_change",
            timestamp: new Date().toISOString(),
            sortOption,
        });
    }

    /**
     * Track page scroll
     * @param {number} depth - Scroll depth %
     */
    trackScroll(depth) {
        this.events.push({
            type: "scroll",
            timestamp: new Date().toISOString(),
            depth,
        });
    }

    /**
     * Track search error
     * @param {string} error - Error message
     * @param {Object} context - Error context
     */
    trackError(error, context = {}) {
        this.events.push({
            type: "error",
            timestamp: new Date().toISOString(),
            error,
            context,
        });
    }

    /**
     * Get session duration in seconds
     */
    getSessionDuration() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Get event count by type
     */
    getEventCountByType() {
        const counts = {};
        for (const event of this.events) {
            counts[event.type] = (counts[event.type] || 0) + 1;
        }
        return counts;
    }

    /**
     * Get most filtered vehicle type
     */
    getMostFilteredType() {
        const typeFilters = this.events.filter((e) => e.filterName === "vehicleTypes");
        const counts = {};

        for (const event of typeFilters) {
            if (Array.isArray(event.value)) {
                for (const type of event.value) {
                    counts[type] = (counts[type] || 0) + 1;
                }
            }
        }

        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    }

    /**
     * Get hover time (estimated engagement)
     */
    getEngagementScore() {
        const searchCount = this.userProfile.searches;
        const viewCount = this.userProfile.vehiclesViewed.length;
        const sessionSeconds = this.getSessionDuration();

        // Simple engagement formula
        return Math.round((searchCount * 10 + viewCount * 15 + sessionSeconds / 10) / (sessionSeconds / 60 || 1));
    }

    /**
     * Get session analytics summary
     */
    getSummary() {
        return {
            sessionId: this.sessionId,
            duration: this.getSessionDuration(),
            eventCount: this.events.length,
            searchCount: this.userProfile.searches,
            vehiclesViewed: this.userProfile.vehiclesViewed.length,
            engagementScore: this.getEngagementScore(),
            eventsByType: this.getEventCountByType(),
            lastEvent: this.events[this.events.length - 1] || null,
        };
    }

    /**
     * Send analytics to server
     * @param {string} endpoint - Analytics endpoint
     */
    async sendAnalytics(endpoint = "/api/analytics") {
        try {
            const payload = {
                sessionId: this.sessionId,
                summary: this.getSummary(),
                events: this.events,
                timestamp: new Date().toISOString(),
            };

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.warn("Failed to send analytics");
            } else {
                console.log("Analytics sent successfully");
            }
        } catch (error) {
            console.error("Error sending analytics:", error);
        }
    }

    /**
     * Export analytics as JSON
     */
    exportAsJSON() {
        return JSON.stringify(
            {
                sessionId: this.sessionId,
                summary: this.getSummary(),
                events: this.events,
                exported: new Date().toISOString(),
            },
            null,
            2
        );
    }

    /**
     * Save analytics to localStorage
     */
    saveToLocalStorage() {
        try {
            const existing = JSON.parse(localStorage.getItem("searchAnalytics") || "[]");
            existing.push({
                ...this.getSummary(),
                events: this.events,
            });
            localStorage.setItem("searchAnalytics", JSON.stringify(existing.slice(-10))); // Keep last 10 sessions
        } catch (e) {
            console.warn("Failed to save analytics:", e);
        }
    }

    /**
     * Clear all events
     */
    clearEvents() {
        this.events = [];
    }

    /**
     * Log analytics summary to console
     */
    log() {
        console.group("Search Analytics Summary");
        console.log("Session ID:", this.sessionId);
        console.log("Duration:", this.getSessionDuration(), "seconds");
        console.log("Events:", this.events.length);
        console.log("Search Count:", this.userProfile.searches);
        console.log("Vehicles Viewed:", this.userProfile.vehiclesViewed.length);
        console.log("Engagement Score:", this.getEngagementScore());
        console.log("Event Breakdown:", this.getEventCountByType());
        console.groupEnd();
    }
}

// Export as global
window.SearchAnalytics = SearchAnalytics;
