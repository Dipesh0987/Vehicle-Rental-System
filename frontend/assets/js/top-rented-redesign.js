// Top Rated Rental Cars — Dynamic data from database, NPR pricing, brand-based filtering
// Matches reference design: brand pills, fuel badges, centered images, specs, NPR prices

(function () {
  'use strict';

  const SECTION_ID = 'homeTopRatedSection';
  const PILL_LIMIT = 5;
  const CARDS_PER_BRAND = 3;
  const FALLBACK_IMG = 'assets/images/car-transparent.png';

  /* ── helpers ────────────────────────────────────── */
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

  /* ── brand logo SVGs (simple circles with letter) ── */
  function brandIcon(brand) {
    const letter = brandLetter(brand);
    const tone = brandTone(brand);
    return `<span class="trr-pill-logo" style="--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}">${letter}</span>`;
  }

  /* ── Supabase fetch ────────────────────────────── */
  async function fetchVehicles() {
    if (window.VehicleCatalogService && typeof window.VehicleCatalogService.listVehicles === 'function') {
      const vehicles = await window.VehicleCatalogService.listVehicles({ includeInactive: false });
      return (vehicles || []).filter(v => v && v.available !== false);
    }

    let sb = window.supabase;
    if (!sb && window.SupabaseClient && typeof window.SupabaseClient.init === 'function') {
      sb = await window.SupabaseClient.init();
      window.supabase = sb;
    }
    if (!sb || typeof sb.from !== 'function') throw new Error('Supabase not ready');

    const { data, error } = await sb
      .from('vehicles')
      .select('id,name,brand,make,model,type,category,transmission,fuel_type,seats,rating,price_per_day,daily_rate,primary_image_url,image_url,vehicle_number,status,is_available,available')
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      name: row.name || row.model || 'Vehicle',
      brand: row.brand || row.make || 'Vehicle',
      fuelType: row.fuel_type || 'Petrol',
      seats: row.seats || 4,
      transmission: row.transmission || 'Automatic',
      pricePerDay: row.price_per_day ?? row.daily_rate ?? 0,
      rating: row.rating ?? 0,
      primaryImageUrl: row.primary_image_url || row.image_url || FALLBACK_IMG,
      vehicleNumber: row.vehicle_number || '',
      category: row.category || row.type || 'Car',
      available: row.available !== false && row.is_available !== false && String(row.status || '').toLowerCase() !== 'inactive',
      status: row.status || 'available'
    })).filter(v => v.available !== false);
  }

  /* ── Skeleton loading ──────────────────────────── */
  function skeletonHTML() {
    const card = `<div class="trr-skel-card">
      <div class="trr-skel-badge"></div>
      <div class="trr-skel-img"></div>
      <div class="trr-skel-line lg"></div>
      <div class="trr-skel-specs"></div>
      <div class="trr-skel-line md"></div>
      <div class="trr-skel-btns">
        <div class="trr-skel-btn"></div>
        <div class="trr-skel-btn"></div>
      </div>
    </div>`;
    return `<section class="trr-section">
      <div class="trr-wrap">
        <div class="trr-head">
          <div class="trr-skel-title"></div>
          <div class="trr-skel-sub"></div>
        </div>
        <div class="trr-pills">
          ${Array(5).fill('<div class="trr-skel-pill"></div>').join('')}
        </div>
        <div class="trr-grid">${card.repeat(3)}</div>
      </div>
    </section>`;
  }

  /* ── SVG Icons ─────────────────────────────────── */
  const ICON = {
    seat: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>`,
    gear: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    fuel: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><rect x="6" y="9" width="6" height="4" rx="1"/></svg>`
  };

  /* ── Render single card ────────────────────────── */
  function renderCard(v, idx) {
    const fuel = esc(v.fuelType || v.fuel_type || 'Petrol');
    const img = esc(v.primaryImageUrl || v.primary_image_url || v.image_url || FALLBACK_IMG);
    const brand = esc(v.brand || 'Vehicle');
    const name = esc(v.name || 'Vehicle');
    const seats = Number(v.seats || 4);
    const trans = esc(v.transmission || 'Manual');
    const pricePerDay = Number(v.pricePerDay || v.price_per_day || v.daily_rate || 0);
    const price = fmtPrice(pricePerDay);
    const detailUrl = 'vehicle-details.html?id=' + encodeURIComponent(v.id || '');
    const bookUrl = 'booking.html?vehicle=' + encodeURIComponent(v.id || '');
    const tone = brandTone(brand || name);

    return `
      <article class="trr-card" style="animation-delay:${idx * 120}ms;--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}" role="article" aria-label="${brand} ${name} rental car">
        <div class="trr-card-top">
          <span class="trr-fuel-tag" aria-label="Fuel type: ${fuel}">${fuel}</span>
        </div>
        <div class="trr-img-box" role="img" aria-label="${brand} ${name} vehicle image">
          <img src="${img}" alt="${brand} ${name}" loading="lazy" decoding="async" onerror="this.src='${FALLBACK_IMG}'" />
        </div>
        <h3 class="trr-brand">${brand}</h3>
        <div class="trr-specs" aria-label="Vehicle specifications">
          <span class="trr-spec" aria-label="${seats} seater capacity">${ICON.seat}<em>${seats} Seater</em></span>
          <span class="trr-spec" aria-label="${trans} transmission">${ICON.gear}<em>${trans}</em></span>
          <span class="trr-spec" aria-label="${fuel.split('/')[0]} fuel type">${ICON.fuel}<em>${fuel.split('/')[0]}</em></span>
        </div>
        <p class="trr-price" aria-label="Price starting at ${price} per day">Starting at <strong>${price}</strong><span>/Day</span></p>
        <div class="trr-actions">
          <a href="${detailUrl}" class="trr-btn trr-btn--details" aria-label="View details for ${brand} ${name}">Details</a>
          <a href="${bookUrl}" class="trr-btn trr-btn--book" aria-label="Book ${brand} ${name} now">Book Now</a>
        </div>
      </article>`;
  }

  /* ── Main init ─────────────────────────────────── */
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
      let renderTimeout = null;

      function render() {
        // Debounce rapid renders
        if (renderTimeout) {
          clearTimeout(renderTimeout);
        }
        
        renderTimeout = setTimeout(() => {
          const pillsHTML = brandList.map(b => {
            const isActive = b.brand === activeBrand;
            const tone = brandTone(b.brand);
            return `<button 
              type="button" 
              class="trr-pill${isActive ? ' active' : ''}" 
              data-brand="${esc(b.brand)}" 
              style="--trr-accent:${tone.accent};--trr-accent-soft:${tone.accentSoft};--trr-accent-deep:${tone.accentDeep}"
              aria-pressed="${isActive}"
              aria-label="Filter by ${esc(b.brand)} brand"
              role="tab"
              tabindex="${isActive ? '0' : '-1'}">
              ${brandIcon(b.brand)}
              <span>${esc(b.brand)}</span>
            </button>`;
          }).join('');

          const cards = (brandMap[activeBrand] || [])
            .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
            .slice(0, CARDS_PER_BRAND);

          const cardsHTML = cards.map((v, i) => renderCard(v, i)).join('');

          root.innerHTML = `
            <section class="trr-section" aria-label="Top Rated Rental Cars">
              <div class="trr-wrap">
                <div class="trr-head">
                  <h2 class="trr-title">Top Rated<br>Rented Cars</h2>
                  <p class="trr-sub">Sed volupat sed nunc vel porttitor. Fusce placerat aliquam dolor non pretium. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere.</p>
                </div>
                <div class="trr-pills" role="tablist" aria-label="Filter by vehicle brand">${pillsHTML}</div>
                <div class="trr-grid" role="tabpanel" aria-label="${esc(activeBrand)} vehicles">${cardsHTML}</div>
              </div>
            </section>`;

          // Pill click handlers with keyboard support
          const pills = root.querySelectorAll('.trr-pill');
          pills.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
              const b = btn.getAttribute('data-brand');
              if (b && b !== activeBrand) {
                activeBrand = b;
                render();
              }
            });

            // Keyboard navigation
            btn.addEventListener('keydown', (e) => {
              let targetIdx = idx;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                targetIdx = (idx + 1) % pills.length;
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                targetIdx = (idx - 1 + pills.length) % pills.length;
              } else if (e.key === 'Home') {
                e.preventDefault();
                targetIdx = 0;
              } else if (e.key === 'End') {
                e.preventDefault();
                targetIdx = pills.length - 1;
              } else {
                return;
              }
              
              const targetPill = pills[targetIdx];
              if (targetPill) {
                const b = targetPill.getAttribute('data-brand');
                if (b) {
                  activeBrand = b;
                  render();
                  setTimeout(() => {
                    const newPills = root.querySelectorAll('.trr-pill');
                    if (newPills[targetIdx]) {
                      newPills[targetIdx].focus();
                    }
                  }, 50);
                }
              }
            });
          });

          // Lazy load images using Intersection Observer
          if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  const img = entry.target;
                  if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                  }
                }
              });
            }, { rootMargin: '50px' });

            root.querySelectorAll('img[data-src]').forEach(img => {
              imageObserver.observe(img);
            });
          }
        }, 50);
      }

      render();
    } catch (err) {
      console.error('Top Rated fetch error', err);
      root.innerHTML = `<section class="trr-section"><div class="trr-wrap"><p class="trr-empty trr-error">Could not load vehicles. Please try again later.</p></div></section>`;
    }
  }

  /* ═══════════════════════════════════════════════════
     CSS — Reference-matched design
     ═══════════════════════════════════════════════════ */
  function getCSS() {
    return `

/* ── Section ─────────────────────────────────────── */
.trr-section {
  padding: 5rem 1.5rem;
  background: #F5F6F4;
  transition: background 0.3s ease;
}

html[data-theme="dark"] .trr-section {
  background: #0F1419;
}

.trr-wrap {
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────── */
.trr-head {
  text-align: center;
  margin-bottom: 2.5rem;
}

.trr-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.1;
  color: #0B161C;
  margin: 0 0 1rem;
  transition: color 0.3s ease;
}

html[data-theme="dark"] .trr-title {
  color: #E6EEF2;
}

.trr-sub {
  max-width: 600px;
  margin: 0 auto;
  font-size: 1rem;
  line-height: 1.6;
  color: #6B7280;
  transition: color 0.3s ease;
}

html[data-theme="dark"] .trr-sub {
  color: #9FB2BA;
}

/* ── Brand Pills ─────────────────────────────────── */
.trr-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.85rem;
  margin-bottom: 2.75rem;
}

.trr-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.75rem;
  border-radius: 9999px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: #C9D4D0;
  color: #374151;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.trr-pill:hover {
  background: #B8C4BF;
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.trr-pill.active {
  background: linear-gradient(135deg, #E58C4E 0%, #D67A3A 100%);
  color: #fff;
  box-shadow: 0 10px 24px rgba(229, 140, 78, 0.35);
  transform: translateY(-2px);
}

.trr-pill.active:hover {
  box-shadow: 0 12px 28px rgba(229, 140, 78, 0.4);
  transform: translateY(-4px);
}

.trr-pill-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 800;
  background: rgba(255,255,255,0.35);
  color: inherit;
  border: 2px solid rgba(255,255,255,0.2);
}

/* ── Card Grid ───────────────────────────────────── */
.trr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

@media (max-width: 1024px) {
  .trr-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .trr-grid { grid-template-columns: 1fr; }
}

/* ── Card ────────────────────────────────────────── */
.trr-card {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 1.75rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  animation: trrSlideUp 0.5s ease both;
  border: 1px solid rgba(0,0,0,0.06);
}

html[data-theme="dark"] .trr-card {
  background: rgba(30,41,51,0.95);
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

.trr-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.12);
  border-color: rgba(229, 140, 78, 0.15);
}

html[data-theme="dark"] .trr-card:hover {
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
  border-color: rgba(229, 140, 78, 0.3);
}

@keyframes trrSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.trr-card-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.trr-fuel-tag {
  display: inline-block;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
  background: #E5E7EB;
  text-transform: capitalize;
}

.trr-img-box {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  background: transparent;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.trr-img-box::before {
  content: '';
  position: absolute;
  inset: 0;
  background: transparent;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.trr-card:hover .trr-img-box::before {
  opacity: 0;
}

.trr-img-box img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
}

.trr-card:hover .trr-img-box img {
  transform: scale(1.08) rotate(1deg);
}

.trr-brand {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.75rem;
  font-weight: 800;
  color: #1F2937;
  text-align: center;
  margin: 0 0 1rem;
  transition: color 0.3s ease;
}

html[data-theme="dark"] .trr-brand {
  color: #E6EEF2;
}

.trr-specs {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.85rem;
  color: #6B7280;
}

.trr-spec {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.trr-spec svg {
  opacity: 0.6;
}

.trr-spec em {
  font-style: normal;
}

.trr-price {
  font-size: 1rem;
  color: #374151;
  text-align: center;
  margin: 0 0 1.5rem;
}

.trr-price strong {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1F2937;
  margin: 0 0.25rem;
}

.trr-price span {
  font-size: 0.9rem;
  color: #6B7280;
}

.trr-actions {
  display: flex;
  gap: 0.85rem;
}

.trr-btn {
  flex: 1;
  padding: 0.95rem 1.5rem;
  border-radius: 9999px;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: none;
}

.trr-btn--details {
  background: linear-gradient(135deg, #E58C4E 0%, #D67A3A 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(229, 140, 78, 0.25);
}

.trr-btn--details:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(229, 140, 78, 0.35);
  filter: brightness(1.05);
}

.trr-btn--book {
  background: #C9D4D0;
  color: #374151;
  border: 2px solid transparent;
}

.trr-btn--book:hover {
  background: #B8C4BF;
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* ── Empty / Error ───────────────────────────────── */
.trr-empty {
  text-align: center;
  padding: 3rem 1rem;
  font-size: 1rem;
  color: #6B7280;
}

.trr-error {
  color: #DC2626;
}

/* ── Skeleton loading ────────────────────────────── */
.trr-skel-card {
  background: #fff;
  border-radius: 20px;
  padding: 1.5rem;
  animation: trrPulse 1.5s ease-in-out infinite;
}

.trr-skel-badge {
  width: 60px;
  height: 24px;
  background: #E5E7EB;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.trr-skel-img {
  height: 160px;
  background: #F3F4F6;
  border-radius: 12px;
  margin-bottom: 1.25rem;
}

.trr-skel-line {
  height: 20px;
  background: #E5E7EB;
  border-radius: 10px;
  margin: 0 auto 0.75rem;
}

.trr-skel-line.lg {
  width: 60%;
  height: 28px;
}

.trr-skel-line.md {
  width: 75%;
}

.trr-skel-specs {
  height: 16px;
  width: 85%;
  background: #F3F4F6;
  border-radius: 8px;
  margin: 0 auto 1rem;
}

.trr-skel-btns {
  display: flex;
  gap: 0.75rem;
}

.trr-skel-btn {
  flex: 1;
  height: 40px;
  border-radius: 9999px;
  background: #E5E7EB;
}

.trr-skel-title {
  height: 3.5rem;
  width: 300px;
  max-width: 80%;
  background: #E5E7EB;
  border-radius: 12px;
  margin: 0 auto 1rem;
  animation: trrPulse 1.5s ease-in-out infinite;
}

.trr-skel-sub {
  height: 1.25rem;
  width: 400px;
  max-width: 70%;
  background: #F3F4F6;
  border-radius: 8px;
  margin: 0 auto;
  animation: trrPulse 1.5s ease-in-out infinite;
}

.trr-skel-pill {
  height: 40px;
  width: 120px;
  border-radius: 9999px;
  background: #E5E7EB;
  animation: trrPulse 1.5s ease-in-out infinite;
}

@keyframes trrPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Responsive ──────────────────────────────────── */
@media (max-width: 1024px) {
  .trr-grid { grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
  .trr-title { font-size: 3rem; }
}

@media (max-width: 768px) {
  .trr-section { padding: 3.5rem 1rem; }
  .trr-title { font-size: 2.5rem; }
  .trr-sub { font-size: 0.95rem; }
  .trr-brand { font-size: 1.5rem; }
  .trr-img-box { height: 150px; }
  .trr-pills { gap: 0.6rem; margin-bottom: 2rem; }
  .trr-pill { padding: 0.6rem 1.25rem; font-size: 0.9rem; }
}

@media (max-width: 640px) {
  .trr-grid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
  .trr-section { padding: 3rem 1rem; }
  .trr-title { font-size: 2.25rem; }
  .trr-head { margin-bottom: 2rem; }
  .trr-pills { margin-bottom: 1.75rem; }
  .trr-card { padding: 1.5rem; }
}
`;
  }

  /* ── Auto-init ─────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    setTimeout(initWidget, 100);
  }

})();
