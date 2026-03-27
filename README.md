# Vehicle Rental System

Tailwind-based vehicle rental UI with a separated JS structure.

## Project Structure

- `frontend/index.html` - Main landing page UI
- `frontend/login.html` - Login page with forgot-password flow
- `frontend/vehicles.html` - Professional dummy fleet listing page with multiple brands
- `frontend/assets/images/car.jpg` - Vehicle image asset
- `frontend/assets/images/car-transparent.png` - Transparent vehicle hero asset
- `frontend/assets/js/supabase.config.js` - Supabase project connection values
- `frontend/assets/js/supabase.client.js` - Shared Supabase client initializer
- `frontend/assets/js/db.bootstrap.js` - DB connection status bootstrap
- `database/DATABASE_DESIGN.md` - Logical database design plan
- `database/schema_blueprint.sql` - Non-executing SQL blueprint
- `backend/js/auth.js` - Shared client-side auth/profile UI logic used by frontend pages

## Run

1. Open `frontend/index.html` in a browser (or Live Server).
2. Use navbar or **Browse Vehicles** to open `frontend/vehicles.html`.
3. The pages load shared script from `backend/js/auth.js`.

## Supabase Setup (Current)

- Supabase is connected in frontend runtime using CDN.
- Current scope is connection + design only.
- No database tables are created yet.

### Connection Files

1. `frontend/assets/js/supabase.config.js` contains your project URL and anon key.
2. `frontend/assets/js/supabase.client.js` initializes the Supabase JS client.
3. `frontend/assets/js/db.bootstrap.js` runs a lightweight connection check.

### Design-Only Artifacts

1. `database/DATABASE_DESIGN.md` for entity and policy planning.
2. `database/schema_blueprint.sql` for SQL-first future migrations.
