# 🚗 Vehicle Rental System

A full-stack, premium vehicle rental web application built with vanilla JavaScript, Tailwind CSS, and Supabase as the backend. It supports customer booking flows, payment processing (eSewa & Khalti), an AI booking chat assistant, a complete admin panel, and real-time payment status synchronization.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Migrations](#database-migrations)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Admin Panel](#admin-panel)
- [Payment Integration](#payment-integration)
- [Auth Flow](#auth-flow)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)

---

## ✨ Features

### Customer-Facing
- **Landing Page** — Hero section, top-rated vehicles, how-it-works section, footer
- **Vehicle Catalog** — Filter by type, brand, price range, availability; search with advanced filters
- **Vehicle Details** — Full vehicle profile with specs, images, pricing breakdown
- **Booking Flow** — Date/time picker, availability check, driver option, coupon codes, price preview
- **Payment** — eSewa and Khalti integration with full/partial payment support, receipt emails
- **Booking Management** — View/modify/cancel bookings; modification request workflow
- **Profile & KYC Verification** — Upload documents, track verification status
- **AI Booking Chat** — Natural-language assistant for booking queries (Supabase Edge Function)
- **Contact Form** — Messages saved to database and visible in admin panel
- **Notifications Bell** — Real-time in-app notifications for payment, booking, and system events
- **Password Reset** — Custom OTP-based forgot-password flow via Resend email
- **Dark / Light Mode** — System-aware theme with manual toggle

### Admin Panel (`/frontend/admin/`)
- **Overview Dashboard** — Live stats: bookings, revenue, fleet, customers
- **Bookings Module** — Full CRUD, status management, payment status (paid/partial/unpaid), real-time sync
- **Payments Module** — Transaction list, receipt status, booking link, provider reference
- **Vehicles Module** — Add/edit/delete vehicles, image management, catalog sync
- **Fleet Module** — Live GPS tracking map of active vehicles
- **Customers Module** — KYC verification queue, approve/reject, trip counts
- **Drivers Module** — Driver profiles, assignment management
- **Maintenance Module** — Real-time maintenance records, damage billing
- **Pricing Module** — Base rates, service fees, tax, discount configuration
- **Reports Module** — Revenue and booking analytics
- **Reviews Module** — Customer review management
- **Notifications Module** — Admin notification management
- **Contact Messages Module** — View, filter, reply, archive, delete customer contact submissions
- **Admins Module** — Admin user management

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules) |
| Backend/DB | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (Email + OTP password reset) |
| Storage | Supabase Storage (profile images, vehicle images) |
| Edge Functions | Deno (TypeScript) via Supabase Edge Functions |
| Payments | eSewa, Khalti |
| Email | Resend (payment receipts, password reset OTP) |
| Real-time | Supabase Realtime (bookings, payments, maintenance, fleet) |
| AI Chat | OpenAI-compatible endpoint via Supabase Edge Function |

---

## 📁 Project Structure

```
Vehicle-Rental-System/
├── frontend/
│   ├── index.html                  # Landing page
│   ├── login.html                  # Login + forgot password
│   ├── registration.html           # Sign-up page
│   ├── vehicles.html               # Vehicle catalog/search
│   ├── vehicle-details.html        # Single vehicle detail view
│   ├── booking.html                # Booking flow
│   ├── payment.html                # Payment page (eSewa/Khalti)
│   ├── payment-return.html         # Payment return handler
│   ├── payment-receipt.html        # Payment receipt viewer
│   ├── modify-booking.html         # Booking modification page
│   ├── profile-verification.html   # Customer KYC upload
│   ├── contact.html                # Contact form
│   ├── reset-password.html         # Password reset
│   ├── search.html                 # Advanced search
│   ├── damage-payment.html         # Damage billing payment
│   ├── damage-payment-return.html  # Damage payment return
│   ├── assets/
│   │   ├── js/
│   │   │   ├── supabase.config.js          # Supabase project URL + anon key
│   │   │   ├── supabase.client.js          # Supabase JS client loader
│   │   │   ├── auth.supabase.js            # Auth service (sign-up/in/out/reset)
│   │   │   ├── booking.service.js          # Booking CRUD, quotes, availability
│   │   │   ├── vehicle-catalog.service.js  # Vehicle catalog data service
│   │   │   ├── payment.service.js          # Payment initiation/verification
│   │   │   ├── payment-page.js             # Payment page controller
│   │   │   ├── payment-return-page.js      # Payment return handler
│   │   │   ├── payment-receipt-page.js     # Receipt viewer controller
│   │   │   ├── booking-page.js             # Booking page controller
│   │   │   ├── booking-modification-manager.js
│   │   │   ├── modify-booking.js
│   │   │   ├── ai-booking-chat.js          # AI chat widget
│   │   │   ├── profile-verification.js     # KYC flow controller
│   │   │   ├── contact.js                  # Contact form + Supabase save
│   │   │   ├── notifications-bell.js       # Real-time notifications bell
│   │   │   ├── notifications.service.js
│   │   │   ├── advanced-search.js          # Advanced vehicle search
│   │   │   ├── search-filter-manager.js
│   │   │   ├── search-ui-manager.js
│   │   │   ├── vehicle-details.js          # Vehicle detail page controller
│   │   │   ├── register.js                 # Registration form logic
│   │   │   ├── forgot-password.js          # OTP forgot-password flow
│   │   │   ├── theme-manager.js            # Dark/light mode
│   │   │   ├── footer.component.js         # Shared footer component
│   │   │   ├── promo-code.service.js       # Coupon/discount codes
│   │   │   ├── price-calculator.js         # Booking quote engine
│   │   │   └── home-*.js                   # Homepage section controllers
│   │   └── css/                            # Tailwind compiled CSS
│   └── admin/
│       ├── index.html                      # Admin SPA shell
│       ├── login.html                      # Admin login
│       └── assets/js/
│           ├── app.js                      # Admin app entry point + state
│           ├── shell.js                    # Sidebar nav + header shell
│           ├── config.js                   # Shared class maps / brand colors
│           ├── table-utils.js              # Sort, filter, paginate helpers
│           ├── ui.js                       # Shared UI (drawers, modals, toasts)
│           ├── data.js                     # Default data shape
│           ├── modules/
│           │   ├── overview.js             # Dashboard overview
│           │   ├── bookings.js             # Bookings management
│           │   ├── payments.js             # Payments management
│           │   ├── vehicles.js             # Vehicle catalog management
│           │   ├── fleet.js                # Live fleet tracking
│           │   ├── customers.js            # Customer KYC queue
│           │   ├── drivers.js              # Driver management
│           │   ├── maintenance.js          # Maintenance records
│           │   ├── pricing.js              # Pricing configuration
│           │   ├── reports.js              # Analytics/reports
│           │   ├── reviews.js              # Reviews management
│           │   ├── notifications.js        # Notification management
│           │   ├── contacts.js             # Contact messages inbox
│           │   └── admins.js               # Admin user management
│           └── services/
│               ├── payments.service.js     # Admin payments data service
│               ├── catalog-service.js      # Admin vehicle catalog service
│               ├── customer-verification.service.js
│               ├── driver.service.js
│               ├── maintenance.service.js
│               └── utilization.service.js
├── database/
│   └── migrations/                         # 32 ordered SQL migrations
├── supabase/
│   └── functions/
│       ├── esewa-payment/                  # eSewa initiate + verify edge function
│       ├── khalti-payment/                 # Khalti initiate + verify edge function
│       ├── booking-chat/                   # AI booking chat endpoint
│       ├── password-reset-code/            # OTP password reset email
│       ├── send-payment-receipt/           # Payment receipt email sender
│       └── damage-billing/                 # Damage billing edge function
├── backend/
│   └── js/auth.js                          # Shared auth/profile UI logic
├── tailwind.config.js
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- A [Supabase](https://supabase.com) project (free tier works)
- A [Resend](https://resend.com) account (for payment receipt emails + password reset)
- eSewa and/or Khalti merchant credentials (for payments)
- [VS Code Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) or any static HTTP server

### 1. Clone the repo

```bash
git clone https://github.com/Dipesh0987/Vehicle-Rental-System.git
cd Vehicle-Rental-System
```

### 2. Configure Supabase

Edit `frontend/assets/js/supabase.config.js`:

```js
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Run Database Migrations

Go to **Supabase Dashboard → SQL Editor** and run each file in order (see [Database Migrations](#database-migrations) below).

### 4. Deploy Edge Functions

```bash
supabase functions deploy esewa-payment
supabase functions deploy khalti-payment
supabase functions deploy booking-chat
supabase functions deploy password-reset-code
supabase functions deploy send-payment-receipt
supabase functions deploy damage-billing
```

### 5. Set Edge Function Secrets

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set KHALTI_SECRET_KEY=your-khalti-secret-key
supabase secrets set ESEWA_SECRET_KEY=your-esewa-secret-key
supabase secrets set OPENAI_API_KEY=your-openai-key        # For AI chat
supabase secrets set PAYMENT_APP_NAME="Your App Name"
supabase secrets set PAYMENT_WEBSITE_URL="https://yoursite.com"
supabase secrets set PAYMENT_RECEIPT_FROM_EMAIL="noreply@yoursite.com"
```

### 6. Open in Browser

Start a local server (e.g. VS Code Live Server) and open:
- **Customer site:** `http://127.0.0.1:5500/frontend/index.html`
- **Admin panel:** `http://127.0.0.1:5500/frontend/admin/index.html`

---

## 🗄 Database Migrations

Run these SQL files **in order** in the Supabase SQL Editor:

| # | File | Description |
|---|---|---|
| 001 | `001_user_profiles.sql` | User profiles table |
| 002 | `002_user_profiles_avatar.sql` | Avatar URL column |
| 003 | `003_profile_images_storage.sql` | Profile image storage bucket + RLS |
| 004 | `004_vehicle_catalog_and_images.sql` | Vehicle catalog, images, storage |
| 005 | `005_vehicle_catalog_schema_hotfix.sql` | Schema backfill for legacy columns |
| 006 | `006_vehicle_bookings_system.sql` | Bookings table + double-booking prevention |
| 007 | `007_booking_code_four_digits.sql` | Booking code format |
| 008 | `008_admin_booking_status_updates.sql` | Admin booking status write policies |
| 009 | `009_booking_driver_option.sql` | Driver option column |
| 010 | `010_vehicle_number_support.sql` | Vehicle number plate support |
| 011 | `011_booking_currency_npr.sql` | NPR currency default |
| 012 | `012_user_profile_verification_workflow.sql` | Customer KYC workflow |
| 013 | `013_verification_document_image_url.sql` | KYC document image URL |
| 014 | `014_admin_profile_access_fallback_and_listing_rpc.sql` | Admin profile listing RPC |
| 015a | `015_booking_payment_and_admin_write_policies.sql` | Payment write policies |
| 015b | `015_password_reset_otp_flow.sql` | Custom OTP password reset |
| 016 | `016_migrate_legacy_bookings_to_vehicle_bookings.sql` | Legacy data migration |
| 017 | `017_booking_cancellation_request_rpc.sql` | Cancellation request RPC |
| 018 | `018_discount_codes.sql` | Coupon/promo code system |
| 021 | `021_live_fleet_tracking.sql` | Live fleet GPS tracking table |
| 022 | `022_seed_live_fleet_sample_locations.sql` | Sample fleet location data |
| 023a | `023_drivers_table.sql` | Drivers management table |
| 023b | `023_khalti_payment_integration.sql` | Khalti payments table + DB trigger for booking payment sync |
| 024a | `024_extra_notifications.sql` | Extended notification types |
| 024b | `024_maintenance_table.sql` | Maintenance records table |
| 025 | `025_payments_esewa_provider.sql` | eSewa provider columns on payments |
| 026 | `026_reset_vehicles_seed.sql` | Vehicle catalog seed data |
| 027 | `027_damage_billing.sql` | Damage billing table + RLS |
| 028 | `028_maintenance_customer_link.sql` | Maintenance → customer link |
| 029 | `029_maintenance_realtime_billed.sql` | Maintenance real-time billed flag |
| 030 | `030_migrate_khalti_to_esewa.sql` | Provider migration helper |
| 031 | `031_add_brand_logo_url_to_vehicles.sql` | Brand logo URL on vehicles |
| 032 | `032_contact_messages.sql` | Contact form submissions table + RLS + DELETE policy |

> **Important:** Migration `023_khalti_payment_integration.sql` installs the database trigger that automatically updates `vehicle_bookings.paid_amount`, `remaining_amount`, and `payment_status` (→ `paid` / `partial`) whenever a payment is finalized.

---

## ⚡ Supabase Edge Functions

| Function | Path | Purpose |
|---|---|---|
| `esewa-payment` | `supabase/functions/esewa-payment/` | Initiate and verify eSewa payments |
| `khalti-payment` | `supabase/functions/khalti-payment/` | Initiate and verify Khalti payments |
| `booking-chat` | `supabase/functions/booking-chat/` | AI natural-language booking assistant |
| `password-reset-code` | `supabase/functions/password-reset-code/` | Send OTP via Resend for password reset |
| `send-payment-receipt` | `supabase/functions/send-payment-receipt/` | Email payment receipts via Resend |
| `damage-billing` | `supabase/functions/damage-billing/` | Create and process damage billing charges |

---

## 🖥 Admin Panel

Access at `/frontend/admin/index.html`. Login with an admin-role Supabase user.

### Modules

| Module | Description |
|---|---|
| **Overview** | KPI dashboard — total bookings, revenue, fleet utilization, pending items |
| **Bookings** | View all reservations; update status (Pending/Confirmed/Cancelled/Completed); manage payment status (Paid/Partially Paid/Unpaid); real-time auto-refresh when customers pay |
| **Payments** | Full payment transaction history with provider references, receipt status, booking links |
| **Vehicles** | Add/edit/delete vehicle listings, images, specs, pricing |
| **Fleet** | Live GPS map of vehicle locations |
| **Customers** | KYC verification queue — approve/reject documents; trip history |
| **Drivers** | Driver profiles and assignment management |
| **Maintenance** | Real-time maintenance records; damage billing |
| **Pricing** | Configure base rates, service fees, tax rates, discount rules |
| **Reports** | Revenue analytics and booking statistics |
| **Reviews** | Manage customer reviews |
| **Notifications** | Admin notification inbox |
| **Contact Messages** | Customer contact form inbox — filter by status, view card detail, reply, archive/unarchive, individual & bulk delete |
| **Admins** | Manage admin users |

### Real-Time Sync
- **Bookings** — Admin sees live booking updates via Supabase Realtime
- **Payments** — When a customer completes payment, the admin bookings table auto-updates payment status (`paid`/`partial`) without manual refresh
- **Maintenance** — Live maintenance record updates via Supabase Realtime channel

---

## 💳 Payment Integration

### Supported Gateways
- **eSewa** — Nepal's leading digital wallet
- **Khalti** — Popular Nepali payment gateway

### Payment Flow
1. Customer selects vehicle and completes booking form
2. Chooses **Full Payment** or **Partial Payment**
3. Redirected to payment gateway
4. On return, edge function verifies payment with gateway API
5. Database trigger updates booking: `paid_amount`, `remaining_amount`, `payment_status`
6. Receipt email sent via Resend
7. Admin panel auto-refreshes via Supabase Realtime

### Payment States
| Status | Meaning |
|---|---|
| `unpaid` | No payment received |
| `partial` | Deposit paid, balance remaining |
| `paid` | Fully paid |

---

## 🔐 Auth Flow

1. Guest visits public pages (no login required to browse)
2. **Sign Up** → `registration.html` → Supabase email verification
3. **Sign In** → `login.html` → redirects to `index.html`
4. **Forgot Password** → OTP sent via Resend → `reset-password.html`
5. **Admin Login** → `admin/login.html` → role checked via Supabase RLS

### Security
- Passwords handled entirely by Supabase Auth (never stored in the app DB)
- Row Level Security (RLS) enforced on all tables
- Admin actions require authenticated session with admin role
- Profile images stored in Supabase Storage (not base64 in DB)

---

## 🌍 Environment Variables

Copy `supabase.config.example.js` to `supabase.config.js` and fill in:

```js
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-public-key';
```

Edge function secrets (set via `supabase secrets set`):

| Secret | Required | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key for admin DB access |
| `RESEND_API_KEY` | ✅ | Resend API key for emails |
| `KHALTI_SECRET_KEY` | For Khalti | Khalti merchant secret key |
| `ESEWA_SECRET_KEY` | For eSewa | eSewa merchant secret key |
| `OPENAI_API_KEY` | For AI chat | OpenAI (or compatible) API key |
| `PAYMENT_APP_NAME` | ✅ | App name shown in receipts |
| `PAYMENT_WEBSITE_URL` | ✅ | Your site URL for receipt links |
| `PAYMENT_RECEIPT_FROM_EMAIL` | ✅ | Sender email for receipts |
| `RESEND_DEV_REDIRECT_TO` | Dev only | Redirect all emails here in dev |

---

## 💻 Running Locally

### Option A — VS Code Live Server
1. Install the **Live Server** extension
2. Right-click `frontend/index.html` → **Open with Live Server**
3. Admin panel: open `frontend/admin/index.html` with Live Server

### Option B — Node.js server
```bash
node server/server.js
```
Then open `http://localhost:3000/frontend/index.html`

### Option C — Python
```bash
python -m http.server 5500
```
Then open `http://localhost:5500/frontend/index.html`

---

## 📦 Key Dependencies

| Package | Version | Usage |
|---|---|---|
| `@supabase/supabase-js` | Bundled | Database, Auth, Realtime, Storage |
| Tailwind CSS | Via CDN / compiled | All UI styling |
| Material Symbols | Via CDN | Icons throughout the UI |

> All vendor JS is bundled in `frontend/assets/js/vendor/`. No `npm install` is needed for the frontend.

---

## 🏗 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is for educational and portfolio purposes.

---

*Built with ❤️ using Supabase, Tailwind CSS, and vanilla JavaScript.*
