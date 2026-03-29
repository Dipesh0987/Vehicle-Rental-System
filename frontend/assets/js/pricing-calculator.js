/**
 * Pricing Calculator
 * Handles rental cost calculations with various fees and discounts
 */

class PricingCalculator {
    constructor() {
        this.basePricePerDay = 0;
        this.numberOfDays = 1;
        this.insuranceType = "none"; // 'none', 'basic', 'premium', 'comprehensive'
        this.driverOption = "self-drive"; // 'self-drive', 'with-driver'
        this.mileagePolicy = "unlimited"; // 'unlimited', 'limited'

        // Pricing rules
        this.rates = {
            insurance: {
                basic: 0.15, // 15% of daily rate
                premium: 0.25, // 25% of daily rate
                comprehensive: 0.35, // 35% of daily rate
            },
            driver: {
                "with-driver": 50, // Fixed $50 per day
            },
            mileage: {
                limited: 0.1, // $0.10 per km over limit
            },
            discounts: {
                weekly: 0.1, // 10% discount for 7+ days
                monthly: 0.2, // 20% discount for 30+ days
                earlyBooking: 0.05, // 5% discount for 7+ days in advance
            },
            fees: {
                securityDeposit: 350, // Standard deposit
                cancellationInsurance: 25, // Optional
                roadAssistance: 30, // Optional
            },
        };

        this.selectedAddOns = [];
    }

    /**
     * Set vehicle and rental period
     * @param {number} dailyRate - Vehicle's daily rate
     * @param {string} startDate - Start date ISO string
     * @param {string} endDate - End date ISO string
     */
    setRentalPeriod(dailyRate, startDate, endDate) {
        this.basePricePerDay = dailyRate;
        this.numberOfDays = this.calculateDays(startDate, endDate);
    }

    /**
     * Calculate days between dates
     */
    calculateDays(startDate, endDate) {
        if (!startDate || !endDate) return 1;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    /**
     * Set insurance type
     * @param {string} type - Insurance type
     */
    setInsurance(type) {
        this.insuranceType = type; // 'none', 'basic', 'premium', 'comprehensive'
    }

    /**
     * Set driver option
     * @param {string} option - Driver option
     */
    setDriverOption(option) {
        this.driverOption = option; // 'self-drive', 'with-driver'
    }

    /**
     * Set mileage policy
     * @param {string} policy - Mileage policy
     */
    setMileagePolicy(policy) {
        this.mileagePolicy = policy; // 'unlimited', 'limited'
    }

    /**
     * Add optional add-on
     * @param {string} addOn - Add-on ID
     * @param {number} cost - Cost
     */
    addAddOn(addOn, cost = null) {
        if (!this.selectedAddOns.includes(addOn)) {
            if (cost === null) {
                cost = this.rates.fees[addOn] || 0;
            }
            this.selectedAddOns.push({ id: addOn, cost });
        }
    }

    /**
     * Remove add-on
     * @param {string} addOn - Add-on ID
     */
    removeAddOn(addOn) {
        this.selectedAddOns = this.selectedAddOns.filter((a) => a.id !== addOn);
    }

    /**
     * Calculate rental cost
     * @returns {Object} Cost breakdown
     */
    calculateCost() {
        // Base rental cost
        const baseRental = this.basePricePerDay * this.numberOfDays;

        // Insurance cost
        let insuranceCost = 0;
        if (this.insuranceType !== "none") {
            insuranceCost = baseRental * this.rates.insurance[this.insuranceType];
        }

        // Driver cost
        let driverCost = 0;
        if (this.driverOption === "with-driver") {
            driverCost = this.rates.driver["with-driver"] * this.numberOfDays;
        }

        // Add-ons cost
        const addOnsCost = this.selectedAddOns.reduce((sum, addon) => {
            if (typeof addon.cost === "number") {
                return sum + addon.cost;
            }
            return sum;
        }, 0);

        // Subtotal before discounts
        const subtotal = baseRental + insuranceCost + driverCost + addOnsCost;

        // Calculate applicable discounts
        let discountAmount = 0;
        const applicableDiscounts = [];

        // Weekly discount
        if (this.numberOfDays >= 7) {
            const weeklyDiscount = baseRental * this.rates.discounts.weekly;
            if (weeklyDiscount > discountAmount) {
                discountAmount = weeklyDiscount;
                applicableDiscounts.push({ name: "Weekly", amount: weeklyDiscount });
            }
        }

        // Monthly discount (takes precedence)
        if (this.numberOfDays >= 30) {
            const monthlyDiscount = baseRental * this.rates.discounts.monthly;
            discountAmount = monthlyDiscount;
            applicableDiscounts.length = 0;
            applicableDiscounts.push({ name: "Monthly", amount: monthlyDiscount });
        }

        // Final total
        const total = Math.max(0, subtotal - discountAmount);

        // Security deposit (not included in total, but shown separately)
        const securityDeposit = this.rates.fees.securityDeposit;

        return {
            breakdown: {
                baseRental: {
                    label: `Vehicle rental (${this.numberOfDays} day${this.numberOfDays > 1 ? "s" : ""})`,
                    amount: baseRental,
                },
                insurance: insuranceCost > 0 ? { label: this.insuranceType + " Insurance", amount: insuranceCost } : null,
                driver: driverCost > 0 ? { label: "Professional Driver", amount: driverCost } : null,
                addOns: this.selectedAddOns.length > 0 ? { label: "Additional Options", amount: addOnsCost } : null,
            },
            subtotal,
            discounts: applicableDiscounts,
            discountAmount,
            total,
            securityDeposit,
            grandTotal: total + securityDeposit,
            estimatedTax: Math.round(total * 0.08 * 100) / 100, // 8% tax
        };
    }

    /**
     * Get cost breakdown as formatted string
     * @returns {string} Formatted breakdown
     */
    getFormattedBreakdown() {
        const cost = this.calculateCost();
        let str = "=== RENTAL COST BREAKDOWN ===\n\n";

        for (const [key, item] of Object.entries(cost.breakdown)) {
            if (item) {
                str += `${item.label}: $${item.amount.toFixed(2)}\n`;
            }
        }

        if (cost.discounts.length > 0) {
            str += "\n--- DISCOUNTS ---\n";
            cost.discounts.forEach((discount) => {
                str += `${discount.name}: -$${discount.amount.toFixed(2)}\n`;
            });
        }

        str += `\nSubtotal: $${cost.subtotal.toFixed(2)}\n`;
        str += `Tax (8%): $${cost.estimatedTax.toFixed(2)}\n`;
        str += `Total Rental: $${cost.total.toFixed(2)}\n`;
        str += `Security Deposit (Refundable): $${cost.securityDeposit.toFixed(2)}\n`;
        str += `GRAND TOTAL: $${cost.grandTotal.toFixed(2)}`;

        return str;
    }

    /**
     * Calculate price per day (including insurance etc)
     * @returns {number} Effective daily rate
     */
    getEffectiveDailyRate() {
        const cost = this.calculateCost();
        return cost.total / this.numberOfDays;
    }

    /**
     * Check if early booking discount applies
     * @param {string} bookingDate - Booking date ISO string
     * @returns {boolean} True if eligible
     */
    isEarlyBookingEligible(bookingDate) {
        try {
            const bookDate = new Date(bookingDate);
            const today = new Date();
            const daysInAdvance = (bookDate - today) / (1000 * 60 * 60 * 24);
            return daysInAdvance >= 7;
        } catch {
            return false;
        }
    }

    /**
     * Generate price quote
     * @returns {Object} Complete quote object
     */
    generateQuote() {
        const cost = this.calculateCost();
        return {
            quoteId: this.generateQuoteId(),
            generatedAt: new Date().toISOString(),
            vehicleDetails: {
                dailyRate: this.basePricePerDay,
                rentalDays: this.numberOfDays,
            },
            options: {
                insurance: this.insuranceType,
                driver: this.driverOption,
                mileage: this.mileagePolicy,
                addOns: this.selectedAddOns,
            },
            pricing: cost,
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Valid for 24 hours
        };
    }

    /**
     * Generate unique quote ID
     */
    generateQuoteId() {
        return `QUOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
    }

    /**
     * Calculate payment schedule
     * @returns {Array} Payment schedule
     */
    getPaymentSchedule() {
        const cost = this.calculateCost();
        const schedule = [];

        // 30% deposit at booking
        schedule.push({
            phase: "Deposit at Booking",
            amount: cost.total * 0.3,
            dueDate: new Date().toISOString(),
        });

        // 70% at pickup
        schedule.push({
            phase: "Payment at Pickup",
            amount: cost.total * 0.7,
            dueDate: new Date().toISOString(), // Usually same day
        });

        // Security deposit (refundable)
        schedule.push({
            phase: "Security Deposit (Refundable)",
            amount: cost.securityDeposit,
            dueDate: new Date().toISOString(),
            refundDate: "Upon return in good condition",
        });

        return schedule;
    }
}

// Export as global
window.PricingCalculator = PricingCalculator;
