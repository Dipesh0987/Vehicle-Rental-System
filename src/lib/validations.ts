// =====================================================
// Shared Validation Utilities for ASSelf Car Rental
// Nepal-specific validations included
// =====================================================

/**
 * Validates Nepal phone number
 * - Must start with 97 or 98
 * - Must be exactly 10 digits
 */
export const validateNepalPhone = (phone: string): { valid: boolean; message: string } => {
  // Remove spaces, dashes, and country code prefix if present
  const cleaned = phone.replace(/[\s\-+]/g, '').replace(/^977/, '');
  
  // Check if it starts with 97 or 98
  if (!cleaned.match(/^9[78]/)) {
    return { valid: false, message: 'Phone number must start with 97 or 98' };
  }
  
  // Check if it's exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, message: 'Phone number must be exactly 10 digits' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validates email with strict format check
 * - Must have valid format with proper domain (.com, .org, etc.)
 */
export const validateEmail = (email: string): { valid: boolean; message: string } => {
  if (!email || !email.trim()) {
    return { valid: false, message: 'Email is required' };
  }
  
  // Strict email regex - must have @ and proper domain ending
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|mil|int|co|io|me|info|biz|name|mobi|pro|aero|coop|museum|jobs|travel|in|np|uk|us|ca|au|de|fr|jp|cn|kr|nz|sg|hk|ph|th|my|id|vn|bd|pk|lk|yahoo|gmail|hotmail|outlook|live|icloud|protonmail)$/i;
  
  if (!emailRegex.test(email.trim())) {
    return { valid: false, message: 'Please enter a valid email address (e.g., name@email.com)' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validates customer name
 * - Only letters and spaces allowed
 * - No numbers or special characters
 */
export const validateName = (name: string): { valid: boolean; message: string } => {
  if (!name || !name.trim()) {
    return { valid: false, message: 'Name is required' };
  }
  
  // Only allow letters (including unicode for international names) and spaces
  const nameRegex = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'-]+$/;
  
  if (!nameRegex.test(name.trim())) {
    return { valid: false, message: 'Name can only contain letters' };
  }
  
  if (name.trim().length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validates a location (pickup/dropoff).
 * - Allows letters, numbers, spaces and common address punctuation
 * - Must contain at least one letter (cannot be only numbers)
 */
export const validateLocation = (location: string): { valid: boolean; message: string } => {
  if (!location || !location.trim()) {
    return { valid: false, message: 'Location is required' };
  }

  const trimmed = location.trim();

  // Reject if there are no letters at all (e.g. "12345")
  if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) {
    return { valid: false, message: 'Location must include a place name, not only numbers' };
  }

  // Allow letters, numbers, spaces and common address characters
  if (!/^[a-zA-Z0-9\u00C0-\u024F\s,.\-/#()]+$/.test(trimmed)) {
    return { valid: false, message: 'Location contains invalid characters' };
  }

  if (trimmed.length < 3) {
    return { valid: false, message: 'Please enter a more specific location' };
  }

  return { valid: true, message: '' };
};

/**
 * Validates that a date is not in the past
 */
export const validateNotPastDate = (dateStr: string): { valid: boolean; message: string } => {
  if (!dateStr) {
    return { valid: false, message: 'Date is required' };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const selectedDate = new Date(dateStr);
  selectedDate.setHours(0, 0, 0, 0);
  
  if (selectedDate < today) {
    return { valid: false, message: 'Date cannot be in the past' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Validates that end date is after start date
 */
export const validateDateRange = (startDate: string, endDate: string): { valid: boolean; message: string } => {
  if (!startDate || !endDate) {
    return { valid: false, message: 'Both dates are required' };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < start) {
    return { valid: false, message: 'Drop-off date must be after pick-up date' };
  }
  
  return { valid: true, message: '' };
};

/**
 * Calculate end date based on start date and duration
 */
export const calculateEndDate = (startDate: string, durationDays: number): string => {
  if (!startDate || durationDays < 1) return '';
  
  const start = new Date(startDate);
  start.setDate(start.getDate() + durationDays);
  
  return start.toISOString().split('T')[0];
};

/**
 * Format phone number for Nepal (add spaces for readability)
 */
export const formatNepalPhone = (phone: string): string => {
  const cleaned = phone.replace(/[\s\-+]/g, '').replace(/^977/, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};
