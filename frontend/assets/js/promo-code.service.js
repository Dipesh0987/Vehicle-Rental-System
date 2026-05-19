/**
 * Promo Code Service
 * Handles validation and application of promotional discount codes
 */

class PromoCodeService {
  static async validatePromoCode(code, bookingAmount) {
    try {
      if (!code || !bookingAmount) {
        return {
          valid: false,
          error: 'Invalid code or booking amount'
        };
      }

      const { data, error } = await window.supabase.rpc('validate_discount_code', {
        p_code: code.toUpperCase().trim(),
        p_booking_amount: bookingAmount
      });

      if (error) {
        // console.error('Promo validation error:', error);
        return {
          valid: false,
          error: 'This code is not valid for your booking'
        };
      }

      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        return {
          valid: result.valid,
          discountType: result.discount_type,
          discountValue: result.discount_value,
          discountAmount: result.discount_amount,
          error: result.error_message || ''
        };
      }

      return {
        valid: false,
        error: 'This code is not valid for your booking'
      };
    } catch (error) {
      // console.error('Promo code validation exception:', error);
      return {
        valid: false,
        error: 'This code is not valid for your booking'
      };
    }
  }

  static async applyPromoCode(code) {
    try {
      const { data, error } = await window.supabase.rpc('apply_discount_code', {
        p_code: code.toUpperCase().trim()
      });

      if (error) {
        // console.error('Apply promo error:', error);
        return false;
      }

      return true;
    } catch (error) {
      // console.error('Apply promo exception:', error);
      return false;
    }
  }

  static formatDiscountDisplay(discountType, discountValue, discountAmount) {
    if (discountType === 'percentage') {
      return `${discountValue}% off`;
    }
    return `NPR ${discountAmount.toFixed(2)} off`;
  }
}

export default PromoCodeService;
