import { 
  db, eventsRef, locationsRef, townsRef, categoriesRef, getDocs 
} from "./firebase-config.js";
import {
  getLang, setLang, toggleLang, t, translateCategory, translatePrice, updateDOMTranslations
} from "./i18n.js";

let selectedCategory = '';
let events = [];
let locations = [];
let towns = [];
let activeGalleryPhotos = [];
let currentLightboxIdx = 0;

let visibleCount = 6;
let observer = null;

const $ = s => document.querySelector(s);

function formatDateLabel(dateStr, dateEndStr = null) {
  const isEn = getLang() === 'en';
  if (!dateStr) return isEn ? 'Coming soon' : 'Próximamente';
  const cleanStart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const dStart = new Date(cleanStart + 'T00:00:00');
  if (isNaN(dStart.getTime())) return dateStr;

  const daysEs = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const days = isEn ? daysEn : daysEs;
  const months = isEn ? monthsEn : monthsEs;

  if (dateEndStr && dateEndStr.trim() !== '' && dateEndStr !== cleanStart) {
    const cleanEnd = dateEndStr.includes('T') ? dateEndStr.split('T')[0] : dateEndStr;
    const dEnd = new Date(cleanEnd + 'T00:00:00');
    if (!isNaN(dEnd.getTime()) && dEnd > dStart) {
      if (dStart.getMonth() === dEnd.getMonth() && dStart.getFullYear() === dEnd.getFullYear()) {
        return isEn 
          ? `${months[dEnd.getMonth()]} ${dStart.getDate()} - ${dEnd.getDate()}`
          : `Del ${dStart.getDate()} al ${dEnd.getDate()} ${months[dEnd.getMonth()]}`;
      } else if (dStart.getFullYear() === dEnd.getFullYear()) {
        return isEn
          ? `${months[dStart.getMonth()]} ${dStart.getDate()} - ${months[dEnd.getMonth()]} ${dEnd.getDate()}`
          : `Del ${dStart.getDate()} ${months[dStart.getMonth()]} al ${dEnd.getDate()} ${months[dEnd.getMonth()]}`;
      } else {
        return isEn
          ? `${months[dStart.getMonth()]} ${dStart.getDate()}, ${dStart.getFullYear()} - ${months[dEnd.getMonth()]} ${dEnd.getDate()}, ${dEnd.getFullYear()}`
          : `Del ${dStart.getDate()} ${months[dStart.getMonth()]} ${dStart.getFullYear()} al ${dEnd.getDate()} ${months[dEnd.getMonth()]} ${dEnd.getFullYear()}`;
      }
    }
  }

  return isEn
    ? `${days[dStart.getDay()]}, ${months[dStart.getMonth()]} ${dStart.getDate()}`
    : `${days[dStart.getDay()]}, ${dStart.getDate()} ${months[dStart.getMonth()]}`;
}

function getEventDateLabel(e) {
  if (!e) return 'Próximamente';
  if (e.dateRaw) return formatDateLabel(e.dateRaw, e.dateEndRaw || e.dateEnd);
  if (e.date && e.date.includes('-')) return formatDateLabel(e.date, e.dateEnd);
  if (e.dateLabel) {
    if (e.dateLabel.includes(',') || e.dateLabel.toLowerCase().includes('del')) return e.dateLabel;
    const m = e.dateLabel.match(/^(\d{1,2})\s+([A-Za-záéíóúÁÉÍÓÚ]+)(?:\s+(\d{4}))?$/);
    if (m) {
      const dayNum = parseInt(m[1], 10);
      const monthStr = m[2].toLowerCase().slice(0, 3);
      const yearNum = m[3] ? parseInt(m[3], 10) : 2026;
      const monthMap = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
      if (monthStr in monthMap) {
        const d = new Date(yearNum, monthMap[monthStr], dayNum);
        if (!isNaN(d.getTime())) {
          const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          return `${days[d.getDay()]}, ${e.dateLabel}`;
        }
      }
    }
    return e.dateLabel;
  }
  return 'Próximamente';
}

// ----------------------------------------------------
// MODO OSCURO (Dark Mode)
// ----------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('ciudad_viva_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleUI(savedTheme);
}

function updateThemeToggleUI(theme) {
  const btn = $('#theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ciudad_viva_theme', next);
  updateThemeToggleUI(next);
}

initTheme();
if ($('#theme-toggle')) $('#theme-toggle').onclick = toggleTheme;

// Cargar municipios para el filtro desplegable
async function loadTowns() {
  try {
    const snapshot = await getDocs(townsRef);
    towns = [];
    snapshot.forEach(docSnap => {
      towns.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderTownFilter();
  } catch (e) {
    console.error("Error al cargar municipios:", e);
  }
}

function renderTownFilter() {
  const citizenTownSelect = $('#town');
  if (citizenTownSelect) {
    const currentVal = citizenTownSelect.value;
    citizenTownSelect.innerHTML = `<option value="">Todos los municipios</option>` + 
      towns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal) citizenTownSelect.value = currentVal;
  }
}

// Cargar lugares para enlaces a Google Maps
async function loadLocations() {
  try {
    const snapshot = await getDocs(locationsRef);
    locations = [];
    snapshot.forEach(docSnap => {
      locations.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (e) {
    console.error("Error al cargar lugares:", e);
  }
}

function getLocationDisplayName(loc) {
  if (!loc) return '';
  if (loc.name.includes('(')) return loc.name;
  return loc.town ? `${loc.name} (${loc.town})` : loc.name;
}

// Cargar eventos para la agenda pública
async function loadEvents() {
  try {
    const snapshot = await getDocs(eventsRef);
    events = [];
    snapshot.forEach(docSnap => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });
    draw();

    // Abrir automáticamente el modal si la URL viene con ?event=ID
    const urlParams = new URLSearchParams(window.location.search);
    const targetEventId = urlParams.get('event');
    if (targetEventId && events.some(ev => ev.id === targetEventId)) {
      openDetail(targetEventId);
    }
  } catch (e) {
    console.error("Error al cargar eventos:", e);
    const cardsEl = $('#cards');
    if (cardsEl) cardsEl.innerHTML = `<p style="color:red; font-weight:bold;">Error al conectar con la base de datos de eventos.</p>`;
  }
}

// ----------------------------------------------------
// COMPARTIR EVENTO Y ENLACES DIRECTOS (URL ?event=ID)
// ----------------------------------------------------
function getEventShareUrl(e) {
  const baseUrl = window.location.href.split('?')[0].split('#')[0];
  return `${baseUrl}?event=${e.id}`;
}

function shareEvent(e) {
  const shareUrl = getEventShareUrl(e);
  const shareText = `¡Mira este plan cultural en Ciudad Viva! "${e.title}" en ${e.venue || e.town}.`;

  if (navigator.share && typeof navigator.share === 'function') {
    navigator.share({
      title: e.title,
      text: shareText,
      url: shareUrl
    }).catch(err => {
      if (err.name !== 'AbortError') {
        showCustomShareDialog(e, shareUrl, shareText);
      }
    });
  } else {
    showCustomShareDialog(e, shareUrl, shareText);
  }
}

function showCustomShareDialog(e, shareUrl, shareText) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: t('share_modal_title'),
      html: `
        <p style="font-size:14px; color:#475569; margin-bottom:16px;"><b>"${e.title}"</b></p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}" target="_blank" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#25D366; color:white; border:0; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:14px;">
            ${t('share_ws')}
          </a>
          <a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}" target="_blank" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#0088cc; color:white; border:0; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:14px;">
            ${t('share_tg')}
          </a>
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}" target="_blank" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#0f172a; color:white; border:0; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:14px;">
            ${t('share_x')}
          </a>
          <button id="btn-copy-link" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:14px; font-weight:700; cursor:pointer;">
            ${t('share_copy')}
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const copyBtn = document.getElementById('btn-copy-link');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              Swal.close();
              if (typeof Swal !== 'undefined') {
                Swal.mixin({
                  toast: true,
                  position: 'top-end',
                  showConfirmButton: false,
                  timer: 2500,
                  timerProgressBar: true
                }).fire({ icon: 'success', title: t('share_copied') });
              }
            }).catch(() => {
              prompt(t('share_copy'), shareUrl);
            });
          };
        }
      }
    });
  }
}

// ----------------------------------------------------
// GESTIÓN DE FAVORITOS (localStorage - Sin costes backend)
// ----------------------------------------------------
let showOnlyFavorites = false;

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('ciudad_viva_favorites')) || [];
  } catch (e) {
    return [];
  }
}

function isFavorite(eventId) {
  return getFavorites().includes(eventId);
}

function updateFavsBadge() {
  const badge = $('#favs-badge');
  if (badge) badge.textContent = getFavorites().length;
}

window.toggleFavorite = (eventId, event) => {
  if (event) event.stopPropagation();
  let favs = getFavorites();
  const index = favs.indexOf(eventId);
  let isAdded = false;

  if (index >= 0) {
    favs.splice(index, 1);
  } else {
    favs.push(eventId);
    isAdded = true;
  }

  try {
    localStorage.setItem('ciudad_viva_favorites', JSON.stringify(favs));
  } catch (err) {
    console.error('Error al guardar favorito:', err);
  }

  updateFavsBadge();
  draw();

  if (typeof Swal !== 'undefined') {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true
    });
    Toast.fire({
      icon: isAdded ? 'success' : 'info',
      title: isAdded ? '❤️ Añadido a tus favoritos' : '🤍 Quitado de tus favoritos'
    });
  }
};

// ----------------------------------------------------
// GESTIÓN DE CATEGORÍAS EN VISTA CIUDADANA
// ----------------------------------------------------
let categories = [];

const DEFAULT_CATEGORIES = [
  { name: 'Música', icon: '🎵' },
  { name: 'Patrimonio', icon: '🏛️' },
  { name: 'Gastronomía', icon: '🍴' },
  { name: 'Talleres', icon: '🎨' },
  { name: 'Cine', icon: '🎬' },
  { name: 'Deporte', icon: '🏃' }
];

async function loadCategories() {
  try {
    const snapshot = await getDocs(categoriesRef);
    categories = [];
    snapshot.forEach(docSnap => {
      categories.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (categories.length === 0) {
      categories = DEFAULT_CATEGORIES;
    }

    renderCategoryChips();
  } catch (e) {
    console.error("Error al cargar categorías en vista ciudadana:", e);
    categories = DEFAULT_CATEGORIES;
    renderCategoryChips();
  }
}

function renderCategoryChips() {
  const chipsRow = $('.chips-row');
  if (!chipsRow) return;

  const favCount = getFavorites().length;
  const isEn = getLang() === 'en';
  const allLabel = isEn ? 'All' : 'Todas';
  const favsLabel = isEn ? 'Favorites' : 'Favoritos';

  let html = `<button class="chip-item ${!selectedCategory && !showOnlyFavorites ? 'on' : ''}" data-cat="">${allLabel}</button>`;
  html += `<button class="chip-item chip-fav ${showOnlyFavorites ? 'on' : ''}" data-favs="true">❤️ ${favsLabel} (<span id="favs-badge">${favCount}</span>)</button>`;

  html += categories.map(c => {
    const isOn = selectedCategory === c.name && !showOnlyFavorites;
    const catDisplayName = translateCategory(c.name);
    return `<button class="chip-item ${isOn ? 'on' : ''}" data-cat="${c.name}">${c.icon || ''} ${catDisplayName}</button>`;
  }).join('');

  chipsRow.innerHTML = html;
  bindChipListeners();
}

function bindChipListeners() {
  document.querySelectorAll('.chip-item').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.chip-item').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      selectedCategory = chip.dataset.cat || '';
      showOnlyFavorites = chip.dataset.favs === 'true';
      visibleCount = 6;
      draw();
    };
  });
}

bindChipListeners();

// ----------------------------------------------------
// FILTRADO AVANZADO DE FECHAS (Hoy, Mañana, Fin de Semana, Personalizada)
// ----------------------------------------------------
function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function getWeekendDates() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const fri = new Date(now);
  const friDiff = (5 - day + 7) % 7;
  fri.setDate(now.getDate() + friDiff);

  const sat = new Date(fri);
  sat.setDate(fri.getDate() + 1);

  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);

  const format = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  return [format(fri), format(sat), format(sun)];
}

function matchesDateFilter(e, dateFilterVal, customDateVal) {
  if (!dateFilterVal) return true;

  const todayStr = getFormattedDate(0);
  const tomorrowStr = getFormattedDate(1);
  const weekendDates = getWeekendDates();

  const eStart = e.dateRaw || e.date || '';
  const eEnd = e.dateEndRaw || e.dateEnd || eStart;
  const eLabel = (e.dateLabel || e.date || '').toLowerCase();

  const isInRange = (targetDate) => {
    if (!eStart) return false;
    return targetDate >= eStart && targetDate <= eEnd;
  };

  if (dateFilterVal === 'today') {
    if (eStart) return isInRange(todayStr);
    return eLabel.includes('hoy');
  }

  if (dateFilterVal === 'tomorrow') {
    if (eStart) return isInRange(tomorrowStr);
    return eLabel.includes('mañana');
  }

  if (dateFilterVal === 'weekend') {
    if (eStart) return weekendDates.some(d => isInRange(d));
    return eLabel.includes('sábado') || eLabel.includes('domingo') || eLabel.includes('viernes');
  }

  if (dateFilterVal === 'custom') {
    if (!customDateVal) return true;
    if (eStart) return isInRange(customDateVal);
    return false;
  }

  return eLabel.includes(dateFilterVal.toLowerCase());
}

// ----------------------------------------------------
// NUEVAS FUNCIONALIDADES: MAPA, EXPORTAR PDF Y DEEP-LINKING
// ----------------------------------------------------

let activeViewMode = 'list'; // 'list' | 'map'
let leafletMap = null;
let mapMarkers = [];

const TOWN_COORDINATES = {
  'Úbeda': { lat: 38.0116, lng: -3.3687 },
  'Baeza': { lat: 37.9942, lng: -3.4682 },
  'Jaén': { lat: 37.7796, lng: -3.7849 },
  'Cazorla': { lat: 37.9133, lng: -3.0044 },
  'Linares': { lat: 38.0931, lng: -3.6346 },
  'Andújar': { lat: 38.0384, lng: -4.0531 },
  'Martos': { lat: 37.7214, lng: -3.9658 },
  'Alcalá la Real': { lat: 37.4623, lng: -3.9231 },
  'Jódar': { lat: 37.8415, lng: -3.3533 },
  'Torredelcampo': { lat: 37.7828, lng: -3.9048 }
};

function getFilteredEvents() {
  const favsList = getFavorites();
  let q = ($('#search') ? $('#search').value : '').toLowerCase();
  let selectedTown = ($('#town') ? $('#town').value : '');
  let dateVal = ($('#date') ? $('#date').value : '');
  let customDateVal = ($('#custom-date-picker') ? $('#custom-date-picker').value : '');

  let shown = events.filter(e => 
    e.title.toLowerCase().includes(q) &&
    (showOnlyFavorites ? favsList.includes(e.id) : true) &&
    (!selectedCategory || e.category === selectedCategory) &&
    (!selectedTown || e.town === selectedTown) &&
    matchesDateFilter(e, dateVal, customDateVal)
  );

  shown.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  return shown;
}

function initOrUpdateMap(filteredEvents) {
  const mapWrap = $('#events-map-wrap');
  if (!mapWrap || mapWrap.style.display === 'none') return;
  if (typeof L === 'undefined') return;

  if (!leafletMap) {
    leafletMap = L.map('events-map').setView([37.9942, -3.4682], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(leafletMap);
  }

  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];

  const bounds = [];
  const coordCounts = {};

  filteredEvents.forEach(e => {
    let coords = null;

    // 1. Look up venue in locations dataset
    if (locations && locations.length > 0) {
      const locObj = locations.find(l => {
        if (!l) return false;
        const dispName = getLocationDisplayName(l);
        return (dispName && dispName === e.venue) ||
               (l.name && l.name === e.venue) ||
               (l.name && e.venue && e.venue.includes(l.name)) ||
               (dispName && e.venue && e.venue.includes(dispName));
      });
      if (locObj && locObj.lat && locObj.lng) {
        const parsedLat = parseFloat(locObj.lat);
        const parsedLng = parseFloat(locObj.lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          coords = { lat: parsedLat, lng: parsedLng };
        }
      }
    }

    // 2. Fallback to town coordinates
    if (!coords && e.town && TOWN_COORDINATES[e.town]) {
      coords = { lat: TOWN_COORDINATES[e.town].lat, lng: TOWN_COORDINATES[e.town].lng };
    }

    // 3. Ultimate default fallback
    if (!coords) {
      coords = { lat: 38.0116, lng: -3.3687 };
    }

    // 4. Offset overlapping coordinates so every event gets a visible, clickable pin
    const coordKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    const count = coordCounts[coordKey] || 0;
    coordCounts[coordKey] = count + 1;

    let finalLat = coords.lat;
    let finalLng = coords.lng;

    if (count > 0) {
      const angle = count * (Math.PI / 3);
      const radius = 0.00035 * Math.ceil(count / 6);
      finalLat += radius * Math.cos(angle);
      finalLng += radius * Math.sin(angle);
    }

    const popupHtml = `
      <div class="map-popup-card">
        <span style="font-size:11px; font-weight:800; color:#2563eb; text-transform:uppercase;">${translateCategory(e.category)}</span>
        <h4 class="map-popup-title">${e.title}</h4>
        <div class="map-popup-meta">
          <span>📅 ${getEventDateLabel(e)}</span>
          <span>🏰 ${e.town} · 🗺️ ${e.venue}</span>
        </div>
        <button class="map-popup-btn" onclick="openDetail('${e.id}')">${t('btn_detail')}</button>
      </div>
    `;

    const marker = L.marker([finalLat, finalLng]).addTo(leafletMap);
    marker.bindPopup(popupHtml);
    mapMarkers.push(marker);
    bounds.push([finalLat, finalLng]);
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      leafletMap.setView(bounds[0], 14);
    } else {
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }
}

function exportFilteredEventsPDF(filteredEvents) {
  if (typeof html2pdf === 'undefined') {
    alert('Error: html2pdf no está disponible');
    return;
  }

  const isEn = getLang() === 'en';
  const selectedTownName = $('#town') && $('#town').value ? $('#town').value : (isEn ? 'All Towns' : 'Todos los Municipios');
  const nowStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'es-ES');

  const pdfContainer = document.createElement('div');
  pdfContainer.style.padding = '24px';
  pdfContainer.style.fontFamily = 'system-ui, sans-serif';
  pdfContainer.style.color = '#0f172a';
  pdfContainer.style.background = '#ffffff';

  let itemsHtml = filteredEvents.slice(0, 15).map(e => `
    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase;">${translateCategory(e.category)}</span>
        <span style="font-size: 11px; font-weight: 700; color: #64748b;">🏰 ${e.town}</span>
      </div>
      <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #0f172a;">${e.title}</h3>
      <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
        <span>📅 ${getEventDateLabel(e)} · ${e.time || ''}</span> | <span>🗺️ ${e.venue}</span>
      </div>
      <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.4;">${(e.description || '').substring(0, 150)}...</p>
    </div>
  `).join('');

  pdfContainer.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:16px;">
      <img src="assets/logo.jpg" style="height:44px; width:44px; border-radius:10px;" alt="Logo">
      <div>
        <h2 style="margin:0; font-size:20px; color:#0f172a;">Ciudad Viva — ${t('pdf_title')}</h2>
        <p style="margin:2px 0 0; font-size:12px; color:#64748b;">${selectedTownName} · ${t('pdf_generated')} ${nowStr}</p>
      </div>
    </div>
    <div>${itemsHtml || '<p>No hay eventos disponibles.</p>'}</div>
    <div style="text-align:center; margin-top:20px; font-size:11px; color:#94a3b8;">
      Ciudad Viva © https://ciudad-viva-1c19f.web.app
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Agenda_Ciudad_Viva_${selectedTownName.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(pdfContainer).save();
}

function setupViewAndExportListeners() {
  const btnList = $('#view-mode-list');
  const btnMap = $('#view-mode-map');
  const cardsEl = $('#cards');
  const mapWrap = $('#events-map-wrap');

  if (btnList && btnMap) {
    btnList.onclick = () => {
      activeViewMode = 'list';
      btnList.classList.add('active');
      btnMap.classList.remove('active');
      if (cardsEl) cardsEl.style.display = 'grid';
      if (mapWrap) mapWrap.style.display = 'none';
    };

    btnMap.onclick = () => {
      activeViewMode = 'map';
      btnMap.classList.add('active');
      btnList.classList.remove('active');
      if (cardsEl) cardsEl.style.display = 'none';
      if (mapWrap) {
        mapWrap.style.display = 'block';
        setTimeout(() => {
          if (leafletMap) leafletMap.invalidateSize();
          initOrUpdateMap(getFilteredEvents());
        }, 200);
      }
    };
  }

  const btnExportPdf = $('#btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.onclick = () => {
      exportFilteredEventsPDF(getFilteredEvents());
    };
  }
}

function checkUrlParamsForEvent() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event');
  if (eventId && events.length > 0) {
    const targetEvent = events.find(e => e.id === eventId);
    if (targetEvent) {
      setTimeout(() => openDetail(eventId), 300);
    }
  }
}

// Renderizar tarjetas de la vista ciudadana
function draw() {
  updateFavsBadge();
  const favsList = getFavorites();
  const shown = getFilteredEvents();

  const countEl = $('#count');
  if (countEl) countEl.textContent = shown.length + ' actividades';

  if (activeViewMode === 'map') {
    initOrUpdateMap(shown);
  }

  const cardsEl = $('#cards');
  if (cardsEl) {
    if (shown.length === 0) {
      if (showOnlyFavorites) {
        cardsEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding: 48px 20px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
            <span style="font-size: 48px; display:block; margin-bottom: 12px;">❤️</span>
            <h4 style="font-size: 20px; margin: 0 0 8px; font-weight: 700; color: #0f172a;">Aún no tienes eventos guardados</h4>
            <p style="color: #64748b; font-size: 14px; max-width: 420px; margin: 0 auto;">Explora la agenda cultural y pulsa el corazón 🤍 en cualquier evento para guardarlo aquí sin necesidad de registrarte.</p>
          </div>
        `;
      } else {
        cardsEl.innerHTML = `<p class="muted" style="grid-column:1/-1; text-align:center; padding: 32px;">No se encontraron actividades con los filtros seleccionados.</p>`;
      }
    } else {
      const pageItems = shown.slice(0, visibleCount);
      cardsEl.innerHTML = pageItems.map((e) => {
        const photos = e.photos || [];
        const primaryIndex = e.primaryPhotoIdx || 0;
        const coverUrl = photos[primaryIndex] || photos[0];
        const hasImg = !!coverUrl;
        const bgStyle = hasImg ? `background-image:url('${coverUrl}');` : 'background:#e2e8f0;';
        const galleryBadge = photos.length > 1 ? `<span class="badge-gallery">${photos.length} ${getLang() === 'en' ? 'photos' : 'fotos'}</span>` : '';
        const featuredBadge = e.featured ? `<span class="badge-featured" style="position:absolute; bottom:12px; left:12px; background:linear-gradient(135deg, #f59e0b, #d97706); color:white; font-size:11px; font-weight:800; padding:3px 9px; border-radius:20px; z-index:2; box-shadow:0 2px 6px rgba(0,0,0,0.2);">${t('badge_featured')}</span>` : '';
        const isFree = (e.price || '').toLowerCase().includes('gratis');
        const isFav = favsList.includes(e.id);

        return `
          <article class="card ${e.featured ? 'card-featured' : ''}">
            <div class="visual" style="${bgStyle}">
              <span class="pill-time">${getEventDateLabel(e)} · ${e.time || ''}</span>
              <button class="btn-fav ${isFav ? 'is-fav' : ''}" title="${isFav ? (getLang() === 'en' ? 'Remove from favorites' : 'Quitar de favoritos') : (getLang() === 'en' ? 'Save to favorites' : 'Guardar en favoritos')}" onclick="toggleFavorite('${e.id}', event)">
                ${isFav ? '❤️' : '🤍'}
              </button>
              ${featuredBadge}
              ${galleryBadge}
              <span style="cursor:pointer;" onclick="openTownModal('${e.town}')" title="${getLang() === 'en' ? 'View info for' : 'Ver información de'} ${e.town}">🏰 ${e.town}</span>
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span class="tag-category">${translateCategory(e.category)}</span>
                <span class="price-tag ${isFree ? '' : 'paid'}">${translatePrice(e.price)}</span>
              </div>
              <h4>${e.title}</h4>
              <p class="venue">🗺️ ${e.venue}</p>
              <div class="card-footer">
                <span class="muted">${getEventDateLabel(e)}</span>
                <button class="btn-detail" onclick="openDetail('${e.id}')">${t('btn_detail')}</button>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  const sentinelText = $('#sentinel-text');
  if (sentinelText) {
    if (visibleCount >= shown.length) {
      sentinelText.textContent = shown.length > 0 ? "✓ Has llegado al final de la agenda." : "";
    } else {
      sentinelText.textContent = `Mostrando ${visibleCount} de ${shown.length} eventos (Desplaza para cargar más...)`;
    }
  }

  setupScrollObserver(shown.length);
}

function setupScrollObserver(totalShown) {
  const sentinel = $('#scroll-sentinel');
  if (!sentinel) return;

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      if (visibleCount < totalShown) {
        visibleCount += 6;
        draw();
      }
    }
  }, { rootMargin: '100px' });

  observer.observe(sentinel);
}

['search', 'town'].forEach(id => {
  if ($('#' + id)) {
    $('#' + id).oninput = () => {
      visibleCount = 6;
      draw();
    };
  }
});

const dateSelectEl = $('#date');
const customDatePickerEl = $('#custom-date-picker');

if (dateSelectEl) {
  dateSelectEl.onchange = () => {
    if (dateSelectEl.value === 'custom') {
      if (customDatePickerEl) customDatePickerEl.style.display = 'inline-block';
    } else {
      if (customDatePickerEl) {
        customDatePickerEl.style.display = 'none';
        customDatePickerEl.value = '';
      }
    }
    visibleCount = 6;
    draw();
  };
}

if (customDatePickerEl) {
  customDatePickerEl.onchange = () => {
    visibleCount = 6;
    draw();
  };
}

// ----------------------------------------------------
// INTEGRACIÓN CON CALENDARIOS (Google Calendar / .ics)
// ----------------------------------------------------
function parseEventDates(e) {
  const dateStr = e.dateRaw || new Date().toISOString().split('T')[0];
  const timeStr = e.time || '20:00';
  
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 9;
  const day = parts[2] || 15;

  const timeParts = (timeStr.includes(':') ? timeStr.split(':') : [20, 0]).map(Number);
  const hours = timeParts[0] || 20;
  const minutes = timeParts[1] || 0;

  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

  const formatICS = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  return {
    startICS: formatICS(startDate),
    endICS: formatICS(endDate)
  };
}

function generateGoogleCalendarUrl(e) {
  const { startICS, endICS } = parseEventDates(e);
  const title = encodeURIComponent(e.title || 'Evento Ciudad Viva');
  const details = encodeURIComponent(`${e.description || ''}\n\nCategoría: ${e.category || ''}\nEntrada: ${e.price || ''}`);
  const location = encodeURIComponent(e.venue || e.town || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startICS}/${endICS}&details=${details}&location=${location}`;
}

function downloadIcsFile(e) {
  const { startICS, endICS } = parseEventDates(e);
  const title = e.title || 'Evento Ciudad Viva';
  const description = (e.description || '').replace(/\n/g, '\\n');
  const location = e.venue || e.town || '';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ciudad Viva//Agenda Cultural//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `DTSTART:${startICS}`,
    `DTEND:${endICS}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showAddToCalendarDialog(e) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Añadir a mi calendario',
      text: `"${e.title}"`,
      icon: 'info',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '📅 Google Calendar',
      denyButtonText: '📥 Descargar iCal (.ics)',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4285F4',
      denyButtonColor: '#0f6674',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(generateGoogleCalendarUrl(e), '_blank');
      } else if (result.isDenied) {
        downloadIcsFile(e);
      }
    });
  } else {
    window.open(generateGoogleCalendarUrl(e), '_blank');
  }
}

// Modal Detalle
window.openDetail = function(id) {
  let e = events.find(ev => ev.id === id);
  if(!e) return;

  if ($('#dtag')) $('#dtag').textContent = translateCategory(e.category);
  if ($('#dtitle')) $('#dtitle').textContent = e.title;
  if ($('#ddesc')) $('#ddesc').textContent = e.description;
  if ($('#dwhen')) $('#dwhen').textContent = getEventDateLabel(e) + ' · ' + e.time;
  
  const isFree = (e.price || '').toLowerCase().includes('gratis');
  const priceBadge = $('#dprice-badge');
  if (priceBadge) {
    priceBadge.textContent = translatePrice(e.price);
    priceBadge.className = `price-tag ${isFree ? '' : 'paid'}`;
  }

function getGoogleMapsUrl(venue, town, locObj) {
  if (locObj && locObj.mapsUrl && locObj.mapsUrl.trim() !== '') {
    return locObj.mapsUrl.trim();
  }
  const queryParts = [];
  if (venue) queryParts.push(venue);
  if (town) queryParts.push(town);
  const searchQuery = encodeURIComponent(queryParts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
}

function getGoogleStreetViewUrl(venue, town, locObj) {
  if (locObj && locObj.streetViewUrl && locObj.streetViewUrl.trim() !== '') {
    return locObj.streetViewUrl.trim();
  }
  if (locObj && locObj.lat && locObj.lng) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${locObj.lat},${locObj.lng}`;
  }
  const queryParts = [];
  if (venue) queryParts.push(venue);
  if (town) queryParts.push(town);
  const query = encodeURIComponent(queryParts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

  const locObj = locations.find(loc => getLocationDisplayName(loc) === e.venue || loc.name === e.venue);
  const mapsUrl = getGoogleMapsUrl(e.venue, e.town, locObj);
  const streetViewUrl = getGoogleStreetViewUrl(e.venue, e.town, locObj);
  
  if ($('#dwhere')) {
    $('#dwhere').textContent = e.venue;
  }

  const venueBox = $('#modal-venue-info');
  const venueDetailsEl = $('#venue-info-details');
  if (venueBox && venueDetailsEl) {
    const isEn = getLang() === 'en';
    let detailsHtml = '';
    if (locObj) {
      if (locObj.address) detailsHtml += `<div>📍 <b>${isEn ? 'Address' : 'Dirección'}:</b> ${locObj.address}</div>`;
      if (locObj.capacity) detailsHtml += `<div>👥 <b>${isEn ? 'Max capacity' : 'Aforo máximo'}:</b> ${locObj.capacity}</div>`;
      if (locObj.phone) detailsHtml += `<div>📞 <b>${isEn ? 'Contact / Box office' : 'Contacto / Taquilla'}:</b> ${locObj.phone}</div>`;
    }
    if (detailsHtml) {
      venueDetailsEl.innerHTML = detailsHtml;
      venueBox.style.display = 'block';
    } else {
      venueBox.style.display = 'none';
    }
  }

  const btnCal = $('#btn-add-calendar');
  if (btnCal) {
    btnCal.textContent = t('modal_calendar');
    btnCal.onclick = () => showAddToCalendarDialog(e);
  }

  const btnFavDetail = $('#btn-fav-detail');
  if (btnFavDetail) {
    const favCurrently = isFavorite(e.id);
    btnFavDetail.innerHTML = favCurrently ? t('modal_favorite_active') : t('modal_favorite');
    btnFavDetail.className = `btn-secondary ${favCurrently ? 'is-fav-active' : ''}`;
    btnFavDetail.onclick = () => {
      toggleFavorite(e.id);
      const isNowFav = isFavorite(e.id);
      btnFavDetail.innerHTML = isNowFav ? t('modal_favorite_active') : t('modal_favorite');
      btnFavDetail.className = `btn-secondary ${isNowFav ? 'is-fav-active' : ''}`;
    };
  }

  const btnShare = $('#btn-share-event');
  if (btnShare) {
    btnShare.textContent = t('modal_share');
    btnShare.onclick = () => shareEvent(e);
  }

  const linksEl = $('#modal-links');
  if (linksEl) {
    const isEn = getLang() === 'en';
    let linksHtml = `<a href="${mapsUrl}" target="_blank" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:700;">${t('maps_link')}</a>`;
    linksHtml += `<a href="${streetViewUrl}" target="_blank" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-weight:700;">📷 ${isEn ? 'Open Google Street View 360° ↗' : 'Ver en Google Street View 360° ↗'}</a>`;

    if (e.linkFacebook) {
      linksHtml += `<a href="${e.linkFacebook}" target="_blank">${t('fb_link')}</a>`;
    }
    if (e.linkWeb) {
      linksHtml += `<a href="${e.linkWeb}" target="_blank">${t('web_link')}</a>`;
    }
    linksEl.innerHTML = linksHtml;
  }

  const galleryEl = $('#modal-gallery');
  const photos = e.photos || [];
  const primaryIdx = e.primaryPhotoIdx || 0;

  if (photos.length > 0) {
    const sorted = [...photos];
    if (primaryIdx > 0 && primaryIdx < sorted.length) {
      const p = sorted.splice(primaryIdx, 1)[0];
      sorted.unshift(p);
    }
    activeGalleryPhotos = sorted;

    galleryEl.style.display = 'grid';
    galleryEl.className = `modal-gallery count-${sorted.length}`;

    if (sorted.length === 1) {
      galleryEl.innerHTML = `<img src="${sorted[0]}" class="main-photo" alt="Cartel" onclick="openLightbox(0)">`;
    } else if (sorted.length === 2) {
      galleryEl.innerHTML = `
        <img src="${sorted[0]}" class="main-photo" alt="Foto 1" onclick="openLightbox(0)">
        <img src="${sorted[1]}" class="sub-photo" alt="Foto 2" onclick="openLightbox(1)">
      `;
    } else {
      galleryEl.innerHTML = `
        <img src="${sorted[0]}" class="main-photo" alt="Foto 1" onclick="openLightbox(0)">
        <img src="${sorted[1]}" class="sub-photo" alt="Foto 2" onclick="openLightbox(1)">
        <img src="${sorted[2]}" class="sub-photo" alt="Foto 3" onclick="openLightbox(2)">
      `;
    }
  } else {
    activeGalleryPhotos = [];
    galleryEl.style.display = 'none';
  }

  $('#detail').classList.add('on');
};

window.closeDetail = () => $('#detail').classList.remove('on');

window.openTownModal = function(townName) {
  const townObj = towns.find(t => t.name === townName) || { name: townName, province: 'Jaén' };
  const townEvents = events.filter(e => e.town === townName);
  const townVenues = locations.filter(l => l.town === townName || (l.name && l.name.includes(townName)));

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: `🏰 ${townObj.name}`,
      html: `
        <div style="text-align:left; font-size:14px; color:var(--text-main);">
          <p style="margin:0 0 12px; font-weight:600; color:#2563eb;">Municipio de ${townObj.name} (${townObj.province || 'Jaén'})</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; background:var(--bg); padding:12px; border-radius:12px; border:1px solid var(--border);">
            <div><b style="font-size:18px; color:var(--text-main);">${townEvents.length}</b><br><span style="font-size:12px; color:var(--text-muted);">Eventos en agenda</span></div>
            <div><b style="font-size:18px; color:var(--text-main);">${townVenues.length}</b><br><span style="font-size:12px; color:var(--text-muted);">Espacios culturales</span></div>
          </div>
          <p style="font-weight:700; margin:0 0 8px;">Próximas actividades en ${townObj.name}:</p>
          ${townEvents.length === 0 ? '<p class="muted">No hay eventos programados próximamente.</p>' : 
            townEvents.slice(0, 4).map(ev => `
              <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:13px;">
                <b>${ev.title}</b><br>
                <span class="muted" style="font-size:11px;">${ev.category} · ${getEventDateLabel(ev)}</span>
              </div>
            `).join('')
          }
        </div>
      `,
      confirmButtonText: 'Filtrar agenda por este municipio',
      confirmButtonColor: '#2563eb',
      showCloseButton: true
    }).then((res) => {
      if (res.isConfirmed) {
        const townSelect = $('#town');
        if (townSelect) {
          townSelect.value = townName;
          visibleCount = 6;
          draw();
        }
      }
    });
  }
};

// Lightbox
window.openLightbox = (index) => {
  if (!activeGalleryPhotos.length) return;
  currentLightboxIdx = index;
  updateLightbox();
  $('#lightbox').classList.add('on');
};

window.closeLightbox = () => $('#lightbox').classList.remove('on');

function updateLightbox() {
  $('#lb-img').src = activeGalleryPhotos[currentLightboxIdx];
  $('#lb-counter').textContent = `${currentLightboxIdx + 1} / ${activeGalleryPhotos.length}`;
  const showNav = activeGalleryPhotos.length > 1;
  $('.lb-prev').style.display = showNav ? 'flex' : 'none';
  $('.lb-next').style.display = showNav ? 'flex' : 'none';
}

window.prevLightboxPhoto = () => {
  currentLightboxIdx = (currentLightboxIdx - 1 + activeGalleryPhotos.length) % activeGalleryPhotos.length;
  updateLightbox();
};

window.nextLightboxPhoto = () => {
  currentLightboxIdx = (currentLightboxIdx + 1) % activeGalleryPhotos.length;
  updateLightbox();
};

window.addEventListener('keydown', (e) => {
  if ($('#lightbox').classList.contains('on')) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevLightboxPhoto();
    if (e.key === 'ArrowRight') nextLightboxPhoto();
  } else if ($('#detail').classList.contains('on')) {
    if (e.key === 'Escape') closeDetail();
  }
});

const lightboxEl = $('#lightbox');
if (lightboxEl) {
  lightboxEl.onclick = (e) => { if (e.target === lightboxEl) closeLightbox(); };
}

const btnEs = $('#lang-btn-es');
const btnEn = $('#lang-btn-en');
if (btnEs) {
  btnEs.onclick = () => {
    setLang('es');
    renderCategoryChips();
    draw();
  };
}
if (btnEn) {
  btnEn.onclick = () => {
    setLang('en');
    renderCategoryChips();
    draw();
  };
}

updateDOMTranslations();

// Carga inicial
Promise.all([loadTowns(), loadLocations(), loadEvents(), loadCategories()]).then(() => {
  setupViewAndExportListeners();
  checkUrlParamsForEvent();
});
