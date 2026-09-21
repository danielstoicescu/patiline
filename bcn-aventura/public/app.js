// Barcelona Aventura – Mara (13), Anne & Daniel
// Offline-first. Trei ecrane: Plan (planificare), Explorare (hartă + radar), Info.
import { TRIP, ZONES, DAY_ZONES, DAY_TIPS, ITINERARY, ALTERNATIVES } from './data.js';

const TRIP_ID = TRIP.id;
const DAYS = ['thu', 'fri', 'sat', 'sun', 'mon'];
const DAY_LABEL = { thu: 'Joi 5', fri: 'Vineri 6', sat: 'Sâmbătă 7', sun: 'Duminică 8', mon: 'Luni 9' };
const PEOPLE = ['Daniel', 'Mara', 'Anne'];
const COFFEE_GOAL = 20;
const LS = { locations: 'bcn_locations', coffee: 'bcn_coffee', quests: 'bcn_quests', visited: 'bcn_visited', pins: 'bcn_pins', notes: 'bcn_notes', skipped: 'bcn_skipped', theme: 'bcn_theme', alerted: 'bcn_alerted', weather: 'bcn_weather', view: 'bcn_view' };

const SUMMARY_TEXT = `Barcelona Aventura (Mara 13, Anne & Daniel), 4–9 nov:
• Baza: Poblenou (Bac de Roda)
• Joi 5: PortAventura (Shambhala, Dragon Khan, Halloween)
• Vineri 6: tren spre BCN, Nomad Coffee, Demasié, Banh Mi Club, tapas Bitácora
• Sâmbătă 7: Satan's Coffee & El Call, churros 1968, toboganul Sephora, vintage Raval, Bar del Pla, MNAC gratis, pinchos Blai
• Duminică 8: Three Marks, Sagrada Família, SAISEI, Design Museum gratis, apus la Bunkers, Gràcia
• Luni 9: Encants, Print Workers, La Cova Fumada, plajă, Hofmann, Quimet & Quimet`;

// ---------- Stare ----------
const state = {
  view: 'plan', day: 'thu', filter: 'all',
  custom: [], coffee: 0, quests: {}, visited: {}, pins: {}, notes: '', skipped: {},
  online: false,
  radarOn: false, pos: null, watchId: null, alerted: {},
  installPrompt: null, map: null, markers: [], meMarker: null,
};
let fb = null;

// ---------- Utilitare ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + (/(barcelona|salou|vila-seca)/i.test(q) ? '' : ' Barcelona'))}`;
const placeQuery = (loc) => (loc.address ? `${loc.title}, ${loc.address}` : loc.title);
function coordsOf(loc) {
  const pin = state.pins[loc.id];
  if (pin && typeof pin.lat === 'number') return { lat: pin.lat, lng: pin.lng, exact: true };
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: loc.lat, lng: loc.lng, exact: !loc.approx };
  return null;
}
// Destinația pentru Google Maps: coordonate când sunt exacte, altfel numele + adresa (Google le rezolvă mai bine decât un punct aproximativ)
const destOf = (loc) => { const p = coordsOf(loc); if (p && p.exact) return `${p.lat},${p.lng}`; const a = loc.address || loc.title; return /(barcelona|salou|vila-seca)/i.test(a) ? a : `${a}, Barcelona`; };
const mapsNav = (loc, mode = 'walking') => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destOf(loc))}&travelmode=${mode}`;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
function distanceM(a, b) {
  const R = 6371000, r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const walkMin = (m) => Math.max(1, Math.round(m / 80));
function parseRange(time) { const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(time || ''); return m ? { from: +m[1] * 60 + +m[2], to: +m[3] * 60 + +m[4] } : null; }
const startMin = (loc) => { const r = parseRange(loc.time); if (r) return r.from; const m = /(\d{1,2}):(\d{2})/.exec(loc.time || ''); return m ? +m[1] * 60 + +m[2] : 10000; };

let toastTimer;
function toast(message, icon = 'fa-circle-check', ms = 3200) {
  const el = $('#toast'); $('#toastMessage').textContent = message;
  el.querySelector('i').className = `fa-solid ${icon} text-ocre text-lg`;
  el.classList.remove('hidden-toast'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden-toast'), ms);
}
function setSyncStatus(mode, detail) {
  const html = mode === 'online' ? '<i class="fa-solid fa-cloud-bolt text-verd"></i> Live' : mode === 'local' ? '<i class="fa-solid fa-mobile-screen text-ocre-dark"></i> Doar pe acest telefon' : '<i class="fa-solid fa-circle-notch fa-spin"></i> Se conectează…';
  for (const el of [$('#syncStatus'), $('#syncStatusMobile')]) if (el) { el.innerHTML = html; el.title = detail || ''; }
}

// ---------- Timp ----------
function todayKey() {
  const t = new Date(), iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return DAYS.find((d) => TRIP.days[d] === iso) || null;
}
function isNow(loc) {
  if (todayKey() !== loc.day) return false;
  const r = parseRange(loc.time); if (!r) return false;
  const t = new Date(), m = t.getHours() * 60 + t.getMinutes();
  return m >= r.from - 15 && m <= r.to;
}
function renderCountdown() {
  const el = $('#countdown'); if (!el) return;
  const start = new Date(TRIP.start + 'T00:00:00'), end = new Date(TRIP.days.mon + 'T23:59:59'), now = new Date();
  const days = Math.ceil((start - now) / 86400000);
  let text = 'Mara turns 13';
  if (now > end) text += ' · a fost o excursie!'; else if (days > 1) text += ` · ${days} zile până la plecare`; else if (days === 1) text += ' · mâine plecăm!'; else text += ' · suntem în excursie!';
  el.innerHTML = `<i class="fa-solid fa-cake-candles"></i> ${esc(text)}`;
}

// ---------- Liste ----------
const CAT = {
  mara:   { chip: 'bg-vermell-soft text-vermell-dark dark:bg-vermell/25 dark:text-vermell-soft', pin: 'bg-vermell', icon: 'fa-wand-magic-sparkles', label: 'Mara' },
  coffee: { chip: 'bg-ocre-soft text-ocre-dark dark:bg-ocre/25 dark:text-ocre-soft', pin: 'bg-ocre text-ink', icon: 'fa-mug-hot', label: 'Cafea & bere' },
  food:   { chip: 'bg-verd-soft text-verd-dark dark:bg-verd/25 dark:text-verd-soft', pin: 'bg-verd', icon: 'fa-utensils', label: 'Mâncare' },
  art:    { chip: 'bg-blau-soft text-blau-dark dark:bg-blau/25 dark:text-blau-soft', pin: 'bg-blau', icon: 'fa-palette', label: 'Artă & vederi' },
};
const cat = (c) => CAT[c] || { chip: 'bg-calc-2 text-ink-2', pin: 'bg-ink', icon: 'fa-map-pin', label: 'Loc' };
const SOURCE = { instagram: ['fa-brands fa-instagram', 'Reel'], tiktok: ['fa-brands fa-tiktok', 'TikTok'], youtube: ['fa-brands fa-youtube', 'YouTube'], gmaps: ['fa-solid fa-map', 'Google Maps'], web: ['fa-solid fa-link', 'Link'] };

function dayItems(day, includeSkipped = false) {
  const items = [...ITINERARY.filter((l) => l.day === day), ...state.custom.filter((l) => l.day === day)]
    .filter((l) => includeSkipped || !state.skipped[l.id]);
  return items.map((l, i) => ({ l, i })).sort((a, b) => startMin(a.l) - startMin(b.l) || a.i - b.i).map((x) => x.l);
}

const chip = (cls, icon, text) => `<span class="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold ${cls}"><i class="fa-solid ${icon}"></i> ${text}</span>`;

function cardHTML(loc, index) {
  const c = cat(loc.cat), key = loc.id;
  const visited = !!state.visited[key], skipped = !!state.skipped[key];
  const p = coordsOf(loc), dist = state.pos && p ? distanceM(state.pos, p) : null;
  const src = loc.source && SOURCE[loc.source];
  const chips = [
    isNow(loc) ? chip('bg-blau text-calc', 'fa-clock', 'ACUM') : '',
    loc.free ? chip('bg-verd-soft text-verd-dark dark:bg-verd/25 dark:text-verd-soft', 'fa-gift', 'Gratis') : '',
    loc.verify ? chip('bg-ocre-soft text-ocre-dark dark:bg-ocre/25 dark:text-ocre-soft', 'fa-circle-question', 'Verifică orele') : '',
    loc.isCustom ? chip('bg-vermell-soft text-vermell-dark dark:bg-vermell/25 dark:text-vermell-soft', 'fa-user', esc(loc.addedBy || 'noi')) : '',
    dist != null ? chip('bg-blau-soft text-blau-dark dark:bg-blau/25 dark:text-blau-soft', 'fa-person-walking', `${fmtDist(dist)} · ${walkMin(dist)} min`) : '',
    p && !p.exact ? chip('bg-calc-2 text-ink-3 dark:bg-carbo-3 dark:text-calc-3', 'fa-location-crosshairs', 'aprox.') : '',
  ].join('');
  const meta = [
    loc.address ? `<div><i class="fa-solid fa-location-dot w-4 text-center text-ink-3"></i> ${esc(loc.address)}</div>` : '',
    loc.hours ? `<div><i class="fa-regular fa-clock w-4 text-center text-ink-3"></i> ${esc(loc.hours)}</div>` : '',
    loc.price ? `<div><i class="fa-solid fa-euro-sign w-4 text-center text-ink-3"></i> ${esc(loc.price)}</div>` : '',
  ].join('');
  const img = loc.imgUrl ? `<img src="${esc(loc.imgUrl)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()">` : '';
  return `
    <article class="relative pl-11 timeline-step ${visited || skipped ? 'opacity-55' : ''}" id="loc-${esc(key)}">
      <div class="absolute left-0 top-3 w-9 h-9 xamfra-sm ${visited ? 'bg-verd text-calc' : skipped ? 'bg-calc-3 text-ink-2' : 'bg-ink dark:bg-calc text-calc dark:text-ink'} font-display font-black text-sm grid place-items-center">${visited ? '<i class="fa-solid fa-check"></i>' : skipped ? '<i class="fa-solid fa-minus"></i>' : index + 1}</div>
      <div class="rounded-xl bg-white dark:bg-carbo-2 hairline overflow-hidden ${isNow(loc) ? 'ring-2 ring-blau' : ''}">
        <div class="grid grid-cols-1 md:grid-cols-12">
          <div class="md:col-span-4 relative h-36 md:h-auto md:min-h-[200px] ${c.pin} xamfra-tr">
            <div class="absolute inset-0 grid place-items-center text-calc/60 text-5xl"><i class="fa-solid ${c.icon}"></i></div>
            ${img}
            <div class="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1"><span class="h-6 px-2 rounded-full bg-ink/80 text-calc text-[10px] font-bold inline-flex items-center gap-1"><i class="fa-solid ${c.icon}"></i> ${esc(loc.catLabel || c.label)}</span></div>
          </div>
          <div class="md:col-span-8 p-4 flex flex-col gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-1 mb-2">${chips}</div>
              <div class="flex items-start justify-between gap-3">
                <h4 class="font-display font-bold text-[17px] leading-snug ${visited ? 'line-through' : ''}" style="text-wrap:balance">${esc(loc.title)}</h4>
                <span class="shrink-0 h-7 px-2.5 rounded-full bg-calc dark:bg-carbo-3 text-xs font-bold tabular-nums">${esc(loc.time || 'Flexibil')}</span>
              </div>
              <p class="text-[13px] text-ink-2 dark:text-calc-2 leading-relaxed mt-2 whitespace-pre-line">${esc(loc.desc)}</p>
              ${meta ? `<div class="mt-2.5 space-y-0.5 text-[11px] text-ink-2 dark:text-calc-3">${meta}</div>` : ''}
              ${src && loc.link ? `<a href="${esc(loc.link)}" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full hairline text-[11px] font-bold"><i class="${src[0]}"></i> Deschide ${src[1]}</a>` : ''}
            </div>
            <div class="pt-3 border-t border-ink/10 dark:border-calc/10 flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <a href="${esc(mapsNav(loc))}" target="_blank" rel="noopener" class="btn h-10 px-4 rounded-full bg-verd text-calc font-bold text-xs inline-flex items-center gap-1.5"><i class="fa-solid fa-person-walking"></i> Navighează</a>
                <a href="${esc(mapsSearch(placeQuery(loc)))}" target="_blank" rel="noopener" class="btn h-10 px-3 rounded-full hairline font-bold text-xs inline-flex items-center gap-1.5"><i class="fa-solid fa-map"></i> Maps & ore</a>
              </div>
              <div class="flex items-center gap-1">
                ${state.pos ? `<button data-action="pin-here" data-id="${esc(key)}" class="btn h-10 w-10 rounded-full hover:bg-calc dark:hover:bg-carbo-3 grid place-items-center text-ink-3" title="Fixează poziția aici"><i class="fa-solid fa-thumbtack"></i></button>` : ''}
                ${loc.isCustom ? `<button data-action="edit-loc" data-id="${esc(key)}" class="btn h-10 w-10 rounded-full hover:bg-calc dark:hover:bg-carbo-3 grid place-items-center text-ink-3" title="Editează"><i class="fa-solid fa-pen"></i></button><button data-action="delete-loc" data-id="${esc(key)}" class="btn h-10 w-10 rounded-full hover:bg-vermell-soft grid place-items-center text-ink-3 hover:text-vermell" title="Șterge"><i class="fa-solid fa-trash-can"></i></button>` : `<button data-action="toggle-skip" data-id="${esc(key)}" class="btn h-10 px-3 rounded-full hover:bg-calc dark:hover:bg-carbo-3 text-xs font-bold text-ink-3" title="${skipped ? 'Pune înapoi în program' : 'Scoate din program (rămâne aici, estompat)'}"><i class="fa-solid ${skipped ? 'fa-rotate-left' : 'fa-minus'}"></i> ${skipped ? 'Înapoi' : 'Sari'}</button>`}
                <button data-action="toggle-visited" data-id="${esc(key)}" class="btn h-10 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${visited ? 'bg-verd-soft text-verd-dark dark:bg-verd/25 dark:text-verd-soft' : 'hairline'}"><i class="fa-solid ${visited ? 'fa-rotate-left' : 'fa-check'}"></i> ${visited ? 'Am fost' : 'Bifează'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

function altHTML(a, i) {
  const c = cat(a.cat);
  const d = state.pos && typeof a.lat === 'number' ? distanceM(state.pos, { lat: a.lat, lng: a.lng }) : null;
  return `
    <div class="rounded-xl bg-white dark:bg-carbo-2 hairline p-3.5 flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-1">
        ${chip(c.chip, c.icon, c.label)}
        ${a.free ? chip('bg-verd-soft text-verd-dark dark:bg-verd/25 dark:text-verd-soft', 'fa-gift', 'Gratis / zi gratis') : ''}
        ${a.verify ? chip('bg-ocre-soft text-ocre-dark dark:bg-ocre/25 dark:text-ocre-soft', 'fa-circle-question', 'Verifică') : ''}
        ${d != null ? chip('bg-blau-soft text-blau-dark dark:bg-blau/25 dark:text-blau-soft', 'fa-person-walking', fmtDist(d)) : ''}
      </div>
      <div class="font-display font-bold text-[15px] leading-snug">${esc(a.title)}</div>
      <p class="text-[12px] text-ink-2 dark:text-calc-2 leading-relaxed">${esc(a.note)}</p>
      <div class="text-[11px] text-ink-3 dark:text-calc-3 space-y-0.5">
        ${a.hours ? `<div><i class="fa-regular fa-clock w-4 text-center"></i> ${esc(a.hours)}</div>` : ''}${a.price ? `<div><i class="fa-solid fa-euro-sign w-4 text-center"></i> ${esc(a.price)}</div>` : ''}${a.address ? `<div><i class="fa-solid fa-location-dot w-4 text-center"></i> ${esc(a.address)}</div>` : ''}
      </div>
      <div class="flex items-center gap-1.5 pt-1 flex-wrap">
        <a href="${esc(mapsSearch(`${a.title}, ${a.address || ''}`))}" target="_blank" rel="noopener" class="btn h-9 px-3 rounded-full hairline text-[11px] font-bold inline-flex items-center gap-1"><i class="fa-solid fa-map"></i> Maps</a>
        <button data-action="add-alt" data-index="${i}" class="btn h-9 px-3 rounded-full bg-ink dark:bg-calc text-calc dark:text-ink text-[11px] font-bold"><i class="fa-solid fa-plus"></i> În program</button>
      </div>
    </div>`;
}

function renderDay() {
  const container = $('#itinerary-container'); if (!container) return;
  const list = dayItems(state.day, true).filter((l) => state.filter === 'all' || l.cat === state.filter);
  const tip = DAY_TIPS[state.day] ? `<div class="rounded-xl bg-blau-soft dark:bg-blau/20 text-blau-dark dark:text-blau-soft p-3.5 text-xs leading-relaxed"><i class="fa-solid fa-lightbulb"></i> ${esc(DAY_TIPS[state.day])}</div>` : '';
  let n = 0;
  const timeline = list.length ? `<div class="relative timeline-line space-y-3">${list.map((l) => cardHTML(l, state.skipped[l.id] ? n : n++)).join('')}</div>`
    : `<div class="p-8 text-center text-ink-3 text-sm rounded-xl bg-white dark:bg-carbo-2 hairline">Nimic pentru filtrul ales. <button data-action="open-add" class="ml-1 font-bold text-blau">Adaugă un loc</button></div>`;
  const zones = (DAY_ZONES[state.day] || []).map((z) => {
    const alts = ALTERNATIVES.map((a, i) => ({ a, i })).filter(({ a }) => a.zone === z && (state.filter === 'all' || a.cat === state.filter));
    return alts.length ? `<div class="mt-4"><div class="eyebrow text-ink-3 dark:text-calc-3 mb-2"><i class="fa-solid ${ZONES[z].icon} text-blau"></i> ${esc(ZONES[z].label)}</div><div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">${alts.map(({ a, i }) => altHTML(a, i)).join('')}</div></div>` : '';
  }).join('');
  const zonesBlock = zones ? `
    <details class="group rounded-xl bg-calc-2 dark:bg-carbo-2 p-4" ${state.filter !== 'all' ? 'open' : ''}>
      <summary class="list-none cursor-pointer flex items-center justify-between gap-2 min-h-[44px]">
        <span class="font-display font-bold text-base uppercase"><i class="fa-solid fa-compass text-blau"></i> Similare în zonele de azi</span>
        <i class="fa-solid fa-chevron-down text-ink-3 transition group-open:rotate-180"></i>
      </summary>
      <p class="text-[11px] text-ink-3 dark:text-calc-3">Ore și prețuri verificate în sept. 2026; „Verifică” = de confirmat în Maps.</p>
      ${zones}
    </details>` : '';
  container.innerHTML = tip + timeline + zonesBlock;
}

function switchDay(day) {
  if (!DAYS.includes(day)) return;
  state.day = day;
  $$('.day-tab, .explore-day').forEach((b) => {
    const on = b.dataset.day === day;
    b.classList.toggle('bg-ink', on); b.classList.toggle('text-calc', on); b.classList.toggle('dark:bg-calc', on); b.classList.toggle('dark:text-ink', on);
    b.classList.toggle('bg-white', !on); b.classList.toggle('dark:bg-carbo-2', !on);
    b.setAttribute('aria-pressed', String(on));
  });
  const t = $('#exploreTitle'); if (t) t.textContent = DAY_LABEL[day] + (todayKey() === day ? ' · azi' : '');
  renderDay(); renderMap(); renderNextStop();
}
function setFilter(c) {
  state.filter = c;
  $$('.cat-btn').forEach((b) => { const on = b.dataset.cat === c; b.classList.toggle('bg-ink', on); b.classList.toggle('text-calc', on); b.classList.toggle('dark:bg-calc', on); b.classList.toggle('dark:text-ink', on); b.classList.toggle('bg-white', !on); b.classList.toggle('dark:bg-carbo-2', !on); });
  renderDay();
}
function renderCoffee() { $('#coffeeCountDisplay').textContent = `${state.coffee} / ${COFFEE_GOAL}`; }
function renderQuests() { $$('.quest-check').forEach((cb) => { cb.checked = !!state.quests[cb.dataset.quest]; }); }
function renderNotes() { const ta = $('#sharedNotes'); if (ta && document.activeElement !== ta) ta.value = state.notes || ''; }
function renderAll() { renderDay(); renderMap(); renderNextStop(); renderNearby(); }

// ---------- Ecrane ----------
function setView(v) {
  if (!['plan', 'explore', 'info'].includes(v)) v = 'plan';
  state.view = v; lsSet(LS.view, v);
  $('#pinSheet').classList.add('hidden'); $('#radarBanner').classList.add('hidden');
  $$('[data-view]').forEach((s) => { if (s.tagName === 'SECTION') s.classList.toggle('hidden', s.dataset.view !== v); });
  $$('.nav-btn').forEach((b) => {
    const on = b.dataset.view === v;
    b.classList.toggle('text-ink', on); b.classList.toggle('dark:text-calc', on); b.classList.toggle('text-ink-3', !on);
    const pill = b.querySelector('.nav-pill'); pill.classList.toggle('bg-ocre', on); pill.classList.toggle('text-ink', on);
  });
  window.scrollTo({ top: 0 });
  if (v === 'explore') { ensureMap(); renderMap(); renderNextStop(); if (!state.radarOn) startRadar(); }
  if (v === 'info') { const url = location.href.split('#')[0].split('?')[0]; $('#shareUrl').value = url; $('#whatsappShareBtn').href = `https://wa.me/?text=${encodeURIComponent(`${SUMMARY_TEXT}\n\n📱 Ghidul live: ${url}`)}`; $('#qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`; }
}

// ---------- Tema ----------
function applyThemeIcon() {
  const dark = document.documentElement.classList.contains('dark');
  $('#themeIcon').className = dark ? 'fa-solid fa-sun text-lg' : 'fa-solid fa-moon text-lg';
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171716' : '#EFECE4');
}
function toggleTheme() { const h = document.documentElement; const d = h.classList.toggle('dark'); h.classList.toggle('light', !d); try { localStorage.setItem(LS.theme, d ? 'dark' : 'light'); } catch {} applyThemeIcon(); renderMap(); }

// ---------- Share ----------
async function share() {
  const url = location.href.split('#')[0].split('?')[0];
  if (navigator.share && location.protocol === 'https:') {
    try { await navigator.share({ title: 'Barcelona Aventura', text: 'Ghidul nostru de vacanță în Barcelona & PortAventura (4–9 noiembrie).', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  setView('info');
}
async function copyText(text, ok) {
  try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
  toast(ok);
}

// ---------- Traseul zilei în Google Maps ----------
function dayRoute() {
  const stops = dayItems(state.day).filter((l) => !state.visited[l.id]);
  if (!stops.length) return toast('Nu mai e nimic de vizitat azi.', 'fa-circle-check');
  const pts = stops.map(destOf);
  const origin = state.pos ? `${state.pos.lat},${state.pos.lng}` : pts.shift();
  const destination = pts.pop() ?? origin;
  const waypoints = pts.slice(0, 9); // Google Maps acceptă maximum 9 opriri intermediare
  const mode = state.day === 'thu' ? 'driving' : 'transit';
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : ''}&travelmode=${mode}`;
  if (pts.length > 9) toast('Google Maps primește maximum 9 opriri; am trimis primele.', 'fa-circle-info');
  window.open(url, '_blank', 'noopener');
}

// ---------- Persistență ----------
function loadLocal() {
  state.custom = lsGet(LS.locations, []); state.coffee = Number(lsGet(LS.coffee, 0)) || 0;
  state.quests = lsGet(LS.quests, {}); state.visited = lsGet(LS.visited, {}); state.pins = lsGet(LS.pins, {});
  state.notes = lsGet(LS.notes, ''); state.skipped = lsGet(LS.skipped, {}); state.alerted = lsGet(LS.alerted, {});
}
function persistLocal() {
  lsSet(LS.locations, state.custom); lsSet(LS.coffee, state.coffee); lsSet(LS.quests, state.quests);
  lsSet(LS.visited, state.visited); lsSet(LS.pins, state.pins); lsSet(LS.notes, state.notes); lsSet(LS.skipped, state.skipped);
}

// ---------- Firestore ----------
async function loadFirebaseConfig() {
  const local = window.FIREBASE_CONFIG;
  if (local && local.apiKey && local.projectId) return local;
  try { const res = await fetch('/__/firebase/init.json', { cache: 'no-store' }); if (res.ok) { const cfg = await res.json(); if (cfg && cfg.apiKey && cfg.projectId) return cfg; } } catch {}
  return null;
}
async function connectFirebase() {
  const cfg = await loadFirebaseConfig();
  if (!cfg) { setSyncStatus('local', 'Fără configurație Firebase (vezi README).'); return; }
  try {
    const V = '11.6.1';
    const [{ initializeApp }, fs] = await Promise.all([import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)]);
    const app = initializeApp(cfg);
    let db; try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); } catch { db = fs.getFirestore(app); }
    fb = { db, fs };
    let first = true;
    fs.onSnapshot(fs.query(fs.collection(db, 'trips', TRIP_ID, 'locations'), fs.orderBy('createdAt', 'asc')), (snap) => {
      state.custom = snap.docs.map((d) => ({ id: d.id, isCustom: true, ...d.data() })); lsSet(LS.locations, state.custom); renderAll();
      if (first) { first = false; state.online = true; setSyncStatus('online'); }
    }, (err) => { console.error(err); state.online = false; setSyncStatus('local', err.message); toast('Nu m-am putut conecta la baza de date. Salvez local.', 'fa-triangle-exclamation'); });
    fs.onSnapshot(fs.doc(db, 'trips', TRIP_ID, 'state', 'shared'), (snap) => {
      const d = snap.data() || {};
      if (typeof d.coffeeCount === 'number') state.coffee = d.coffeeCount;
      for (const k of ['quests', 'visited', 'pins', 'skipped']) if (d[k] && typeof d[k] === 'object') state[k] = d[k];
      if (typeof d.notes === 'string') state.notes = d.notes;
      persistLocal(); renderCoffee(); renderQuests(); renderNotes(); renderAll();
    }, (err) => console.error(err));
  } catch (err) { console.error(err); setSyncStatus('local', err.message); }
}
async function saveShared(patch) {
  if (fb && state.online) { const { db, fs } = fb; await fs.setDoc(fs.doc(db, 'trips', TRIP_ID, 'state', 'shared'), { ...patch, updatedAt: fs.serverTimestamp() }, { merge: true }); }
  else persistLocal();
}
async function saveLocation(data, editingId) {
  if (fb && state.online && !(editingId && String(editingId).startsWith('local-'))) {
    const { db, fs } = fb;
    if (editingId) await fs.updateDoc(fs.doc(db, 'trips', TRIP_ID, 'locations', editingId), data);
    else await fs.addDoc(fs.collection(db, 'trips', TRIP_ID, 'locations'), { ...data, createdAt: fs.serverTimestamp() });
  } else {
    if (editingId) state.custom = state.custom.map((l) => (l.id === editingId ? { ...l, ...data } : l));
    else state.custom.push({ ...data, id: 'local-' + Date.now(), isCustom: true, createdAt: new Date().toISOString() });
    persistLocal(); renderAll();
  }
}
async function deleteLocation(id) {
  if (!confirm('Ștergi acest loc din programul comun?')) return;
  if (fb && state.online && !String(id).startsWith('local-')) { const { db, fs } = fb; await fs.deleteDoc(fs.doc(db, 'trips', TRIP_ID, 'locations', id)); }
  else { state.custom = state.custom.filter((l) => l.id !== id); persistLocal(); renderAll(); }
  toast('Locul a fost șters.', 'fa-trash-can');
}
async function updateCoffee(delta) { state.coffee = Math.max(0, state.coffee + delta); renderCoffee(); await saveShared({ coffeeCount: state.coffee }); if (state.coffee === COFFEE_GOAL) toast('20 de espresso! Daniel, ești oficial barcelonez.', 'fa-trophy'); }
async function setQuest(k, done) { state.quests = { ...state.quests, [k]: done }; await saveShared({ quests: state.quests }); if (done) toast('Quest bifat!'); }
async function toggleVisited(k) { state.visited = { ...state.visited, [k]: !state.visited[k] }; renderAll(); await saveShared({ visited: state.visited }); }
async function toggleSkip(k) { state.skipped = { ...state.skipped, [k]: !state.skipped[k] }; renderAll(); await saveShared({ skipped: state.skipped }); toast(state.skipped[k] ? 'Scos din program (îl poți pune înapoi oricând).' : 'Pus înapoi în program.'); }
async function pinHere(k) {
  if (!state.pos) return toast('Nu am încă poziția ta. Deschide Explorare.', 'fa-triangle-exclamation');
  state.pins = { ...state.pins, [k]: { lat: state.pos.lat, lng: state.pos.lng } }; renderAll();
  await saveShared({ pins: state.pins }); toast('Poziția exactă a fost salvată pentru toți.');
}
let notesTimer;
function onNotesInput() {
  state.notes = $('#sharedNotes').value.slice(0, 2000); $('#notesStatus').textContent = 'Se salvează…';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(async () => { try { await saveShared({ notes: state.notes }); $('#notesStatus').textContent = state.online ? 'Salvat și sincronizat ✓' : 'Salvat pe acest telefon ✓'; } catch { $('#notesStatus').textContent = 'Eroare la salvare'; } }, 700);
}

// ---------- Adăugare: link / Reel / Maps ----------
function parseShared(text) {
  const out = { text: (text || '').trim(), url: null, source: null, title: '', lat: null, lng: null };
  const m = /https?:\/\/[^\s<>"']+/i.exec(out.text);
  if (m) out.url = m[0].replace(/[),.]+$/, '');
  const lines = out.text.split(/\n+/).map((s) => s.trim()).filter((s) => s && !/^https?:\/\//i.test(s));
  if (out.url) {
    let u; try { u = new URL(out.url); } catch { u = null; }
    const host = u ? u.hostname.replace(/^www\./, '') : '';
    if (/instagram\.com/.test(host)) out.source = 'instagram';
    else if (/tiktok\.com/.test(host)) out.source = 'tiktok';
    else if (/youtu\.?be/.test(host)) out.source = 'youtube';
    else if (/google\.[a-z.]+$/.test(host) && /\/maps/.test(u.pathname) || /maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/.test(host + u?.pathname)) out.source = 'gmaps';
    else out.source = 'web';
    if (out.source === 'gmaps' && u) {
      const place = /\/maps\/place\/([^/]+)/.exec(u.pathname); if (place) out.title = decodeURIComponent(place[1].replace(/\+/g, ' '));
      const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u.pathname); if (at) { out.lat = +at[1]; out.lng = +at[2]; }
      const d3 = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(u.href); if (d3) { out.lat = +d3[1]; out.lng = +d3[2]; }
      const q = u.searchParams.get('q') || u.searchParams.get('query');
      if (q) { const c = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/.exec(q); if (c) { out.lat = +c[1]; out.lng = +c[2]; } else if (!out.title) out.title = q; }
    }
  }
  // Share din aplicația Google Maps: „Nume loc\nhttps://maps.app.goo.gl/…”; Instagram/TikTok: uneori un titlu pe prima linie
  if (!out.title && lines.length) out.title = lines[0].replace(/\s*[|·-]\s*(Instagram|TikTok|YouTube).*$/i, '').slice(0, 120);
  return out;
}
function applyParsed(p) {
  const r = $('#linkResult');
  $('#locLink').value = p.url || ''; $('#locSource').value = p.source || '';
  if (p.title && !$('#locTitle').value) $('#locTitle').value = p.title;
  if (typeof p.lat === 'number') { formPos = { lat: p.lat, lng: p.lng }; $('#posInfo').textContent = 'poziție din link ✓'; }
  const src = SOURCE[p.source] || SOURCE.web;
  r.classList.remove('hidden');
  r.innerHTML = p.url
    ? `<div class="flex items-center gap-2"><i class="${src[0]} text-lg"></i><div class="min-w-0"><div class="font-bold">${esc(src[1])} ${p.title ? '· ' + esc(p.title) : ''}</div><div class="truncate text-ink-3">${esc(p.url)}</div></div></div>
       <p class="mt-2 text-ink-2 dark:text-calc-2">${p.source === 'gmaps' ? 'Numele și poziția au fost preluate. Completează ziua și notele.' : p.source === 'instagram' || p.source === 'tiktok' ? 'Instagram/TikTok nu lasă citirea descrierii fără login. Scrie numele locului (îl găsești în caption sau pe eticheta de locație) și apasă „Maps” ca să-l verifici. Linkul rămâne atașat pe card.' : 'Linkul va rămâne atașat pe card. Completează numele locului.'}</p>`
    : '<span class="text-vermell">Nu am găsit niciun link în text.</span>';
  if (!$('#locTitle').value) $('#locTitle').focus(); else $('#locDesc').focus();
}
async function pasteLink() {
  try { const t = await navigator.clipboard.readText(); if (t) { $('#linkInput').value = t; applyParsed(parseShared(t)); } else toast('Clipboard-ul e gol.', 'fa-circle-info'); }
  catch { toast('Nu am acces la clipboard. Lipește manual în câmp.', 'fa-circle-info'); $('#linkInput').focus(); }
}
function setAddTab(tab) {
  $$('.add-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('bg-ink', on); b.classList.toggle('text-calc', on); b.classList.toggle('dark:bg-calc', on); b.classList.toggle('dark:text-ink', on); b.classList.toggle('bg-white', !on); b.classList.toggle('dark:bg-carbo-3', !on); });
  $('#addTabLink').classList.toggle('hidden', tab !== 'link');
}
let formPos = null;
function resetForm() {
  $('#addLocationForm').reset(); $('#editingId').value = ''; $('#locLink').value = ''; $('#locSource').value = ''; $('#linkInput').value = '';
  $('#linkResult').classList.add('hidden'); $('#posInfo').textContent = ''; formPos = null;
  $('#useMyPosBtn span').textContent = 'Sunt aici acum'; $('#addTitle').textContent = 'Adaugă un loc'; $('#saveLocBtn').textContent = 'Salvează în programul comun';
  $('#locDay').value = state.day;
}
function openAdd({ tab = 'manual', prefill = {}, shared = null, editing = null } = {}) {
  resetForm(); setAddTab(tab);
  if (editing) {
    $('#addTitle').textContent = 'Editează locul'; $('#saveLocBtn').textContent = 'Salvează modificările'; $('#editingId').value = editing.id;
    $('#locTitle').value = editing.title || ''; $('#locAddedBy').value = editing.addedBy || 'Daniel'; $('#locDay').value = editing.day; $('#locCat').value = editing.cat;
    $('#locTime').value = editing.time || ''; $('#locHours').value = editing.hours || ''; $('#locDesc').value = editing.desc || ''; $('#locNear').checked = !!editing.nearPoblenou;
    $('#locLink').value = editing.link || ''; $('#locSource').value = editing.source || '';
    if (typeof editing.lat === 'number') { formPos = { lat: editing.lat, lng: editing.lng }; $('#posInfo').textContent = 'poziție salvată ✓'; }
  }
  for (const [k, v] of Object.entries(prefill)) { const el = $('#' + k); if (el) el.value = v; }
  if (prefill.pos) { formPos = prefill.pos; $('#posInfo').textContent = 'poziție preluată ✓'; }
  $('#addModal').classList.remove('hidden');
  if (shared) { $('#linkInput').value = shared; applyParsed(parseShared(shared)); }
  else if (tab === 'link') $('#linkInput').focus(); else if (!editing) $('#locTitle').focus();
}
function closeModals() { $$('[data-modal]').forEach((m) => m.classList.add('hidden')); }
async function handleAddSubmit(e) {
  e.preventDefault();
  const btn = $('#saveLocBtn'), title = $('#locTitle').value.trim(), desc = $('#locDesc').value.trim();
  if (!title || !desc) return;
  const data = {
    title, day: $('#locDay').value, cat: $('#locCat').value, time: $('#locTime').value.trim() || 'Flexibil', desc,
    hours: $('#locHours').value.trim(), mapLink: mapsSearch(title),
    addedBy: PEOPLE.includes($('#locAddedBy').value) ? $('#locAddedBy').value : 'Daniel', nearPoblenou: $('#locNear').checked,
    link: $('#locLink').value.trim(), source: $('#locSource').value.trim(),
  };
  if (!data.hours) delete data.hours; if (!data.link) { delete data.link; delete data.source; }
  if (formPos) { data.lat = formPos.lat; data.lng = formPos.lng; }
  const editingId = $('#editingId').value || null;
  btn.disabled = true; btn.textContent = 'Se salvează…';
  try {
    await saveLocation(data, editingId); switchDay(data.day); closeModals(); resetForm();
    toast(editingId ? 'Modificările au fost salvate.' : state.online ? `Salvat și sincronizat de ${data.addedBy}.` : `Salvat pe acest telefon de ${data.addedBy}.`);
  } catch (err) { console.error(err); toast('Eroare la salvare: ' + (err.message || err), 'fa-triangle-exclamation'); }
  finally { btn.disabled = false; btn.textContent = editingId ? 'Salvează modificările' : 'Salvează în programul comun'; }
}
function useMyPosition() {
  const b = $('#useMyPosBtn'), done = (pos) => { formPos = pos; b.querySelector('span').textContent = 'Poziție salvată ✓'; $('#posInfo').textContent = ''; };
  if (state.pos) return done(state.pos);
  if (!navigator.geolocation) return toast('Telefonul nu oferă localizare.', 'fa-triangle-exclamation');
  b.querySelector('span').textContent = 'Caut poziția…';
  navigator.geolocation.getCurrentPosition((p) => done({ lat: p.coords.latitude, lng: p.coords.longitude }), () => { toast('Nu am putut lua poziția.', 'fa-triangle-exclamation'); b.querySelector('span').textContent = 'Sunt aici acum'; }, { enableHighAccuracy: true, timeout: 10000 });
}
function addAlternative(i) {
  const a = ALTERNATIVES[i]; if (!a) return;
  openAdd({ prefill: { locTitle: a.title, locCat: a.cat, locDay: state.day, locHours: a.hours || '', locDesc: [a.note, a.price ? `Preț: ${a.price}` : '', a.address ? `Adresă: ${a.address}` : ''].filter(Boolean).join('\n'), pos: typeof a.lat === 'number' ? { lat: a.lat, lng: a.lng } : null } });
  $('#locTime').focus();
}
function handleShareTarget() {
  const u = new URL(location.href);
  const shared = [u.searchParams.get('title'), u.searchParams.get('text'), u.searchParams.get('url')].filter(Boolean).join('\n');
  if (!shared) return;
  history.replaceState(null, '', u.pathname);
  openAdd({ tab: 'link', shared });
}

// ---------- Radar ----------
const ALERT_COOLDOWN = 3 * 3600 * 1000;
function radarTargets() {
  const items = [];
  for (const loc of [...ITINERARY, ...state.custom]) { if (state.skipped[loc.id]) continue; const p = coordsOf(loc); if (p) items.push({ loc, p, kind: loc.isCustom ? 'custom' : 'plan' }); }
  ALTERNATIVES.forEach((a, i) => { if (typeof a.lat === 'number') items.push({ loc: { ...a, id: 'alt-' + i, radius: 150 }, p: { lat: a.lat, lng: a.lng, exact: !a.approx }, kind: 'alt', altIndex: i }); });
  return items;
}
function renderNearby() {
  const list = $('#nearbyList'); if (!list) return;
  if (!state.pos) { list.innerHTML = `<div class="text-xs text-ink-3 p-3 rounded-xl bg-white dark:bg-carbo-2 hairline">${state.radarOn ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Caut poziția…' : 'Apasă „Unde sunt” ca să vezi distanțele.'}</div>`; return; }
  const today = todayKey();
  const items = radarTargets().map((it) => ({ ...it, d: distanceM(state.pos, it.p) })).sort((a, b) => (a.kind === 'alt') - (b.kind === 'alt') || a.d - b.d).slice(0, 8);
  list.innerHTML = items.map(({ loc, d, kind, p }) => {
    const c = cat(loc.cat);
    return `<div class="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-carbo-2 hairline">
      <div class="w-10 h-10 shrink-0 xamfra-sm ${c.pin} text-calc grid place-items-center"><i class="fa-solid ${c.icon}"></i></div>
      <div class="min-w-0 flex-1"><div class="text-xs font-bold truncate">${esc(loc.title)}</div><div class="text-[11px] text-ink-3 dark:text-calc-3 truncate">${fmtDist(d)} · ${walkMin(d)} min pe jos · ${kind === 'alt' ? 'recomandare' : DAY_LABEL[loc.day]}${loc.time ? ' ' + esc(loc.time) : ''}${!p.exact ? ' · aprox.' : ''}${loc.day === today ? ' · <b class="text-blau">azi</b>' : ''}</div></div>
      <a href="${esc(mapsNav(loc))}" target="_blank" rel="noopener" class="btn shrink-0 w-11 h-11 rounded-full bg-verd text-calc grid place-items-center" aria-label="Navighează"><i class="fa-solid fa-person-walking"></i></a>
    </div>`;
  }).join('');
}
function renderNextStop() {
  const el = $('#nextStop'); if (!el) return;
  const stops = dayItems(state.day).filter((l) => !state.visited[l.id]);
  if (!stops.length) { el.classList.add('hidden'); return; }
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  let next = stops.find(isNow) || (todayKey() === state.day ? stops.find((l) => startMin(l) >= now - 15) : null) || stops[0];
  const c = cat(next.cat), p = coordsOf(next), d = state.pos && p ? distanceM(state.pos, p) : null;
  el.classList.remove('hidden');
  el.innerHTML = `<div class="xamfra bg-ink dark:bg-calc text-calc dark:text-ink p-4 flex items-center gap-3">
    <div class="w-12 h-12 shrink-0 xamfra-sm ${c.pin} text-calc grid place-items-center text-xl"><i class="fa-solid ${c.icon}"></i></div>
    <div class="min-w-0 flex-1"><div class="eyebrow opacity-70">${isNow(next) ? 'Acum' : 'Următorul pas'} · ${esc(next.time || '')}</div><div class="font-display font-bold text-[15px] leading-snug">${esc(next.title)}</div><div class="text-[11px] opacity-80 truncate">${d != null ? `${fmtDist(d)} · ${walkMin(d)} min pe jos` : esc(next.address || '')}${next.hours ? ' · ' + esc(next.hours) : ''}</div></div>
    <a href="${esc(mapsNav(next))}" target="_blank" rel="noopener" class="btn shrink-0 h-12 px-4 rounded-full bg-verd text-calc font-bold text-xs grid place-items-center"><span><i class="fa-solid fa-person-walking"></i> Du-mă</span></a>
  </div>`;
}
function checkProximity() {
  if (!state.pos || !state.radarOn) return;
  const now = Date.now();
  for (const { loc, p, kind } of radarTargets()) {
    const d = distanceM(state.pos, p); if (d > (loc.radius || 150)) continue;
    if (state.visited[loc.id]) continue;
    if (state.alerted[loc.id] && now - state.alerted[loc.id] < ALERT_COOLDOWN) continue;
    state.alerted[loc.id] = now; lsSet(LS.alerted, state.alerted);
    $('#radarBannerTitle').textContent = loc.title;
    $('#radarBannerMeta').textContent = `${fmtDist(d)} · ${kind === 'alt' ? 'recomandare din zonă' : (loc.time || '')}${loc.hours ? ' · ' + loc.hours : ''}`;
    $('#radarBannerNav').href = mapsNav(loc); $('#radarBanner').classList.remove('hidden');
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
    if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('Sunteți aproape: ' + loc.title, { body: `${fmtDist(d)} · ${loc.hours || loc.time || ''}`, icon: '/icon-192.png', tag: 'bcn-' + loc.id }); } catch {} }
    break;
  }
}
function onPosition(p) {
  state.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
  const s = $('#radarStatus'); if (s) s.innerHTML = `<i class="fa-solid fa-satellite-dish text-verd"></i> Radar activ · precizie ±${Math.round(p.coords.accuracy)} m · alertă la ~150 m de un loc din program, cât timp aplicația e deschisă.`;
  renderNearby(); renderNextStop(); updateMeMarker(); checkProximity();
  if (!onPosition._t || Date.now() - onPosition._t > 20000) { onPosition._t = Date.now(); renderDay(); }
}
function onPosError(err) { const s = $('#radarStatus'); if (s) s.textContent = err.code === 1 ? 'Localizarea e blocată. Permite accesul la locație în setările browserului.' : 'Nu găsesc poziția (GPS slab?). Încerc în continuare…'; }
async function startRadar() {
  if (!navigator.geolocation) return toast('Telefonul nu oferă localizare.', 'fa-triangle-exclamation');
  state.radarOn = true; renderNearby();
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
  if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = navigator.geolocation.watchPosition(onPosition, onPosError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function locate() { startRadar(); if (state.pos && state.map) state.map.setView([state.pos.lat, state.pos.lng], 16); else toast('Caut poziția…', 'fa-satellite-dish'); }

// ---------- Harta ----------
function ensureMap() {
  if (state.map || !window.L || !$('#map')) return;
  const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([41.39, 2.17], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
  state.map = map;
  setTimeout(() => map.invalidateSize(), 50);
}
function updateMeMarker() {
  if (!state.map || !state.pos) return;
  const ll = [state.pos.lat, state.pos.lng];
  if (!state.meMarker) state.meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000 }).addTo(state.map);
  else state.meMarker.setLatLng(ll);
}
function renderMap() {
  if (!state.map) return;
  state.markers.forEach((m) => m.remove()); state.markers = [];
  const stops = dayItems(state.day), bounds = [];
  let n = 0;
  for (const loc of stops) {
    const p = coordsOf(loc); n++; if (!p) continue;
    const cls = state.visited[loc.id] ? 'pin done' : loc.isCustom ? 'pin custom' : 'pin';
    const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="${cls}">${n}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(state.map);
    m.on('click', () => showPinSheet(loc)); state.markers.push(m); bounds.push([p.lat, p.lng]);
  }
  for (const z of DAY_ZONES[state.day] || []) ALTERNATIVES.forEach((a, i) => {
    if (a.zone !== z || typeof a.lat !== 'number') return;
    const m = L.marker([a.lat, a.lng], { icon: L.divIcon({ className: '', html: '<div class="pin alt">+</div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(state.map);
    m.on('click', () => showPinSheet({ ...a, id: 'alt-' + i, altIndex: i })); state.markers.push(m);
  });
  updateMeMarker();
  if (bounds.length) state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  setTimeout(() => state.map.invalidateSize(), 50);
}
function showPinSheet(loc) {
  const c = cat(loc.cat), p = coordsOf(loc) || (typeof loc.lat === 'number' ? { lat: loc.lat, lng: loc.lng } : null);
  const d = state.pos && p ? distanceM(state.pos, p) : null;
  $('#pinSheetIcon').className = `w-11 h-11 shrink-0 xamfra-sm ${c.pin} text-calc grid place-items-center text-lg`; $('#pinSheetIcon').innerHTML = `<i class="fa-solid ${c.icon}"></i>`;
  $('#pinSheetTitle').textContent = loc.title;
  $('#pinSheetMeta').textContent = [loc.time, loc.hours, d != null ? `${fmtDist(d)} · ${walkMin(d)} min` : loc.address].filter(Boolean).join(' · ');
  $('#pinSheetNav').href = mapsNav(loc);
  $('#pinSheet').classList.remove('hidden');
}

// ---------- Vreme ----------
const WMO = (c) => c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 49 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '🌨️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
async function loadWeather() {
  const strip = $('#weatherStrip'); if (!strip) return;
  const names = { '2026-11-04': 'Mie 4', '2026-11-05': 'Joi 5', '2026-11-06': 'Vin 6', '2026-11-07': 'Sâm 7', '2026-11-08': 'Dum 8', '2026-11-09': 'Lun 9' };
  const render = (data) => {
    if (!data?.daily?.time?.length) return;
    strip.innerHTML = data.daily.time.map((t, i) => `<div class="shrink-0 w-[68px] p-2 rounded-lg bg-white/80 dark:bg-carbo-3 text-center"><div class="eyebrow text-ink-3">${names[t] || t.slice(5)}</div><div class="text-xl leading-tight">${WMO(data.daily.weather_code[i])}</div><div class="text-[11px] font-bold tabular-nums">${Math.round(data.daily.temperature_2m_max[i])}° <span class="text-ink-3 font-medium">${Math.round(data.daily.temperature_2m_min[i])}°</span></div><div class="text-[10px] text-blau">${data.daily.precipitation_probability_max[i] ?? 0}% 🌧</div></div>`).join('');
    strip.classList.remove('hidden'); strip.classList.add('flex');
  };
  const cached = lsGet(LS.weather, null); if (cached && Date.now() - cached.at < 3 * 3600 * 1000) render(cached.data);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=41.39&longitude=2.17&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FMadrid&start_date=${TRIP.start}&end_date=${TRIP.days.mon}`);
    if (!res.ok) return; const data = await res.json(); if (data.error) return;
    lsSet(LS.weather, { at: Date.now(), data }); render(data);
  } catch {}
}

// ---------- PWA ----------
function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; $('#installBtn').classList.remove('hidden'); $('#installBtn').classList.add('flex'); });
  window.addEventListener('appinstalled', () => { $('#installBtn').classList.add('hidden'); toast('Instalată! O găsești pe ecranul principal și în meniul Share.'); });
  const host = location.hostname;
  if (!('serviceWorker' in navigator) || !(host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') || host === 'localhost' || host === '127.0.0.1')) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => reg.addEventListener('updatefound', () => { const nw = reg.installing; nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Versiune nouă descărcată. Se aplică la următoarea deschidere.', 'fa-rotate'); }); })).catch((e) => console.warn('SW:', e));
}
async function installApp() { const p = state.installPrompt; if (!p) return; p.prompt(); await p.userChoice; state.installPrompt = null; $('#installBtn').classList.add('hidden'); }

// ---------- Evenimente ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) { if (e.target.matches('[data-modal]')) closeModals(); return; }
  const a = el.dataset.action, id = el.dataset.id;
  const map = {
    'view': () => setView(el.dataset.view), 'day': () => switchDay(el.dataset.day), 'filter': () => setFilter(el.dataset.cat),
    'coffee': () => updateCoffee(Number(el.dataset.delta)), 'toggle-theme': toggleTheme, 'share': share,
    'open-add': () => openAdd({ tab: 'manual' }), 'close-modal': closeModals, 'add-tab': () => setAddTab(el.dataset.tab),
    'paste-link': pasteLink, 'parse-link': () => applyParsed(parseShared($('#linkInput').value)),
    'modal-search': () => { const q = $('#locTitle').value.trim(); if (q) window.open(mapsSearch(q), '_blank', 'noopener'); else $('#locTitle').focus(); },
    'use-my-position': useMyPosition, 'add-alt': () => addAlternative(Number(el.dataset.index)),
    'copy-link': () => copyText($('#shareUrl').value, 'Linkul a fost copiat.'), 'copy-summary': () => copyText(`${SUMMARY_TEXT}\n\n📱 ${location.href.split('#')[0].split('?')[0]}`, 'Rezumatul a fost copiat.'),
    'delete-loc': () => deleteLocation(id), 'edit-loc': () => { const l = state.custom.find((x) => x.id === id); if (l) openAdd({ tab: 'manual', editing: l }); },
    'toggle-visited': () => toggleVisited(id), 'toggle-skip': () => toggleSkip(id), 'pin-here': () => pinHere(id),
    'day-route': dayRoute, 'locate': locate, 'close-banner': () => $('#radarBanner').classList.add('hidden'), 'close-sheet': () => $('#pinSheet').classList.add('hidden'),
    'install': installApp,
  };
  map[a]?.();
});
document.addEventListener('submit', (e) => { if (e.target.id === 'addLocationForm') handleAddSubmit(e); });
document.addEventListener('change', (e) => { if (e.target.matches('.quest-check')) setQuest(e.target.dataset.quest, e.target.checked); });
document.addEventListener('input', (e) => { if (e.target.id === 'sharedNotes') onNotesInput(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModals(); $('#pinSheet').classList.add('hidden'); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderDay(); renderNextStop(); if (state.radarOn) startRadar(); } });

// ---------- Start ----------
applyThemeIcon();
loadLocal();
renderCountdown(); renderCoffee(); renderQuests(); renderNotes();
switchDay(todayKey() || 'thu');
setView(new URL(location.href).searchParams.has('text') || new URL(location.href).searchParams.has('url') ? 'plan' : (lsGet(LS.view, 'plan')));
setupPWA(); loadWeather(); connectFirebase(); handleShareTarget();
setInterval(() => { renderCountdown(); renderNextStop(); }, 60000);
