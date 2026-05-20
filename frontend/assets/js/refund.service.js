/**
 * Refund service — shared between customer-facing and admin.
 *
 * Reads from `refunds` table (RLS scoped) and provides helpers for
 * refund eligibility checks, status tracking, and refund initiation.
 */
(function () {
  "use strict";

  var REFUND_STEPS = [
    { key: "initiated",  label: "Refund Initiated",  icon: "flag" },
    { key: "approved",   label: "Approved",           icon: "check_circle" },
    { key: "processing", label: "Processing",         icon: "sync" },
    { key: "completed",  label: "Completed",          icon: "paid" },
  ];

  var REFUND_STEP_KEYS = REFUND_STEPS.map(function (s) { return s.key; });

  function getClient() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client not available");
    }
    return window.SupabaseClient.init();
  }

  /**
   * List refunds for the current user (RLS-scoped).
   */
  async function listUserRefunds() {
    var client = getClient();
    var result = await client
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      if (result.error.message && (
        result.error.message.indexOf("does not exist") >= 0 ||
        result.error.message.indexOf("relation") >= 0
      )) {
        return [];
      }
      throw new Error(result.error.message || "Failed to load refunds");
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  /**
   * Get a single refund by booking ID.
   */
  async function getRefundByBookingId(bookingId) {
    if (!bookingId) return null;
    var client = getClient();
    var result = await client
      .from("refunds")
      .select("*")
      .eq("booking_id", bookingId)
      .not("status", "in", "(rejected,failed)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) return null;
    return result.data || null;
  }

  /**
   * Check refund eligibility for a booking (calls DB function).
   */
  async function checkEligibility(bookingId) {
    if (!bookingId) return { eligible: false, reason: "No booking ID" };
    var client = getClient();
    var result = await client.rpc("calculate_refund_eligibility", { p_booking_id: bookingId });
    if (result.error) {
      return { eligible: false, reason: result.error.message || "Eligibility check failed" };
    }
    return result.data || { eligible: false, reason: "Unknown error" };
  }

  /**
   * Admin: initiate a refund.
   */
  async function initiateRefund(params) {
    var client = getClient();

    var statusEntry = {
      status: "initiated",
      timestamp: new Date().toISOString(),
      by: params.initiatedBy || null,
      note: "Refund initiated by admin",
    };

    var row = {
      refund_code: "",
      booking_id: params.bookingId,
      payment_id: params.paymentId || null,
      transaction_code: params.transactionCode || null,
      customer_user_id: params.customerUserId || null,
      customer_email: params.customerEmail || null,
      customer_name: params.customerName || null,
      original_paid_amount: Number(params.originalPaidAmount || 0),
      refund_amount: Number(params.refundAmount || 0),
      refund_percentage: Number(params.refundPercentage || 0),
      policy_rule: params.policyRule || "manual",
      pickup_date: params.pickupDate || null,
      cancelled_at: params.cancelledAt || null,
      hours_before_pickup: Number(params.hoursBeforePickup || 0),
      refund_method: params.refundMethod || "original",
      refund_reference: params.refundReference || null,
      status: "initiated",
      status_history: [statusEntry],
      initiated_by: params.initiatedBy || null,
      notes: params.notes || null,
    };

    var result = await client.from("refunds").insert(row).select().single();
    if (result.error) {
      throw new Error(result.error.message || "Failed to create refund");
    }
    return result.data;
  }

  /**
   * Admin: update refund status (approve, process, complete, reject, fail).
   */
  async function updateRefundStatus(refundId, newStatus, opts) {
    opts = opts || {};
    var client = getClient();

    // Get current status_history
    var current = await client.from("refunds").select("status_history").eq("id", refundId).single();
    var history = (current.data && Array.isArray(current.data.status_history)) ? current.data.status_history : [];

    var entry = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      by: opts.adminId || null,
      note: opts.note || ("Status changed to " + newStatus),
    };
    history.push(entry);

    var update = {
      status: newStatus,
      status_history: history,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "approved") update.approved_by = opts.adminId || null;
    if (newStatus === "rejected") update.rejection_reason = opts.rejectionReason || "";
    if (newStatus === "completed") {
      update.refund_reference = opts.refundReference || null;
    }
    if (opts.notes) update.notes = opts.notes;

    var result = await client.from("refunds").update(update).eq("id", refundId).select().single();
    if (result.error) {
      throw new Error(result.error.message || "Failed to update refund");
    }
    return result.data;
  }

  /**
   * Admin: list all refunds.
   */
  async function listAllRefunds() {
    var client = getClient();
    var result = await client
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (result.error) {
      if (result.error.message && result.error.message.indexOf("does not exist") >= 0) {
        return [];
      }
      throw new Error(result.error.message || "Failed to load refunds");
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  /**
   * Get refund step progress info for display.
   */
  function getRefundStepProgress(refund) {
    var currentStatus = String(refund && refund.status ? refund.status : "initiated").toLowerCase();
    var history = (refund && Array.isArray(refund.status_history)) ? refund.status_history : [];

    var isFailed = currentStatus === "failed";
    var isRejected = currentStatus === "rejected";
    var isTerminal = isFailed || isRejected;

    var currentIdx = REFUND_STEP_KEYS.indexOf(currentStatus);
    if (currentIdx < 0 && !isTerminal) currentIdx = 0;

    var steps = REFUND_STEPS.map(function (step, idx) {
      var historyEntry = history.find(function (h) { return h.status === step.key; });
      var isActive = idx === currentIdx;
      var isComplete = idx < currentIdx || currentStatus === "completed";

      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        isActive: isActive,
        isComplete: isComplete,
        timestamp: historyEntry ? historyEntry.timestamp : null,
        note: historyEntry ? historyEntry.note : null,
      };
    });

    return {
      steps: steps,
      currentStatus: currentStatus,
      isFailed: isFailed,
      isRejected: isRejected,
      isCompleted: currentStatus === "completed",
      rejectionReason: isRejected ? String(refund.rejection_reason || "") : "",
    };
  }

  function formatRefundMoney(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n)) n = 0;
    return "NPR " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  window.VehicleRefundService = {
    listUserRefunds: listUserRefunds,
    getRefundByBookingId: getRefundByBookingId,
    checkEligibility: checkEligibility,
    initiateRefund: initiateRefund,
    updateRefundStatus: updateRefundStatus,
    listAllRefunds: listAllRefunds,
    getRefundStepProgress: getRefundStepProgress,
    formatRefundMoney: formatRefundMoney,
    REFUND_STEPS: REFUND_STEPS,
  };
})();
