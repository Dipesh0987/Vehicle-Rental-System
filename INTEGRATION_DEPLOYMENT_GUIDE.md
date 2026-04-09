# Booking Modification Integration Guide

## Quick Start

### 1. Deploy Database Migrations

Open Supabase SQL Editor and execute migrations in order:

```sql
-- 1. Run migration 004
-- Copy and paste: database/migrations/004_bookings_table.sql

-- 2. Run migration 005
-- Copy and paste: database/migrations/005_booking_events_and_modifications.sql

-- 3. Run migration 006
-- Copy and paste: database/migrations/006_vehicles_table.sql
```

### 2. Verify Database Setup

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bookings', 'booking_events', 'booking_modifications', 'vehicles');

-- Check RLS is enabled
SELECT tablename FROM pg_tables WHERE schemaname='public';
SELECT * FROM information_schema.table_constraints 
WHERE constraint_name LIKE 'booking%';
```

### 3. Update Frontend Navigation

Add link in customer dashboard/bookings list:

**In `frontend/vehicles.html` or customer dashboard:**
```html
<button onclick="window.location.href='/frontend/modify-booking.html?id=${booking.id}'" 
        class="btn btn-primary">
  Modify Booking
</button>
```

### 4. Test the Feature

1. **Create a test booking:**
   - Go to `frontend/vehicles.html`
   - Select a vehicle and complete booking

2. **Modify the booking:**
   - Note the booking ID from the confirmation
   - Navigate to `modify-booking.html?id={booking-id}`
   - Change dates and/or vehicle
   - Verify price calculation
   - Submit form

3. **Verify audit trail:**
   - Check `booking_modifications` table in Supabase
   - Check `booking_events` table for new modification event

## Email Configuration

### Option A: SendGrid Integration

1. **Get SendGrid API Key:**
   - Sign up at https://sendgrid.com
   - Navigate to API Keys page
   - Create new API key with "Mail Send" permission

2. **Add to Supabase Environment:**
   - Supabase Dashboard → Settings → Integrations
   - Or add to `.env` file if using Edge Functions

3. **Create Edge Function:**

```typescript
// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import sgMail from "https://cdn.skypack.dev/@sendgrid/mail@7.7.0"

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")
sgMail.setApiKey(SENDGRID_API_KEY)

serve(async (req) => {
  try {
    const emailData = await req.json()
    
    const msg = {
      to: emailData.to,
      from: "noreply@vrs.example.com",
      subject: emailData.subject,
      html: emailData.body,
    }
    
    await sgMail.send(msg)
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
})
```

4. **Call from BookingModificationManager:**

```javascript
static async callEmailWebhook(emailData) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    }
  )
  return await response.json()
}
```

### Option B: Mailgun Integration

1. **Get Mailgun Credentials:**
   - Sign up at https://mailgun.com
   - Get API Key and Domain

2. **Create Edge Function:**

```typescript
serve(async (req) => {
  const emailData = await req.json()
  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY")
  const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN")
  
  const auth = btoa(`api:${MAILGUN_API_KEY}`)
  
  const formData = new FormData()
  formData.append("from", `VRS Support <support@${MAILGUN_DOMAIN}>`)
  formData.append("to", emailData.to)
  formData.append("subject", emailData.subject)
  formData.append("html", emailData.body)
  
  const response = await fetch(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}` },
      body: formData,
    }
  )
  
  return response
})
```

### Option C: AWS SES Integration

```typescript
import { SESClient, SendEmailCommand } from "https://esm.sh/@aws-sdk/client-ses@3.321.1"

serve(async (req) => {
  const emailData = await req.json()
  
  const client = new SESClient({ region: "us-east-1" })
  
  const command = new SendEmailCommand({
    Source: "noreply@vrs.example.com",
    Destination: { ToAddresses: [emailData.to] },
    Message: {
      Subject: { Data: emailData.subject },
      Body: { Html: { Data: emailData.body } }
    }
  })
  
  await client.send(command)
  return new Response(JSON.stringify({ success: true }))
})
```

## Deployment Checklist

- [ ] Supabase migrations applied (all 006)
- [ ] RLS policies verified
- [ ] Supabase auth configured
- [ ] Frontend files deployed
- [ ] Email service configured (SendGrid/Mailgun/SES)
- [ ] Environment variables set
- [ ] Test booking created and modified
- [ ] Confirmation email received
- [ ] Audit trail verified in database
- [ ] Error handling tested

## Production Considerations

### Security

1. **Authentication:**
   - Verify user owns booking before modification
   - RLS policies enforce row-level security
   - Only authenticated users can modify bookings

2. **Data Validation:**
   - All inputs validated on client and server
   - Date range validation
   - Vehicle availability checks
   - Price calculation verification

3. **Rate Limiting:**
   - Implement rate limits on modification API
   - Prevent abuse/spam modifications
   - Use Supabase Auth with rate limits

### Performance

1. **Database Optimization:**
   - Indexes on frequently queried columns
   - Cache vehicle list on frontend
   - Use connection pooling

2. **Frontend Optimization:**
   - Lazy load modification history
   - Debounce price calculations
   - Minimize API calls

### Monitoring

1. **Logging:**
   - Log all modifications to booking_events
   - Track email delivery status
   - Monitor error rates

2. **Alerts:**
   - Alert on high refund rates
   - Monitor email delivery failures
   - Track API response times

## Troubleshooting

### Issue: "Vehicle not found" error

**Solution:**
- Verify vehicles table has data
- Check vehicle IDs are correct
- Ensure vehicles.is_available = TRUE

### Issue: Dates showing as unavailable

**Solution:**
- Check booking_modifications table for conflicting bookings
- Verify booking status is 'confirmed' or 'pending'
- Check pickup/dropoff date logic

### Issue: Email not sending

**Solution:**
- Verify email service credentials
- Check notifications table for queued emails
- Review email service logs
- Verify sender email is verified in email service

### Issue: Price calculation incorrect

**Solution:**
- Check daily_rate on vehicles table
- Verify service fee and tax percentages
- Check for discount eligibility (5+ days)
- Verify insurance type configuration

### Issue: RLS policies blocking access

**Solution:**
- Check user authentication status
- Verify user_id matches booking.user_id
- Check admin role in JWT token
- Run policy validation queries

## Performance Optimization

### Enable Query Caching

```javascript
// In booking-service.js
setCache(key, data, 5 * 60 * 1000); // 5-minute TTL
```

### Debounce Price Calculation

```javascript
// In modify-booking.js
this.debounceTimer = setTimeout(() => {
  this.updatePricePreview();
}, 500); // Wait 500ms before calculating
```

## Scaling Considerations

For large fleets (1000+ vehicles):

1. **Pagination:** Load vehicles in batches
2. **Search:** Add vehicle search/filter
3. **Caching:** Cache vehicle catalog
4. **Async Processing:** Use background jobs for email
5. **Read Replicas:** Use Supabase read replicas

## Support & Maintenance

### Regular Tasks

- [ ] Monitor email delivery rates
- [ ] Review modification audit trail monthly
- [ ] Check for failed modifications
- [ ] Update pricing based on demand
- [ ] Verify RLS policies work correctly

### Documentation Updates

- Update this guide when adding features
- Document any customizations
- Keep API documentation current

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [SendGrid Email API](https://docs.sendgrid.com/)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)

## Version History

- v1.0 (2026-04-09): Initial implementation
  - Basic modify dates/vehicle functionality
  - Price recalculation
  - Email notifications
  - Audit trail logging
