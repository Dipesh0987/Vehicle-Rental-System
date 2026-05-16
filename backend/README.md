KPI Server

This lightweight Express server exposes an admin-only KPI endpoint used by the admin UI.

Setup

- Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service role key).
- Install dependencies: `npm install` inside `backend/`.
- Start: `npm start` (defaults to port 3001).

Endpoint

- `GET /api/kpis?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — returns `repeat_customers_pct`, `avg_booking_window_days`, `top_segment`.
