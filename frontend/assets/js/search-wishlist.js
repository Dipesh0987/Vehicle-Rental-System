/**
 * Search Wishlist Manager
 * Handles the wishlist/favorites functionality with persistence
 */

class SearchWishlist {
    constructor() {
        this.storageKey = "vehicleWishlist";
        this.wishlist = this.loadWishlist();
    }

    /**
     * Load wishlist from localStorage
     */
    loadWishlist() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn("Failed to load wishlist:", e);
            return [];
        }
    }

    /**
     * Save wishlist to localStorage
     */
    saveWishlist() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.wishlist));
        } catch (e) {
            console.warn("Failed to save wishlist:", e);
        }
    }

    /**
     * Add vehicle to wishlist
     * @param {string} vehicleId - Vehicle ID
     * @returns {boolean} True if added, false if already exists
     */
    addToWishlist(vehicleId) {
        if (!this.wishlist.includes(vehicleId)) {
            this.wishlist.push(vehicleId);
            this.saveWishlist();
            this.notifyListeners("added", vehicleId);
            return true;
        }
        return false;
    }

    /**
     * Remove vehicle from wishlist
     * @param {string} vehicleId - Vehicle ID
     * @returns {boolean} True if removed, false if not found
     */
    removeFromWishlist(vehicleId) {
        const index = this.wishlist.indexOf(vehicleId);
        if (index > -1) {
            this.wishlist.splice(index, 1);
            this.saveWishlist();
            this.notifyListeners("removed", vehicleId);
            return true;
        }
        return false;
    }

    /**
     * Toggle wishlist status
     * @param {string} vehicleId - Vehicle ID
     * @returns {boolean} True if now wishlisted, false if removed
     */
    toggleWishlist(vehicleId) {
        if (this.isWishlisted(vehicleId)) {
            this.removeFromWishlist(vehicleId);
            return false;
        } else {
            this.addToWishlist(vehicleId);
            return true;
        }
    }

    /**
     * Check if vehicle is wishlisted
     * @param {string} vehicleId - Vehicle ID
     * @returns {boolean} True if wishlisted
     */
    isWishlisted(vehicleId) {
        return this.wishlist.includes(vehicleId);
    }

    /**
     * Get all wishlisted vehicle IDs
     * @returns {Array<string>} Array of vehicle IDs
     */
    getWishlist() {
        return [...this.wishlist];
    }

    /**
     * Get wishlist count
     * @returns {number} Count of wishlisted vehicles
     */
    getCount() {
        return this.wishlist.length;
    }

    /**
     * Clear entire wishlist
     */
    clearWishlist() {
        this.wishlist = [];
        this.saveWishlist();
        this.notifyListeners("cleared");
    }

    /**
     * Export wishlist as JSON
     * @returns {string} JSON string of wishlist
     */
    export() {
        return JSON.stringify(this.wishlist, null, 2);
    }

    /**
     * Import wishlist from JSON
     * @param {string} jsonString - JSON string to import
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (Array.isArray(imported)) {
                this.wishlist = imported;
                this.saveWishlist();
                this.notifyListeners("imported");
            }
        } catch (e) {
            console.error("Failed to import wishlist:", e);
        }
    }

    /**
     * Update wishlist UI elements
     */
    updateWishlistCount() {
        const countElement = document.getElementById("wishlistCount");
        const count = this.getCount();

        if (countElement) {
            if (count > 0) {
                countElement.textContent = count;
                countElement.classList.remove("hidden");
            } else {
                countElement.classList.add("hidden");
            }
        }
    }

    // Event listener support
    listeners = new Set();

    /**
     * Register a listener
     * @param {Function} callback - Callback function
     */
    onWishlistChange(callback) {
        this.listeners.add(callback);
    }

    /**
     * Unregister a listener
     * @param {Function} callback - Callback function
     */
    offWishlistChange(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notify listeners
     */
    notifyListeners(action, vehicleId = null) {
        this.listeners.forEach((callback) => {
            try {
                callback({ action, vehicleId, wishlist: this.getWishlist() });
            } catch (e) {
                console.error("Error in wishlist listener:", e);
            }
        });
    }
}

// Create global instance
window.SearchWishlist = new SearchWishlist();
