/**
 * Admin payments service.
 *
 * Reads from `payments` (RLS allows admins to see all rows via the
 * "Customers read own payments" policy + is_admin_user fallback) and joins
 * the latest receipt + booking summary client-side.
 *
 * Mutations are limited to firing the `esewa-payment` Edge Function, which
 * already enforces admin override server-side.
 */
export function createPaymentsService() {
  let clientPromise;

  async function getClient() {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') {
        throw new Error('Supabase client bootstrap is missing.');
      }
      if (!window.SupabaseClient.isConfigured()) {
        throw new Error('Supabase configuration is missing.');
      }
      return window.SupabaseClient.init();
    })();

    return clientPromise;
  }

  async function listPayments() {
    const client = await getClient();

    // We pull both the new provider_* columns (migration 025) and the legacy
    // khalti_* columns so the admin UI still works on databases that have not
    // run 025 yet. The mapper below prefers the new columns when present.
    let result = await client
      .from('payments')
      .select(
        'id,transaction_code,booking_id,customer_user_id,customer_email,customer_name,' +
        'payment_method,payment_type,amount,total_booking_amount,currency,status,failure_reason,' +
        'provider_reference,provider_transaction_id,' +
        'khalti_pidx,khalti_transaction_id,khalti_payment_url,initiated_at,expires_at,paid_at,' +
        'created_at,updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(500);

    // Fall back to wildcard select if specific columns are missing
    if (result.error && result.error.message && result.error.message.includes('does not exist')) {
      result = await client
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
    }

    if (result.error) {
      throw new Error(result.error.message || 'Failed to load payments.');
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  async function listReceipts() {
    const client = await getClient();

    let result = await client
      .from('payment_receipts')
      .select('id,receipt_code,payment_id,booking_id,customer_user_id,email_to,email_status,email_sent_at,email_error,created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    // Table might not exist yet — return empty instead of crashing
    if (result.error && result.error.message && (
      result.error.message.includes('does not exist') ||
      result.error.message.includes('relation') ||
      result.error.message.includes('permission denied')
    )) {
      return [];
    }

    if (result.error) {
      throw new Error(result.error.message || 'Failed to load receipts.');
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  async function listBookingSummaries(bookingIds) {
    const client = await getClient();
    const ids = Array.from(new Set((Array.isArray(bookingIds) ? bookingIds : []).filter(Boolean)));
    if (!ids.length) return {};

    let result = await client
      .from('vehicle_bookings')
      .select('id,booking_code,customer_name,customer_email,total_amount,paid_amount,remaining_amount,payment_status,start_date,end_date,status')
      .in('id', ids);

    if (result.error && result.error.message && result.error.message.includes('does not exist')) {
      result = await client
        .from('vehicle_bookings')
        .select('*')
        .in('id', ids);
    }

    if (result.error) {
      return {};
    }

    const indexed = {};
    (Array.isArray(result.data) ? result.data : []).forEach((row) => {
      if (row && row.id) indexed[row.id] = row;
    });
    return indexed;
  }

  /**
   * Hydrates the full admin payments dataset: payments + receipts +
   * matching bookings. Returns rows sorted newest-first with stat totals.
   */
  async function loadAdminPayments() {
    const [payments, receipts] = await Promise.all([
      listPayments(),
      listReceipts(),
    ]);

    const bookingIds = payments.map((row) => row && row.booking_id).filter(Boolean);
    const bookingsById = await listBookingSummaries(bookingIds);

    const receiptsByPaymentId = {};
    receipts.forEach((row) => {
      if (!row || !row.payment_id) return;
      // Latest first thanks to the SELECT order.
      if (!receiptsByPaymentId[row.payment_id]) {
        receiptsByPaymentId[row.payment_id] = row;
      }
    });

    const rows = payments.map((payment) => {
      const booking = bookingsById[payment.booking_id] || {};
      const receipt = receiptsByPaymentId[payment.id] || null;
      const total = Number(payment.total_booking_amount || booking.total_amount || 0);
      const paid = Number(booking.paid_amount || 0);
      const remaining = Number(booking.remaining_amount != null
        ? booking.remaining_amount
        : Math.max(0, total - paid));

      return {
        id: payment.id,
        transactionCode: String(payment.transaction_code || ''),
        bookingId: String(payment.booking_id || ''),
        bookingCode: String(booking.booking_code || ''),
        customerName: String(payment.customer_name || booking.customer_name || ''),
        customerEmail: String(payment.customer_email || booking.customer_email || ''),
        method: String(payment.payment_method || 'esewa'),
        paymentType: String(payment.payment_type || 'full'),
        amount: Number(payment.amount || 0),
        currency: String(payment.currency || 'NPR'),
        status: String(payment.status || 'initiated'),
        failureReason: String(payment.failure_reason || ''),
        providerReference: String(payment.provider_reference || payment.khalti_pidx || ''),
        providerTransactionId: String(payment.provider_transaction_id || payment.khalti_transaction_id || ''),
        initiatedAt: String(payment.initiated_at || ''),
        expiresAt: String(payment.expires_at || ''),
        paidAt: String(payment.paid_at || ''),
        createdAt: String(payment.created_at || ''),
        bookingTotalAmount: total,
        bookingPaidAmount: paid,
        bookingRemainingAmount: remaining,
        bookingPaymentStatus: String(booking.payment_status || ''),
        bookingTravelStartDate: String(booking.start_date || ''),
        bookingTravelEndDate: String(booking.end_date || ''),
        bookingStatus: String(booking.status || ''),
        receipt,
        receiptCode: receipt ? String(receipt.receipt_code || '') : '',
        receiptEmailStatus: receipt ? String(receipt.email_status || 'pending') : '',
        receiptEmailTo: receipt ? String(receipt.email_to || '') : '',
        receiptEmailSentAt: receipt ? String(receipt.email_sent_at || '') : '',
        receiptEmailError: receipt ? String(receipt.email_error || '') : '',
      };
    });

    return {
      rows,
      stats: computeStats(rows),
    };
  }

  function computeStats(rows) {
    const stats = {
      total: rows.length,
      revenuePaid: 0,
      revenueOutstanding: 0,
      countCompleted: 0,
      countPartial: 0,
      countFailed: 0,
      countPending: 0,
      countExpired: 0,
      receiptsSent: 0,
      receiptsFailed: 0,
    };

    rows.forEach((row) => {
      if (row.status === 'completed') {
        stats.countCompleted += 1;
        stats.revenuePaid += Number(row.amount || 0);
      }
      if (row.status === 'pending' || row.status === 'initiated') stats.countPending += 1;
      if (row.status === 'failed') stats.countFailed += 1;
      if (row.status === 'expired') stats.countExpired += 1;
      if (row.bookingPaymentStatus === 'partial') stats.countPartial += 1;
      if (row.receiptEmailStatus === 'sent') stats.receiptsSent += 1;
      if (row.receiptEmailStatus === 'failed') stats.receiptsFailed += 1;
    });

    // Outstanding NPR is computed off the booking ledger to avoid double
    // counting when there are several payments per booking.
    const seenBookings = new Set();
    rows.forEach((row) => {
      if (!row.bookingId || seenBookings.has(row.bookingId)) return;
      seenBookings.add(row.bookingId);
      stats.revenueOutstanding += Number(row.bookingRemainingAmount || 0);
    });

    return stats;
  }

  async function resendReceipt(transactionCode) {
    const code = String(transactionCode || '').trim();
    if (!code) throw new Error('Missing transaction code.');

    const client = await getClient();
    const response = await client.functions.invoke('esewa-payment', {
      body: { action: 'resend_receipt', transactionCode: code },
    });

    if (response.error) {
      const payload = response.data || {};
      const message = (payload && payload.message) || response.error.message || 'Resend failed.';
      throw new Error(message);
    }
    return response.data || { success: true };
  }

  async function expireStale() {
    const client = await getClient();
    const response = await client.functions.invoke('esewa-payment', {
      body: { action: 'expire_stale' },
    });
    if (response.error) {
      const payload = response.data || {};
      throw new Error((payload && payload.message) || response.error.message || 'Expire failed.');
    }
    return response.data || { success: true, expired: 0 };
  }

  return {
    loadAdminPayments,
    resendReceipt,
    expireStale,
  };
}
