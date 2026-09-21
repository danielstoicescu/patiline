// Barcelona Aventura – Mara (13), Anne & Daniel
// Aplicația randează programul imediat (offline-first) și apoi încearcă să se conecteze la Firestore
// pentru sincronizare live. Dacă Firebase nu e disponibil, totul se salvează local pe telefon.

const TRIP_ID = 'bcn-aventura';
const DAYS = ['thu', 'fri', 'sat', 'sun', 'mon'];
const CATS = ['mara', 'coffee', 'food', 'art'];
const PEOPLE = ['Daniel', 'Mara', 'Anne'];
const COFFEE_GOAL = 20;
const QUESTS = ['sephora', 'churros', 'matcha', 'quimet'];
const LS = { locations: 'bcn_locations', coffee: 'bcn_coffee', quests: 'bcn_quests', theme: 'bcn_theme' };

const SUMMARY_TEXT = `Barcelona Aventura (Mara 13, Anne & Daniel):
• Baza: Poblenou (Bac de Roda)
• Joi-Vineri: Ferrari Land & PortAventura
• Vineri: Nomad Coffee Poblenou, Pho vietnamez & tapas Poblenou
• Sâmbătă: Right Side Coffee, churros 1968, toboganul Sephora Triangle, thrifting Raval, pinchos Blai
• Duminică: Three Marks, SAISEI ceremonial matcha, Design Museum (gratis după 15:00), apus la Bunkers
• Luni: Encants, Print Workers Gràcia, Quimet & Quimet, plaja Barceloneta`;

// ---------- Programul predefinit ----------
const predefinedLocations = [
  { day: 'thu', cat: 'mara', time: '10:00 – 14:00', catLabel: 'Ferrari Land',
    title: 'Red Force Rollercoaster (112m / 180km/h)',
    desc: 'Adrenalină extremă la 13 ani! Cel mai înalt și cel mai rapid rollercoaster din Europa. Accelerează de la 0 la 180 km/h în doar 5 secunde pe o verticală de 112 metri.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Ferrari+Land+PortAventura',
    imgUrl: 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'thu', cat: 'mara', time: '14:30 – 20:00', catLabel: 'PortAventura Park',
    title: 'Shambhala & Dragon Khan',
    desc: 'Shambhala este un hypercoaster uriaș cu senzație de zbor zero-g, iar Dragon Khan oferă 8 inversiuni spectaculoase. Seara vă puteți plimba prin zona Polinezia.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=PortAventura+Park',
    imgUrl: 'https://images.unsplash.com/photo-1505672678401-209210e75525?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },

  { day: 'fri', cat: 'food', time: '14:00 – 16:00', catLabel: 'Transfer BCN',
    title: 'Sosire din PortAventura ➔ Baza Poblenou',
    desc: 'Sosire în stația Barcelona Sants în jurul orei 14:00. Luați metroul L4 (linia galbenă) direct spre cazarea voastră de pe Carrer de Bac de Roda. Lăsați bagajele și începe aventura!',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Carrer+de+Bac+de+Roda+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'fri', cat: 'coffee', time: '16:30 – 18:00', catLabel: 'Specialty Coffee #1',
    title: 'Nomad Frutas Selectas (Poblenou)',
    desc: 'Situat chiar în cartierul vostru (Carrer de Pujades 290). Este unul dintre cele mai frumoase spații Nomad Coffee. Primul espresso dublu al lui Daniel din Barcelona!',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Nomad+Frutas+Selectas+Poblenou',
    imgUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'fri', cat: 'food', time: '18:30 – 20:00', catLabel: 'Cină vietnameză autentică',
    title: 'Vietnam Autèntic Restaurant (Poblenou)',
    desc: 'Mâncare vietnameză proaspătă și reconfortantă lângă cazare: supă Pho Bo fumegândă, pachețele crocante (Nems) și Iced Coffee vietnamez cu lapte condensat.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Vietnam+Autentic+Poblenou',
    imgUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'fri', cat: 'food', time: '20:00 – 22:00', catLabel: 'Poblenou Tapas Crawl',
    title: 'Tapas pe străduțele Poblenou (Bitacora & El 58)',
    desc: 'Plimbare pe Rambla del Poblenou. Opriți-vă la Bitacora Tapas (Plaça de la Unió) pentru patatas bravas crocante, calamari și atmosfera de tavernă locală. Alternativă: El 58 sau Can Recasens (charcuterie din 1906).',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Bitacora+Tapas+Poblenou',
    imgUrl: 'https://images.unsplash.com/photo-1515443961218-a51367888e4b?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'fri', cat: 'mara', time: '22:00 – 22:30', catLabel: 'Desert Poblenou',
    title: 'Demasié Poblenou (Cinnamon Rolls)',
    desc: 'Raiul deserturilor pe Rambla del Poblenou! Rulouri uriașe cu scorțișoară, umplute cu fistic cremos, Lotus Biscoff sau ciocolată belgiană.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Demasie+Poblenou',
    imgUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },

  { day: 'sat', cat: 'coffee', time: '09:30 – 11:30', catLabel: 'Espresso #2 & Gòtic',
    title: 'Right Side Coffee Bar & Cartierul Evreiesc',
    desc: 'Metrou L4 la Jaume I. Espresso de clasă mondială la micuțul bar Right Side. Explorați străduțele din El Call, Plaça de Sant Felip Neri și celebrul pod neogotic.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Right+Side+Coffee+Bar+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sat', cat: 'mara', time: '11:30 – 12:15', catLabel: 'Churros tradiționali',
    title: 'Xurrería Manuel San Roman (din 1968)',
    desc: 'Cea mai veche churroserie din Gotic (Carrer dels Banys Nous). Churros fierbinți la cornet de hârtie, scufundați în ciocolată caldă ultra-densă.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Xurreria+Manuel+San+Roman+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1624371350109-2900f5778d1d?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sat', cat: 'mara', time: '12:30 – 13:45', catLabel: 'Mara Highlight',
    title: 'SEPHORA Triangle (cu tobogan uriaș!)',
    desc: 'La Plaça de Catalunya! Magazinul uriaș unde clienții coboară pe un tobogan spre nivelul inferior. Secțiuni uriașe Rare Beauty, Fenty și Sol de Janeiro.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=SEPHORA+Triangle+Placa+Catalunya',
    imgUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sat', cat: 'food', time: '14:00 – 16:00', catLabel: 'Prânz tapas & Coffee #3',
    title: 'Bar del Pla & Nomad Coffee Lab (Passatge Sert)',
    desc: 'Prânz la Bar del Pla (crochete cu cerneală de sepie și obraji de vită). Cafea la emblematicul Nomad Coffee Lab pe pasajul pietonal Passatge Sert.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Bar+del+Pla+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sat', cat: 'mara', time: '16:30 – 21:00', catLabel: 'Thrifting & Pinchos',
    title: 'Vintage Raval, Garage Beer & Carrer de Blai',
    desc: 'Vânătoare de haine retro pe Carrer dels Tallers (Kilo Vintage). Bere craft IPA pentru Daniel la Garage Beer Co. Tur de pinchos pe scobitoare pe Carrer de Blai (1.50€ – 2.50€).',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Carrer+de+Blai+Pinchos+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },

  { day: 'sun', cat: 'coffee', time: '09:30 – 11:30', catLabel: 'Espresso #4 & Gaudí',
    title: 'Three Marks Coffee & Sagrada Família',
    desc: 'Start cu espresso la Three Marks Coffee (Eixample/Fort Pienc). Plimbare și poze din parcurile din jurul catedralei Sagrada Família.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Three+Marks+Coffee+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1583772289962-4a689b354448?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sun', cat: 'mara', time: '12:00 – 13:30', catLabel: 'Matcha ceremonial',
    title: 'SAISEI (Ceremonial Matcha & Wagashi)',
    desc: 'Estetică japoneză zen superbă (Carrer de València 293). Matcha bătut manual cu pămătuf de bambus. Deserturi delicate și matcha latte cu lapte de ovăz.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=SAISEI+Matcha+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'sun', cat: 'art', time: '15:00 – 17:00', catLabel: 'GRATUIT DUPĂ 15:00',
    title: 'Design Museum (Disseny Hub – Glòries)',
    desc: 'Chiar la intrarea în Poblenou! Clădire futuristă cu expoziții de design textil, modă, graphic design și obiecte iconice. Intrare complet gratuită duminica după ora 15:00.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Museu+del+Disseny+de+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'sun', cat: 'art', time: '17:30 – 19:30', catLabel: 'Apus panoramic 360°',
    title: 'Bunkers del Carmel & Gelato DeLaCrem',
    desc: 'Panoramă gratuită peste toată Barcelona și Marea Mediterană. Gelato artizanală excelentă la DeLaCrem după apus.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Bunkers+del+Carmel+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },

  { day: 'mon', cat: 'art', time: '09:30 – 11:00', catLabel: 'Târg de vechituri',
    title: 'Mercat dels Encants (acoperiș de oglinzi)',
    desc: 'Piață istorică de vechituri sub un acoperiș uriaș din oglinzi spectaculoase (lângă Glòries / Poblenou). Obiecte retro, aparate foto analog, haine și accesorii.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Mercat+dels+Encants+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1531058240690-006c446962d8?auto=format&fit=crop&w=800&q=80', nearPoblenou: true },
  { day: 'mon', cat: 'art', time: '11:30 – 13:00', catLabel: 'Artă locală',
    title: 'Print Workers Barcelona (Gràcia)',
    desc: 'Atelier de serigrafie și galerie din cartierul Gràcia. Puteți cumpăra o lucrare grafică originală, printată manual pe hârtie de calitate (15€ – 35€).',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Print+Workers+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'mon', cat: 'food', time: '13:30 – 15:00', catLabel: '⭐ HIGHLIGHT BCN',
    title: 'Quimet & Quimet (barmanul Quim & fiica sa)',
    desc: 'O legendă a Barcelonei în Poble Sec! Bar minuscul tapetat cu 500+ sticle. Se stă în picioare. Montaditos cu somon proaspăt, miere de trufe și iaurt cremos.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=Quimet+and+Quimet+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
  { day: 'mon', cat: 'food', time: '15:30 – 18:00', catLabel: 'Plajă & La Bomba',
    title: 'Barceloneta & La Cova Fumada (din 1944)',
    desc: 'Plimbare pe nisipul mării. Oprire la La Cova Fumada pentru „La Bomba” – o crochetă uriașă de cartof umplută cu carne picantă și alioli.',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=La+Cova+Fumada+Barcelona',
    imgUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', nearPoblenou: false },
];

// ---------- Stare ----------
const state = {
  day: 'thu',
  filter: 'all',
  custom: [],          // locații adăugate de familie
  coffee: 0,
  quests: {},
  online: false,       // conectat la Firestore?
};

let fb = null; // { db, fs } – SDK-ul Firestore, după conectare

// ---------- Utilitare ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ' Barcelona')}`;

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

let toastTimer;
function toast(message, icon = 'fa-circle-check') {
  const el = $('#toast');
  $('#toastMessage').textContent = message;
  el.querySelector('i').className = `fa-solid ${icon} text-maraPurple text-lg`;
  el.classList.remove('hidden-toast');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden-toast'), 3200);
}

function setSyncStatus(mode, detail) {
  const el = $('#syncStatus');
  if (!el) return;
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border';
  if (mode === 'online') {
    el.className = `${base} bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400`;
    el.innerHTML = '<i class="fa-solid fa-cloud-bolt"></i> Sincronizat live';
  } else if (mode === 'local') {
    el.className = `${base} bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400`;
    el.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Salvat doar pe acest telefon';
    el.title = detail || '';
  } else {
    el.className = `${base} bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500`;
    el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Se conectează…';
  }
}

// ---------- Randare ----------
const CAT_STYLE = {
  mara:   { bg: 'bg-pink-100 dark:bg-pink-950',       text: 'text-pink-600 dark:text-pink-400',     icon: 'fa-wand-magic-sparkles', grad: 'from-pink-400 to-purple-500' },
  coffee: { bg: 'bg-amber-100 dark:bg-amber-950',     text: 'text-amber-700 dark:text-amber-400',   icon: 'fa-mug-hot',             grad: 'from-amber-400 to-orange-600' },
  food:   { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', icon: 'fa-utensils',          grad: 'from-emerald-400 to-teal-600' },
  art:    { bg: 'bg-sky-100 dark:bg-sky-950',         text: 'text-sky-700 dark:text-sky-400',       icon: 'fa-palette',             grad: 'from-sky-400 to-indigo-600' },
};

function cardHTML(loc, index) {
  const st = CAT_STYLE[loc.cat] || { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: 'fa-map-pin', grad: 'from-slate-400 to-slate-600' };
  const catLabel = loc.catLabel || (loc.isCustom ? `Adăugat de ${loc.addedBy || 'noi'}` : 'Descoperire');
  const mapLink = loc.mapLink && loc.mapLink !== '#' ? loc.mapLink : mapsSearch(loc.title);
  const nearBadge = loc.nearPoblenou ? '<span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold flex items-center gap-1"><i class="fa-solid fa-location-dot"></i> Lângă Poblenou</span>' : '';
  const addedBadge = loc.isCustom ? `<span class="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold flex items-center gap-1"><i class="fa-solid fa-user-tag"></i> ${esc(loc.addedBy || 'Grup')}</span>` : '';
  const deleteBtn = loc.isCustom ? `<button data-action="delete-loc" data-id="${esc(loc.id)}" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center gap-1.5" title="Șterge locația"><i class="fa-solid fa-trash-can"></i> Șterge</button>` : '';
  const media = loc.imgUrl
    ? `<img src="${esc(loc.imgUrl)}" alt="" loading="lazy" class="w-full h-full object-cover" onerror="this.remove()">`
    : '';

  return `
    <div class="relative pl-12 pb-6 timeline-step" data-cat="${esc(loc.cat)}">
      <div class="absolute left-0 top-1 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-maraPurple text-maraPurple font-bold text-xs flex items-center justify-center shadow-md z-10">${index + 1}</div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-card-hover transition duration-300">
        <div class="grid grid-cols-1 md:grid-cols-12">
          <div class="md:col-span-5 relative h-44 md:h-auto md:min-h-[200px] bg-gradient-to-br ${st.grad}">
            <div class="absolute inset-0 flex items-center justify-center text-white/70 text-5xl"><i class="fa-solid ${st.icon}"></i></div>
            <div class="absolute inset-0">${media}</div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent md:hidden pointer-events-none"></div>
            <div class="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 md:hidden">
              <span class="${st.bg} ${st.text} px-2.5 py-1 rounded-lg text-[10px] font-bold"><i class="fa-solid ${st.icon}"></i> ${esc(catLabel)}</span>
              ${nearBadge}${addedBadge}
            </div>
          </div>
          <div class="md:col-span-7 p-5 flex flex-col justify-between gap-3">
            <div>
              <div class="hidden md:flex items-center justify-between gap-2 mb-2">
                <span class="${st.bg} ${st.text} px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5"><i class="fa-solid ${st.icon}"></i> ${esc(catLabel)}</span>
                <div class="flex items-center gap-1 flex-wrap justify-end">${nearBadge}${addedBadge}</div>
              </div>
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white leading-snug">${esc(loc.title)}</h4>
                <span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800 whitespace-nowrap">${esc(loc.time || 'Flexibil')}</span>
              </div>
              <p class="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2 whitespace-pre-line">${esc(loc.desc)}</p>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <a href="${esc(mapLink)}" target="_blank" rel="noopener" class="btn-primary-action px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <i class="fa-solid fa-map-location-dot"></i> Deschide în Google Maps ↗
              </a>
              ${deleteBtn}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderDay() {
  const container = $('#itinerary-container');
  const all = [
    ...predefinedLocations.filter((l) => l.day === state.day),
    ...state.custom.filter((l) => l.day === state.day),
  ];
  const list = all.filter((l) => state.filter === 'all' || l.cat === state.filter);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        Nu există locații pentru filtrul ales în această zi.<br/>
        <button data-action="open-add" class="mt-3 px-4 py-2 rounded-xl bg-maraPurple text-white font-bold text-xs"><i class="fa-solid fa-plus"></i> Adaugă una</button>
      </div>`;
    return;
  }
  container.innerHTML = `<div class="relative timeline-line">${list.map(cardHTML).join('')}</div>`;
}

const DAY_BORDER = { thu: 'border-ferrari', fri: 'border-maraPink', sat: 'border-amber-500', sun: 'border-emerald-500', mon: 'border-bcnTeal' };

function switchDay(day) {
  if (!DAYS.includes(day)) return;
  state.day = day;
  document.querySelectorAll('.day-tab').forEach((tab) => {
    tab.classList.remove(...Object.values(DAY_BORDER), 'bg-slate-100', 'dark:bg-slate-800');
    tab.setAttribute('aria-pressed', 'false');
  });
  const tab = $(`#tab-${day}`);
  if (tab) { tab.classList.add(DAY_BORDER[day], 'bg-slate-100', 'dark:bg-slate-800'); tab.setAttribute('aria-pressed', 'true'); }
  renderDay();
}

function setFilter(cat) {
  state.filter = cat;
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    const active = btn.dataset.cat === cat;
    btn.classList.toggle('ring-2', active);
    btn.classList.toggle('ring-maraPurple', active);
  });
  renderDay();
}

function renderCoffee() {
  $('#coffeeCountDisplay').textContent = `${state.coffee} / ${COFFEE_GOAL} Espressos BCN`;
}
function renderQuests() {
  document.querySelectorAll('.quest-check').forEach((cb) => { cb.checked = !!state.quests[cb.dataset.quest]; });
}

// ---------- Tema ----------
function applyThemeIcon() {
  const dark = document.documentElement.classList.contains('dark');
  $('#themeIcon').className = dark ? 'fa-solid fa-sun text-amber-500 text-base' : 'fa-solid fa-moon text-indigo-600 text-base';
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F172A' : '#8B5CF6');
}
function toggleTheme() {
  const html = document.documentElement;
  const dark = html.classList.toggle('dark');
  html.classList.toggle('light', !dark);
  try { localStorage.setItem(LS.theme, dark ? 'dark' : 'light'); } catch {}
  applyThemeIcon();
}

// ---------- Modale ----------
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModals() {
  document.querySelectorAll('[data-modal]').forEach((m) => m.classList.add('hidden'));
}
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
    try {
      await navigator.share({ title: 'Barcelona Aventura: Mara, Anne & Daniel', text: 'Ghidul nostru de vacanță în Barcelona & PortAventura (4–9 noiembrie).', url });
      return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  openShare();
}
async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast(okMessage);
}

// ---------- Locații: local ----------
function loadLocal() {
  state.custom = lsGet(LS.locations, []);
  state.coffee = Number(lsGet(LS.coffee, 0)) || 0;
  state.quests = lsGet(LS.quests, {});
}
function persistLocal() {
  lsSet(LS.locations, state.custom);
  lsSet(LS.coffee, state.coffee);
  lsSet(LS.quests, state.quests);
}

// ---------- Locații: Firestore ----------
async function loadFirebaseConfig() {
  const local = window.FIREBASE_CONFIG;
  if (local && local.apiKey && local.projectId) return local;
  // Pe Firebase Hosting configurația e servită automat la această adresă rezervată.
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg && cfg.apiKey && cfg.projectId) return cfg;
    }
  } catch { /* nu suntem pe Firebase Hosting */ }
  return null;
}

async function connectFirebase() {
  const cfg = await loadFirebaseConfig();
  if (!cfg) {
    setSyncStatus('local', 'Nu există configurație Firebase – vezi README.');
    return;
  }
  try {
    const V = '11.6.1';
    const [{ initializeApp }, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const app = initializeApp(cfg);
    const db = fs.getFirestore(app);
    fb = { db, fs };

    const locRef = fs.collection(db, 'trips', TRIP_ID, 'locations');
    const stateRef = fs.doc(db, 'trips', TRIP_ID, 'state', 'shared');

    let firstSnapshot = true;
    fs.onSnapshot(fs.query(locRef, fs.orderBy('createdAt', 'asc')), (snap) => {
      state.custom = snap.docs.map((d) => ({ id: d.id, isCustom: true, ...d.data() }));
      lsSet(LS.locations, state.custom);
      renderDay();
      if (firstSnapshot) {
        firstSnapshot = false;
        state.online = true;
        setSyncStatus('online');
      }
    }, (err) => {
      console.error('Firestore locations error:', err);
      state.online = false;
      setSyncStatus('local', err.message);
      toast('Nu m-am putut conecta la baza de date. Salvez local.', 'fa-triangle-exclamation');
    });

    fs.onSnapshot(stateRef, (snap) => {
      const data = snap.data() || {};
      if (typeof data.coffeeCount === 'number') state.coffee = data.coffeeCount;
      if (data.quests && typeof data.quests === 'object') state.quests = data.quests;
      lsSet(LS.coffee, state.coffee);
      lsSet(LS.quests, state.quests);
      renderCoffee();
      renderQuests();
    }, (err) => console.error('Firestore state error:', err));
  } catch (err) {
    console.error('Firebase init error:', err);
    setSyncStatus('local', err.message);
  }
}

async function saveLocation(data) {
  if (fb && state.online) {
    const { db, fs } = fb;
    await fs.addDoc(fs.collection(db, 'trips', TRIP_ID, 'locations'), { ...data, createdAt: fs.serverTimestamp() });
  } else {
    state.custom.push({ ...data, id: 'local-' + Date.now(), isCustom: true, createdAt: new Date().toISOString() });
    persistLocal();
    renderDay();
  }
}

async function deleteLocation(id) {
  if (!confirm('Ștergi această locație din programul comun?')) return;
  if (fb && state.online && !String(id).startsWith('local-')) {
    const { db, fs } = fb;
    await fs.deleteDoc(fs.doc(db, 'trips', TRIP_ID, 'locations', id));
  } else {
    state.custom = state.custom.filter((l) => l.id !== id);
    persistLocal();
    renderDay();
  }
  toast('Locația a fost ștearsă.', 'fa-trash-can');
}

async function updateCoffee(delta) {
  const next = Math.max(0, state.coffee + delta);
  state.coffee = next;
  renderCoffee();
  if (fb && state.online) {
    const { db, fs } = fb;
    await fs.setDoc(fs.doc(db, 'trips', TRIP_ID, 'state', 'shared'), { coffeeCount: next, updatedAt: fs.serverTimestamp() }, { merge: true });
  } else {
    persistLocal();
  }
}

async function setQuest(key, done) {
  state.quests = { ...state.quests, [key]: done };
  if (fb && state.online) {
    const { db, fs } = fb;
    await fs.setDoc(fs.doc(db, 'trips', TRIP_ID, 'state', 'shared'), { quests: state.quests, updatedAt: fs.serverTimestamp() }, { merge: true });
  } else {
    persistLocal();
  }
  if (done) toast('Quest bifat! 🎉');
}

// ---------- Formular ----------
async function handleAddSubmit(e) {
  e.preventDefault();
  const btn = $('#saveLocBtn');
  const title = $('#locTitle').value.trim();
  const desc = $('#locDesc').value.trim();
  if (!title || !desc) return;
  const data = {
    title,
    day: $('#locDay').value,
    cat: $('#locCat').value,
    time: $('#locTime').value.trim() || 'Pauză flexibilă',
    desc,
    mapLink: mapsSearch(title),
    addedBy: PEOPLE.includes($('#locAddedBy').value) ? $('#locAddedBy').value : 'Daniel',
    nearPoblenou: $('#locNear').checked,
  };
  btn.disabled = true; btn.textContent = 'Se salvează…';
  try {
    await saveLocation(data);
    switchDay(data.day);
    closeModals();
    $('#addLocationForm').reset();
    toast(state.online ? `Locația a fost salvată și sincronizată de ${data.addedBy}!` : `Locația a fost salvată pe acest telefon de ${data.addedBy}.`);
  } catch (err) {
    console.error(err);
    toast('Eroare la salvare: ' + (err.message || err), 'fa-triangle-exclamation');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvează în programul comun';
  }
}

function openAddWithQuery(q) {
  openModal('#addModal');
  if (q) {
    $('#modalSearchQuery').value = q;
    $('#locTitle').value = q;
    window.open(mapsSearch(q), '_blank', 'noopener');
  }
  if (!q) $('#locTitle').focus();
}

// ---------- Evenimente (delegare) ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    // click pe fundalul modalului
    if (e.target.matches('[data-modal]')) closeModals();
    return;
  }
  const a = el.dataset.action;
  if (a === 'day') switchDay(el.dataset.day);
  else if (a === 'filter') setFilter(el.dataset.cat);
  else if (a === 'coffee') updateCoffee(Number(el.dataset.delta));
  else if (a === 'toggle-theme') toggleTheme();
  else if (a === 'share') share();
  else if (a === 'open-add') openAddWithQuery('');
  else if (a === 'close-modal') closeModals();
  else if (a === 'copy-link') copyText($('#shareUrl').value, 'Linkul a fost copiat!');
  else if (a === 'copy-summary') { copyText(`${SUMMARY_TEXT}\n\n📱 ${location.href.split('#')[0]}`, 'Rezumatul a fost copiat!'); $('#copyCheckIcon')?.classList.remove('opacity-0'); }
  else if (a === 'delete-loc') deleteLocation(el.dataset.id);
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'addLocationForm') return handleAddSubmit(e);
  const a = form.dataset.action;
  if (a === 'hero-search') { e.preventDefault(); openAddWithQuery($('#heroSearchQuery').value.trim()); }
  if (a === 'modal-search') {
    e.preventDefault();
    const q = $('#modalSearchQuery').value.trim();
    if (q) { if (!$('#locTitle').value) $('#locTitle').value = q; window.open(mapsSearch(q), '_blank', 'noopener'); }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('.quest-check')) setQuest(e.target.dataset.quest, e.target.checked);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

// ---------- Start ----------
applyThemeIcon();
loadLocal();
renderCoffee();
renderQuests();
switchDay('thu');
connectFirebase();
