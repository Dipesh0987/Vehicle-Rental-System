# Vehicle Rental System

Tailwind-based vehicle rental UI with a separated JS structure.

## Project Structure

- `frontend/index.html` - Main landing page UI
- `frontend/login.html` - Login page with forgot-password flow
- `frontend/registration.html` - Registration page aligned to the same premium theme
- `frontend/vehicles.html` - Professional dummy fleet listing page with multiple brands
- `frontend/vehicle-details.html` - Individual vehicle profile view (query-based static details)
- `frontend/assets/images/car.jpg` - Vehicle image asset
- `frontend/assets/images/car-transparent.png` - Transparent vehicle hero asset
- `frontend/assets/js/supabase.config.js` - Supabase connection config
- `frontend/assets/js/supabase.client.js` - Supabase JS client runtime loader
- `frontend/assets/js/auth.supabase.js` - Shared Supabase auth service (sign-up/sign-in/reset/logout)
- `frontend/assets/js/register.js` - Registration form logic with real Supabase sign-up
- `backend/js/auth.js` - Shared client-side auth/profile UI logic used by frontend pages
- `frontend/assets/js/vehicle-details.js` - Static vehicle data and UI rendering logic for detail page
- `database/migrations/001_user_profiles.sql` - SQL migration for persistent user profile data

## Run

1. Open `frontend/index.html` in a browser (or Live Server).
2. Use navbar or **Browse Vehicles** to open `frontend/vehicles.html`.
3. Click **Show Details** on any card to open per-vehicle route like `frontend/vehicle-details.html?id=camry-hybrid`.
4. The pages load shared script from `backend/js/auth.js`.

## Supabase Auth Setup

1. Confirm `frontend/assets/js/supabase.config.js` has your live project URL and anon key.
2. In Supabase Dashboard -> Authentication -> Providers:
	- Enable Email provider.
	- Enable email confirmation (verification link).
	- Optionally enable Google provider for OAuth sign-in.
3. In Supabase Dashboard -> Authentication -> URL Configuration, include your frontend URLs (example local URLs):
	- `http://127.0.0.1:5500/frontend/login.html`
	- `http://127.0.0.1:5500/frontend/index.html`
	- `http://localhost:5500/frontend/login.html`
	- `http://localhost:5500/frontend/index.html`

## Database Migration

Run this SQL in Supabase SQL Editor:

1. `database/migrations/001_user_profiles.sql`

This creates `public.user_profiles` with RLS policies so each authenticated user can read/write only their own profile row.

## Auth Flow

1. Guest clicks **Sign Up** from public pages -> opens `frontend/registration.html`.
2. Registration validates full name, email, and secure password (minimum 8 + special character).
3. Supabase sends email verification link.
4. User is redirected to `frontend/login.html` after successful registration.
5. Successful sign-in redirects to `frontend/index.html`.
6. Public users can still browse `frontend/index.html` without signing in.
