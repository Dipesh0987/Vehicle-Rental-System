# ASSelf — Self Drive Car Rental (Nepal)

Nepal's self-drive car rental platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend / DB / Auth:** Supabase
- **Charts:** Chart.js + react-chartjs-2
- **PDF / Print:** jsPDF, jspdf-autotable, react-to-print
- **Icons:** lucide-react, qrcode.react

## Project Structure

```
.
├── public/                 # Static assets (images, etc.)
├── src/
│   ├── app/                # App Router pages
│   │   ├── admin/          # Admin dashboard (bookings, vehicles, payments, etc.)
│   │   ├── booking/        # Booking flow
│   │   ├── vehicles/       # Vehicle catalog + detail pages
│   │   ├── vendor-enquiry/ # Vendor onboarding form
│   │   ├── contact/        # Contact form
│   │   ├── layout.tsx      # Root layout + providers
│   │   └── page.tsx        # Homepage
│   ├── components/         # Reusable UI (Toast, layout, admin, ui)
│   ├── context/            # React context (Auth, Theme, Role)
│   ├── lib/                # Supabase client + validation helpers
│   └── services/           # Data-access services (bookings, billing, catalog)
├── supabase/               # SQL migrations / setup scripts
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```
   Then fill in your Supabase URL and anon key.
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the development server      |
| `npm run build` | Create a production build         |
| `npm run start` | Run the production build locally  |
| `npm run lint`  | Run ESLint                        |

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, click **New Project** and import the repo.
3. Vercel auto-detects Next.js — leave the build settings at their defaults
   (Build Command `next build`, Output `.next`). The **Root Directory** is the
   repository root.
4. Add the environment variables under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**.

## Database Setup

SQL scripts for the Supabase schema live in the `supabase/` folder. Run them in
the Supabase SQL Editor to provision tables and policies.
