/**
 * Utilization service — computes per-segment utilization rates.
 *
 * Utilization % = (booked vehicle-days in range / total vehicle-days in range) * 100
 *
 * Falls back to static dashboard data when Supabase is unavailable.
 */

import { SEGMENT_COLORS } from '../config.js';

const DEFAULT_SEGMENTS = Object.keys(SEGMENT_COLORS);

/**
 * Count overlapping days between a booking and the filter window.
 */
function overlapDays(bookingStart, bookingEnd, windowStart, windowEnd) {
  const s = Math.max(bookingStart.getTime(), windowStart.getTime());
  const e = Math.min(bookingEnd.getTime(), windowEnd.getTime());
  if (e <= s) return 0;
  return Math.ceil((e - s) / 86400000);
}

/**
 * Compute utilization rates per segment from live booking + vehicle data.
 *
 * @param {Object} opts
 * @param {Array}  opts.bookings  — admin-normalised booking rows
 * @param {Array}  opts.vehicles  — admin-normalised vehicle rows
 * @param {Date}   opts.startDate — filter window start
 * @param {Date}   opts.endDate   — filter window end
 * @returns {{ label: string, value: number }[]}
 */
export function computeSegmentUtilization({ bookings, vehicles, startDate, endDate }) {
  const vList = Array.isArray(vehicles) ? vehicles : [];
  const bList = Array.isArray(bookings) ? bookings : [];

  // Group vehicles by segment (category)
  const segmentVehicleCounts = {};
  for (const v of vList) {
    const seg = v.category || v.segment || 'Other';
    segmentVehicleCounts[seg] = (segmentVehicleCounts[seg] || 0) + 1;
  }

  // Total calendar days in window
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

  // Accumulate booked vehicle-days per segment
  const segmentBookedDays = {};
  for (const b of bList) {
    // Only count confirmed / active / completed bookings
    const status = String(b.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'expired') continue;

    const bStart = (b.startDate || b.start) ? new Date(b.startDate || b.start) : null;
    const bEnd   = (b.endDate || b.end)     ? new Date(b.endDate || b.end)     : null;
    if (!bStart || !bEnd || isNaN(bStart) || isNaN(bEnd)) continue;

    // Resolve segment: prefer explicit category fields, then match via vehicleId
    let seg = b.vehicleCategory || b.vehicleType || b.category || b.type || b.segment || '';
    if ((!seg || seg === 'Vehicle') && b.vehicleId) {
      const matchedVehicle = vList.find((v) => v.id === b.vehicleId);
      if (matchedVehicle) seg = matchedVehicle.category || matchedVehicle.segment || 'Other';
    }
    if (!seg || seg === 'Vehicle') seg = 'Other';

    const days = overlapDays(bStart, bEnd, startDate, endDate);
    if (days > 0) {
      segmentBookedDays[seg] = (segmentBookedDays[seg] || 0) + days;
    }
  }

  // Build result array — only use segments that exist in the actual vehicle fleet
  const allSegments = new Set([...Object.keys(segmentVehicleCounts)]);
  const result = [];

  for (const seg of allSegments) {
    const vehicleCount = segmentVehicleCounts[seg] || 0;
    const bookedDays   = segmentBookedDays[seg] || 0;
    const capacity     = vehicleCount * totalDays;
    const rate = capacity > 0 ? Math.round((bookedDays / capacity) * 100) : 0;
    result.push({ label: seg, value: Math.min(rate, 100) });
  }

  return result;
}

/**
 * Return the default static utilization data (from dashboardData).
 */
export function getStaticUtilization(data) {
  return Array.isArray(data.utilization) ? data.utilization : [];
}
