# Vehicle Rental System — Enterprise Audit Report

**Date:** 2026-05-19
**Auditor:** Senior Full-Stack Architect / Security Engineer
**Scope:** Complete codebase — frontend, admin, edge functions, database, security, performance

---

## A. EXECUTIVE SUMMARY

| Dimension | Score | Grade |
|---|---|---|
| **Architecture Quality** | 7.2 / 10 | B |
| **Code Quality** | 6.5 / 10 | C+ |
| **Security** | 5.0 / 10 | D |
| **Performance** | 6.8 / 10 | C+ |
| **Scalability** | 6.0 / 10 | C |
| **Maintainability** | 5.5 / 10 | C- |
| **Production Readiness** | 4.5 / 10 | D |

**Overall: NOT production-ready.** The application has solid feature coverage and a well-structured admin panel, but has critical security vulnerabilities, dead code bloat, missing admin role enforcement in RLS, and no CI/CD or testing infrastructure. Requires the fixes below before production deployment.

---

## B. COMPLETE BUG & VULNERABILITY REPORT

### CRITICAL (Must Fix Before Production)

---

#### B-01: Hardcoded Supabase Credentials Committed to Git

- **Severity:** CRITICAL
- **Files:** `frontend/assets/js/supabase.config.js`, `frontend/assets/js/supabase.configlocal.js`
- **Issue:** Real Supabase project URL and anon key (`sb_publishable_A1YrGw_...`) are hardcoded and tracked in Git. Even though this is a "publishable" anon key, its exposure alongside the project URL gives attackers a target for API abuse, RLS bypass attempts, and data enumeration. The key is in Git history permanently.
- **Root Cause:** `supabase.config.js` is not gitignored; only `supabase.config.local.js` is.
- **Fix:**
  1. Add `frontend/assets/js/supabase.config.js` to `.gitignore`.
  2. Replace committed file contents with placeholder values.
  3. Rotate the anon key in Supabase Dashboard.
  4. Use `supabase.config.example.js` (already exists) as the template.
  5. Consider `git filter-branch` or BFG to scrub key from history.

---

#### B-02: Admin Login Accepts Credentials via URL Query Parameters

- **Severity:** CRITICAL
- **File:** `frontend/admin/assets/js/login.js` lines 70-89
- **Issue:** `prefillFromQuery()` reads `adminUsername` and `adminPassword` from the URL. Credentials in URLs are logged in browser history, HTTP referrer headers, proxy logs, and analytics.
- **Root Cause:** Developer convenience feature left in production code.
- **Fix:** Remove the entire `prefillFromQuery` function and its call on line 123.

---

#### B-03: RLS Policies Allow ANY Authenticated User to Perform Admin Actions

- **Severity:** CRITICAL
- **Files:** Multiple migrations — `023_drivers_table.sql`, `024_maintenance_table.sql`, `027_damage_billing.sql`, `032_contact_messages.sql`
- **Issue:** RLS policies use `TO authenticated USING (true)` for INSERT, UPDATE, DELETE on admin-only tables (drivers, maintenance_records, damage_bills, contact_messages). **Any logged-in customer can delete drivers, modify maintenance records, create fake damage bills, and delete contact messages.**
- **Root Cause:** No admin role check in RLS policies.
- **Fix:** All admin-write policies must check admin role:
  ```sql
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  ```

---

#### B-04: CORS Allows All Origins on Payment Edge Functions

- **Severity:** HIGH
- **Files:** `supabase/functions/khalti-payment/index.ts` line 136, `supabase/functions/esewa-payment/index.ts` line 138
- **Issue:** `Access-Control-Allow-Origin: *` on payment endpoints. Any website can initiate payment API calls on behalf of authenticated users (if they have the JWT).
- **Fix:** Replace `*` with your actual domain(s):
  ```ts
  "Access-Control-Allow-Origin": "https://yourdomain.com",
  ```

---

#### B-05: No Content Security Policy (CSP) on Any Page

- **Severity:** HIGH
- **Files:** All HTML pages except `payment-return.html`
- **Issue:** No CSP meta tag or header. XSS attacks can load arbitrary external scripts, exfiltrate data, or hijack sessions.
- **Fix:** Add CSP meta tag to all pages:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://esm.sh; connect-src 'self' https://*.supabase.co; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;">
  ```

---

#### B-06: Vehicle Bookings Table Readable by Anyone (Including Anonymous)

- **Severity:** HIGH
- **File:** `database/migrations/006_vehicle_bookings_system.sql`
- **Issue:** SELECT policy: `USING (true)` — any unauthenticated visitor can read all booking data including customer names, emails, phones, dates, and payment amounts.
- **Fix:** Restrict SELECT to booking owner + admins:
  ```sql
  USING (
    customer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  ```

---

### HIGH (Should Fix Before Production)

---

#### B-07: 314 Event Listeners vs 9 Removals — Memory Leak Risk

- **Severity:** HIGH
- **Files:** All frontend JS files, especially admin modules
- **Issue:** 314 `addEventListener` calls across the codebase but only 9 `removeEventListener` calls. Admin SPA re-renders modules by replacing innerHTML, but event listeners on document/window accumulate indefinitely.
- **Root Cause:** Admin uses innerHTML-based rendering without event delegation or cleanup.
- **Fix:** Use event delegation on stable parent elements instead of per-element listeners. For admin modules, implement a cleanup function called before each re-render.

---

#### B-08: No Rate Limiting on Payment Edge Functions

- **Severity:** HIGH
- **Files:** `supabase/functions/esewa-payment/index.ts`, `supabase/functions/khalti-payment/index.ts`
- **Issue:** Password reset has rate limiting, but payment initiation endpoints have none. An attacker can spam payment creation, generating thousands of pending payment rows and potentially hitting gateway API limits.
- **Fix:** Add per-user rate limiting (e.g., max 5 initiations per minute per user).

---

#### B-09: 99 Console.log Statements in Production Code

- **Severity:** MEDIUM
- **Files:** 27 JS files across frontend and admin
- **Issue:** Debug logging exposes internal state, error details, and data structures to anyone with browser DevTools open.
- **Fix:** Replace with a conditional logger that is silent in production, or strip console calls in build step.

---

### MEDIUM

---

#### B-10: Vehicles Table Public Write Access

- **Severity:** MEDIUM
- **File:** `database/migrations/004_vehicle_catalog_and_images.sql`
- **Issue:** The "Public can manage vehicles" policy allows any user to INSERT/UPDATE/DELETE vehicles. This was noted as intentional for dev but must be locked down for production.
- **Fix:** Restrict vehicle write operations to admin users only.

---

#### B-11: No CSRF Protection

- **Severity:** MEDIUM
- **Files:** All forms across the application
- **Issue:** No CSRF tokens on forms. Since auth uses JWT in localStorage (not cookies), this is partially mitigated, but any form that operates on session state could be exploited.
- **Recommendation:** Ensure all state-mutating operations verify the JWT from the Authorization header, not cookies.

---

---

## C. UNUSED FILE & DEAD CODE REPORT

### Files Safe to Delete

| File | Reason |
|---|---|
| `frontend/assets/js/booking-service.js` (5.7 KB) | Legacy service querying deprecated `bookings` table. Superseded by `booking.service.js`. Only imported by equally-dead `booking-modification-manager.js`. |
| `frontend/assets/js/booking-modification-manager.js` (8.5 KB) | Depends on dead `booking-service.js`. Not imported by any HTML page directly. |
| `frontend/assets/js/forgot-password.js` (10.5 KB) | Not referenced by any HTML page. `forgot-password-simple.js` is the one used by `login.html`. |
| `frontend/assets/js/home-top-rated.js` (11.4 KB) | Not referenced by any HTML file. Superseded by `top-rented-redesign.js`. |
| `frontend/assets/js/supabase.configlocal.js` (0.6 KB) | Legacy compatibility shim with hardcoded credentials. Not imported anywhere meaningful. |
| `backend/js/fleet-tracking.js` (4.9 KB) | Not imported by any HTML page or JS file in the entire project. |
| `frontend/tools/copy-sql.html` + `frontend/assets/js/copy-sql.js` | Developer tool, not a user-facing feature. Should not ship to production. |
| `frontend/assets/js/db.bootstrap.js` (1.4 KB) | DB bootstrapping utility loaded on index.html — debug/dev tool, not production code. |

### Duplicate Migration Files

| File | Duplicate Of |
|---|---|
| `database/migrations/004_bookings_table.sql` | Superseded by `006_vehicle_bookings_system.sql`. Creates legacy `bookings` table that's no longer used. |
| `database/migrations/004_vehicle_catalog.sql` | Superseded by `004_vehicle_catalog_and_images.sql` (more complete version). |
| `database/migrations/006_vehicles_table.sql` | Superseded by `004_vehicle_catalog_and_images.sql`. Creates a different schema for the same `vehicles` table. |
| `database/migrations/005_booking_events_and_modifications.sql` | Creates `booking_events` and `booking_modifications` tables for the legacy `bookings` system — never used by current code. |

### Root-Level Documentation Bloat (45 .md files)

The `.gitignore` excludes most `.md` files except `README.md` and `database/DATABASE_DESIGN.md`, so these don't ship to the repo. However, they clutter the local workspace. Consider consolidating into `docs/` folder.

**Total removable code: ~42 KB of dead JavaScript + 5 orphaned SQL migrations.**

---

## D. FRONTEND QA REPORT

### UI / State Issues

| # | Issue | Severity | File(s) |
|---|---|---|---|
| D-01 | Admin module re-renders wipe all event listeners — clicking rapidly during loading can cause orphaned state | Medium | All admin modules |
| D-02 | `innerHTML` used with user-controlled data in `contact.js` toast (line 162, 185) — technically safe since it's static SVG, but pattern is risky | Low | `contact.js` |
| D-03 | Admin payment select dropdown shows "Yes/No" instead of "Paid/Partially Paid/Unpaid" options — mismatch with actual 3-state system | Medium | `bookings.js` line 785-788 |
| D-04 | `modify-booking.js` imports from dead `booking-service.js` — modification flow may be broken if it relies on the legacy `bookings` table | High | `modify-booking.js`, `booking-modification-manager.js` |

### Responsiveness

| Issue | Details |
|---|---|
| Admin table columns | Very wide tables (12+ columns in bookings) overflow on tablet/mobile — no responsive collapse strategy |
| Payment page | Appears well-structured but should be tested on <375px screens for eSewa form overflow |

### Accessibility

| Issue | Details |
|---|---|
| Missing `aria-label` on icon-only buttons | Admin action buttons (read, reply, archive, delete) use only Material icons with no accessible text |
| Form error messages | Some forms use color alone to indicate errors (no icon or `role="alert"`) |
| Focus management | Admin modal open/close doesn't trap or restore focus |

---

## E. BACKEND QA REPORT

### Edge Functions

| # | Issue | Severity |
|---|---|---|
| E-01 | eSewa and Khalti functions share ~80% identical code (receipt email, verify flow, booking fetch) — violates DRY | Medium |
| E-02 | No input length validation on payment initiation — a malicious `bookingId` string could be very long | Low |
| E-03 | `expire_stale_payments` RPC called on every initiation — could be slow under load with many payment rows | Medium |

### Database

| # | Issue | Severity |
|---|---|---|
| E-04 | `password_reset_otps` table correctly restricts to `service_role` only — good | — |
| E-05 | No index on `payments.booking_id` for the trigger join | Medium |
| E-06 | `vehicle_locations` table (fleet tracking) has no TTL/cleanup — will grow unbounded | Medium |
| E-07 | `notifications` table has no index on `user_id` + `is_read` — slow for users with many notifications | Medium |

---

## F. PAYMENT AUDIT REPORT

### Strengths
- Idempotent verification — already-completed payments return cached result
- Amount cross-check — eSewa amount mismatch detection
- Stale payment expiry sweep
- DB trigger correctly updates booking `paid_amount`/`remaining_amount`/`payment_status`
- Receipt email with dev-redirect support
- Proper JWT auth verification on all payment endpoints

### Vulnerabilities / Issues

| # | Issue | Severity | Fix |
|---|---|---|---|
| F-01 | No rate limit on `initiate` action | High | Add per-user throttle |
| F-02 | CORS `*` allows cross-origin payment initiation | High | Restrict to app domain |
| F-03 | No duplicate-initiation guard per booking — user can create multiple pending payments for the same booking | Medium | Check for existing `pending` payment before creating new one |
| F-04 | Payment return page has CSP but other pages don't — inconsistent | Medium | Add CSP to all pages |
| F-05 | Admin can't manually mark a payment as refunded — no refund workflow | Low | Future feature |

### Edge Cases Handled Well
- Refresh during payment → verify re-checks gateway status
- Failed verification → clear error state returned
- Network interruption → pending state allows retry
- Duplicate clicks → `submitting` guard on frontend
- Expired sessions → `expire_stale` sweep

---

## G. SECURITY AUDIT REPORT

### Critical Vulnerabilities

| # | Vulnerability | Risk | Attack Vector | Fix |
|---|---|---|---|---|
| S-01 | Hardcoded Supabase credentials in Git | Critical | Anyone with repo access can enumerate/attack the DB | Rotate key, gitignore config |
| S-02 | Admin credentials via URL params | Critical | Browser history, referrer leakage | Remove `prefillFromQuery` |
| S-03 | No admin role check in RLS | Critical | Any authenticated user can modify admin-only tables | Add admin role check to policies |
| S-04 | Public SELECT on vehicle_bookings | High | Customer PII exposed to unauthenticated users | Restrict to owner + admin |
| S-05 | CORS wildcard on payment functions | High | Cross-site payment manipulation | Restrict origins |
| S-06 | No CSP headers | High | XSS payload execution | Add CSP meta tags |

### Good Security Practices Found
- Passwords never stored in localStorage
- No `eval()` or `new Function()` usage
- JWT-based auth (not cookie-based) mitigates CSRF
- Edge functions verify user ownership before mutations
- Service role key never exposed to frontend
- Password reset has rate limiting and OTP hashing
- Payment amount verification against gateway response

---

## H. PERFORMANCE AUDIT REPORT

### Bottlenecks

| # | Issue | Impact | Fix |
|---|---|---|---|
| P-01 | `backend/js/auth.js` is 140 KB / 3,263 lines — loaded on every page | High | Split into modules or lazy-load |
| P-02 | `ai-booking-chat.js` is 66 KB — loaded even when chat isn't used | Medium | Lazy-load on first chat open |
| P-03 | `booking.service.js` (46 KB) + `vehicle-catalog.service.js` (46 KB) loaded on pages that don't need them | Medium | Conditional loading |
| P-04 | Tailwind CSS loaded via CDN on every page (117 KB) + theme.css (79 KB) + payment.css (21 KB) = 217 KB CSS | Medium | Purge unused Tailwind classes, combine CSS |
| P-05 | No image optimization — vehicle images loaded from external URLs with no lazy loading in catalog | Medium | Add `loading="lazy"` to vehicle images |
| P-06 | Admin re-renders entire module on every state change (filter, sort, page) — causes layout thrash | Medium | Virtual DOM or incremental updates |
| P-07 | 314 event listeners accumulating without cleanup in admin SPA | High | Event delegation pattern |

### Quick Wins
1. Add `loading="lazy"` to all `<img>` tags
2. Move large JS files to `defer` or dynamic `import()`
3. Purge unused Tailwind classes (currently shipping all of Tailwind)
4. Add `rel="preconnect"` for Supabase domain
5. Cache vehicle catalog in `sessionStorage` to avoid repeat fetches

---

## I. REFACTOR REPORT

### Architecture Issues

| # | Issue | Files | Recommendation |
|---|---|---|---|
| R-01 | Two booking service files with different APIs | `booking-service.js` (legacy class), `booking.service.js` (current IIFE) | Delete legacy, keep current |
| R-02 | Two forgot-password implementations | `forgot-password.js` (unused), `forgot-password-simple.js` (active) | Delete unused |
| R-03 | `backend/js/auth.js` is a 3,263-line god file | `backend/js/auth.js` | Split into: auth-core, profile-ui, booking-guard, verification-ui |
| R-04 | Admin modules are 500-1000 line monoliths with HTML templates in JS | `admin/assets/js/modules/*.js` | Extract HTML templates, use template literals in separate files |
| R-05 | eSewa and Khalti edge functions are 90% duplicate code | `supabase/functions/esewa-payment/`, `khalti-payment/` | Extract shared module: `_shared/payment-core.ts` |
| R-06 | Inconsistent module patterns — IIFE, ES modules, class-based, function-based all mixed | All frontend JS | Standardize on ES modules |
| R-07 | Magic numbers throughout | Various | Extract to constants file |

### Code Smells

| Smell | Example | Count |
|---|---|---|
| God files (>500 lines) | `auth.js`, `booking.service.js`, `ai-booking-chat.js`, admin modules | 15+ files |
| Deeply nested conditionals | `booking.service.js` payment fallback logic | Multiple |
| String-based status checks | `if (status === 'paid')` scattered everywhere | 50+ instances |
| Repeated HTML generation | Status badges, payment pills duplicated across admin modules | 10+ locations |
| No TypeScript | Entire frontend | All files |

---

## J. ENTERPRISE FOLDER STRUCTURE

### Recommended Structure

```
Vehicle-Rental-System/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, build
│       └── deploy.yml                # Deploy to hosting
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── API.md
│   └── SECURITY.md
├── database/
│   ├── migrations/                   # Keep as-is (well organized)
│   ├── seeds/                        # Move seed SQL here
│   └── schema/
│       └── DATABASE_DESIGN.md
├── supabase/
│   └── functions/
│       ├── _shared/                  # Shared payment/auth/email utilities
│       │   ├── payment-core.ts
│       │   ├── email.ts
│       │   └── auth.ts
│       ├── esewa-payment/
│       ├── khalti-payment/
│       ├── booking-chat/
│       ├── password-reset-code/
│       ├── send-payment-receipt/
│       └── damage-billing/
├── frontend/
│   ├── public/                       # Static HTML pages
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── vehicles.html
│   │   └── ...
│   ├── src/
│   │   ├── core/                     # Shared services
│   │   │   ├── supabase.client.js
│   │   │   ├── auth.service.js       # Extracted from 3,263-line auth.js
│   │   │   ├── profile.service.js
│   │   │   └── notifications.service.js
│   │   ├── features/                 # Feature modules
│   │   │   ├── booking/
│   │   │   ├── payment/
│   │   │   ├── vehicles/
│   │   │   ├── search/
│   │   │   └── contact/
│   │   ├── components/               # Shared UI components
│   │   │   ├── footer.js
│   │   │   ├── theme-manager.js
│   │   │   └── toast.js
│   │   └── utils/                    # Pure utility functions
│   │       ├── format.js
│   │       ├── validate.js
│   │       └── date.js
│   ├── admin/
│   │   ├── index.html
│   │   ├── login.html
│   │   └── src/
│   │       ├── app.js
│   │       ├── modules/              # Keep current structure
│   │       ├── services/
│   │       └── shared/
│   │           ├── ui.js
│   │           ├── table-utils.js
│   │           └── config.js
│   └── assets/
│       ├── css/
│       ├── images/
│       └── vendor/
├── tests/                            # NEW
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── README.md
├── tailwind.config.js
└── package.json
```

---

## K. PRODUCTION READINESS CHECKLIST

### Must-Have (Blocking)

- [ ] **Rotate Supabase anon key** — current key is exposed in Git history
- [ ] **Gitignore `supabase.config.js`** — prevent future credential commits
- [ ] **Remove `prefillFromQuery`** from admin login — credential exposure via URL
- [ ] **Add admin role check to all admin-table RLS policies** — drivers, maintenance, damage_bills, contact_messages
- [ ] **Restrict vehicle_bookings SELECT** to owner + admin
- [ ] **Restrict vehicles INSERT/UPDATE/DELETE** to admin only
- [ ] **Replace CORS `*`** with actual domain on edge functions
- [ ] **Add CSP headers** to all HTML pages
- [ ] **Delete dead code files** (see Section C)
- [ ] **Remove `console.log`** statements or gate behind env flag

### Should-Have (Important)

- [ ] **Add rate limiting** to payment initiation edge functions
- [ ] **Add duplicate-initiation guard** — check for existing pending payment before creating new
- [ ] **Add indexes** on `payments.booking_id`, `notifications.user_id`
- [ ] **Implement event listener cleanup** in admin SPA modules
- [ ] **Add `loading="lazy"`** to all vehicle images
- [ ] **Split `backend/js/auth.js`** into smaller modules
- [ ] **Add error boundaries** — global unhandled rejection handler
- [ ] **Add `aria-label`** to icon-only buttons

### Nice-to-Have (Post-Launch)

- [ ] **Add unit tests** for booking quote calculation, payment amount validation
- [ ] **Add E2E tests** (Playwright) for booking → payment → admin verification flow
- [ ] **Set up CI/CD** — GitHub Actions for lint + deploy
- [ ] **Add monitoring** — Supabase Dashboard alerts, error tracking (Sentry)
- [ ] **Add TypeScript** — gradual migration starting with edge functions
- [ ] **Implement backup strategy** — Supabase daily backups (Pro plan)
- [ ] **Add analytics** — page views, booking conversion funnel
- [ ] **Refactor edge functions** — extract shared code into `_shared/` module
- [ ] **Purge Tailwind CSS** — reduce 117 KB to ~15 KB
- [ ] **Add `rel="preconnect"`** for Supabase URL

---

## PRIORITY ACTION PLAN

### Phase 1: Security Fixes (Day 1-2)
1. Rotate Supabase key
2. Fix RLS policies (admin role checks)
3. Remove URL credential prefill
4. Add CORS restrictions
5. Add CSP headers

### Phase 2: Cleanup (Day 3-4)
1. Delete dead code files
2. Remove duplicate migrations from active set
3. Strip console.log statements
4. Delete dev tools (copy-sql, db.bootstrap)

### Phase 3: Stability (Day 5-7)
1. Add payment rate limiting
2. Fix event listener leaks
3. Add missing DB indexes
4. Fix modify-booking to use current booking service

### Phase 4: Performance (Week 2)
1. Lazy-load large JS files
2. Purge Tailwind CSS
3. Add image lazy loading
4. Split auth.js monolith

### Phase 5: Quality (Week 3+)
1. Add unit tests
2. Add E2E tests
3. Set up CI/CD
4. TypeScript migration
