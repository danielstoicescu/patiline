// Barcelona Aventura – Mara (13), Anne & Daniel
// Offline-first: programul se randează imediat; apoi aplicația încearcă Firestore pentru sincronizare live.
import { TRIP, ZONES, DAY_ZONES, DAY_TIPS, ITINERARY, ALTERNATIVES } from './data.js';

const TRIP_ID = TRIP.id;
const DAYS = ['thu', 'fri', 'sat', 'sun', 'mon'];
const PEOPLE = ['Daniel', 'Mara', 'Anne'];
const COFFEE_GOAL = 20;
const LS = { locations: 'bcn_locations', coffee: 'bcn_coffee', quests: 'bcn_quests', visited: 'bcn_visited', pins: 'bcn_pins', notes: 'bcn_notes', theme: 'bcn_theme', radar: 'bcn_radar', alerted: 'bcn_alerted', weather: 'bcn_weather' };

const SUMMARY_TEXT = `Barcelona Aventura (Mara 13, Anne & Daniel), 4–9 nov:
• Baza: Poblenou (Bac de Roda)
• Joi: PortAventura (Shambhala, Dragon Khan, Halloween)
• Vineri: tren spre BCN, Nomad Coffee, Demasié, Banh Mi Club, tapas Bitácora
• Sâmbătă: Satan's Coffee & El Call, churros 1968, toboganul Sephora, vintage Raval, Bar del Pla, MNAC gratis, pinchos Blai
• Duminică: Three Marks, Sagrada Família, SAISEI matcha, Design Museum gratis, apus la Bunkers, Gràcia
• Luni: Encants, Print Workers, La Cova Fumada, plajă, Hofmann, Quimet & Quimet`;

// ---------- Stare ----------
const state = {
  day: 'thu', filter: 'all',
  custom: [], coffee: 0, quests: {}, visited: {}, pins: {}, notes: '',
  online: false,
  radarOn: false, pos: null, watchId: null, alerted: {},
  installPrompt: null,
};
let fb = null;

// ---------- Utilitare ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ' Barcelona')}`;
const mapsNav = (loc, mode = 'walking') => {
  const p = coordsOf(loc);
  const dest = p ? `${p.lat},${p.lng}` : encodeURIComponent((loc.address || loc.title) + ' Barcelona');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;
};
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const keyOf = (loc) => loc.id;
function coordsOf(loc) {
  const pin = state.pins[keyOf(loc)];
  if (pin && typeof pin.lat === 'number') return { lat: pin.lat, lng: pin.lng, exact: true };
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: loc.lat, lng: loc.lng, exact: !loc.approx };
  return null;
}
function distanceM(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const walkMin = (m) => Math.max(1, Math.round(m / 80));

let toastTimer;
function toast(message, icon = 'fa-circle-check', ms = 3200) {
  const el = $('#toast');
  $('#toastMessage').textContent = message;
  el.querySelector('i').className = `fa-solid ${icon} text-maraPurple text-lg`;
  el.classList.remove('hidden-toast');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden-toast'), ms);
}
function setSyncStatus(mode, detail) {
  const el = $('#syncStatus'); if (!el) return;
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border';
  if (mode === 'online') { el.className = `${base} bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400`; el.innerHTML = '<i class="fa-solid fa-cloud-bolt"></i> Sincronizat live'; }
  else if (mode === 'local') { el.className = `${base} bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400`; el.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Salvat doar pe acest telefon'; el.title = detail || ''; }
  else { el.className = `${base} bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500`; el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se conectează…'; }
}

// ---------- Timp / „azi” ----------
function todayKey() {
  const t = new Date(), iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return DAYS.find((d) => TRIP.days[d] === iso) || null;
}
function parseRange(time) {
  const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(time || '');
  if (!m) return null;
  return { from: +m[1] * 60 + +m[2], to: +m[3] * 60 + +m[4] };
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
  if (now > end) el.textContent = 'Mara turned 13 🎉 · Ce excursie a fost!';
  else if (days > 1) el.textContent = `Mara turns 13 🎉 · Mai sunt ${days} zile până la Barcelona`;
  else if (days === 1) el.textContent = 'Mara turns 13 🎉 · Mâine plecăm!';
  else el.textContent = 'Mara turns 13 🎉 · Suntem în excursie!';
}

// ---------- Randare ----------
const CAT_STYLE = {
  mara:   { bg: 'bg-pink-100 dark:bg-pink-950', text: 'text-pink-600 dark:text-pink-400', icon: 'fa-wand-magic-sparkles', grad: 'from-pink-400 to-purple-500', label: 'Mara' },
  coffee: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', icon: 'fa-mug-hot', grad: 'from-amber-400 to-orange-600', label: 'Cafea & bere' },
  food:   { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', icon: 'fa-utensils', grad: 'from-emerald-400 to-teal-600', label: 'Mâncare' },
  art:    { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-400', icon: 'fa-palette', grad: 'from-sky-400 to-indigo-600', label: 'Artă & vederi' },
};
const catStyle = (cat) => CAT_STYLE[cat] || { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: 'fa-map-pin', grad: 'from-slate-400 to-slate-600', label: 'Loc' };

function badge(cls, icon, text) { return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 ${cls}"><i class="fa-solid ${icon}"></i> ${text}</span>`; }

function cardHTML(loc, index) {
  const st = catStyle(loc.cat);
  const key = keyOf(loc);
  const visited = !!state.visited[key];
  const catLabel = loc.catLabel || (loc.isCustom ? `Adăugat de ${loc.addedBy || 'noi'}` : st.label);
  const mapLink = loc.mapLink && loc.mapLink !== '#' ? loc.mapLink : mapsSearch(loc.address ? `${loc.title}, ${loc.address}` : loc.title);
  const p = coordsOf(loc);
  const dist = state.pos && p ? distanceM(state.pos, p) : null;
  const badges = [
    isNow(loc) ? badge('bg-maraPurple text-white', 'fa-clock', 'ACUM') : '',
    loc.free ? badge('bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300', 'fa-gift', 'Gratis') : '',
    loc.verify ? badge('bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300', 'fa-circle-question', 'Verifică orele') : '',
    loc.isCustom ? badge('bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300', 'fa-user-tag', esc(loc.addedBy || 'Grup')) : '',
    dist != null ? badge('bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300', 'fa-person-walking', `${fmtDist(dist)} · ~${walkMin(dist)} min`) : '',
    p && !p.exact ? badge('bg-slate-100 dark:bg-slate-800 text-slate-500', 'fa-location-crosshairs', 'poziție aprox.') : '',
  ].join('');
  const meta = [
    loc.address ? `<span class="inline-flex items-center gap-1"><i class="fa-solid fa-location-dot text-slate-400"></i> ${esc(loc.address)}</span>` : '',
    loc.hours ? `<span class="inline-flex items-center gap-1"><i class="fa-regular fa-clock text-slate-400"></i> ${esc(loc.hours)}</span>` : '',
    loc.price ? `<span class="inline-flex items-center gap-1"><i class="fa-solid fa-euro-sign text-slate-400"></i> ${esc(loc.price)}</span>` : '',
  ].filter(Boolean).join('');
  const media = loc.imgUrl ? `<img src="${esc(loc.imgUrl)}" alt="" loading="lazy" class="w-full h-full object-cover" onerror="this.remove()">` : '';
  const pinBtn = state.pos ? `<button data-action="pin-here" data-id="${esc(key)}" class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition inline-flex items-center gap-1" title="Salvează poziția mea curentă pentru acest loc"><i class="fa-solid fa-thumbtack"></i> Fixează aici</button>` : '';
  const delBtn = loc.isCustom ? `<button data-action="delete-loc" data-id="${esc(key)}" class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition inline-flex items-center gap-1"><i class="fa-solid fa-trash-can"></i></button>` : '';

  return `
    <div class="relative pl-12 pb-6 timeline-step ${visited ? 'opacity-60' : ''}" data-cat="${esc(loc.cat)}" id="loc-${esc(key)}">
      <div class="absolute left-0 top-1 w-8 h-8 rounded-full ${visited ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-900 border-maraPurple text-maraPurple'} border-2 font-bold text-xs flex items-center justify-center shadow-md z-10">${visited ? '<i class="fa-solid fa-check"></i>' : index + 1}</div>
      <div class="bg-white dark:bg-slate-900 border ${isNow(loc) ? 'border-maraPurple ring-2 ring-maraPurple/30' : 'border-slate-200 dark:border-slate-800'} rounded-3xl overflow-hidden shadow-sm hover:shadow-card-hover transition duration-300">
        <div class="grid grid-cols-1 md:grid-cols-12">
          <div class="md:col-span-4 relative h-40 md:h-auto md:min-h-[210px] bg-gradient-to-br ${st.grad}">
            <div class="absolute inset-0 flex items-center justify-center text-white/70 text-5xl"><i class="fa-solid ${st.icon}"></i></div>
            <div class="absolute inset-0">${media}</div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none"></div>
            <div class="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
              <span class="${st.bg} ${st.text} px-2.5 py-1 rounded-lg text-[10px] font-bold"><i class="fa-solid ${st.icon}"></i> ${esc(catLabel)}</span>
            </div>
          </div>
          <div class="md:col-span-8 p-4 md:p-5 flex flex-col justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-1 mb-2">${badges}</div>
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white leading-snug ${visited ? 'line-through' : ''}">${esc(loc.title)}</h4>
                <span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800 whitespace-nowrap">${esc(loc.time || 'Flexibil')}</span>
              </div>
              <p class="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2 whitespace-pre-line">${esc(loc.desc)}</p>
              ${meta ? `<div class="mt-2.5 flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">${meta}</div>` : ''}
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <a href="${esc(mapsNav(loc))}" target="_blank" rel="noopener" class="btn-primary-action px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"><i class="fa-solid fa-person-walking"></i> Navighează</a>
                <a href="${esc(mapLink)}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 font-bold text-xs inline-flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"><i class="fa-solid fa-map"></i> Maps & ore</a>
              </div>
              <div class="flex items-center gap-1">
                ${pinBtn}
                <button data-action="toggle-visited" data-id="${esc(key)}" class="px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${visited ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}"><i class="fa-solid ${visited ? 'fa-rotate-left' : 'fa-check'}"></i> ${visited ? 'Am fost' : 'Bifează'}</button>
                ${delBtn}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function altHTML(a, i) {
  const st = catStyle(a.cat);
  const p = state.pos && typeof a.lat === 'number' ? distanceM(state.pos, { lat: a.lat, lng: a.lng }) : null;
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1 mb-1">
            <span class="${st.bg} ${st.text} px-2 py-0.5 rounded-md text-[10px] font-extrabold"><i class="fa-solid ${st.icon}"></i> ${st.label}</span>
            ${a.free ? badge('bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300', 'fa-gift', 'Gratis / zi gratis') : ''}
            ${a.verify ? badge('bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300', 'fa-circle-question', 'Verifică') : ''}
            ${p != null ? badge('bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300', 'fa-person-walking', fmtDist(p)) : ''}
          </div>
          <div class="font-display font-bold text-sm text-slate-900 dark:text-white leading-snug">${esc(a.title)}</div>
        </div>
      </div>
      <p class="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">${esc(a.note)}</p>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
        ${a.hours ? `<span><i class="fa-regular fa-clock"></i> ${esc(a.hours)}</span>` : ''}
        ${a.price ? `<span><i class="fa-solid fa-euro-sign"></i> ${esc(a.price)}</span>` : ''}
        ${a.address ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(a.address)}</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5 pt-1 flex-wrap">
        <a href="${esc(mapsSearch(`${a.title}, ${a.address || ''}`))}" target="_blank" rel="noopener" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800"><i class="fa-solid fa-map"></i> Maps</a>
        <button data-action="add-alt" data-index="${i}" class="px-2.5 py-1.5 rounded-lg bg-maraPurple text-white font-bold text-[11px]"><i class="fa-solid fa-plus"></i> Adaugă în program</button>
      </div>
    </div>`;
}

function renderDay() {
  const container = $('#itinerary-container');
  const all = [...ITINERARY.filter((l) => l.day === state.day), ...state.custom.filter((l) => l.day === state.day)];
  const list = all.filter((l) => state.filter === 'all' || l.cat === state.filter);
  const tip = DAY_TIPS[state.day] ? `<div class="mb-5 p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed"><i class="fa-solid fa-lightbulb text-indigo-500"></i> ${esc(DAY_TIPS[state.day])}</div>` : '';

  let timeline;
  if (list.length === 0) {
    timeline = `<div class="p-8 text-center text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">Nu există locații pentru filtrul ales în această zi.<br/><button data-action="open-add" class="mt-3 px-4 py-2 rounded-xl bg-maraPurple text-white font-bold text-xs"><i class="fa-solid fa-plus"></i> Adaugă una</button></div>`;
  } else {
    timeline = `<div class="relative timeline-line">${list.map(cardHTML).join('')}</div>`;
  }

  const zones = (DAY_ZONES[state.day] || []).map((z) => {
    const alts = ALTERNATIVES.map((a, i) => ({ a, i })).filter(({ a }) => a.zone === z && (state.filter === 'all' || a.cat === state.filter));
    if (!alts.length) return '';
    return `
      <div class="mt-4">
        <div class="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"><i class="fa-solid ${ZONES[z].icon} text-maraPurple"></i> ${esc(ZONES[z].label)}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">${alts.map(({ a, i }) => altHTML(a, i)).join('')}</div>
      </div>`;
  }).join('');
  const zonesBlock = zones ? `
    <details class="group mt-2 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-5" ${state.filter !== 'all' ? 'open' : ''}>
      <summary class="list-none cursor-pointer flex items-center justify-between gap-2">
        <span class="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2"><i class="fa-solid fa-compass text-bcnTeal"></i> Recomandări similare în zonele de azi</span>
        <i class="fa-solid fa-chevron-down text-slate-400 transition group-open:rotate-180"></i>
      </summary>
      <p class="text-[11px] text-slate-500 mt-1">Ore și prețuri verificate în septembrie 2026; cele marcate „Verifică” se confirmă în Maps. „Adaugă în program” le pune în ziua aleasă.</p>
      ${zones}
    </details>` : '';

  container.innerHTML = tip + timeline + zonesBlock;
}

const DAY_BORDER = { thu: 'border-ferrari', fri: 'border-maraPink', sat: 'border-amber-500', sun: 'border-emerald-500', mon: 'border-bcnTeal' };
function switchDay(day, scroll = false) {
  if (!DAYS.includes(day)) return;
  state.day = day;
  document.querySelectorAll('.day-tab').forEach((tab) => { tab.classList.remove(...Object.values(DAY_BORDER), 'bg-slate-100', 'dark:bg-slate-800'); tab.setAttribute('aria-pressed', 'false'); });
  const tab = $(`#tab-${day}`);
  if (tab) { tab.classList.add(DAY_BORDER[day], 'bg-slate-100', 'dark:bg-slate-800'); tab.setAttribute('aria-pressed', 'true'); }
  document.querySelectorAll('.bottom-day').forEach((b) => {
    const active = b.dataset.day === day;
    b.classList.toggle('bg-slate-100', active); b.classList.toggle('dark:bg-slate-800', active);
    b.classList.remove(...Object.values(DAY_BORDER), 'border-transparent');
    b.classList.add(active ? DAY_BORDER[day] : 'border-transparent');
  });
  renderDay();
  if (scroll) $('#itinerary-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setFilter(cat) {
  state.filter = cat;
  document.querySelectorAll('.cat-btn').forEach((btn) => { const on = btn.dataset.cat === cat; btn.classList.toggle('ring-2', on); btn.classList.toggle('ring-maraPurple', on); });
  renderDay();
}
function renderCoffee() { $('#coffeeCountDisplay').textContent = `${state.coffee} / ${COFFEE_GOAL} Espressos BCN`; }
function renderQuests() { document.querySelectorAll('.quest-check').forEach((cb) => { cb.checked = !!state.quests[cb.dataset.quest]; }); }
function renderNotes() { const ta = $('#sharedNotes'); if (ta && document.activeElement !== ta) ta.value = state.notes || ''; }

// ---------- Tema ----------
function applyThemeIcon() {
  const dark = document.documentElement.classList.contains('dark');
  $('#themeIcon').className = dark ? 'fa-solid fa-sun text-amber-500 text-base' : 'fa-solid fa-moon text-indigo-600 text-base';
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F172A' : '#8B5CF6');
}
function toggleTheme() {
  const html = document.documentElement;
  const dark = html.classList.toggle('dark'); html.classList.toggle('light', !dark);
  try { localStorage.setItem(LS.theme, dark ? 'dark' : 'light'); } catch {}
  applyThemeIcon();
}

// ---------- Modale & share ----------
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModals() { document.querySelectorAll('[data-modal]').forEach((m) => m.classList.add('hidden')); }
function openShare() {
  const url = location.href.split('#')[0];
  $('#shareUrl').value = url;
  $('#whatsappShareBtn').href = `https://wa.me/?text=${encodeURIComponent(`${SUMMARY_TEXT}\n\n📱 Ghidul live: ${url}`)}`;
  $('#qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  openModal('#shareModal');
}
async function share() {
  const url = location.href.split('#')[0];
  if (navigator.share && location.protocol === 'https:') {
    try { await navigator.share({ title: 'Barcelona Aventura: Mara, Anne & Daniel', text: 'Ghidul nostru de vacanță în Barcelona & PortAventura (4–9 noiembrie).', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  openShare();
}
async function copyText(text, okMessage) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
  toast(okMessage);
}

// ---------- Persistență locală ----------
function loadLocal() {
  state.custom = lsGet(LS.locations, []);
  state.coffee = Number(lsGet(LS.coffee, 0)) || 0;
  state.quests = lsGet(LS.quests, {});
  state.visited = lsGet(LS.visited, {});
  state.pins = lsGet(LS.pins, {});
  state.notes = lsGet(LS.notes, '');
  state.alerted = lsGet(LS.alerted, {});
  state.radarOn = !!lsGet(LS.radar, false);
}
function persistLocal() {
  lsSet(LS.locations, state.custom); lsSet(LS.coffee, state.coffee); lsSet(LS.quests, state.quests);
  lsSet(LS.visited, state.visited); lsSet(LS.pins, state.pins); lsSet(LS.notes, state.notes);
}

// ---------- Firestore ----------
async function loadFirebaseConfig() {
  const local = window.FIREBASE_CONFIG;
  if (local && local.apiKey && local.projectId) return local;
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (res.ok) { const cfg = await res.json(); if (cfg && cfg.apiKey && cfg.projectId) return cfg; }
  } catch {}
  return null;
}
async function connectFirebase() {
  const cfg = await loadFirebaseConfig();
  if (!cfg) { setSyncStatus('local', 'Fără configurație Firebase (vezi README).'); return; }
  try {
    const V = '11.6.1';
    const [{ initializeApp }, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const app = initializeApp(cfg);
    let db;
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch { db = fs.getFirestore(app); }
    fb = { db, fs };
    const locRef = fs.collection(db, 'trips', TRIP_ID, 'locations');
    const stateRef = fs.doc(db, 'trips', TRIP_ID, 'state', 'shared');
    let first = true;
    fs.onSnapshot(fs.query(locRef, fs.orderBy('createdAt', 'asc')), (snap) => {
      state.custom = snap.docs.map((d) => ({ id: d.id, isCustom: true, ...d.data() }));
      lsSet(LS.locations, state.custom);
      renderDay(); renderNearby();
      if (first) { first = false; state.online = true; setSyncStatus('online'); }
    }, (err) => { console.error('Firestore locations error:', err); state.online = false; setSyncStatus('local', err.message); toast('Nu m-am putut conecta la baza de date. Salvez local.', 'fa-triangle-exclamation'); });
    fs.onSnapshot(stateRef, (snap) => {
      const d = snap.data() || {};
      if (typeof d.coffeeCount === 'number') state.coffee = d.coffeeCount;
      if (d.quests && typeof d.quests === 'object') state.quests = d.quests;
      if (d.visited && typeof d.visited === 'object') state.visited = d.visited;
      if (d.pins && typeof d.pins === 'object') state.pins = d.pins;
      if (typeof d.notes === 'string') state.notes = d.notes;
      persistLocal();
      renderCoffee(); renderQuests(); renderNotes(); renderDay(); renderNearby();
    }, (err) => console.error('Firestore state error:', err));
  } catch (err) { console.error('Firebase init error:', err); setSyncStatus('local', err.message); }
}
async function saveShared(patch) {
  if (fb && state.online) {
    const { db, fs } = fb;
    await fs.setDoc(fs.doc(db, 'trips', TRIP_ID, 'state', 'shared'), { ...patch, updatedAt: fs.serverTimestamp() }, { merge: true });
  } else persistLocal();
}

// ---------- Acțiuni ----------
async function saveLocation(data) {
  if (fb && state.online) {
    const { db, fs } = fb;
    await fs.addDoc(fs.collection(db, 'trips', TRIP_ID, 'locations'), { ...data, createdAt: fs.serverTimestamp() });
  } else {
    state.custom.push({ ...data, id: 'local-' + Date.now(), isCustom: true, createdAt: new Date().toISOString() });
    persistLocal(); renderDay(); renderNearby();
  }
}
async function deleteLocation(id) {
  if (!confirm('Ștergi această locație din programul comun?')) return;
  if (fb && state.online && !String(id).startsWith('local-')) { const { db, fs } = fb; await fs.deleteDoc(fs.doc(db, 'trips', TRIP_ID, 'locations', id)); }
  else { state.custom = state.custom.filter((l) => l.id !== id); persistLocal(); renderDay(); renderNearby(); }
  toast('Locația a fost ștearsă.', 'fa-trash-can');
}
async function updateCoffee(delta) {
  state.coffee = Math.max(0, state.coffee + delta); renderCoffee();
  await saveShared({ coffeeCount: state.coffee });
  if (state.coffee === COFFEE_GOAL) toast('20 de espresso! Daniel, ești oficial barcelonez ☕', 'fa-trophy');
}
async function setQuest(key, done) {
  state.quests = { ...state.quests, [key]: done };
  await saveShared({ quests: state.quests });
  if (done) toast('Quest bifat! 🎉');
}
async function toggleVisited(key) {
  state.visited = { ...state.visited, [key]: !state.visited[key] };
  renderDay();
  await saveShared({ visited: state.visited });
}
async function pinHere(key) {
  if (!state.pos) return toast('Nu am încă poziția ta. Pornește radarul.', 'fa-triangle-exclamation');
  state.pins = { ...state.pins, [key]: { lat: state.pos.lat, lng: state.pos.lng } };
  renderDay(); renderNearby();
  await saveShared({ pins: state.pins });
  toast('Poziția exactă a fost salvată pentru toți.');
}
let notesTimer;
function onNotesInput() {
  const ta = $('#sharedNotes');
  state.notes = ta.value.slice(0, 2000);
  $('#notesStatus').textContent = 'Se salvează…';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(async () => {
    try { await saveShared({ notes: state.notes }); $('#notesStatus').textContent = state.online ? 'Salvat și sincronizat ✓' : 'Salvat pe acest telefon ✓'; }
    catch (e) { $('#notesStatus').textContent = 'Eroare la salvare'; }
  }, 700);
}

// ---------- Formular ----------
let formPos = null;
async function handleAddSubmit(e) {
  e.preventDefault();
  const btn = $('#saveLocBtn');
  const title = $('#locTitle').value.trim(), desc = $('#locDesc').value.trim();
  if (!title || !desc) return;
  const data = {
    title, day: $('#locDay').value, cat: $('#locCat').value,
    time: $('#locTime').value.trim() || 'Pauză flexibilă', desc,
    mapLink: mapsSearch(title),
    addedBy: PEOPLE.includes($('#locAddedBy').value) ? $('#locAddedBy').value : 'Daniel',
    nearPoblenou: $('#locNear').checked,
  };
  if (formPos) { data.lat = formPos.lat; data.lng = formPos.lng; }
  btn.disabled = true; btn.textContent = 'Se salvează…';
  try {
    await saveLocation(data);
    switchDay(data.day);
    closeModals(); $('#addLocationForm').reset(); formPos = null; resetPosBtn();
    toast(state.online ? `Salvat și sincronizat de ${data.addedBy}!` : `Salvat pe acest telefon de ${data.addedBy}.`);
  } catch (err) { console.error(err); toast('Eroare la salvare: ' + (err.message || err), 'fa-triangle-exclamation'); }
  finally { btn.disabled = false; btn.textContent = 'Salvează în programul comun'; }
}
function resetPosBtn() { const b = $('#useMyPosBtn'); if (b) { b.querySelector('span').textContent = 'Sunt aici acum (salvează poziția)'; b.classList.remove('bg-sky-600', 'text-white'); } }
function useMyPosition() {
  const b = $('#useMyPosBtn');
  const done = (pos) => { formPos = pos; b.querySelector('span').textContent = 'Poziție salvată ✓'; b.classList.add('bg-sky-600', 'text-white'); };
  if (state.pos) return done(state.pos);
  if (!navigator.geolocation) return toast('Telefonul nu oferă localizare.', 'fa-triangle-exclamation');
  b.querySelector('span').textContent = 'Caut poziția…';
  navigator.geolocation.getCurrentPosition((p) => done({ lat: p.coords.latitude, lng: p.coords.longitude }), () => { toast('Nu am putut lua poziția.', 'fa-triangle-exclamation'); resetPosBtn(); }, { enableHighAccuracy: true, timeout: 10000 });
}
function openAddWithQuery(q) {
  openModal('#addModal');
  if (q) { $('#modalSearchQuery').value = q; $('#locTitle').value = q; window.open(mapsSearch(q), '_blank', 'noopener'); }
  else $('#locTitle').focus();
}
function addAlternative(i) {
  const a = ALTERNATIVES[i]; if (!a) return;
  openModal('#addModal');
  $('#locTitle').value = a.title;
  $('#locCat').value = a.cat;
  $('#locDay').value = state.day;
  $('#locDesc').value = [a.note, a.hours ? `Program: ${a.hours}` : '', a.price ? `Preț: ${a.price}` : '', a.address ? `Adresă: ${a.address}` : ''].filter(Boolean).join('\n');
  if (typeof a.lat === 'number') formPos = { lat: a.lat, lng: a.lng };
  $('#locTime').focus();
}

// ---------- Radar (geolocalizare) ----------
const ALERT_COOLDOWN = 3 * 3600 * 1000;
function allRadarTargets() {
  const items = [];
  for (const loc of ITINERARY) { const p = coordsOf(loc); if (p) items.push({ loc, p, kind: 'plan' }); }
  for (const loc of state.custom) { const p = coordsOf(loc); if (p) items.push({ loc, p, kind: 'custom' }); }
  ALTERNATIVES.forEach((a, i) => { if (typeof a.lat === 'number') items.push({ loc: { ...a, id: 'alt-' + i, radius: 150 }, p: { lat: a.lat, lng: a.lng, exact: !a.approx }, kind: 'alt', altIndex: i }); });
  return items;
}
function renderNearby() {
  const list = $('#nearbyList'), hint = $('#radarHint');
  if (!state.radarOn) { list.classList.add('hidden'); hint.classList.add('hidden'); return; }
  list.classList.remove('hidden'); hint.classList.remove('hidden');
  if (!state.pos) { list.innerHTML = '<div class="text-xs text-slate-500 p-2"><i class="fa-solid fa-circle-notch fa-spin"></i> Caut poziția…</div>'; return; }
  const today = todayKey();
  const items = allRadarTargets().map((it) => ({ ...it, d: distanceM(state.pos, it.p) }))
    .sort((a, b) => (a.kind === 'alt') - (b.kind === 'alt') || a.d - b.d).slice(0, 6);
  list.innerHTML = items.map(({ loc, d, kind, p }) => {
    const st = catStyle(loc.cat);
    const dayLabel = loc.day ? { thu: 'Joi', fri: 'Vin', sat: 'Sâm', sun: 'Dum', mon: 'Lun' }[loc.day] : 'Alternativă';
    return `<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
      <div class="w-9 h-9 shrink-0 rounded-xl ${st.bg} ${st.text} flex items-center justify-center"><i class="fa-solid ${st.icon}"></i></div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(loc.title)}</div>
        <div class="text-[11px] text-slate-500">${fmtDist(d)} · ~${walkMin(d)} min pe jos · ${dayLabel}${loc.time ? ' ' + esc(loc.time) : ''}${!p.exact ? ' · aprox.' : ''}${loc.day === today ? ' · <b class="text-maraPurple">azi</b>' : ''}</div>
      </div>
      <a href="${esc(mapsNav(loc))}" target="_blank" rel="noopener" class="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center" title="Navighează"><i class="fa-solid fa-person-walking"></i></a>
    </div>`;
  }).join('');
}
function checkProximity() {
  if (!state.pos || !state.radarOn) return;
  const now = Date.now();
  for (const { loc, p, kind, altIndex } of allRadarTargets()) {
    const radius = loc.radius || 150;
    const d = distanceM(state.pos, p);
    if (d > radius) continue;
    const key = keyOf(loc);
    if (state.visited[key]) continue;
    if (state.alerted[key] && now - state.alerted[key] < ALERT_COOLDOWN) continue;
    state.alerted[key] = now; lsSet(LS.alerted, state.alerted);
    showRadarAlert(loc, d, kind);
    break;
  }
}
function showRadarAlert(loc, d, kind) {
  $('#radarBannerTitle').textContent = loc.title;
  $('#radarBannerMeta').textContent = `${fmtDist(d)} · ${kind === 'alt' ? 'recomandare din zonă' : (loc.time || '')}${loc.hours ? ' · ' + loc.hours : ''}`;
  $('#radarBannerNav').href = mapsNav(loc);
  $('#radarBanner').classList.remove('hidden');
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Sunteți aproape: ' + loc.title, { body: `${fmtDist(d)} · ${loc.hours || loc.time || ''}`, icon: '/icon-192.png', tag: 'bcn-' + keyOf(loc) }); } catch {}
  }
}
function onPosition(p) {
  state.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
  $('#radarStatus').textContent = `Radar activ · precizie ±${Math.round(p.coords.accuracy)} m · alertă la ~150 m de un loc din program.`;
  renderNearby(); checkProximity();
  // actualizează distanțele de pe carduri fără a re-randa tot la fiecare secundă
  if (!onPosition._t || Date.now() - onPosition._t > 15000) { onPosition._t = Date.now(); renderDay(); }
}
function onPosError(err) {
  $('#radarStatus').textContent = err.code === 1 ? 'Localizarea e blocată. Permite accesul la locație în setările browserului.' : 'Nu găsesc poziția (GPS slab?). Încerc în continuare…';
}
async function startRadar() {
  if (!navigator.geolocation) return toast('Telefonul nu oferă localizare.', 'fa-triangle-exclamation');
  state.radarOn = true; lsSet(LS.radar, true);
  const btn = $('#radarBtn'); btn.querySelector('span').textContent = 'Oprește radarul'; btn.classList.add('bg-maraPink', 'dark:bg-maraPink', 'dark:text-white');
  $('#radarStatus').textContent = 'Caut poziția…';
  renderNearby();
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
  state.watchId = navigator.geolocation.watchPosition(onPosition, onPosError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function stopRadar() {
  state.radarOn = false; lsSet(LS.radar, false);
  if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = null; state.pos = null;
  const btn = $('#radarBtn'); btn.querySelector('span').textContent = 'Pornește radarul'; btn.classList.remove('bg-maraPink', 'dark:bg-maraPink', 'dark:text-white');
  $('#radarStatus').textContent = 'Pornește radarul ca să primiți o alertă când vă apropiați de un loc din program.';
  $('#radarBanner').classList.add('hidden');
  renderNearby(); renderDay();
}

// ---------- Vreme (Open-Meteo, fără cheie) ----------
const WMO = (c) => c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 49 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '🌨️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
async function loadWeather() {
  const strip = $('#weatherStrip'); if (!strip) return;
  const render = (data) => {
    if (!data?.daily?.time?.length) return;
    const names = { '2026-11-04': 'Mie', '2026-11-05': 'Joi', '2026-11-06': 'Vin', '2026-11-07': 'Sâm', '2026-11-08': 'Dum', '2026-11-09': 'Lun' };
    strip.innerHTML = data.daily.time.map((t, i) => `
      <div class="shrink-0 w-[72px] p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
        <div class="text-[10px] font-bold text-slate-500">${names[t] || t.slice(5)}</div>
        <div class="text-xl leading-tight">${WMO(data.daily.weather_code[i])}</div>
        <div class="text-[11px] font-bold text-slate-800 dark:text-slate-100">${Math.round(data.daily.temperature_2m_max[i])}° <span class="text-slate-400 font-medium">${Math.round(data.daily.temperature_2m_min[i])}°</span></div>
        <div class="text-[10px] text-sky-600">${data.daily.precipitation_probability_max[i] ?? 0}% 🌧</div>
      </div>`).join('');
    strip.classList.remove('hidden'); strip.classList.add('flex');
  };
  const cached = lsGet(LS.weather, null);
  if (cached && Date.now() - cached.at < 3 * 3600 * 1000) render(cached.data);
  try {
    // Prognoza există cu ~16 zile înainte; în afara ferestrei, API-ul răspunde cu eroare și ascundem banda.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=41.39&longitude=2.17&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FMadrid&start_date=${TRIP.start}&end_date=${TRIP.days.mon}`;
    const res = await fetch(url); if (!res.ok) return;
    const data = await res.json(); if (data.error) return;
    lsSet(LS.weather, { at: Date.now(), data }); render(data);
  } catch {}
}

// ---------- PWA ----------
function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; $('#installBtn').classList.remove('hidden'); $('#installBtn').classList.add('flex'); });
  window.addEventListener('appinstalled', () => { $('#installBtn').classList.add('hidden'); toast('Instalată! O găsești pe ecranul principal.'); });
  const host = location.hostname;
  const canSW = 'serviceWorker' in navigator && (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') || host === 'localhost' || host === '127.0.0.1');
  if (!canSW) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Versiune nouă descărcată. Se aplică la următoarea deschidere.', 'fa-rotate'); });
    });
  }).catch((e) => console.warn('SW:', e));
}
async function installApp() {
  const p = state.installPrompt; if (!p) return;
  p.prompt(); await p.userChoice; state.installPrompt = null; $('#installBtn').classList.add('hidden');
}

// ---------- Evenimente ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) { if (e.target.matches('[data-modal]')) closeModals(); return; }
  const a = el.dataset.action;
  if (a === 'day') switchDay(el.dataset.day, el.classList.contains('bottom-day'));
  else if (a === 'filter') setFilter(el.dataset.cat);
  else if (a === 'coffee') updateCoffee(Number(el.dataset.delta));
  else if (a === 'toggle-theme') toggleTheme();
  else if (a === 'share') share();
  else if (a === 'open-add') openAddWithQuery('');
  else if (a === 'close-modal') closeModals();
  else if (a === 'copy-link') copyText($('#shareUrl').value, 'Linkul a fost copiat!');
  else if (a === 'copy-summary') { copyText(`${SUMMARY_TEXT}\n\n📱 ${location.href.split('#')[0]}`, 'Rezumatul a fost copiat!'); $('#copyCheckIcon')?.classList.remove('opacity-0'); }
  else if (a === 'delete-loc') deleteLocation(el.dataset.id);
  else if (a === 'toggle-visited') toggleVisited(el.dataset.id);
  else if (a === 'pin-here') pinHere(el.dataset.id);
  else if (a === 'add-alt') addAlternative(Number(el.dataset.index));
  else if (a === 'toggle-radar') (state.radarOn ? stopRadar() : startRadar());
  else if (a === 'close-banner') $('#radarBanner').classList.add('hidden');
  else if (a === 'use-my-position') useMyPosition();
  else if (a === 'install') installApp();
});
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'addLocationForm') return handleAddSubmit(e);
  const a = form.dataset.action;
  if (a === 'hero-search') { e.preventDefault(); openAddWithQuery($('#heroSearchQuery').value.trim()); }
  if (a === 'modal-search') { e.preventDefault(); const q = $('#modalSearchQuery').value.trim(); if (q) { if (!$('#locTitle').value) $('#locTitle').value = q; window.open(mapsSearch(q), '_blank', 'noopener'); } }
});
document.addEventListener('change', (e) => { if (e.target.matches('.quest-check')) setQuest(e.target.dataset.quest, e.target.checked); });
document.addEventListener('input', (e) => { if (e.target.id === 'sharedNotes') onNotesInput(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderDay(); if (state.radarOn && state.watchId == null) startRadar(); } });

// ---------- Start ----------
applyThemeIcon();
loadLocal();
renderCountdown();
renderCoffee(); renderQuests(); renderNotes();
switchDay(todayKey() || 'thu');
setupPWA();
loadWeather();
connectFirebase();
if (state.radarOn) startRadar();
setInterval(() => { renderCountdown(); }, 60000);
