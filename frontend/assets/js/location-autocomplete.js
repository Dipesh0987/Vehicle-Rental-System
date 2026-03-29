/**
 * Location Autocomplete Manager
 * Handles location search with caching and suggestions
 */

class LocationAutocomplete {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.cache = new Map();
        this.suggestions = [];
        this.isOpen = false;

        // Sample locations for testing (replace with API)
        this.defaultLocations = [
            { city: "New York", state: "NY", code: "NYC", lat: 40.7128, lon: -74.006 },
            { city: "Los Angeles", state: "CA", code: "LAX", lat: 34.0522, lon: -118.2437 },
            { city: "Chicago", state: "IL", code: "ORD", lat: 41.8781, lon: -87.6298 },
            { city: "Houston", state: "TX", code: "IAH", lat: 29.7604, lon: -95.3698 },
            { city: "Phoenix", state: "AZ", code: "PHX", lat: 33.4484, lon: -112.074 },
            { city: "Philadelphia", state: "PA", code: "PHL", lat: 39.9526, lon: -75.1652 },
            { city: "San Antonio", state: "TX", code: "SAT", lat: 29.4241, lon: -98.4936 },
            { city: "San Diego", state: "CA", code: "SAN", lat: 32.7157, lon: -117.1611 },
            { city: "Dallas", state: "TX", code: "DFW", lat: 32.7767, lon: -96.797 },
            { city: "San Jose", state: "CA", code: "SJC", lat: 37.3382, lon: -121.8863 },
            { city: "Austin", state: "TX", code: "AUS", lat: 30.2672, lon: -97.7431 },
            { city: "Jacksonville", state: "FL", code: "JAX", lat: 30.3322, lon: -81.6557 },
            { city: "Fort Worth", state: "TX", code: "DFW", lat: 32.7555, lon: -97.3308 },
            { city: "Columbus", state: "OH", code: "CMH", lat: 39.9612, lon: -82.9988 },
            { city: "Denver", state: "CO", code: "DEN", lat: 39.7392, lon: -104.9903 },
        ];
    }

    /**
     * Initialize autocomplete for input element
     * @param {string} inputSelector - CSS selector for input
     * @param {Function} onSelect - Callback when location selected
     */
    init(inputSelector, onSelect) {
        const input = document.querySelector(inputSelector);
        if (!input) return;

        // Create suggestions container
        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.className =
            "absolute top-full left-0 right-0 bg-white border border-[#d4ded9] rounded-lg mt-1 shadow-lg z-40 hidden max-h-64 overflow-y-auto";
        suggestionsContainer.id = `suggestions-${Math.random().toString(36).substr(2, 9)}`;

        input.parentElement.style.position = "relative";
        input.parentElement.appendChild(suggestionsContainer);

        // Input listener
        input.addEventListener("input", async (e) => {
            const query = e.target.value.trim();

            if (query.length < 2) {
                suggestionsContainer.classList.add("hidden");
                return;
            }

            const results = await this.search(query);
            this.renderSuggestions(results, suggestionsContainer, input, onSelect);
        });

        // Close on blur
        input.addEventListener("blur", () => {
            setTimeout(() => {
                suggestionsContainer.classList.add("hidden");
            }, 200);
        });

        // Focus to show suggestions
        input.addEventListener("focus", () => {
            if (input.value.length >= 2) {
                suggestionsContainer.classList.remove("hidden");
            }
        });
    }

    /**
     * Search locations
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching locations
     */
    async search(query) {
        // Check cache first
        if (this.cache.has(query)) {
            return this.cache.get(query);
        }

        try {
            // Try API first
            const results = await this.apiClient.searchLocations(query);
            this.cache.set(query, results);
            return results;
        } catch (error) {
            // Fallback to local search
            const results = this.localSearch(query);
            this.cache.set(query, results);
            return results;
        }
    }

    /**
     * Local location search
     * @param {string} query - Search query
     * @returns {Array} Matching locations
     */
    localSearch(query) {
        const lowerQuery = query.toLowerCase();
        return this.defaultLocations.filter(
            (loc) =>
                loc.city.toLowerCase().includes(lowerQuery) ||
                loc.state.toLowerCase().includes(lowerQuery) ||
                loc.code.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Render suggestions dropdown
     * @param {Array} results - Search results
     * @param {Element} container - Container element
     * @param {Element} input - Input element
     * @param {Function} onSelect - Selection callback
     */
    renderSuggestions(results, container, input, onSelect) {
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="px-4 py-3 text-center text-muted text-sm">
                    <i class="fas fa-search mr-2"></i> No locations found
                </div>
            `;
            container.classList.remove("hidden");
            return;
        }

        let html = "";
        for (const location of results.slice(0, 10)) {
            const displayName = location.airport ? `${location.city} - ${location.code}` : location.city;
            html += `
                <div class="location-suggestion px-4 py-3 hover:bg-[#f5f5f5] cursor-pointer transition" data-location='${JSON.stringify(location)}'>
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-semibold text-ink">${location.city}</div>
                            <div class="text-xs text-muted">${location.state}</div>
                        </div>
                        <div class="text-xs font-bold text-accent">${location.code || ""}</div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        container.classList.remove("hidden");

        // Attach click handlers
        container.querySelectorAll(".location-suggestion").forEach((item) => {
            item.addEventListener("click", () => {
                const location = JSON.parse(item.dataset.location);
                input.value = location.city;
                container.classList.add("hidden");
                if (onSelect) onSelect(location);
            });
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get recent searches
     * @returns {Array} Recent search queries
     */
    getRecent() {
        try {
            return JSON.parse(localStorage.getItem("recentLocations") || "[]");
        } catch {
            return [];
        }
    }

    /**
     * Add to recent searches
     * @param {Object} location - Location object
     */
    addRecent(location) {
        try {
            let recent = this.getRecent();
            recent = recent.filter((l) => l.city !== location.city);
            recent.unshift(location);
            localStorage.setItem("recentLocations", JSON.stringify(recent.slice(0, 5)));
        } catch (e) {
            console.warn("Failed to save recent location:", e);
        }
    }

    /**
     * Calculate distance between two coordinates
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in kilometers
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

// Export as global
window.LocationAutocomplete = LocationAutocomplete;
