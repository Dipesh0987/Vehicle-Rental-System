/**
 * Search API Client
 * Handles all backend API calls for the advanced search system
 * Features: Debouncing, caching, error handling, request validation
 */

class SearchAPIClient {
    constructor(baseURL = "/api") {
        this.baseURL = baseURL;
        this.cache = new Map();
        this.requestTimeout = 8000;
        this.debounceTimers = {};
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
        
        // Listen for online/offline events
        window.addEventListener("online", () => {
            this.isOnline = true;
            this.processQueue();
        });
        window.addEventListener("offline", () => {
            this.isOnline = false;
        });
    }

    /**
     * Debounce API calls to reduce server load
     * @param {string} key - Unique debounce key
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     */
    debounce(key, fn, delay = 500) {
        if (this.debounceTimers[key]) {
            clearTimeout(this.debounceTimers[key]);
        }
        this.debounceTimers[key] = setTimeout(() => {
            fn();
            delete this.debounceTimers[key];
        }, delay);
    }

    /**
     * Cache a response with TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
     */
    setCache(key, value, ttl = 5 * 60 * 1000) {
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl,
        });
    }

    /**
     * Get cached value if not expired
     * @param {string} key - Cache key
     * @returns {*} Cached value or null if expired
     */
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Build cache key from search parameters
     */
    buildCacheKey(endpoint, params) {
        const paramStr = JSON.stringify(params);
        return `${endpoint}:${paramStr}`;
    }

    /**
     * Make an API request with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} API response
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = this.buildCacheKey(endpoint, options.body || {});

        // Check cache for GET requests
        if (!options.method || options.method === "GET") {
            const cached = this.getCache(cacheKey);
            if (cached) return cached;
        }

        // Queue request if offline
        if (!this.isOnline) {
            return new Promise((resolve, reject) => {
                this.requestQueue.push({ url, options, resolve, reject });
            });
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache successful responses
            if (!options.method || options.method === "GET") {
                this.setCache(cacheKey, data);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw {
                message: error.message,
                endpoint,
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Process queued requests when back online
     */
    async processQueue() {
        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject } = this.requestQueue.shift();
            try {
                const response = await fetch(url, options);
                const data = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        }
    }

    /**
     * Search vehicles with filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Matching vehicles
     */
    async searchVehicles(filters = {}) {
        return this.request("/vehicles/search", {
            method: "POST",
            body: JSON.stringify(filters),
        });
    }

    /**
     * Get vehicle details
     * @param {string} vehicleId - Vehicle ID
     * @returns {Promise<Object>} Vehicle details
     */
    async getVehicleDetails(vehicleId) {
        return this.request(`/vehicles/${vehicleId}`);
    }

    /**
     * Check vehicle availability
     * @param {string} vehicleId - Vehicle ID
     * @param {string} startDate - Start date (ISO format)
     * @param {string} endDate - End date (ISO format)
     * @returns {Promise<Object>} Availability status
     */
    async checkAvailability(vehicleId, startDate, endDate) {
        return this.request("/vehicles/availability", {
            method: "POST",
            body: JSON.stringify({ vehicleId, startDate, endDate }),
        });
    }

    /**
     * Get price estimate
     * @param {string} vehicleId - Vehicle ID
     * @param {string} startDate - Start date (ISO format)
     * @param {string} endDate - End date (ISO format)
     * @returns {Promise<Object>} Price estimate
     */
    async getPriceEstimate(vehicleId, startDate, endDate) {
        return this.request("/bookings/estimate", {
            method: "POST",
            body: JSON.stringify({ vehicleId, startDate, endDate }),
        });
    }

    /**
     * Search locations with autocomplete
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching locations
     */
    async searchLocations(query) {
        return this.request("/locations/search", {
            method: "POST",
            body: JSON.stringify({ query }),
        });
    }

    /**
     * Get vehicle brands
     * @returns {Promise<Array>} Available brands
     */
    async getBrands() {
        return this.request("/vehicles/brands");
    }

    /**
     * Get vehicle models by brand
     * @param {string} brand - Brand name
     * @returns {Promise<Array>} Available models
     */
    async getModels(brand) {
        return this.request(`/vehicles/brands/${brand}/models`);
    }

    /**
     * Get filter options (for dynamic filter rendering)
     * @returns {Promise<Object>} Available filter options
     */
    async getFilterOptions() {
        return this.request("/vehicles/filters");
    }
}

// Export as global for use in other modules
window.SearchAPIClient = SearchAPIClient;
