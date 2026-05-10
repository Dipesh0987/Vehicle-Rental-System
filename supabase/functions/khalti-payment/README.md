# khalti-payment edge function

End-to-end Khalti ePayment v2 integration for vehicle bookings, with partial
payment support (60% advance + balance), receipt emails, and in-app
notifications.

## Endpoints (single function, action-routed)

POST `/functions/v1/khalti-payment` with JSON body:

| `action`              | who can call | purpose |
|-----------------------|--------------|---------|
| `initiate`            | customer     | Create payment + return Khalti `payment_url` |
| `verify`              | customer     | Look up `pidx` and finalize payment |
| `resend_receipt`      | customer/admin | Re-send invoice email |
| `list_user_payments`  | customer     | Last 50 payments for the caller |
| `expire_stale`        | admin only   | Sweep expired `initiated`/`pending` rows |

All requests require `Authorization: Bearer <supabase-jwt>`.

## Required secrets

Set these on the Supabase project:

```
supabase secrets set \
  KHALTI_BASE_URL=https://dev.khalti.com/api/v2 \
  KHALTI_SECRET_KEY=test_secret_key_xxxxx \
  PAYMENT_RETURN_URL=https://your.site/frontend/payment-return.html \
  PAYMENT_WEBSITE_URL=https://your.site \
  RESEND_API_KEY=re_xxxxx \
  PAYMENT_RECEIPT_FROM_EMAIL="RentAVehicle <receipts@your-domain.com>" \
  PAYMENT_APP_NAME="RentAVehicle Nepal" \
  PARTIAL_PAYMENT_PERCENT=0.60
```

Switch `KHALTI_BASE_URL` to `https://a.khalti.com/api/v2` and use the live
secret key for production. The function returns `503` until both
`KHALTI_BASE_URL` and `KHALTI_SECRET_KEY` are set, so the rest of the site is
not affected if you forget to configure them.

## Deploy

```
supabase functions deploy khalti-payment --no-verify-jwt
```

`--no-verify-jwt` is intentional: we verify the JWT inside the function so we
can return helpful error bodies (the gateway-level check returns an opaque
401). Booking ownership is enforced inside `handleInitiate`, `handleVerify`,
and `handleResendReceipt`.

## Lifecycle (happy path)

1. Customer fills booking form → backend writes `vehicle_bookings` row with
   `payment_deadline = created_at + 15 minutes`.
2. Frontend redirects to `payment.html?booking=<id>` and calls `action:
   initiate` with `paymentType: "full" | "partial"`.
3. Function creates a `payments` row (status `initiated`), calls Khalti, then
   patches `khalti_pidx` + `khalti_payment_url` and bumps status to `pending`.
4. Frontend redirects browser to `payment_url`.
5. Khalti redirects back to `PAYMENT_RETURN_URL?pidx=...&status=Completed&...`.
6. Frontend calls `action: verify` with `pidx`. Function looks up Khalti, on
   `Completed` flips `payments.status='completed'`, the trigger updates
   `vehicle_bookings.paid_amount/remaining_amount/payment_status`, and the
   receipt email is sent.
7. Customer sees the success screen with `bookingCode` + `transactionCode`
   (`P-XXXX`). Receipt arrives in inbox within ~60s.

## Failure handling

* `Khalti status = User canceled / Failed / Refunded` → `payments.status =
  failed`, `failure_reason` set, customer notified, frontend offers retry.
* `Khalti status = Expired` or `expires_at < now()` → `payments.status =
  expired`. Calling `expire_stale_payments()` periodically keeps stale rows
  honest.
* Resend API errors are stored in `payment_receipts.email_error` so the
  admin "Resend Receipt" button can recover from transient failures.
