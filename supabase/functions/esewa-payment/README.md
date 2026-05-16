# esewa-payment edge function

Deploy and configure the eSewa payment edge function used by the public
site and admin console. This function replaces the older Khalti integration
and writes generic `provider_*` fields into the `payments` table.

Required secrets (example):

```bash
supabase secrets set \
  ESEWA_GATEWAY_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form \
  ESEWA_STATUS_URL=https://rc.esewa.com.np/api/epay/transaction/status/ \
  ESEWA_PRODUCT_CODE=EPAYTEST \
  ESEWA_SECRET_KEY=your_esewa_secret_key \
  PAYMENT_SUCCESS_URL=https://your.site/frontend/payment-return.html \
  PAYMENT_FAILURE_URL=https://your.site/frontend/payment-return.html \
  PAYMENT_WEBSITE_URL=https://your.site \
  RESEND_API_KEY=re_xxxxx \
  PAYMENT_RECEIPT_FROM_EMAIL="RentAVehicle <receipts@your-domain.com>" \
  PAYMENT_APP_NAME="RentAVehicle Nepal" \
  PARTIAL_PAYMENT_PERCENT=0.60
```

Deploy:

```bash
supabase functions deploy esewa-payment --no-verify-jwt
```

Notes:
- The function creates/updates rows in `public.payments` and uses
  `provider_reference`, `provider_transaction_id`, and `provider_response`.
- We provide a migration `database/migrations/030_migrate_khalti_to_esewa.sql`
  to backfill legacy `khalti_*` columns into the generic `provider_*` fields
  and to map `payment_method='khalti'` → `'esewa'`.
- After deploying `esewa-payment`, you can retire the `khalti-payment`
  function (the code in `supabase/functions/khalti-payment` is retained as
  a deprecated reference but returns HTTP 410 for POSTs).
