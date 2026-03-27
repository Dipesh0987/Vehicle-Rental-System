/**
 * Search Performance Optimizer
 * Implements various performance enhancements
 */

class SearchPerformanceOptimizer {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            searchExecutionTime: 0,
            filterApplicationTime: 0,
            renderTime: 0,
        };

        this.markPageStart();
    }

    /**
     * Mark page start time
     */
    markPageStart() {
        this.metrics.pageStart = performance.now();
    }

    /**
     * Mark page end and log metrics
     */
    markPageEnd() {
        const endTime = performance.now();
        this.metrics.pageLoadTime = endTime - this.metrics.pageStart;
        console.log("Page Load Time:", this.metrics.pageLoadTime.toFixed(2), "ms");
    }

    /**
     * Measure search execution time
     * @param {Function} executeFn - Function to measure
     * @returns {*} Function result
     */
    measureSearch(executeFn) {
        const startTime = performance.now();
        const result = executeFn();
        this.metrics.searchExecutionTime = performance.now() - startTime;
        return result;
    }

    /**
     * Measure filter application time
     * @param {Function} executeFn - Function to measure
     * @returns {*} Function result
     */
    measureFilter(executeFn) {
        const startTime = performance.now();
        const result = executeFn();
        this.metrics.filterApplicationTime = performance.now() - startTime;
        return result;
    }

    /**
     * Measure render time
     * @param {Function} executeFn - Function to measure
     * @returns {*} Function result
     */
    measureRender(executeFn) {
        const startTime = performance.now();
        const result = executeFn();
        this.metrics.renderTime = performance.now() - startTime;
        return result;
    }

    /**
     * Implement request animation frame batching
     * @param {Function} callback - Function to execute
     * @returns {number} Request ID
     */
    scheduleRender(callback) {
        return requestAnimationFrame(callback);
    }

    /**
     * Cancel scheduled render
     * @param {number} id - Request ID
     */
    cancelRender(id) {
        cancelAnimationFrame(id);
    }

    /**
     * Lazy load images
     * @param {Array} images - Image elements
     */
    lazyLoadImages(images) {
        if ("IntersectionObserver" in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add("loaded");
                        observer.unobserve(img);
                    }
                });
            });

            images.forEach((img) => imageObserver.observe(img));
        }
    }

    /**
     * Implement virtual scrolling
     * @param {Array} items - Items to render
     * @param {number} itemHeight - Height of each item
     * @param {Element} container - Container element
     */
    initVirtualScroll(items, itemHeight, container) {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const visibleStart = Math.floor(scrollTop / itemHeight);
        const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

        return {
            start: Math.max(0, visibleStart),
            end: Math.min(items.length, visibleEnd),
            totalHeight: items.length * itemHeight,
        };
    }

    /**
     * Implement request idle callback for non-critical tasks
     * @param {Function} callback - Function to execute
     */
    scheduleIdleTask(callback) {
        if ("requestIdleCallback" in window) {
            requestIdleCallback(callback);
        } else {
            setTimeout(callback, 0);
        }
    }

    /**
     * Compress and optimize strings
     * @param {string} str - String to compress
     * @returns {string} Compressed string
     */
    compressString(str) {
        return str.replace(/\s+/g, " ").trim();
    }

    /**
     * Local cache wrapper
     * @param {string} key - Cache key
     * @param {Function} fn - Function to cache result of
     * @param {number} ttl - Time to live in seconds
     */
    memoize(key, fn, ttl = 300) {
        const cached = JSON.parse(localStorage.getItem(`cache:${key}`) || "null");
        const now = Date.now();

        if (cached && cached.expires > now) {
            return cached.value;
        }

        const result = fn();
        localStorage.setItem(
            `cache:${key}`,
            JSON.stringify({
                value: result,
                expires: now + ttl * 1000,
            })
        );

        return result;
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith("cache:")) {
                localStorage.removeItem(key);
            }
        }
    }

    /**
     * Monitor performance observer
     */
    initPerformanceMonitoring() {
        if ("PerformanceObserver" in window) {
            try {
                const perfObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        console.log("Performance Entry:", {
                            name: entry.name,
                            duration: entry.duration,
                            startTime: entry.startTime,
                        });
                    }
                });

                perfObserver.observe({ entryTypes: ["measure", "navigation", "paint"] });
            } catch (e) {
                console.warn("Performance monitoring not fully supported");
            }
        }
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            navigationTiming: this.getNavigationMetrics(),
        };
    }

    /**
     * Get navigation timing metrics
     */
    getNavigationMetrics() {
        const perfData = performance.getEntriesByType("navigation")[0];
        if (!perfData) return null;

        return {
            dns: perfData.domainLookupEnd - perfData.domainLookupStart,
            tcp: perfData.connectEnd - perfData.connectStart,
            request: perfData.responseStart - perfData.requestStart,
            response: perfData.responseEnd - perfData.responseStart,
            dom: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            load: perfData.loadEventEnd - perfData.loadEventStart,
            total: perfData.loadEventEnd - perfData.fetchStart,
        };
    }

    /**
     * Log all metrics
     */
    logMetrics() {
        console.group("📊 Performance Metrics");
        console.table(this.metrics);

        const navMetrics = this.getNavigationMetrics();
        if (navMetrics) {
            console.group("Navigation Timing");
            console.table(navMetrics);
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Create web worker for heavy computations
     * @param {Function} fn - Function to run in worker
     * @returns {Promise} Worker promise
     */
    runInWorker(fn) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([`self.onmessage = function(e) { self.postMessage((${fn.toString()})(...e.data)) }`], {
                type: "application/javascript",
            });
            const worker = new Worker(URL.createObjectURL(blob));

            worker.onmessage = (e) => {
                resolve(e.data);
                worker.terminate();
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            return worker;
        });
    }

    /**
     * Prefetch resources
     * @param {Array} urls - URLs to prefetch
     */
    prefetchResources(urls) {
        for (const url of urls) {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = url;
            document.head.appendChild(link);
        }
    }

    /**
     * Implement service worker caching (if available)
     */
    async registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js");
                console.log("Service Worker registered:", registration);
            } catch (error) {
                console.log("Service Worker registration failed:", error);
            }
        }
    }
}

// Export as global
window.SearchPerformanceOptimizer = SearchPerformanceOptimizer;
