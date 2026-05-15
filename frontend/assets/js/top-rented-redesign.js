// Top Rented Cars ??? pixel-perfect match to reference design
// Fetches vehicles from Supabase, groups by brand, shows top 3 per brand
// Cards: fuel badge ?? centred image ?? brand name ?? specs ?? price ?? action buttons

(function () {
  'use strict';

  const SECTION_ID = 'homeTopRatedSection';
  const PILL_LIMIT = 5;
  const CARDS_PER_BRAND = 3;
  const FALLBACK_IMG = 'assets/images/car-transparent.png';

  /* ?????? helpers ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtPrice(n) {
    return 'NPR ' + Math.round(Number(n || 0)).toLocaleString('en-IN');
  }

  function brandTone(brand) {
    const seed = String(brand || 'vehicle').toLowerCase();
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 360;
    }

    return {
      accent: `hsl(${hash} 55% 44%)`,
      accentSoft: `hsl(${hash} 70% 94%)`,
      accentDeep: `hsl(${hash} 60% 26%)`
    };
  }

  function brandLetter(brand) {
    if (!brand) return '?';
    return String(brand).trim().charAt(0).toUpperCase();
  }

  /* ?????? brand logo SVGs (simple circles with letter) ?????? */
  function brandIcon(brand) {
    const letter = brandLetter(brand);
    const tone = brandTone(brand);
    return `<span class="trr-pill-logo" style="--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}">${letter}</span>`;
  }

  /* ?????? Supabase fetch ?????????????????????????????????????????????????????????????????????????????????????????? */
  async function fetchVehicles() {
    let sb = window.supabase;
    if (!sb && window.SupabaseClient && typeof window.SupabaseClient.init === 'function') {
      sb = await window.SupabaseClient.init();
      window.supabase = sb;
    }
    if (!sb || typeof sb.from !== 'function') throw new Error('Supabase not ready');

    const { data, error } = await sb
      .from('vehicles')
      .select('id,name,brand,fuel_type,seats,transmission,price_per_day,rating,primary_image_url,image_url,brand_logo_url,vehicle_number,category,is_active,available')
      .eq('is_active', true)
      .eq('available', true)
      .order('rating', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  }

  /* ?????? Skeleton loading ???????????????????????????????????????????????????????????????????????????????????? */
  function skeletonHTML() {
    const card = `<div class="trr-skel-card"><div class="trr-skel-badge"></div><div class="trr-skel-img"></div><div class="trr-skel-line lg"></div><div class="trr-skel-specs"></div><div class="trr-skel-line md"></div><div class="trr-skel-btns"><div class="trr-skel-btn"></div><div class="trr-skel-btn"></div></div></div>`;
    return `<section class="trr-section"><div class="trr-wrap">
      <div class="trr-head"><div class="trr-skel-title"></div><div class="trr-skel-sub"></div></div>
      <div class="trr-pills">${'<div class="trr-skel-pill"></div>'.repeat(4)}</div>
      <div class="trr-grid">${card.repeat(3)}</div>
    </div></section>`;
  }

  /* ?????? SVG Icons ????????????????????????????????????????????????????????????????????????????????????????????????????????? */
  const ICON = {
    seat: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>`,
    gear: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    fuel: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><rect x="6" y="9" width="6" height="4" rx="1"/></svg>`
  };

  /* ?????? Render single card ?????????????????????????????????????????????????????????????????????????????? */
  function renderCard(v, idx) {
    const fuel = esc(v.fuel_type || 'Petrol');
    const img = esc(v.primary_image_url || v.image_url || FALLBACK_IMG);
    const brand = esc(v.brand || 'Vehicle');
    const name = esc(v.name || 'Vehicle');
    const vehicleNumber = esc(v.vehicle_number || '');
    const category = esc(v.category || 'Car');
    const seats = Number(v.seats || 4);
    const trans = esc(v.transmission || 'Manual');
    const price = fmtPrice(v.price_per_day);
    const rating = Number(v.rating || 0).toFixed(1);
    const detailUrl = 'vehicle-details.html?id=' + encodeURIComponent(v.id || '');
    const bookUrl = 'booking.html?vehicle=' + encodeURIComponent(v.id || '');
    const tone = brandTone(brand || name);

    return `
      <article class="trr-card" style="animation-delay:${idx * 120}ms;--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}">
        <div class="trr-card-top">
          <span class="trr-fuel-tag">${fuel}</span>
          <span class="trr-rating-badge">??? ${rating}</span>
        </div>
        <div class="trr-img-box">
          <img src="${img}" alt="${brand} ${name}" loading="lazy" decoding="async" onerror="this.src='${FALLBACK_IMG}'" />
        </div>
        <p class="trr-brand-eyebrow">${brand}</p>
        <h3 class="trr-brand">${name}</h3>
        <p class="trr-vehicle-meta">${vehicleNumber ? vehicleNumber + ' ?? ' : ''}${category}</p>
        <div class="trr-specs">
          <span class="trr-spec">${ICON.seat}<em>${seats} Seater</em></span>
          <span class="trr-spec">${ICON.gear}<em>${trans}</em></span>
          <span class="trr-spec">${ICON.fuel}<em>${fuel}</em></span>
        </div>
        <p class="trr-price">From <strong>${price}</strong><span>/day</span></p>
        <div class="trr-actions">
          <a href="${detailUrl}" class="trr-btn trr-btn--primary">View Details</a>
          <a href="${bookUrl}" class="trr-btn trr-btn--outline">Book Now</a>
        </div>
      </article>`;
  }

  /* ?????? Main init ????????????????????????????????????????????????????????????????????????????????????????????????????????? */
  async function initWidget() {
    const root = document.getElementById(SECTION_ID);
    if (!root) return;

    // Inject styles
    if (!document.getElementById('trrStyles')) {
      const style = document.createElement('style');
      style.id = 'trrStyles';
      style.textContent = getCSS();
      document.head.appendChild(style);
    }

    root.innerHTML = skeletonHTML();

    try {
      const vehicles = await fetchVehicles();
      if (!vehicles.length) {
        root.innerHTML = `<section class="trr-section"><div class="trr-wrap"><p class="trr-empty">No vehicles available right now.</p></div></section>`;
        return;
      }

      // Group by brand
      const brandMap = {};
      vehicles.forEach(v => {
        const b = v.brand || 'Other';
        if (!brandMap[b]) brandMap[b] = [];
        brandMap[b].push(v);
      });

      // Sort brands by total count desc, pick top N
      const brandList = Object.keys(brandMap)
        .map(b => ({
          brand: b,
          count: brandMap[b].length,
          avgRating: brandMap[b].reduce((s, v) => s + Number(v.rating || 0), 0) / brandMap[b].length
        }))
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, PILL_LIMIT);

      let activeBrand = brandList[0]?.brand || '';

      function render() {
        const pillsHTML = brandList.map(b => {
          const isActive = b.brand === activeBrand;
          const tone = brandTone(b.brand);
          return `<button type="button" class="trr-pill${isActive ? ' active' : ''}" data-brand="${esc(b.brand)}" style="--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}">
            ${brandIcon(b.brand)}
            <span>${esc(b.brand)}</span>
            <em>${b.count}</em>
          </button>`;
        }).join('');

        const cards = (brandMap[activeBrand] || [])
          .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
          .slice(0, CARDS_PER_BRAND);

        const cardsHTML = cards.map((v, i) => renderCard(v, i)).join('');
        const brandCount = brandList.length;
        const totalCount = vehicles.length;

        root.innerHTML = `
          <section class="trr-section">
            <div class="trr-wrap">
              <div class="trr-kicker-row">
                <span class="trr-kicker">Premium live fleet</span>
                <span class="trr-kicker trr-kicker--soft">NPR pricing</span>
                <span class="trr-kicker trr-kicker--soft">${brandCount} top brands</span>
              </div>
              <div class="trr-head">
                <h2 class="trr-title">Top Rated<br>Rented Cars</h2>
                <p class="trr-sub">Hand-picked from your live inventory. Real brand vehicles, real ratings, and prices shown in NPR for a cleaner booking decision.</p>
                <div class="trr-metrics">
                  <div class="trr-metric">
                    <strong>${totalCount}</strong>
                    <span>Available vehicles</span>
                  </div>
                  <div class="trr-metric">
                    <strong>${brandCount}</strong>
                    <span>Featured brands</span>
                  </div>
                  <div class="trr-metric">
                    <strong>${cards.length}</strong>
                    <span>Cars in view</span>
                  </div>
                </div>
              </div>
              <div class="trr-pills">${pillsHTML}</div>
              <div class="trr-grid">${cardsHTML}</div>
            </div>
          </section>`;

        // Pill click handlers
        root.querySelectorAll('.trr-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            const b = btn.getAttribute('data-brand');
            if (b && b !== activeBrand) {
              activeBrand = b;
              render();
            }
          });
        });
      }

      render();
    } catch (err) {
      console.error('Top Rented fetch error', err);
      root.innerHTML = `<section class="trr-section"><div class="trr-wrap"><p class="trr-empty trr-error">Could not load vehicles. Please try again later.</p></div></section>`;
    }
  }

  /* ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     CSS ??? Reference-matched design
     ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
  function getCSS() {
    return `

/* ?????? Section ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-section {
  padding: 5rem 1rem 5.5rem;
  background:
    radial-gradient(circle at top left, rgba(229, 137, 78, 0.14), transparent 34%),
    radial-gradient(circle at right 20%, rgba(44, 118, 110, 0.12), transparent 30%),
    linear-gradient(180deg, #eef2ec 0%, #e6ebe5 100%);
  transition: background 0.4s ease;
}
html[data-theme="dark"] .trr-section {
  background:
    radial-gradient(circle at top left, rgba(74, 163, 153, 0.18), transparent 30%),
    radial-gradient(circle at right 20%, rgba(229, 137, 78, 0.12), transparent 26%),
    linear-gradient(155deg, #111820, #0d141a);
}

.trr-wrap {
  max-width: 1200px;
  width: 94%;
  margin: 0 auto;
}

/* ?????? Header ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-head {
  text-align: center;
  margin-bottom: 2rem;
}
.trr-kicker-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.trr-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.85rem;
  border-radius: 9999px;
  background: rgba(44, 118, 110, 0.08);
  color: #235e57;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.trr-kicker--soft {
  background: rgba(255, 255, 255, 0.72);
  color: #56706d;
}
html[data-theme="dark"] .trr-kicker {
  background: rgba(74, 163, 153, 0.12);
  color: #bfe3dc;
}
html[data-theme="dark"] .trr-kicker--soft {
  background: rgba(255, 255, 255, 0.06);
  color: #c3d5dd;
}
.trr-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2.4rem, 5vw, 3.8rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: #0f3133;
  margin: 0;
  transition: color 0.3s;
}
html[data-theme="dark"] .trr-title { color: #e6eef2; }

.trr-sub {
  max-width: 520px;
  margin: 0.75rem auto 0;
  font-size: 0.96rem;
  line-height: 1.7;
  color: #6e8282;
  transition: color 0.3s;
}
html[data-theme="dark"] .trr-sub { color: #9fb2ba; }

.trr-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  max-width: 640px;
  margin: 1.35rem auto 0;
}
.trr-metric {
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(114, 131, 126, 0.16);
  box-shadow: 0 10px 28px rgba(15, 49, 51, 0.06);
}
.trr-metric strong {
  display: block;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.45rem;
  line-height: 1;
  color: #0f3133;
}
.trr-metric span {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6e8282;
}
html[data-theme="dark"] .trr-metric {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
html[data-theme="dark"] .trr-metric strong {
  color: #e6eef2;
}
html[data-theme="dark"] .trr-metric span {
  color: #9fb2ba;
}

/* ?????? Brand Pills ????????????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin-bottom: 2.2rem;
}

.trr-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  border: 1.5px solid transparent;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  background: #C9D4D0;
  color: #2a4a4d;
}
.trr-pill:hover {
  background: #bcc9c5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.trr-pill.active {
  background: linear-gradient(135deg, var(--trr-accent, #D08844), var(--trr-accent-deep, #c47a38));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 10px 22px rgba(208, 136, 68, 0.26);
}
.trr-pill.active:hover {
  transform: translateY(-2px);
}

/* Brand logo circle inside pill */
.trr-pill-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.15);
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  background: var(--trr-accent-soft, rgba(255,255,255,0.25));
  color: var(--trr-accent-deep, inherit);
}
.trr-pill.active .trr-pill-logo {
  border-color: rgba(255,255,255,0.45);
  background: rgba(255,255,255,0.18);
}
.trr-pill em {
  font-style: normal;
  font-size: 0.66rem;
  font-weight: 700;
  opacity: 0.72;
}

/* Dark mode pills */
html[data-theme="dark"] .trr-pill {
  background: rgba(255,255,255,0.08);
  color: #c3d5dd;
  border-color: rgba(255,255,255,0.06);
}
html[data-theme="dark"] .trr-pill:hover {
  background: rgba(255,255,255,0.14);
}
html[data-theme="dark"] .trr-pill.active {
  background: #D08844;
  color: #fff;
  border-color: #c47a38;
  box-shadow: 0 6px 20px rgba(208, 136, 68, 0.3);
}
html[data-theme="dark"] .trr-pill-logo {
  border-color: rgba(255,255,255,0.18);
}

/* ?????? Card Grid ??????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
@media (max-width: 1024px) {
  .trr-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .trr-grid { grid-template-columns: 1fr; max-width: 380px; margin: 0 auto; }
}

/* ?????? Card ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-card {
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), #ffffff);
  border-radius: 24px;
  padding: 1.25rem 1.25rem 1.5rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  animation: trrSlideUp 0.55s ease both;
  overflow: hidden;
  border: 1px solid rgba(102, 120, 114, 0.14);
}
.trr-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 22px 48px rgba(0,0,0,0.12);
}

html[data-theme="dark"] .trr-card {
  background: linear-gradient(155deg, rgba(22,32,40,0.95), rgba(18,28,35,0.92));
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.06);
}
html[data-theme="dark"] .trr-card:hover {
  box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  border-color: rgba(255,255,255,0.12);
}

.trr-card::before {
  content: '';
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 5px;
  background: linear-gradient(90deg, var(--trr-accent, #2C766E), transparent 82%);
}

.trr-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

@keyframes trrSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Fuel badge */
.trr-fuel-tag {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(102, 120, 114, 0.18);
  font-size: 0.68rem;
  font-weight: 700;
  font-family: 'Poppins', sans-serif;
  color: var(--trr-accent-deep, #3a6b69);
  text-transform: capitalize;
  letter-spacing: 0.02em;
  background: var(--trr-accent-soft, rgba(255,255,255,0.72));
}
html[data-theme="dark"] .trr-fuel-tag {
  border-color: rgba(160,185,195,0.28);
  color: #b6cad3;
  background: rgba(255,255,255,0.04);
}

.trr-rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--trr-accent-deep, #1a3032);
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(102, 120, 114, 0.14);
}
html[data-theme="dark"] .trr-rating-badge {
  background: rgba(255,255,255,0.05);
  color: #f2f7f8;
  border-color: rgba(255,255,255,0.08);
}

/* Vehicle image container */
.trr-img-box {
  height: 168px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.35rem 0 0.85rem;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(circle at top, var(--trr-accent-soft, rgba(44, 118, 110, 0.12)), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.92));
}
.trr-img-box img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.1));
}
.trr-card:hover .trr-img-box img {
  transform: scale(1.06);
}

.trr-brand-eyebrow {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--trr-accent-deep, #4a6566);
  text-align: center;
}

/* Brand name */
.trr-brand {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a3032;
  text-align: center;
  line-height: 1.15;
  margin: 0.35rem 0 0;
  transition: color 0.3s;
}
html[data-theme="dark"] .trr-brand { color: #e6eef2; }

.trr-vehicle-meta {
  margin: 0.35rem 0 0;
  text-align: center;
  color: #6b7d7d;
  font-size: 0.78rem;
  font-weight: 600;
}
html[data-theme="dark"] .trr-vehicle-meta { color: #9fb2ba; }

/* Specs row */
.trr-specs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
  font-size: 0.73rem;
  font-weight: 500;
  font-family: 'Poppins', sans-serif;
  color: #4a6566;
}
html[data-theme="dark"] .trr-specs { color: #b0c4cd; }

.trr-spec {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.42rem 0.7rem;
  border-radius: 9999px;
  background: rgba(255,255,255,0.68);
  border: 1px solid rgba(102, 120, 114, 0.12);
}
.trr-spec svg {
  opacity: 0.5;
  flex-shrink: 0;
}
.trr-spec em {
  font-style: normal;
}

/* Price */
.trr-price {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1rem;
  font-weight: 600;
  color: #1a3032;
  text-align: center;
  margin: 1rem 0 0;
  transition: color 0.3s;
}
.trr-price span {
  font-family: 'Poppins', sans-serif;
  font-size: 0.76rem;
  font-weight: 600;
  color: #6e8282;
}
.trr-price strong {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0 0.1rem;
}
html[data-theme="dark"] .trr-price { color: #e6eef2; }

/* Action buttons */
.trr-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
.trr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.72rem 1.2rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  text-decoration: none;
  transition: all 0.28s cubic-bezier(0.25,0.46,0.45,0.94);
  cursor: pointer;
  border: 2px solid transparent;
  letter-spacing: 0.01em;
}

/* Details button ??? teal green (matches reference) */
.trr-btn--primary {
  background: linear-gradient(135deg, var(--trr-accent, #2C766E), var(--trr-accent-deep, #246058));
  color: #fff;
  border-color: transparent;
}
.trr-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(44,118,110,0.25);
}
html[data-theme="dark"] .trr-btn--primary {
  background: linear-gradient(135deg, #4aa399, #3D8F7E);
}
html[data-theme="dark"] .trr-btn--primary:hover {
  box-shadow: 0 12px 24px rgba(74,163,153,0.26);
}

/* Book Now button ??? outlined gray (matches reference) */
.trr-btn--outline {
  background: rgba(255,255,255,0.78);
  color: #3a5555;
  border-color: rgba(102, 120, 114, 0.18);
}
.trr-btn--outline:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 49, 51, 0.08);
}
html[data-theme="dark"] .trr-btn--outline {
  background: transparent;
  color: #c3d5dd;
  border-color: rgba(255,255,255,0.18);
}
html[data-theme="dark"] .trr-btn--outline:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.3);
}

/* ?????? Empty / Error ??????????????????????????????????????????????????????????????????????????????????????????????????? */
.trr-empty {
  text-align: center;
  padding: 3rem 1rem;
  font-size: 0.92rem;
  color: #7f8f8f;
  font-weight: 500;
}
.trr-error { color: #c0392b; }
html[data-theme="dark"] .trr-empty { color: #9fb2ba; }
html[data-theme="dark"] .trr-error { color: #e74c3c; }

/* ?????? Skeleton loading ?????????????????????????????????????????????????????????????????????????????????????????? */
.trr-skel-card {
  background: #fff;
  border-radius: 24px;
  padding: 1.4rem;
  animation: trrPulse 1.6s ease-in-out infinite;
}
html[data-theme="dark"] .trr-skel-card {
  background: rgba(255,255,255,0.04);
}
.trr-skel-badge {
  width: 52px;
  height: 22px;
  background: #e6ebe6;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}
.trr-skel-img {
  height: 140px;
  background: #eceee9;
  border-radius: 14px;
  margin-bottom: 1rem;
}
.trr-skel-line {
  height: 18px;
  background: #e6ebe6;
  border-radius: 9px;
  margin: 0 auto 0.6rem;
}
.trr-skel-line.lg { width: 55%; height: 24px; }
.trr-skel-line.md { width: 70%; }
.trr-skel-specs {
  height: 14px;
  width: 80%;
  background: #eceee9;
  border-radius: 7px;
  margin: 0 auto 0.8rem;
}
.trr-skel-btns {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
.trr-skel-btn {
  width: 80px;
  height: 34px;
  border-radius: 9999px;
  background: #e6ebe6;
}

html[data-theme="dark"] .trr-skel-badge,
html[data-theme="dark"] .trr-skel-img,
html[data-theme="dark"] .trr-skel-line,
html[data-theme="dark"] .trr-skel-specs,
html[data-theme="dark"] .trr-skel-btn {
  background: rgba(255,255,255,0.06);
}

.trr-skel-title {
  height: 3.2rem;
  width: 260px;
  max-width: 70%;
  background: #dde2dc;
  border-radius: 10px;
  margin: 0 auto 1rem;
  animation: trrPulse 1.6s ease-in-out infinite;
}
.trr-skel-sub {
  height: 1rem;
  width: 380px;
  max-width: 60%;
  background: #dde2dc;
  border-radius: 6px;
  margin: 0 auto;
  animation: trrPulse 1.6s ease-in-out infinite;
}
.trr-skel-pill {
  height: 38px;
  width: 100px;
  border-radius: 9999px;
  background: #d4dbd7;
  animation: trrPulse 1.6s ease-in-out infinite;
}

html[data-theme="dark"] .trr-skel-title,
html[data-theme="dark"] .trr-skel-sub,
html[data-theme="dark"] .trr-skel-pill {
  background: rgba(255,255,255,0.05);
}

@keyframes trrPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

/* ?????? Responsive polish ??????????????????????????????????????????????????????????????????????????????????????? */
@media (max-width: 768px) {
  .trr-section { padding: 3rem 0.75rem 3.5rem; }
  .trr-title { font-size: 2.2rem; }
  .trr-metrics { grid-template-columns: 1fr; }
  .trr-img-box { height: 130px; }
  .trr-brand { font-size: 1.4rem; }
  .trr-price strong { font-size: 1.15rem; }
  .trr-pills { gap: 0.4rem; }
  .trr-pill { padding: 0.4rem 0.9rem; font-size: 0.72rem; }
  .trr-pill-logo { width: 18px; height: 18px; font-size: 0.55rem; }
}
`;
  }

  /* ?????? Auto-init ????????????????????????????????????????????????????????????????????????????????????????????????????????? */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    setTimeout(initWidget, 100);
  }

})();
