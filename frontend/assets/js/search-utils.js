/**
 * Advanced Search - Utility Functions
 * Common helpers for formatting, validation, and data manipulation
 */

const SearchUtils = {
    /**
     * Format currency
     * @param {number} amount - Amount in dollars
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    },

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    },

    /**
     * Format time for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted time
     */
    formatTime(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    },

    /**
     * Calculate days between two dates
     * @param {string} startDate - Start date ISO string
     * @param {string} endDate - End date ISO string
     * @returns {number} Number of days
     */
    calculateDays(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate phone number
     * @param {string} phone - Phone number
     * @returns {boolean} True if valid phone
     */
    isValidPhone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, "").length >= 10;
    },

    /**
     * Capitalize string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    /**
     * Slugify string (for URLs)
     * @param {string} str - String to slugify
     * @returns {string} Slugified string
     */
    slugify(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim("-");
    },

    /**
     * Truncate text with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} length - Max length
     * @returns {string} Truncated text
     */
    truncate(text, length = 100) {
        if (text.length <= length) return text;
        return text.substring(0, length) + "...";
    },

    /**
     * Highlight search term in text
     * @param {string} text - Text to highlight in
     * @param {string} term - Search term
     * @returns {string} HTML with highlighted term
     */
    highlightTerm(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, "gi");
        return text.replace(regex, "<mark>$1</mark>");
    },

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Milliseconds between calls
     * @returns {Function} Throttled function
     */
    throttle(func, limit = 1000) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    /**
     * Deep clone object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if object is empty
     * @param {Object} obj - Object to check
     * @returns {boolean} True if empty
     */
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    },

    /**
     * Merge objects
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    merge(...objects) {
        return Object.assign({}, ...objects);
    },

    /**
     * Get query parameter value
     * @param {string} param - Parameter name
     * @returns {string|null} Parameter value or null
     */
    getQueryParam(param) {
        const params = new URLSearchParams(window.location.search);
        return params.get(param);
    },

    /**
     * Set multiple query parameters
     * @param {Object} params - Parameters to set
     */
    setQueryParams(params) {
        const current = new URLSearchParams(window.location.search);
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                current.set(key, value);
            } else {
                current.delete(key);
            }
        });
        window.history.pushState({}, "", `?${current.toString()}`);
    },

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = "info", duration = 3000) {
        const toast = document.createElement("div");
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-semibold animate-fadeIn z-50`;

        const typeColors = {
            success: "bg-green-500",
            error: "bg-red-500",
            info: "bg-blue-500",
            warning: "bg-yellow-500",
        };

        toast.classList.add(typeColors[type] || typeColors.info);
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 300ms ease";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch((err) => {
            console.error("Failed to copy:", err);
        });
    },

    /**
     * Get element offset position
     * @param {Element} element - Element
     * @returns {Object} {top, left} position
     */
    getOffset(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
        };
    },

    /**
     * Check if element is in viewport
     * @param {Element} element - Element to check
     * @returns {boolean} True if in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    },

    /**
     * Smooth scroll to element
     * @param {Element|string} target - Element or selector
     * @param {number} offset - Offset in pixels
     */
    smoothScroll(target, offset = 0) {
        const element = typeof target === "string" ? document.querySelector(target) : target;
        if (!element) return;

        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({
            top,
            behavior: "smooth",
        });
    },

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Parse duration string to minutes
     * @param {string} duration - Duration string (e.g., "2h 30m")
     * @returns {number} Total minutes
     */
    parseDuration(duration) {
        const hours = (duration.match(/(\d+)h/) || [0, 0])[1];
        const minutes = (duration.match(/(\d+)m/) || [0, 0])[1];
        return parseInt(hours) * 60 + parseInt(minutes);
    },

    /**
     * Format milliseconds to human readable time
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted time
     */
    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    },
};

// Export as global
window.SearchUtils = SearchUtils;
