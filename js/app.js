import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  projectId: "ciudad-viva-1c19f",
  appId: "1:490349125496:web:27a46fae03141901d9328d",
  storageBucket: "ciudad-viva-1c19f.firebasestorage.app",
  apiKey: "AIzaSyA5FYYnyohOrAFPdjMc_SDzqZfzjaIQxU0",
  authDomain: "ciudad-viva-1c19f.firebaseapp.com",
  messagingSenderId: "490349125496",
  measurementId: "G-9D7RJLHN8P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventsRef = collection(db, "events");
const locationsRef = collection(db, "locations");
const townsRef = collection(db, "towns");

let selectedCategory = '';
let events = [];
let locations = [];
let towns = [];
let uploadedPhotos = [];
let activeGalleryPhotos = [];
let currentLightboxIdx = 0;

// Scroll Infinito
let visibleCount = 6;
let observer = null;

const $ = s => document.querySelector(s);

// ----------------------------------------------------
// NAVEGACIÓN Y PESTAÑAS
// ----------------------------------------------------
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab, .view').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  $('#' + b.dataset.view).classList.add('on');
});

document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.admin-subview').forEach(sv => sv.style.display = 'none');
    
    btn.classList.add('on');
    const target = $('#admin-subview-' + btn.dataset.adminSubview);
    if (target) target.style.display = 'block';
  };
});

const freeCheckbox = $('#new-price-free');
const priceWrap = $('#price-input-wrap');

if (freeCheckbox && priceWrap) {
  freeCheckbox.onchange = () => {
    priceWrap.style.display = freeCheckbox.checked ? 'none' : 'flex';
  };
}

// ----------------------------------------------------
// GESTIÓN DE MUNICIPIOS (TOWNS)
// ----------------------------------------------------
async function loadTowns() {
  try {
    const snapshot = await getDocs(townsRef);
    towns = [];
    snapshot.forEach(docSnap => {
      towns.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (towns.length === 0) {
      const sampleTowns = [
        { name: 'Úbeda', province: 'Jaén' },
        { name: 'Baeza', province: 'Jaén' }
      ];
      for (const t of sampleTowns) {
        await addDoc(townsRef, t);
      }
      return loadTowns();
    }

    renderTowns();
    renderLocations();
    updateSummaryStats();
  } catch (e) {
    console.error("Error al cargar municipios:", e);
  }
}

function renderTowns() {
  const citizenTownSelect = $('#town');
  if (citizenTownSelect) {
    const currentVal = citizenTownSelect.value;
    citizenTownSelect.innerHTML = `<option value="">Todos los municipios</option>` + 
      towns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal) citizenTownSelect.value = currentVal;
  }

  const venueTownSelect = $('#new-venue-town');
  if (venueTownSelect) {
    const currentVal = venueTownSelect.value;
    venueTownSelect.innerHTML = towns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal && towns.some(t => t.name === currentVal)) venueTownSelect.value = currentVal;
  }

  const listEl = $('#towns-list');
  if (!listEl) return;

  const searchQuery = ($('#admin-search-towns') ? $('#admin-search-towns').value : '').toLowerCase().trim();
  const filteredTowns = towns.filter(t => t.name.toLowerCase().includes(searchQuery));

  if (filteredTowns.length === 0) {
    listEl.innerHTML = `<p class="muted">${searchQuery ? 'No hay municipios que coincidan.' : 'No hay municipios creados.'}</p>`;
    return;
  }

  listEl.innerHTML = filteredTowns.map(t => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
      <div>
        <b style="font-size:15px; color:#0f172a;">${t.name}</b><br>
        <span class="muted" style="font-size:13px;">${t.province || 'Jaén'}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" style="padding:6px 12px; font-size:13px;" onclick="editTown('${t.id}')">Editar</button>
        <button class="btn-secondary" style="padding:6px 12px; font-size:13px; color:#dc2626; border-color:#fca5a5;" onclick="deleteTown('${t.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

if ($('#admin-search-towns')) $('#admin-search-towns').oninput = renderTowns;

if ($('#save-town')) {
  $('#save-town').onclick = async () => {
    const id = $('#town-edit-id').value;
    const name = $('#new-town-name').value.trim();
    const province = $('#new-town-province').value.trim() || 'Jaén';

    if (!name) return alert('Escribe el nombre del municipio.');

    try {
      $('#save-town').disabled = true;
      $('#save-town').textContent = "Guardando...";

      if (id) {
        await updateDoc(doc(db, "towns", id), { name, province });
      } else {
        await addDoc(townsRef, { name, province });
      }

      resetTownForm();
      const toast = $('#toast-town');
      if (toast) {
        toast.style.display = 'inline-block';
        setTimeout(() => toast.style.display = 'none', 3000);
      }
      await loadTowns();
    } catch(err) {
      console.error(err);
      alert("Error al guardar municipio: " + err.message);
    } finally {
      $('#save-town').disabled = false;
      $('#save-town').textContent = "Guardar municipio";
    }
  };
}

window.editTown = (id) => {
  const t = towns.find(item => item.id === id);
  if (!t) return;

  $('#town-edit-id').value = t.id;
  $('#new-town-name').value = t.name;
  $('#new-town-province').value = t.province || 'Jaén';
  
  $('#town-form-title').textContent = "Editar Municipio";
  $('#save-town').textContent = "Actualizar municipio";
  if ($('#cancel-town-edit')) $('#cancel-town-edit').style.display = 'inline-block';
};

window.deleteTown = async (id) => {
  const t = towns.find(item => item.id === id);
  if (!t) return;

  if (!confirm(`¿Seguro que quieres eliminar el municipio "${t.name}"?`)) return;

  try {
    await deleteDoc(doc(db, "towns", id));
    await loadTowns();
  } catch(err) {
    console.error(err);
    alert("Error al eliminar municipio: " + err.message);
  }
};

if ($('#cancel-town-edit')) {
  $('#cancel-town-edit').onclick = resetTownForm;
}

function resetTownForm() {
  $('#town-edit-id').value = '';
  $('#new-town-name').value = '';
  $('#new-town-province').value = 'Jaén';
  $('#town-form-title').textContent = "Añadir Nuevo Municipio";
  $('#save-town').textContent = "Guardar municipio";
  if ($('#cancel-town-edit')) $('#cancel-town-edit').style.display = 'none';
}


// ----------------------------------------------------
// GESTIÓN DE LUGARES / LOCATIONS
// ----------------------------------------------------
async function loadLocations() {
  try {
    const snapshot = await getDocs(locationsRef);
    locations = [];
    snapshot.forEach(docSnap => {
      locations.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderLocations();
    updateSummaryStats();
  } catch (e) {
    console.error("Error al cargar lugares:", e);
    const listEl = $('#venues-list');
    if (listEl) listEl.innerHTML = `<p style="color:red;">Asegúrate de haber activado Cloud Firestore en la consola de Firebase.</p>`;
  }
}

function getLocationDisplayName(loc) {
  if (!loc) return '';
  if (loc.name.includes('(')) return loc.name;
  return loc.town ? `${loc.name} (${loc.town})` : loc.name;
}

function renderLocations() {
  const datalist = $('#locations-datalist');
  if (datalist) {
    datalist.innerHTML = locations.map(loc => {
      const disp = getLocationDisplayName(loc);
      return `<option value="${disp}">`;
    }).join('');
  }

  const listEl = $('#venues-list');
  if (!listEl) return;

  const searchQuery = ($('#admin-search-venues') ? $('#admin-search-venues').value : '').toLowerCase().trim();
  const filteredLocations = locations.filter(loc => getLocationDisplayName(loc).toLowerCase().includes(searchQuery));

  if (filteredLocations.length === 0) {
    listEl.innerHTML = `<p class="muted">${searchQuery ? 'No hay lugares que coincidan con la búsqueda.' : 'No hay lugares creados aún.'}</p>`;
    return;
  }

  listEl.innerHTML = filteredLocations.map(loc => {
    const hasMaps = !!loc.mapsUrl;
    const disp = getLocationDisplayName(loc);
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
        <div>
          <b style="font-size:15px; color:#0f172a;">${disp}</b><br>
          ${hasMaps 
            ? `<a href="${loc.mapsUrl}" target="_blank" style="color:#2563eb; font-size:13px; text-decoration:underline;">Ver en Google Maps ↗</a>` 
            : `<span class="muted" style="font-size:13px;">Sin enlace a Maps</span>`}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" style="padding:6px 12px; font-size:13px;" onclick="editVenue('${loc.id}')">Editar</button>
          <button class="btn-secondary" style="padding:6px 12px; font-size:13px; color:#dc2626; border-color:#fca5a5;" onclick="deleteVenue('${loc.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

if ($('#save-venue')) {
  $('#save-venue').onclick = async () => {
    const id = $('#venue-edit-id').value;
    let name = $('#new-venue-name').value.trim();
    const town = $('#new-venue-town') ? $('#new-venue-town').value : 'Úbeda';
    const mapsUrl = $('#new-venue-maps').value.trim();

    if (!name) return alert('Escribe el nombre del lugar.');

    name = name.replace(/\s*\([^)]*\)$/, '').trim();
    const locationPayload = { name, town, mapsUrl };

    try {
      $('#save-venue').disabled = true;
      $('#save-venue').textContent = "Guardando...";

      if (id) {
        await updateDoc(doc(db, "locations", id), locationPayload);
      } else {
        await addDoc(locationsRef, locationPayload);
      }

      resetVenueForm();
      const toast = $('#toast-venue');
      if (toast) {
        toast.style.display = 'inline-block';
        setTimeout(() => toast.style.display = 'none', 3000);
      }
      await loadLocations();
    } catch(err) {
      console.error(err);
      alert("Error al guardar lugar: " + err.message);
    } finally {
      $('#save-venue').disabled = false;
      $('#save-venue').textContent = "Guardar lugar";
    }
  };
}

window.editVenue = (id) => {
  const loc = locations.find(item => item.id === id);
  if (!loc) return;

  $('#venue-edit-id').value = loc.id;
  const rawName = loc.name.replace(/\s*\([^)]*\)$/, '').trim();
  $('#new-venue-name').value = rawName;
  if ($('#new-venue-town') && loc.town) $('#new-venue-town').value = loc.town;
  $('#new-venue-maps').value = loc.mapsUrl || '';
  
  $('#venue-form-title').textContent = "Editar Lugar";
  $('#save-venue').textContent = "Actualizar lugar";
  if ($('#cancel-venue-edit')) $('#cancel-venue-edit').style.display = 'inline-block';
};

window.deleteVenue = async (id) => {
  const loc = locations.find(item => item.id === id);
  if (!loc) return;

  if (!confirm(`¿Seguro que quieres eliminar el lugar "${getLocationDisplayName(loc)}"?`)) return;

  try {
    await deleteDoc(doc(db, "locations", id));
    await loadLocations();
  } catch(err) {
    console.error(err);
    alert("Error al eliminar el lugar: " + err.message);
  }
};

if ($('#cancel-venue-edit')) {
  $('#cancel-venue-edit').onclick = resetVenueForm;
}

function resetVenueForm() {
  $('#venue-edit-id').value = '';
  $('#new-venue-name').value = '';
  $('#new-venue-maps').value = '';
  $('#venue-form-title').textContent = "Añadir Nuevo Lugar";
  $('#save-venue').textContent = "Guardar lugar";
  if ($('#cancel-venue-edit')) $('#cancel-venue-edit').style.display = 'none';
}


// ----------------------------------------------------
// GESTIÓN DE EVENTOS & SCROLL INFINITO
// ----------------------------------------------------
async function loadEvents() {
  try {
    const q = query(eventsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    events = [];
    snapshot.forEach(docSnap => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (events.length < 5) {
      await seedDatabase(true);
    } else {
      draw();
      updateSummaryStats();
    }
  } catch (e) {
    console.error("Error al cargar eventos:", e);
    draw();
  }
}

// Sembrado masivo: 20 Ubicaciones + 30 Eventos
async function seedDatabase(force = false) {
  try {
    const btn = $('#btn-seed-data');
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Generando 30 Eventos y 20 Lugares..."; }

    if (force) {
      // Limpiar colecciones anteriores
      const evSnap = await getDocs(eventsRef);
      for (const d of evSnap.docs) { await deleteDoc(doc(db, "events", d.id)); }
      
      const locSnap = await getDocs(locationsRef);
      for (const d of locSnap.docs) { await deleteDoc(doc(db, "locations", d.id)); }
    }

    // 20 Lugares (10 Úbeda + 10 Baeza)
    const dummyLocations = [
      { name: 'Hospital de Santiago', town: 'Úbeda', mapsUrl: 'https://maps.app.goo.gl/6QN1Jj5r28aWBtUL7' },
      { name: 'Plaza Vázquez de Molina', town: 'Úbeda', mapsUrl: '' },
      { name: 'Teatro Ideal Cinema', town: 'Úbeda', mapsUrl: '' },
      { name: 'Palacio Vela de los Cobos', town: 'Úbeda', mapsUrl: '' },
      { name: 'Sinagoga del Agua', town: 'Úbeda', mapsUrl: '' },
      { name: 'Parque de la Alameda', town: 'Úbeda', mapsUrl: '' },
      { name: 'Museo Arqueológico de Úbeda', town: 'Úbeda', mapsUrl: '' },
      { name: 'Plaza Primero de Mayo', town: 'Úbeda', mapsUrl: '' },
      { name: 'Alfarería Paco Tito', town: 'Úbeda', mapsUrl: '' },
      { name: 'Centro del Olivar y Aceite', town: 'Úbeda', mapsUrl: '' },
      { name: 'Auditorio Ruinas de San Francisco', town: 'Baeza', mapsUrl: '' },
      { name: 'Catedral de Santa María', town: 'Baeza', mapsUrl: '' },
      { name: 'Palacio de Jabalquinto', town: 'Baeza', mapsUrl: '' },
      { name: 'Antigua Universidad de Baeza', town: 'Baeza', mapsUrl: '' },
      { name: 'Plaza del Pópulo', town: 'Baeza', mapsUrl: '' },
      { name: 'Paseo Antonio Machado', town: 'Baeza', mapsUrl: '' },
      { name: 'Polideportivo Municipal', town: 'Baeza', mapsUrl: '' },
      { name: 'Teatro Montemar', town: 'Baeza', mapsUrl: '' },
      { name: 'Plaza de Santa María', town: 'Baeza', mapsUrl: '' },
      { name: 'Plaza de los Leones', town: 'Baeza', mapsUrl: '' }
    ];

    for (const loc of dummyLocations) {
      await addDoc(locationsRef, loc);
    }

    // 30 Eventos variados
    const cats = ['Música', 'Patrimonio', 'Gastronomía', 'Talleres', 'Cine', 'Deporte'];
    const dummyEvents = [];

    for (let i = 1; i <= 30; i++) {
      const isUbeda = i % 2 === 0;
      const townName = isUbeda ? 'Úbeda' : 'Baeza';
      const locList = dummyLocations.filter(l => l.town === townName);
      const locObj = locList[i % locList.length];
      const category = cats[i % cats.length];
      const isFree = i % 3 === 0;
      const price = isFree ? 'Gratis' : `${(5 + (i * 2.5)).toFixed(2)} €`;

      const day = (10 + (i % 20)).toString().padStart(2, '0');
      const dateRaw = `2026-09-${day}`;
      const dateLabel = `${day} Sep`;
      const time = `${18 + (i % 5)}:30`;

      let title = '';
      if (category === 'Música') title = `Concierto ${i}: Noche de Clásicos y Jazz`;
      else if (category === 'Patrimonio') title = `Ruta Guiada ${i}: Secretos e Historias`;
      else if (category === 'Gastronomía') title = `Cata y Maridaje ${i}: Sabores del Renacimiento`;
      else if (category === 'Talleres') title = `Taller Práctico ${i}: Cerámica y Artesanía`;
      else if (category === 'Cine') title = `Cine Bajo las Estrellas V.${i}`;
      else title = `Competición Deportiva ${i}: Torneo Abierto`;

      dummyEvents.push({
        title,
        category,
        town: townName,
        dateRaw,
        dateLabel,
        time,
        venue: `${locObj.name} (${townName})`,
        price,
        description: `Evento cultural número ${i} programado en ${locObj.name} (${townName}). Disfruta de la mejor oferta cultural de la comarca.`,
        photos: [],
        primaryPhotoIdx: 0,
        linkFacebook: 'https://facebook.com',
        linkWeb: '',
        createdAt: serverTimestamp()
      });
    }

    for (const ev of dummyEvents) {
      await addDoc(eventsRef, ev);
    }

    if (btn) { btn.disabled = false; btn.textContent = "⚡ Cargar 30 Eventos y 20 Lugares de prueba"; }

    // Recargar datos
    await Promise.all([loadTowns(), loadLocations(), loadEvents()]);
    alert("¡Éxito! Se han creado 20 Ubicaciones y 30 Eventos de prueba.");
  } catch (err) {
    console.error("Error al sembrar datos:", err);
    alert("Error al cargar datos dummy: " + err.message);
  }
}

if ($('#btn-seed-data')) {
  $('#btn-seed-data').onclick = () => seedDatabase(true);
}

document.querySelectorAll('.chip-item').forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll('.chip-item').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    selectedCategory = chip.dataset.cat;
    visibleCount = 6;
    draw();
  };
});

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Próximamente';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function draw() {
  let q = $('#search').value.toLowerCase();
  let t = $('#town').value;
  let d = $('#date').value;

  let shown = events.filter(e => 
    e.title.toLowerCase().includes(q) &&
    (!selectedCategory || e.category === selectedCategory) &&
    (!t || e.town === t) &&
    (!d || (e.dateLabel && e.dateLabel.includes(d)))
  );

  $('#count').textContent = shown.length + ' actividades';

  // Cortar para Scroll Infinito
  const pageItems = shown.slice(0, visibleCount);

  // Renderizar tarjetas en Vista Ciudadana
  $('#cards').innerHTML = pageItems.map((e) => {
    const photos = e.photos || [];
    const primaryIndex = e.primaryPhotoIdx || 0;
    const coverUrl = photos[primaryIndex] || photos[0];
    const hasImg = !!coverUrl;
    const bgStyle = hasImg ? `background-image:url('${coverUrl}');` : 'background:#e2e8f0;';
    const galleryBadge = photos.length > 1 ? `<span class="badge-gallery">${photos.length} fotos</span>` : '';
    const isFree = (e.price || '').toLowerCase().includes('gratis');

    return `
      <article class="card">
        <div class="visual" style="${bgStyle}">
          <span class="pill-time">${e.dateLabel || e.date || 'Próximamente'} · ${e.time || ''}</span>
          ${galleryBadge}
          <span>${e.town}</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="tag-category">${e.category}</span>
            <span class="price-tag ${isFree ? '' : 'paid'}">${e.price}</span>
          </div>
          <h4>${e.title}</h4>
          <p class="venue">📍 ${e.venue}</p>
          <div class="card-footer">
            <span class="muted">${e.dateLabel || 'Próximamente'}</span>
            <button class="btn-detail" onclick="openDetail('${e.id}')">Ver ficha →</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Actualizar estado del Scroll Infinito (Sentinel)
  const sentinelText = $('#sentinel-text');
  if (sentinelText) {
    if (visibleCount >= shown.length) {
      sentinelText.textContent = shown.length > 0 ? "✓ Has llegado al final de la agenda." : "No hay actividades disponibles.";
    } else {
      sentinelText.textContent = `Mostrando ${visibleCount} de ${shown.length} eventos (Desplaza para cargar más...)`;
    }
  }

  // Inicializar Observer si no existe
  setupScrollObserver(shown.length);

  // Renderizar lista de Administración con filtro de búsqueda
  const adminEventsList = $('#admin-events-list');
  if (adminEventsList) {
    const adminSearchQuery = ($('#admin-search-events') ? $('#admin-search-events').value : '').toLowerCase().trim();
    const adminFilteredEvents = events.filter(e => 
      e.title.toLowerCase().includes(adminSearchQuery) ||
      e.category.toLowerCase().includes(adminSearchQuery) ||
      (e.venue && e.venue.toLowerCase().includes(adminSearchQuery))
    );

    if (adminFilteredEvents.length === 0) {
      adminEventsList.innerHTML = `<p class="muted">${adminSearchQuery ? 'No hay eventos que coincidan con la búsqueda.' : 'No hay eventos activos.'}</p>`;
    } else {
      adminEventsList.innerHTML = adminFilteredEvents.map(e => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <div>
            <b style="font-size:15px; color:#0f172a;">${e.title}</b><br>
            <span class="muted" style="font-size:13px;">${e.category} · ${e.venue} (${e.dateLabel || e.time})</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-secondary" style="padding:6px 12px; font-size:13px;" onclick="editEvent('${e.id}')">Editar</button>
            <button class="btn-secondary" style="padding:6px 12px; font-size:13px; color:#dc2626; border-color:#fca5a5;" onclick="deleteEvent('${e.id}')">Eliminar</button>
          </div>
        </div>
      `).join('');
    }
  }
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

function updateSummaryStats() {
  if ($('#summary-towns-count')) $('#summary-towns-count').textContent = towns.length;
  if ($('#summary-cats-count')) $('#summary-cats-count').textContent = 6;
  if ($('#summary-venues-count')) $('#summary-venues-count').textContent = locations.length;
  if ($('#summary-events-count')) $('#summary-events-count').textContent = events.length;

  const recEventsEl = $('#summary-recent-events');
  if (recEventsEl) {
    if (events.length === 0) {
      recEventsEl.innerHTML = `<p class="muted">No hay eventos recientes.</p>`;
    } else {
      recEventsEl.innerHTML = events.slice(0, 5).map(e => `
        <div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <b>${e.title}</b><br>
          <span class="muted" style="font-size:12px;">${e.category} · ${e.venue}</span>
        </div>
      `).join('');
    }
  }

  const recVenuesEl = $('#summary-recent-venues');
  if (recVenuesEl) {
    if (locations.length === 0) {
      recVenuesEl.innerHTML = `<p class="muted">No hay lugares recientes.</p>`;
    } else {
      recVenuesEl.innerHTML = locations.slice(0, 5).map(v => `
        <div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <b>${getLocationDisplayName(v)}</b>
        </div>
      `).join('');
    }
  }
}

['search', 'town', 'date'].forEach(id => {
  if ($('#' + id)) {
    $('#' + id).oninput = () => {
      visibleCount = 6;
      draw();
    };
  }
});

if ($('#admin-search-events')) $('#admin-search-events').oninput = draw;
if ($('#admin-search-venues')) $('#admin-search-venues').oninput = renderLocations;

if ($('#btn-new-event')) {
  $('#btn-new-event').onclick = () => {
    resetEventForm();
    $('#event-form-panel').scrollIntoView({ behavior: 'smooth' });
  };
}

window.editEvent = (id) => {
  const e = events.find(item => item.id === id);
  if (!e) return;

  $('#event-edit-id').value = e.id;
  $('#new-title').value = e.title;
  $('#new-cat').value = e.category;
  if ($('#new-venue')) $('#new-venue').value = e.venue;
  
  if ($('#new-date') && e.dateRaw) $('#new-date').value = e.dateRaw;
  if ($('#new-time') && e.time) $('#new-time').value = e.time;

  const isFree = (e.price || '').toLowerCase().includes('gratis');
  $('#new-price-free').checked = isFree;
  $('#price-input-wrap').style.display = isFree ? 'none' : 'flex';
  if (!isFree && $('#new-price-num')) {
    $('#new-price-num').value = parseFloat((e.price || '').replace('€', '').trim()) || '';
  }

  $('#new-desc').value = e.description || '';
  if ($('#new-link-fb')) $('#new-link-fb').value = e.linkFacebook || '';
  if ($('#new-link-web')) $('#new-link-web').value = e.linkWeb || '';

  uploadedPhotos = (e.photos || []).map((url, idx) => ({
    url,
    isPrimary: idx === (e.primaryPhotoIdx || 0)
  }));
  renderThumbs();

  $('#event-form-title').textContent = "Editar Evento";
  $('#save').textContent = "Actualizar evento";
  if ($('#cancel-event-edit')) $('#cancel-event-edit').style.display = 'inline-block';

  $('#event-form-panel').scrollIntoView({ behavior: 'smooth' });
};

window.deleteEvent = async (id) => {
  const e = events.find(item => item.id === id);
  if (!e) return;

  if (!confirm(`¿Seguro que quieres eliminar el evento "${e.title}"?`)) return;

  try {
    await deleteDoc(doc(db, "events", id));
    await loadEvents();
  } catch(err) {
    console.error(err);
    alert("Error al eliminar el evento: " + err.message);
  }
};

if ($('#cancel-event-edit')) {
  $('#cancel-event-edit').onclick = resetEventForm;
}

function resetEventForm() {
  $('#event-edit-id').value = '';
  $('#new-title').value = '';
  if ($('#new-date')) $('#new-date').value = '';
  if ($('#new-time')) $('#new-time').value = '20:00';
  
  $('#new-price-free').checked = true;
  $('#price-input-wrap').style.display = 'none';
  if ($('#new-price-num')) $('#new-price-num').value = '';

  if ($('#new-desc')) $('#new-desc').value = '';
  if ($('#new-link-fb')) $('#new-link-fb').value = '';
  if ($('#new-link-web')) $('#new-link-web').value = '';

  uploadedPhotos = [];
  renderThumbs();

  $('#event-form-title').textContent = "Publicación de Evento";
  $('#save').textContent = "Publicar en la agenda";
  if ($('#cancel-event-edit')) $('#cancel-event-edit').style.display = 'none';
}

if ($('#save')) {
  $('#save').onclick = async () => {
    const id = $('#event-edit-id').value;
    let title = $('#new-title').value.trim();
    if (!title) return alert('Escribe un título.');

    const isFree = $('#new-price-free').checked;
    const priceVal = parseFloat($('#new-price-num').value);
    const formattedPrice = isFree || isNaN(priceVal) || priceVal <= 0 ? 'Gratis' : `${priceVal.toFixed(2)} €`;

    const dateRaw = $('#new-date').value;
    const dateLabel = formatDateLabel(dateRaw);
    const selectedVenue = $('#new-venue').value;

    let eventTown = 'Úbeda';
    const matchTown = selectedVenue.match(/\(([^)]+)\)$/);
    if (matchTown) {
      eventTown = matchTown[1];
    }

    const eventPayload = {
      title: title,
      category: $('#new-cat').value,
      town: eventTown,
      dateRaw: dateRaw,
      dateLabel: dateLabel,
      time: $('#new-time').value || '20:00',
      venue: selectedVenue,
      price: formattedPrice,
      description: $('#new-desc').value.trim() || 'Evento municipal.',
      linkFacebook: $('#new-link-fb').value.trim(),
      linkWeb: $('#new-link-web').value.trim(),
      photos: uploadedPhotos.map(p => p.url),
      primaryPhotoIdx: Math.max(0, uploadedPhotos.findIndex(p => p.isPrimary)),
    };

    try {
      $('#save').disabled = true;
      $('#save').textContent = "Guardando...";

      if (id) {
        await updateDoc(doc(db, "events", id), eventPayload);
      } else {
        eventPayload.createdAt = serverTimestamp();
        await addDoc(eventsRef, eventPayload);
      }

      resetEventForm();
      
      const toast = $('#toast');
      if (toast) {
        toast.style.display = 'inline-block';
        setTimeout(() => toast.style.display = 'none', 3000);
      }
      
      loadEvents();
    } catch(err) {
      console.error(err);
      alert("Error al guardar el evento: " + err.message);
    } finally {
      $('#save').disabled = false;
      $('#save').textContent = id ? "Actualizar evento" : "Publicar en la agenda";
    }
  };
}

window.openDetail = function(id) {
  let e = events.find(ev => ev.id === id);
  if(!e) return;

  $('#dtag').textContent = e.category;
  $('#dtitle').textContent = e.title;
  $('#ddesc').textContent = e.description;
  $('#dwhen').textContent = (e.dateLabel || 'Próximamente') + ', ' + e.time;
  
  const locObj = locations.find(loc => getLocationDisplayName(loc) === e.venue || loc.name === e.venue);
  
  if (locObj && locObj.mapsUrl) {
    $('#dwhere').innerHTML = `<a href="${locObj.mapsUrl}" target="_blank" style="color:#2563eb; text-decoration:underline;">${e.venue} ↗</a>`;
  } else {
    $('#dwhere').textContent = e.venue;
  }
  
  $('#dprice').textContent = e.price;

  const linksEl = $('#modal-links');
  if (linksEl) {
    let linksHtml = '';
    if (e.linkFacebook) {
      linksHtml += `<a href="${e.linkFacebook}" target="_blank" style="color:#1877f2; font-weight:600; text-decoration:underline; font-size:14px;">📘 Ver publicación en Facebook ↗</a>`;
    }
    if (e.linkWeb) {
      linksHtml += `<a href="${e.linkWeb}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:underline; font-size:14px;">🌐 Web Oficial / Venta de Entradas ↗</a>`;
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

$('#lightbox').onclick = (e) => { if (e.target === $('#lightbox')) closeLightbox(); };
$('#detail').onclick = e => { if (e.target === $('#detail')) closeDetail(); };

const dropZone = $('#drop-zone');
const fileInput = $('#poster-input');
const thumbsContainer = $('#thumbs-container');
const slotsInfo = $('#slots-info');

if (dropZone) {
  dropZone.addEventListener('click', () => { if (uploadedPhotos.length < 3) fileInput.click(); });
  ['dragover', 'dragenter'].forEach(e => dropZone.addEventListener(e, (evt) => { evt.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, (evt) => { evt.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });
}

function handleFiles(fileList) {
  const files = Array.from(fileList);
  const remaining = 3 - uploadedPhotos.length;
  if (remaining <= 0) return alert('Máximo 3 imágenes.');

  files.slice(0, remaining).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 1400;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round((h * MAX_W) / w); w = MAX_W; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        uploadedPhotos.push({
          url: canvas.toDataURL('image/webp', 0.84),
          isPrimary: uploadedPhotos.length === 0
        });
        renderThumbs();
      };
    };
  });
}

function renderThumbs() {
  if (!uploadedPhotos.length) {
    thumbsContainer.style.display = 'none';
    slotsInfo.textContent = '3 huecos disponibles';
    return;
  }
  thumbsContainer.style.display = 'grid';
  slotsInfo.textContent = `${3 - uploadedPhotos.length} huecos restantes · Clic para portada`;
  thumbsContainer.innerHTML = uploadedPhotos.map((item, idx) => `
    <div class="thumb-slot ${item.isPrimary ? 'is-primary' : ''}" onclick="setAsPrimary(${idx})">
      <img src="${item.url}">
      <span class="badge-cover">${item.isPrimary ? '★ Portada' : 'Hacer portada'}</span>
      <button type="button" class="btn-del" onclick="removePhoto(event, ${idx})">✕</button>
    </div>
  `).join('');
}

window.setAsPrimary = (idx) => {
  uploadedPhotos.forEach((p, i) => p.isPrimary = (i === idx));
  renderThumbs();
};

window.removePhoto = (e, idx) => {
  e.stopPropagation();
  const wasPri = uploadedPhotos[idx].isPrimary;
  uploadedPhotos.splice(idx, 1);
  if (wasPri && uploadedPhotos.length) uploadedPhotos[0].isPrimary = true;
  renderThumbs();
};

// Carga Inicial
Promise.all([loadTowns(), loadLocations(), loadEvents()]);