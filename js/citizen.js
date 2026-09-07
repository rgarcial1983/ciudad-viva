import { 
  db, eventsRef, locationsRef, townsRef, getDocs 
} from "./firebase-config.js";

let selectedCategory = '';
let events = [];
let locations = [];
let towns = [];
let activeGalleryPhotos = [];
let currentLightboxIdx = 0;

let visibleCount = 6;
let observer = null;

const $ = s => document.querySelector(s);

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
  const url = new URL(window.location.href);
  url.searchParams.set('event', e.id);
  return url.toString();
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
      title: 'Compartir Evento',
      html: `
        <p style="font-size:14px; color:#475569; margin-bottom:16px;"><b>"${e.title}"</b></p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}" target="_blank" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#25D366; color:white; border:0; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:14px;">
            📲 Compartir por WhatsApp
          </a>
          <a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}" target="_blank" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#0088cc; color:white; border:0; text-decoration:none; padding:12px; border-radius:12px; font-weight:700; font-size:14px;">
            ✈️ Compartir por Telegram
          </a>
          <button id="btn-copy-link" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:14px; font-weight:700; cursor:pointer;">
            📋 Copiar Enlace Directo
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
                }).fire({ icon: 'success', title: '¡Enlace copiado al portapapeles!' });
              }
            }).catch(() => {
              prompt('Copia este enlace:', shareUrl);
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

// Chips de categoría
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

  const eDate = e.dateRaw || '';
  const eLabel = (e.dateLabel || e.date || '').toLowerCase();

  if (dateFilterVal === 'today') {
    if (eDate) return eDate === todayStr;
    return eLabel.includes('hoy');
  }

  if (dateFilterVal === 'tomorrow') {
    if (eDate) return eDate === tomorrowStr;
    return eLabel.includes('mañana');
  }

  if (dateFilterVal === 'weekend') {
    if (eDate) return weekendDates.includes(eDate);
    return eLabel.includes('sábado') || eLabel.includes('domingo') || eLabel.includes('viernes');
  }

  if (dateFilterVal === 'custom') {
    if (!customDateVal) return true;
    if (eDate) return eDate === customDateVal;
    return false;
  }

  return eLabel.includes(dateFilterVal.toLowerCase());
}

// Renderizar tarjetas de la vista ciudadana
function draw() {
  updateFavsBadge();
  const favsList = getFavorites();
  let q = ($('#search') ? $('#search').value : '').toLowerCase();
  let t = ($('#town') ? $('#town').value : '');
  let dateVal = ($('#date') ? $('#date').value : '');
  let customDateVal = ($('#custom-date-picker') ? $('#custom-date-picker').value : '');

  let shown = events.filter(e => 
    e.title.toLowerCase().includes(q) &&
    (showOnlyFavorites ? favsList.includes(e.id) : true) &&
    (!selectedCategory || e.category === selectedCategory) &&
    (!t || e.town === t) &&
    matchesDateFilter(e, dateVal, customDateVal)
  );

  const countEl = $('#count');
  if (countEl) countEl.textContent = shown.length + ' actividades';

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
        const galleryBadge = photos.length > 1 ? `<span class="badge-gallery">${photos.length} fotos</span>` : '';
        const isFree = (e.price || '').toLowerCase().includes('gratis');
        const isFav = favsList.includes(e.id);

        return `
          <article class="card">
            <div class="visual" style="${bgStyle}">
              <span class="pill-time">${e.dateLabel || e.date || 'Próximamente'} · ${e.time || ''}</span>
              <button class="btn-fav ${isFav ? 'is-fav' : ''}" title="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}" onclick="toggleFavorite('${e.id}', event)">
                ${isFav ? '❤️' : '🤍'}
              </button>
              ${galleryBadge}
              <span>${e.town}</span>
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span class="tag-category">${e.category}</span>
                <span class="price-tag ${isFree ? '' : 'paid'}">${e.price}</span>
              </div>
              <h4>${e.title}</h4>
              <p class="venue">🗺️ ${e.venue}</p>
              <div class="card-footer">
                <span class="muted">${e.dateLabel || 'Próximamente'}</span>
                <button class="btn-detail" onclick="openDetail('${e.id}')">Ver detalle →</button>
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

  if ($('#dtag')) $('#dtag').textContent = e.category;
  if ($('#dtitle')) $('#dtitle').textContent = e.title;
  if ($('#ddesc')) $('#ddesc').textContent = e.description;
  if ($('#dwhen')) $('#dwhen').textContent = (e.dateLabel || 'Próximamente') + ' · ' + e.time;
  
  const isFree = (e.price || '').toLowerCase().includes('gratis');
  const priceBadge = $('#dprice-badge');
  if (priceBadge) {
    priceBadge.textContent = e.price;
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

  const locObj = locations.find(loc => getLocationDisplayName(loc) === e.venue || loc.name === e.venue);
  const mapsUrl = getGoogleMapsUrl(e.venue, e.town, locObj);
  
  if ($('#dwhere')) {
    $('#dwhere').textContent = e.venue;
  }

  const venueBox = $('#modal-venue-info');
  const venueDetailsEl = $('#venue-info-details');
  if (venueBox && venueDetailsEl) {
    let detailsHtml = '';
    if (locObj) {
      if (locObj.address) detailsHtml += `<div>📍 <b>Dirección:</b> ${locObj.address}</div>`;
      if (locObj.capacity) detailsHtml += `<div>👥 <b>Aforo máximo:</b> ${locObj.capacity}</div>`;
      if (locObj.phone) detailsHtml += `<div>📞 <b>Contacto / Taquilla:</b> ${locObj.phone}</div>`;
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
    btnCal.onclick = () => showAddToCalendarDialog(e);
  }

  const btnFavDetail = $('#btn-fav-detail');
  if (btnFavDetail) {
    const favCurrently = isFavorite(e.id);
    btnFavDetail.innerHTML = favCurrently ? '❤️ En favoritos' : '🤍 Guardar';
    btnFavDetail.className = `btn-secondary ${favCurrently ? 'is-fav-active' : ''}`;
    btnFavDetail.onclick = () => {
      toggleFavorite(e.id);
      const isNowFav = isFavorite(e.id);
      btnFavDetail.innerHTML = isNowFav ? '❤️ En favoritos' : '🤍 Guardar';
      btnFavDetail.className = `btn-secondary ${isNowFav ? 'is-fav-active' : ''}`;
    };
  }

  const btnShare = $('#btn-share-event');
  if (btnShare) {
    btnShare.onclick = () => shareEvent(e);
  }

  const linksEl = $('#modal-links');
  if (linksEl) {
    let linksHtml = `<a href="${mapsUrl}" target="_blank" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:700;">📍 Abrir ubicación en Google Maps ↗</a>`;
    if (e.linkFacebook) {
      linksHtml += `<a href="${e.linkFacebook}" target="_blank">📘 Publicación en Facebook ↗</a>`;
    }
    if (e.linkWeb) {
      linksHtml += `<a href="${e.linkWeb}" target="_blank">🌐 Web Oficial / Venta de Entradas ↗</a>`;
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

const detailEl = $('#detail');
if (detailEl) {
  detailEl.onclick = e => { if (e.target === detailEl) closeDetail(); };
}

// Carga inicial
Promise.all([loadTowns(), loadLocations(), loadEvents()]);
