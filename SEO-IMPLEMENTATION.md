# RS Self Drive - Complete SEO Implementation Guide

## Sitewide SEO Strategy

- **Brand**: RS Self Drive
- **Location**: Banasthali Ring Road, Kathmandu, Nepal
- **Industry**: Self Drive Vehicle Rental
- **Primary Domain**: rsselfdrive.com
- **Target Audience**: Local & tourist customers in Kathmandu seeking self-drive vehicles

### Core Keywords (by priority):
1. self drive car rental kathmandu
2. vehicle rental kathmandu
3. self drive vehicle rental nepal
4. car rental banasthali
5. rental vehicle kathmandu
6. self drive cars nepal

---

## Page-by-Page SEO Data

### HOME PAGE (/)

| Field | Value |
|-------|-------|
| SEO Title | RS Self Drive \| Self Drive Car Rental Kathmandu Nepal |
| Meta Description | RS Self Drive - Affordable self drive car rental in Banasthali Ring Road, Kathmandu, Nepal. Rent cars, SUVs & vehicles without driver. Book online now! |
| Focus Keyword | self drive car rental kathmandu |
| Secondary Keywords | vehicle rental kathmandu, car rental nepal, self drive nepal, rent car without driver |
| URL Slug | / |
| Canonical URL | https://rsselfdrive.com |
| OG Title | RS Self Drive \| Self Drive Car Rental Kathmandu |
| OG Description | Affordable self drive car rental in Banasthali, Kathmandu. Rent cars & SUVs without driver. Well-maintained vehicles at best rates. |
| Twitter Title | RS Self Drive \| Self Drive Car Rental Kathmandu |
| Twitter Description | Affordable self drive car & vehicle rental in Kathmandu, Nepal. Drive yourself at the best rates! |
| H1 | Self Drive Car Rental in Kathmandu |
| H2 Suggestions | Browse Our Vehicles, How It Works, Why Choose RS Self Drive |
| Image ALT | RS Self Drive car rental fleet in Kathmandu Nepal, Self drive vehicle rental Banasthali Ring Road |
| Internal Links | /vehicles, /vendor-enquiry, /contact |

---

### VEHICLES PAGE (/vehicles)

| Field | Value |
|-------|-------|
| SEO Title | Self Drive Vehicles for Rent in Kathmandu |
| Meta Description | Browse & book self drive cars, SUVs & vehicles in Kathmandu Nepal. RS Self Drive offers affordable rental vehicles at Banasthali Ring Road. Book online now! |
| Focus Keyword | vehicle rental kathmandu |
| Secondary Keywords | self drive cars nepal, rent SUV kathmandu, car rental banasthali, self drive vehicle rental nepal |
| URL Slug | /vehicles |
| Canonical URL | https://rsselfdrive.com/vehicles |
| OG Title | Self Drive Vehicles for Rent \| RS Self Drive Kathmandu |
| OG Description | Browse our fleet of self drive rental vehicles in Kathmandu. Cars, SUVs & more at affordable daily rates. |
| Twitter Title | Self Drive Vehicles for Rent \| RS Self Drive |
| Twitter Description | Browse & book self drive cars and SUVs in Kathmandu Nepal. Best rates at Banasthali Ring Road. |
| H1 | Self Drive Vehicles Available in Kathmandu |
| H2 Suggestions | Filter by Vehicle Type, Popular Self Drive Cars, SUVs for Rent |
| Image ALT | [Vehicle Name] available for self drive rental in Kathmandu, Rent [Vehicle Name] at RS Self Drive Banasthali |
| Internal Links | / (Home), /contact, /vendor-enquiry |

---

### VENDORS PAGE (/vendor-enquiry)

| Field | Value |
|-------|-------|
| SEO Title | List Your Vehicle \| Vendor Enquiry |
| Meta Description | Partner with RS Self Drive Kathmandu. List your car or vehicle for rental at Banasthali Ring Road. Earn income from your vehicle. Submit enquiry now! |
| Focus Keyword | list vehicle for rent kathmandu |
| Secondary Keywords | car rental vendor nepal, vehicle rental partner, earn from vehicle kathmandu |
| URL Slug | /vendor-enquiry |
| Canonical URL | https://rsselfdrive.com/vendor-enquiry |
| OG Title | List Your Vehicle \| RS Self Drive Kathmandu |
| OG Description | Partner with RS Self Drive. List your car or vehicle for rental and earn passive income in Kathmandu. |
| Twitter Title | List Your Vehicle \| RS Self Drive Vendor Enquiry |
| Twitter Description | Partner with RS Self Drive Kathmandu. List your vehicle and earn rental income. |
| H1 | List Your Vehicle with RS Self Drive |
| H2 Suggestions | Why Partner With Us, Submit Your Vehicle Details |
| Image ALT | List your vehicle for rent with RS Self Drive Kathmandu |
| Internal Links | / (Home), /vehicles, /contact |

---

### CONTACT PAGE (/contact)

| Field | Value |
|-------|-------|
| SEO Title | Contact Us \| RS Self Drive Kathmandu |
| Meta Description | Contact RS Self Drive at Banasthali Ring Road, Kathmandu Nepal. Call +977-9704520781 or send a message. Self drive car rental enquiries welcome! |
| Focus Keyword | contact RS Self Drive kathmandu |
| Secondary Keywords | car rental kathmandu phone, self drive rental contact, banasthali car rental |
| URL Slug | /contact |
| Canonical URL | https://rsselfdrive.com/contact |
| OG Title | Contact RS Self Drive \| Kathmandu Nepal |
| OG Description | Get in touch with RS Self Drive at Banasthali Ring Road, Kathmandu. Call, email or visit us for vehicle rental enquiries. |
| Twitter Title | Contact RS Self Drive Kathmandu |
| Twitter Description | Reach RS Self Drive at Banasthali Ring Road, Kathmandu. Call +977-9704520781 for self drive vehicle rental. |
| H1 | Contact RS Self Drive |
| H2 Suggestions | Send Us a Message, Visit Our Office, Our Location |
| Image ALT | RS Self Drive office location Banasthali Ring Road Kathmandu |
| Internal Links | / (Home), /vehicles, /vendor-enquiry |

---

## Technical SEO Checklist

- [x] Metadata implemented for all pages (Next.js App Router standard)
- [x] robots.txt created (programmatic + static)
- [x] sitemap.xml created (programmatic + static)
- [x] JSON-LD Schema: LocalBusiness, Organization, WebSite
- [x] Open Graph tags for all pages
- [x] Twitter Card tags for all pages
- [x] Canonical URLs set for all pages
- [x] Geo meta tags for local SEO
- [x] Mobile-first viewport configured
- [x] Image optimization via Next.js Image component
- [ ] Create /public/og-image.jpg (1200x630px) — PLACEHOLDER
- [ ] Create /public/favicon.ico — PLACEHOLDER
- [ ] Create /public/apple-touch-icon.png — PLACEHOLDER
- [ ] Create /public/logo.png — PLACEHOLDER
- [ ] Replace `YOUR_GOOGLE_VERIFICATION_CODE` in layout.tsx after Search Console setup
- [ ] Add social media URLs to JSON-LD "sameAs" array when available

---

## Vercel Custom Domain Setup

### Steps:
1. Go to https://vercel.com/dashboard
2. Click your project (RS Self Drive)
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Type: `rsselfdrive.com`
6. Also add: `www.rsselfdrive.com` (redirect to non-www)
7. Vercel will show DNS records to configure

### DNS Configuration (at your domain registrar):
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

8. Wait 10-30 minutes for DNS propagation
9. Vercel will auto-issue SSL certificate

---

## Google Search Console Setup

### Step 1: Add Property
1. Go to https://search.google.com/search-console
2. Click **Add Property**
3. Choose **URL prefix** method
4. Enter: `https://rsselfdrive.com`

### Step 2: Verify Ownership (HTML Meta Tag method)
1. Google will give you a verification code like: `google1234567890abcdef`
2. Open `src/app/layout.tsx`
3. Replace `YOUR_GOOGLE_VERIFICATION_CODE` with the code Google gave you
4. Deploy to Vercel
5. Go back to Search Console and click **Verify**

### Step 3: Submit Sitemap
1. In Search Console sidebar → **Sitemaps**
2. Enter: `sitemap.xml`
3. Click **Submit**

### Step 4: Request Indexing
1. Go to **URL Inspection** (top search bar)
2. Enter: `https://rsselfdrive.com`
3. Click **Request Indexing**
4. Repeat for `/vehicles`, `/vendor-enquiry`, `/contact`

### Step 5: Make Website Visible by Business Name
For your site to appear when people search "RS Self Drive":
1. **Google Business Profile**: Go to https://business.google.com
   - Create/claim your business listing
   - Business name: RS Self Drive
   - Category: Car Rental Agency
   - Address: Banasthali Ring Road, Kathmandu, Nepal
   - Phone: +977-9704520781
   - Website: https://rsselfdrive.com
   - This is the MOST important step for local visibility

2. **Wait for indexing**: Usually 3-7 days after sitemap submission
3. **Brand signals**: The JSON-LD schema + consistent NAP (Name, Address, Phone) across your site helps Google associate "RS Self Drive" with your domain

### Expected Timeline:
- DNS + SSL: 10-30 minutes
- Google verification: Instant after deploy
- Sitemap processing: 1-3 days
- First appearance in search: 3-14 days
- Full keyword ranking: 2-8 weeks

---

## Files Created/Modified:

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root metadata + JSON-LD schemas |
| `src/app/vehicles/layout.tsx` | Vehicles page metadata |
| `src/app/vehicles/metadata.ts` | Vehicles SEO data |
| `src/app/vendor-enquiry/layout.tsx` | Vendor page metadata |
| `src/app/vendor-enquiry/metadata.ts` | Vendor SEO data |
| `src/app/contact/layout.tsx` | Contact page metadata |
| `src/app/contact/metadata.ts` | Contact SEO data |
| `src/app/sitemap.ts` | Programmatic sitemap |
| `src/app/robots.ts` | Programmatic robots.txt |
| `public/robots.txt` | Static robots.txt fallback |
| `public/sitemap.xml` | Static sitemap fallback |
