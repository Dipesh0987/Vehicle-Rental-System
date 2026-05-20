/**
 * Price Calculator Service
 * Calculates rental prices based on vehicle rates, dates, and add-ons
 * - Daily rate calculation
 * - Service fees
 * - Tax calculations
 * - Discount application
 * - Price difference calculations for modifications
 */

class PriceCalculator {
  // Configuration
  static SERVICE_FEE_PERCENTAGE = 0.10; // 10% service fee
  static TAX_PERCENTAGE = 0.10; // 10% tax
  static DISCOUNT_PERCENTAGE_MULTI_DAY = 0.05; // 5% discount for 5+ days
  static INSURANCE_DAILY_RATES = {
    basic: 15.00,
    standard: 25.00,
    premium: 40.00
  };

  /**
   * Calculate rental duration in days
   */
  static calculateDays(pickupDate, dropoffDate) {
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    const diffTime = Math.abs(dropoff - pickup);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // Minimum 1 day
  }

  /**
   * Calculate base rental price
   * @param {number} dailyRate - Daily rate of vehicle
   * @param {number} rentalDays - Number of rental days
   * @returns {number} Base price
   */
  static calculateBasePrice(dailyRate, rentalDays) {
    return parseFloat((dailyRate * rentalDays).toFixed(2));
  }

  /**
   * Calculate insurance cost
   * @param {number} dailyRate - Daily vehicle rate
   * @param {number} rentalDays - Number of rental days
   * @param {string} insuranceType - 'basic', 'standard', or 'premium'
   * @returns {number} Insurance cost
   */
  static calculateInsurance(dailyRate, rentalDays, insuranceType = 'basic') {
    const insuranceRate = this.INSURANCE_DAILY_RATES[insuranceType] || 0;
    return parseFloat((insuranceRate * rentalDays).toFixed(2));
  }

  /**
   * Calculate service fee (10% of base price)
   */
  static calculateServiceFee(basePrice) {
    return parseFloat((basePrice * this.SERVICE_FEE_PERCENTAGE).toFixed(2));
  }

  /**
   * Calculate tax (10% of base + service + insurance)
   */
  static calculateTax(basePrice, serviceFee, insurance = 0) {
    const taxableAmount = basePrice + serviceFee + insurance;
    return parseFloat((taxableAmount * this.TAX_PERCENTAGE).toFixed(2));
  }

  /**
   * Calculate discount for multi-day rentals
   */
  static calculateDiscount(basePrice, rentalDays) {
    if (rentalDays >= 5) {
      return parseFloat((basePrice * this.DISCOUNT_PERCENTAGE_MULTI_DAY).toFixed(2));
    }
    return 0.00;
  }

  /**
   * Calculate complete rental price breakdown
   * @param {object} options - { vehicleRate, pickupDate, dropoffDate, insuranceType, addOns, promoCode, promoDiscount }
   * @returns {object} Price breakdown
   */
  static calculateRentalPrice(options = {}) {
    const {
      vehicleRate = 0,
      pickupDate = new Date().toISOString().split('T')[0],
      dropoffDate = new Date().toISOString().split('T')[0],
      insuranceType = 'basic',
      addOns = [],
      promoCode = null,
      promoDiscount = 0
    } = options;

    // Calculate base
    const rentalDays = this.calculateDays(pickupDate, dropoffDate);
    const basePrice = this.calculateBasePrice(vehicleRate, rentalDays);

    // Calculate insurance
    const insurance = this.calculateInsurance(vehicleRate, rentalDays, insuranceType);

    // Calculate addons cost
    const addOnsPrice = this.calculateAddOnsCost(addOns);

    // Calculate fees and tax
    const serviceFee = this.calculateServiceFee(basePrice);
    const multiDayDiscount = this.calculateDiscount(basePrice, rentalDays);
    
    // Total discount = multi-day discount + promo discount
    const totalDiscount = parseFloat((multiDayDiscount + promoDiscount).toFixed(2));
    const taxableAmount = basePrice + serviceFee + insurance + addOnsPrice - totalDiscount;
    const tax = this.calculateTax(taxableAmount, 0, 0); // Already included in taxableAmount

    // Calculate total
    const totalPrice = basePrice + serviceFee + tax + insurance + addOnsPrice - totalDiscount;

    return {
      rentalDays,
      vehicleRate,
      basePrice,
      insurance,
      insuranceType,
      addOnsPrice,
      addOns,
      serviceFee,
      discount: multiDayDiscount,
      promoDiscount,
      totalDiscount,
      promoCode,
      tax,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      breakdown: {
        basePrice,
        insurance,
        addOnsPrice,
        serviceFee,
        discount: multiDayDiscount,
        promoDiscount,
        totalDiscount,
        tax
      }
    };
  }

  /**
   * Calculate cost of additional services (add-ons)
   */
  static calculateAddOnsCost(addOns = []) {
    const addOnPrices = {
      'Child Seat': 20.00,
      'GPS Navigation': 15.00,
      'Premium Insurance': 50.00,
      'Basic Insurance': 0.00, // Included in insurance calculation
      'WiFi Hotspot': 25.00,
      'Roadside Assistance': 30.00,
      'Driver Training': 50.00
    };

    return addOns.reduce((total, addOn) => {
      return total + (addOnPrices[addOn] || 0);
    }, 0);
  }

  /**
   * Calculate price difference when modifying booking
   * @param {object} originalPrice - Original price breakdown
   * @param {object} newPrice - New price breakdown
   * @returns {object} Price difference details
   */
  static calculatePriceDifference(originalPrice, newPrice) {
    const difference = newPrice.totalPrice - originalPrice.totalPrice;
    const isRefund = difference < 0;
    const isCharge = difference > 0;
    const amount = Math.abs(difference);

    return {
      priceDifference: parseFloat(difference.toFixed(2)),
      isRefund,
      isCharge,
      amount: parseFloat(amount.toFixed(2)),
      originalTotal: originalPrice.totalPrice,
      newTotal: newPrice.totalPrice,
      change: isRefund ? `-$${amount.toFixed(2)}` : isCharge ? `+$${amount.toFixed(2)}` : '$0.00'
    };
  }

  /**
   * Format price to currency string
   */
  static formatPrice(price) {
    return `$${parseFloat(price).toFixed(2)}`;
  }
}

export { PriceCalculator };
