# 🚗 Vehicle Rental System

A full-stack, premium vehicle rental web application built with vanilla JavaScript, Tailwind CSS, and Supabase as the backend. It supports customer booking flows, payment processing via eSewa, an AI booking chat assistant, a complete admin panel, real-time payment status synchronization, and automated booking expiry.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Admin Panel](#admin-panel)
- [Payment Integration](#payment-integration)
- [Booking Expiry System](#booking-expiry-system)
- [Auth Flow](#auth-flow)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)

---

## ✨ Features

### Customer-Facing
- **Landing Page** — Hero section, top-rated vehicles, how-it-works section, upcoming booking widget, footer
- **Vehicle Catalog** — Filter by type, brand, price range, availability; advanced search with multiple filters
- **Vehicle Details** — Full vehicle profile with specs, images, pricing breakdown
- **Booking Flow** — Date/time picker, real-time availability check, driver option, coupon codes, price preview
- **Payment** — eSewa integration with remaining balance display, 15-minute payment countdown timer
- **Booking History** — View all bookings with payment status, remaining balance, View Receipt and Download PDF buttons
- **Booking Modification** — Request booking changes; modification request workflow
- **Profile & KYC Verification** — Upload identity documents, track verification status
- **AI Booking Chat** — Natural-language assistant for vehicle search, trip planning, booking queries, payment status
- **Contact Form** — Messages saved to database and visible in admin panel
- **Notifications Bell** — Real-time in-app notifications for payment, booking, and system events
- **Password Reset** — Custom OTP-based forgot-password flow via Resend email
- **Dark / Light Mode** — System-aware theme with manual toggle

### Admin Panel (`/frontend/admin/`)
- **Overview Dashboard** — KPI dashboard — total bookings, revenue, fleet utilization by segment, pending items
- **Bookings Module** — Full CRUD, status management, payment status (paid/partial/unpaid), auto-expiry of overdue unpaid bookings, real-time sync
- **Payments Module** — Full payment transaction history with provider references, receipt status, booking links
- **Vehicles Module** — Add/edit/delete vehicle listings, images, specs, pricing
- **Fleet Module** — Live GPS map of vehicle locations
- **Customers Module** — KYC verification queue — approve/reject documents; trip history
- **Drivers Module** — Driver profiles and assignment management
- **Maintenance Module** — Real-time maintenance records; damage billing integration
- **Pricing Module** — Configure base rates, service fees, tax rates, discount rules
- **Reports Module** — Revenue analytics, booking statistics, utilization by segment chart
- **Reviews Module** — Manage customer reviews
- **Notifications Module** — Admin notification inbox
- **Contact Messages Module** — Customer contact form inbox — filter by status, view detail, reply, archive, delete
- **Admins Module** — Manage admin users with profile image upload/replace

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules) |
| Backend/DB | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (Email + OTP password reset) |
| Storage | Supabase Storage (profile images, vehicle images, KYC documents) |
| Edge Functions | Deno (TypeScript) via Supabase Edge Functions |
| Payments | eSewa (NPR) |
| Email | Resend (payment receipts, password reset OTP) |
| Real-time | Supabase Realtime (bookings, payments, maintenance, fleet) |
| AI Chat | Gemini AI via Supabase Edge Function |
| Scheduling | pg_cron (auto-expire unpaid bookings every minute) |

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
│   ├── payment.html                # Payment page (remaining balance + timer)
│   ├── payment-return.html         # Payment return handler
│   ├── payment-receipt.html        # Payment receipt viewer (printable PDF)
│   ├── modify-booking.html         # Booking modification page
│   ├── profile-verification.html   # Customer KYC upload
│   ├── contact.html                # Contact form
│   ├── reset-password.html         # Password reset
│   ├── search.html                 # Advanced search
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
│   │   └── css/                            # Tailwind compiled CSS + theme
│   └── admin/
│       ├── index.html                      # Admin SPA shell
│       ├── login.html                      # Admin login
│       └── assets/js/
│           ├── app.js                      # Admin app entry point + state
│           ├── shell.js                    # Sidebar nav + header + profile image
│           ├── config.js                   # Shared class maps / brand colors
│           ├── table-utils.js              # Sort, filter, paginate helpers
│           ├── ui.js                       # Shared UI (drawers, modals, toasts)
│           ├── data.js                     # Default data shape
│           ├── modules/
│           │   ├── overview.js             # Dashboard overview + charts
│           │   ├── bookings.js             # Bookings management
│           │   ├── payments.js             # Payments management
│           │   ├── vehicles.js             # Vehicle catalog management
│           │   ├── fleet.js                # Live fleet tracking
│           │   ├── customers.js            # Customer KYC queue
│           │   ├── drivers.js              # Driver management
│           │   ├── maintenance.js          # Maintenance records
│           │   ├── pricing.js              # Pricing configuration
│           │   ├── reports.js              # Analytics/reports + utilization
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
├── supabase/
│   └── functions/
│       ├── esewa-payment/                  # eSewa initiate + verify
│       ├── booking-chat/                   # AI booking chat endpoint
│       ├── password-reset-code/            # OTP password reset email
│       ├── send-payment-receipt/           # Payment receipt email sender
│       ├── damage-billing/                 # Damage billing edge function
│       └── khalti-payment/                 # Khalti (legacy, migrated to eSewa)
├── backend/
│   └── js/auth.js                          # Shared auth/profile/bookings UI logic
├── tailwind.config.js
├── package.json
└── .env.example

---

## 🚀 Getting Started

### Prerequisites
- A [Supabase](https://supabase.com) project (free tier works)
- A [Resend](https://resend.com) account (for payment receipt emails + password reset)
- eSewa merchant credentials (for payments)
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
window.SUPABASE_ANON_KEY = 'your-anon-public-key';
```

### 3. Set Up Database

Run the database setup SQL in **Supabase Dashboard → SQL Editor**. The schema includes:
- User profiles with avatar support
- Vehicle catalog with images and pricing
- Booking system with payment ledger (paid_amount, remaining_amount, payment_deadline)
- Payments table with RLS for customer read access
- Notifications system
- Contact messages
- Discount codes
- Live fleet tracking
- Drivers table
- Maintenance records with damage billing
- Chat conversations and analytics
- pg_cron job for auto-expiring unpaid bookings every minute

### 4. Deploy Edge Functions

```bash
supabase functions deploy esewa-payment
supabase functions deploy booking-chat
supabase functions deploy password-reset-code
supabase functions deploy send-payment-receipt
supabase functions deploy damage-billing
```

### 5. Set Edge Function Secrets

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set ESEWA_SECRET_KEY=your-esewa-secret-key
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set PAYMENT_APP_NAME="Rent A Vehicle"
supabase secrets set PAYMENT_WEBSITE_URL="https://yoursite.com"
supabase secrets set PAYMENT_RECEIPT_FROM_EMAIL="noreply@yoursite.com"
```

### 6. Open in Browser

Start a local server (e.g. VS Code Live Server) and open:
- **Customer site:** `http://127.0.0.1:5500/frontend/index.html`
- **Admin panel:** `http://127.0.0.1:5500/frontend/admin/index.html`

---

## ⚡ Supabase Edge Functions

| Function | Path | Purpose |
|---|---|---|
| `esewa-payment` | `supabase/functions/esewa-payment/` | Initiate and verify eSewa payments |
| `booking-chat` | `supabase/functions/booking-chat/` | AI natural-language booking assistant (Gemini) |
| `password-reset-code` | `supabase/functions/password-reset-code/` | Send OTP via Resend for password reset |
| `send-payment-receipt` | `supabase/functions/send-payment-receipt/` | Email payment receipts via Resend |
| `damage-billing` | `supabase/functions/damage-billing/` | Create and process damage billing charges |

---

## 🖥 Admin Panel

Access at `/frontend/admin/index.html`. Login with an admin-role Supabase user.

### Modules

| Module | Description |
|---|---|
| **Overview** | KPI dashboard — total bookings, revenue, fleet utilization by segment, pending items |
| **Bookings** | View all reservations; update status (Pending/Confirmed/Cancelled/Completed); payment status tracking; auto-expiry of overdue unpaid bookings; real-time sync |
| **Payments** | Full payment transaction history with provider references, receipt status, booking links |
| **Vehicles** | Add/edit/delete vehicle listings, images, specs, pricing |
| **Fleet** | Live GPS map of vehicle locations |
| **Customers** | KYC verification queue — approve/reject documents; trip history |
| **Drivers** | Driver profiles and assignment management |
| **Maintenance** | Real-time maintenance records; damage billing integration |
| **Pricing** | Configure base rates, service fees, tax rates, discount rules |
| **Reports** | Revenue analytics, booking statistics, utilization by segment chart |
| **Reviews** | Manage customer reviews |
| **Notifications** | Admin notification inbox |
| **Contact Messages** | Customer contact form inbox — filter by status, view detail, reply, archive, delete |
| **Admins** | Manage admin users with profile image upload/replace |

### Real-Time Sync
- **Bookings** — Admin sees live booking updates via Supabase Realtime
- **Payments** — Customer payment completion auto-updates admin bookings table (paid/partial status)
- **Maintenance** — Live maintenance record updates via Supabase Realtime channel

---

## 💳 Payment Integration

### Supported Gateway
- **eSewa** — Nepal's leading digital wallet (NPR currency)

### Payment Flow
1. Customer selects vehicle and completes booking form
2. Booking created with 15-minute payment deadline
3. Payment page shows remaining balance with countdown timer
4. Customer pays full remaining balance via eSewa
5. On return, edge function verifies payment with eSewa API
6. Database trigger updates booking: `paid_amount`, `remaining_amount`, `payment_status`
7. Booking auto-confirms when payment >= 60% of total
8. Receipt email sent via Resend
9. Admin panel auto-refreshes via Supabase Realtime

### Payment States
| Status | Meaning |
|---|---|
| `unpaid` | No payment received yet |
| `partial` | Partial payment made, balance remaining |
| `paid` | Fully paid |

### Booking History — Receipt Access
- **View Receipt** button — opens printable receipt page (only visible after payment)
- **Save as PDF** button — opens receipt in new tab and triggers browser Print/Save as PDF

---

## ⏱ Booking Expiry System

Unpaid bookings are automatically expired after the 15-minute payment window:

1. **Client-side (Payment Page)** — When timer reaches 00:00, the booking is marked `expired` on the server and the UI locks the pay button
2. **Client-side (Booking History)** — When user opens "Your Bookings", any past-deadline unpaid bookings are filtered out and expired on the server
3. **Client-side (Admin)** — When admin loads bookings, past-deadline unpaid bookings are auto-expired
4. **Server-side (pg_cron)** — A PostgreSQL cron job runs every minute to expire any overdue unpaid bookings that clients haven't caught yet

This ensures vehicle reservations are released promptly and no stale pending bookings block availability.

---

## 🔐 Auth Flow

1. Guest visits public pages (no login required to browse)
2. **Sign Up** → `registration.html` → Supabase email verification
3. **Sign In** → `login.html` → redirects to `index.html`
4. **Forgot Password** → OTP sent via Resend → `reset-password.html`
5. **KYC Verification** → Required before booking → `profile-verification.html`
6. **Admin Login** → `admin/login.html` → role checked via Supabase RLS

### Security
- Passwords handled entirely by Supabase Auth (never stored in the app DB)
- Row Level Security (RLS) enforced on all tables
- Admin actions require authenticated session with admin role
- Profile images stored in Supabase Storage (not base64 in DB)
- Payment deadline is server-side tamper-proof (set at booking creation)

---

## 🌍 Environment Variables

Copy `.env.example` for reference. Frontend config in `frontend/assets/js/supabase.config.js`:

```js
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-public-key';
```

Edge function secrets (set via `supabase secrets set`):

| Secret | Required | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key for admin DB access |
| `RESEND_API_KEY` | ✅ | Resend API key for emails |
| `ESEWA_SECRET_KEY` | ✅ | eSewa merchant secret key |
| `GEMINI_API_KEY` | For AI chat | Google Gemini API key |
| `PAYMENT_APP_NAME` | ✅ | App name shown in receipts |
| `PAYMENT_WEBSITE_URL` | ✅ | Your site URL for receipt links |
| `PAYMENT_RECEIPT_FROM_EMAIL` | ✅ | Sender email for receipts |

---

## 💻 Running Locally

### Option A — VS Code Live Server
1. Install the **Live Server** extension
2. Right-click `frontend/index.html` → **Open with Live Server**
3. Admin panel: open `frontend/admin/index.html` with Live Server

### Option B — Python
```bash
python -m http.server 5500
```
Then open `http://localhost:5500/frontend/index.html`

### Option C — Node.js
```bash
npx serve .
```
Then open the displayed URL and navigate to `/frontend/index.html`

---

## 📦 Key Dependencies

| Package | Version | Usage |
|---|---|---|
| `@supabase/supabase-js` | Bundled via CDN | Database, Auth, Realtime, Storage |
| Tailwind CSS | Via CDN | All UI styling |
| Material Symbols | Via CDN | Icons throughout the UI |
| Manrope + IBM Plex Mono | Google Fonts | Typography |

> No `npm install` is needed for the frontend. All vendor JS is loaded via CDN or bundled.

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

*Built with Supabase, Tailwind CSS, and vanilla JavaScript.*
