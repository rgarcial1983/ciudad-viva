import { 
  db, auth, eventsRef, locationsRef, townsRef, usersRef,
  addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "./firebase-config.js";

let events = [];
let locations = [];
let towns = [];
let usersList = [];
let currentUserProfile = null;
let uploadedPhotos = [];

const $ = s => document.querySelector(s);

// ----------------------------------------------------
// MODO OSCURO (Dark Mode) ADMIN
// ----------------------------------------------------
function initAdminTheme() {
  const savedTheme = localStorage.getItem('ciudad_viva_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateAdminThemeToggleUI(savedTheme);
}

function updateAdminThemeToggleUI(theme) {
  const btn = $('#admin-theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  }
}

function toggleAdminTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ciudad_viva_theme', next);
  updateAdminThemeToggleUI(next);
}

initAdminTheme();
if ($('#admin-theme-toggle')) $('#admin-theme-toggle').onclick = toggleAdminTheme;

// ----------------------------------------------------
// NOTIFICACIONES Y DIÁLOGOS SWEETALERT2
// ----------------------------------------------------
const Toast = (typeof Swal !== 'undefined') ? Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  }
}) : null;

function notifySuccess(message) {
  if (Toast) {
    Toast.fire({ icon: 'success', title: message });
  } else {
    alert(message);
  }
}

function notifyWarning(message) {
  if (Toast) {
    Toast.fire({ icon: 'warning', title: message });
  } else {
    alert(message);
  }
}

function notifyError(title, message) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'error',
      title: title || 'Error',
      text: message,
      confirmButtonColor: '#0f6674'
    });
  } else {
    alert(message);
  }
}

async function confirmDialog(title, text, confirmText = 'Sí, eliminar') {
  if (typeof Swal !== 'undefined') {
    const res = await Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    return res.isConfirmed;
  }
  return confirm(`${title}\n${text}`);
}

function isTownAllowed(townName) {
  if (!currentUserProfile) return true;
  if (currentUserProfile.role === 'superadmin') return true;
  if (!currentUserProfile.allowedTowns || currentUserProfile.allowedTowns.includes('*')) return true;
  return currentUserProfile.allowedTowns.includes(townName);
}

// ----------------------------------------------------
// AUTENTICACIÓN Y PERSISTENCIA DE SESIÓN
// ----------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  const loginPanel = $('#admin-login-panel');
  const adminContent = $('#admin-content-wrap');
  const emailDisplay = $('#user-email-display');

  if (user) {
    if (loginPanel) loginPanel.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        const allUsersSnap = await getDocs(usersRef);
        const isFirstUser = allUsersSnap.empty;
        const isSuperadminEmail = (user.email && user.email.toLowerCase() === 'rgarcial1983@gmail.com');

        const role = (isFirstUser || isSuperadminEmail) ? 'superadmin' : 'editor';
        const allowedTowns = (role === 'superadmin') ? ['*'] : (towns.length ? [towns[0].name] : ['Úbeda']);

        const newProfile = {
          uid: user.uid,
          email: user.email || 'Sin correo',
          role: role,
          allowedTowns: allowedTowns,
          createdAt: serverTimestamp()
        };

        await setDoc(userDocRef, newProfile);
        currentUserProfile = { ...newProfile };
      } else {
        currentUserProfile = userSnap.data();
      }
    } catch (err) {
      console.error("Error al obtener perfil de usuario:", err);
      currentUserProfile = { uid: user.uid, email: user.email, role: 'editor', allowedTowns: ['Úbeda'] };
    }

    if (emailDisplay) {
      const roleLabel = currentUserProfile.role === 'superadmin' ? ' (Superadmin)' : ` (Gestor: ${(currentUserProfile.allowedTowns || []).join(', ')})`;
      emailDisplay.textContent = (user.email || user.displayName || 'Usuario') + roleLabel;
    }

    updateUserRoleUI(true);
  } else {
    currentUserProfile = null;
    if (adminContent) adminContent.style.display = 'none';
    if (loginPanel) loginPanel.style.display = 'block';
  }
});

function switchToSubView(name) {
  document.querySelectorAll('.admin-tab').forEach(b => {
    if (b.dataset.adminSubview === name) b.classList.add('on');
    else b.classList.remove('on');
  });
  document.querySelectorAll('.admin-subview').forEach(sv => {
    if (sv.id === 'admin-subview-' + name) {
      sv.classList.add('on');
      sv.style.display = 'block';
    } else {
      sv.classList.remove('on');
      sv.style.display = 'none';
    }
  });
}

function updateUserRoleUI(resetToSummary = false) {
  const isSuper = currentUserProfile && currentUserProfile.role === 'superadmin';

  const usersTab = $('#tab-admin-users');
  const townsTab = $('#tab-admin-towns');

  if (usersTab) usersTab.style.display = isSuper ? 'block' : 'none';
  if (townsTab) townsTab.style.display = isSuper ? 'block' : 'none';

  const currentActiveSub = document.querySelector('.admin-subview.on');
  if (!isSuper || resetToSummary || !currentActiveSub || currentActiveSub.id === 'admin-subview-users' || currentActiveSub.id === 'admin-subview-towns') {
    switchToSubView('summary');
  }

  if (isSuper) {
    loadUsers();
  }

  renderTowns();
  renderLocations();
  renderAdminEvents();
  updateSummaryStats();
}

// Formulario de Login (Email / Password)
const loginForm = $('#login-form');
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value.trim();
    const btnSubmit = $('#btn-login-submit');
    const errBox = $('#login-error');

    if (errBox) errBox.style.display = 'none';

    try {
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = "Verificando..."; }
      await signInWithEmailAndPassword(auth, email, password);
      loginForm.reset();
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      if (errBox) {
        errBox.style.display = 'block';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          errBox.textContent = "El correo o la contraseña son incorrectos.";
        } else {
          errBox.textContent = "Error al conectar: " + err.message;
        }
      }
    } finally {
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Iniciar sesión"; }
    }
  };
}

// Login con Google
const btnGoogle = $('#btn-google-login');
if (btnGoogle) {
  btnGoogle.onclick = async () => {
    const provider = new GoogleAuthProvider();
    const errBox = $('#login-error');
    if (errBox) errBox.style.display = 'none';

    try {
      btnGoogle.disabled = true;
      btnGoogle.style.opacity = '0.7';
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Error al iniciar sesión con Google:", err);
      if (errBox) {
        errBox.style.display = 'block';
        if (err.code === 'auth/popup-closed-by-user') {
          errBox.textContent = "Se ha cerrado la ventana de acceso con Google.";
        } else {
          errBox.textContent = "Error al conectar con Google: " + err.message;
        }
      }
    } finally {
      btnGoogle.disabled = false;
      btnGoogle.style.opacity = '1';
    }
  };
}

// Botón de Cerrar Sesión
const btnLogout = $('#btn-logout');
if (btnLogout) {
  btnLogout.onclick = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };
}

// Navegación entre pestañas
document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.onclick = () => {
    switchToSubView(btn.dataset.adminSubview);
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
  const venueTownSelect = $('#new-venue-town');
  if (venueTownSelect) {
    const currentVal = venueTownSelect.value;
    const availableTowns = towns.filter(t => isTownAllowed(t.name));
    venueTownSelect.innerHTML = availableTowns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal && availableTowns.some(t => t.name === currentVal)) venueTownSelect.value = currentVal;
  }

  const eventTownSelect = $('#admin-filter-town-events');
  if (eventTownSelect) {
    const currentVal = eventTownSelect.value;
    const availableTowns = towns.filter(t => isTownAllowed(t.name));
    eventTownSelect.innerHTML = `<option value="">Todos los municipios autorizados</option>` +
      availableTowns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal && availableTowns.some(t => t.name === currentVal)) eventTownSelect.value = currentVal;
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
    <div class="admin-list-item">
      <div>
        <b style="font-size:15px;">${t.name}</b><br>
        <span class="muted" style="font-size:13px;">${t.province || 'Jaén'}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-action-edit" onclick="editTown('${t.id}')">✏️ Editar</button>
        <button class="btn-action-delete" onclick="deleteTown('${t.id}')">🗑️ Eliminar</button>
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

    if (!name) return notifyWarning('Escribe el nombre del municipio.');

    try {
      $('#save-town').disabled = true;
      $('#save-town').textContent = "Guardando...";

      if (id) {
        await updateDoc(doc(db, "towns", id), { name, province });
        notifySuccess('Municipio actualizado con éxito.');
      } else {
        await addDoc(townsRef, { name, province });
        notifySuccess('Municipio creado con éxito.');
      }

      resetTownForm();
      await loadTowns();
    } catch(err) {
      console.error(err);
      notifyError('Error al guardar municipio', err.message);
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

  const confirmed = await confirmDialog('¿Eliminar municipio?', `¿Seguro que quieres eliminar el municipio "${t.name}"?`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "towns", id));
    notifySuccess(`Municipio "${t.name}" eliminado con éxito.`);
    await loadTowns();
  } catch(err) {
    console.error(err);
    notifyError('Error al eliminar municipio', err.message);
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
    datalist.innerHTML = locations
      .filter(loc => isTownAllowed(loc.town || (loc.name.match(/\(([^)]+)\)$/) ? loc.name.match(/\(([^)]+)\)$/)[1] : '')))
      .map(loc => {
        const disp = getLocationDisplayName(loc);
        return `<option value="${disp}">`;
      }).join('');
  }

  const listEl = $('#venues-list');
  if (!listEl) return;

  const searchQuery = ($('#admin-search-venues') ? $('#admin-search-venues').value : '').toLowerCase().trim();
  const filteredLocations = locations.filter(loc => {
    const locTown = loc.town || (loc.name.match(/\(([^)]+)\)$/) ? loc.name.match(/\(([^)]+)\)$/)[1] : '');
    return isTownAllowed(locTown) && getLocationDisplayName(loc).toLowerCase().includes(searchQuery);
  });

  if (filteredLocations.length === 0) {
    listEl.innerHTML = `<p class="muted">${searchQuery ? 'No hay lugares que coincidan con la búsqueda.' : 'No hay lugares creados o asignados a tus municipios.'}</p>`;
    return;
  }

  listEl.innerHTML = filteredLocations.map(loc => {
    const hasMaps = !!loc.mapsUrl;
    const disp = getLocationDisplayName(loc);
    const metaParts = [];
    if (loc.address) metaParts.push(`📍 ${loc.address}`);
    if (loc.capacity) metaParts.push(`👥 Aforo: ${loc.capacity}`);
    if (loc.phone) metaParts.push(`📞 ${loc.phone}`);
    const metaText = metaParts.length > 0 ? `<br><span class="muted" style="font-size:12px;">${metaParts.join(' · ')}</span>` : '';

    return `
      <div class="admin-list-item">
        <div>
          <b style="font-size:15px;">${disp}</b>
          ${metaText}<br>
          ${hasMaps 
            ? `<a href="${loc.mapsUrl}" target="_blank" style="color:#2563eb; font-size:13px; text-decoration:underline;">Ver en Google Maps ↗</a>` 
            : `<span class="muted" style="font-size:13px;">Sin enlace a Maps</span>`}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-action-edit" onclick="editVenue('${loc.id}')">✏️ Editar</button>
          <button class="btn-action-delete" onclick="deleteVenue('${loc.id}')">🗑️ Eliminar</button>
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
    const address = $('#new-venue-address') ? $('#new-venue-address').value.trim() : '';
    const capacity = $('#new-venue-capacity') ? $('#new-venue-capacity').value.trim() : '';
    const phone = $('#new-venue-phone') ? $('#new-venue-phone').value.trim() : '';

    if (!name) return notifyWarning('Escribe el nombre del lugar.');

    try {
      $('#save-venue').disabled = true;
      $('#save-venue').textContent = "Guardando...";

      const venuePayload = { name, town, mapsUrl, address, capacity, phone };

      if (id) {
        await updateDoc(doc(db, "locations", id), venuePayload);
        notifySuccess('Lugar actualizado con éxito.');
      } else {
        await addDoc(locationsRef, venuePayload);
        notifySuccess('Lugar creado con éxito.');
      }

      resetVenueForm();
      await loadLocations();
    } catch(err) {
      console.error(err);
      notifyError('Error al guardar lugar', err.message);
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
  $('#new-venue-name').value = loc.name;
  if ($('#new-venue-town')) $('#new-venue-town').value = loc.town || 'Úbeda';
  $('#new-venue-maps').value = loc.mapsUrl || '';
  if ($('#new-venue-address')) $('#new-venue-address').value = loc.address || '';
  if ($('#new-venue-capacity')) $('#new-venue-capacity').value = loc.capacity || '';
  if ($('#new-venue-phone')) $('#new-venue-phone').value = loc.phone || '';

  $('#venue-form-title').textContent = "Editar Lugar";
  $('#save-venue').textContent = "Actualizar lugar";
  if ($('#cancel-venue-edit')) $('#cancel-venue-edit').style.display = 'inline-block';
};

window.deleteVenue = async (id) => {
  const loc = locations.find(item => item.id === id);
  if (!loc) return;

  const confirmed = await confirmDialog('¿Eliminar lugar?', `¿Seguro que quieres eliminar el lugar "${getLocationDisplayName(loc)}"?`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "locations", id));
    notifySuccess(`Lugar "${getLocationDisplayName(loc)}" eliminado con éxito.`);
    await loadLocations();
  } catch(err) {
    console.error(err);
    notifyError('Error al eliminar lugar', err.message);
  }
};

if ($('#cancel-venue-edit')) {
  $('#cancel-venue-edit').onclick = resetVenueForm;
}

function resetVenueForm() {
  $('#venue-edit-id').value = '';
  $('#new-venue-name').value = '';
  $('#new-venue-maps').value = '';
  if ($('#new-venue-address')) $('#new-venue-address').value = '';
  if ($('#new-venue-capacity')) $('#new-venue-capacity').value = '';
  if ($('#new-venue-phone')) $('#new-venue-phone').value = '';
  $('#venue-form-title').textContent = "Añadir Nuevo Lugar";
  $('#save-venue').textContent = "Guardar lugar";
  if ($('#cancel-venue-edit')) $('#cancel-venue-edit').style.display = 'none';
}

// ----------------------------------------------------
// GESTIÓN DE EVENTOS
// ----------------------------------------------------
async function loadEvents() {
  try {
    const snapshot = await getDocs(eventsRef);
    events = [];
    snapshot.forEach(docSnap => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderAdminEvents();
    updateSummaryStats();
  } catch (e) {
    console.error("Error al cargar eventos:", e);
  }
}

function getFilteredAdminEvents() {
  const query = ($('#admin-search-events') ? $('#admin-search-events').value : '').toLowerCase().trim();
  const townFilter = ($('#admin-filter-town-events') ? $('#admin-filter-town-events').value : '');

  return events.filter(e => 
    isTownAllowed(e.town) &&
    (!townFilter || e.town === townFilter) &&
    (e.title.toLowerCase().includes(query) ||
     e.category.toLowerCase().includes(query) ||
     (e.venue && e.venue.toLowerCase().includes(query)))
  );
}

function renderAdminEvents() {
  const adminEventsList = $('#admin-events-list');
  if (!adminEventsList) return;

  const adminFilteredEvents = getFilteredAdminEvents();
  const query = ($('#admin-search-events') ? $('#admin-search-events').value : '').toLowerCase().trim();
  const townFilter = ($('#admin-filter-town-events') ? $('#admin-filter-town-events').value : '');

  if (adminFilteredEvents.length === 0) {
    adminEventsList.innerHTML = `<p class="muted">${(query || townFilter) ? 'No hay eventos que coincidan con la búsqueda o filtro seleccionado.' : 'No hay eventos en tus municipios asignados.'}</p>`;
  } else {
    adminEventsList.innerHTML = adminFilteredEvents.map(e => `
      <div class="admin-list-item">
        <div>
          <b style="font-size:15px;">${e.title}</b><br>
          <span class="muted" style="font-size:13px;">${e.category} · ${e.venue} (${getEventDateLabel(e)} · ${e.time}) · <b>${e.town}</b></span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-action-edit" onclick="editEvent('${e.id}')">✏️ Editar</button>
          <button class="btn-action-delete" onclick="deleteEvent('${e.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `).join('');
  }
}

if ($('#admin-search-events')) $('#admin-search-events').oninput = renderAdminEvents;
if ($('#admin-filter-town-events')) $('#admin-filter-town-events').onchange = renderAdminEvents;

if ($('#btn-export-pdf')) {
  $('#btn-export-pdf').onclick = () => exportAgendaPDF();
}

function exportAgendaPDF() {
  const filteredEvents = getFilteredAdminEvents();
  if (filteredEvents.length === 0) {
    return notifyWarning('No hay eventos en la lista filtrada actual para exportar.');
  }

  const townFilterVal = $('#admin-filter-town-events') ? $('#admin-filter-town-events').value : '';
  const searchVal = $('#admin-search-events') ? $('#admin-search-events').value.trim() : '';

  let subtitleParts = [];
  if (townFilterVal) {
    subtitleParts.push(`Municipio: ${townFilterVal}`);
  } else if (currentUserProfile && currentUserProfile.role !== 'superadmin') {
    subtitleParts.push(`Municipios: ${(currentUserProfile.allowedTowns || []).join(', ')}`);
  } else {
    subtitleParts.push('Todos los municipios');
  }

  if (searchVal) {
    subtitleParts.push(`Búsqueda: "${searchVal}"`);
  }

  const subtitleText = `Boletín Oficial de Agenda Cultural (${subtitleParts.join(' · ')})`;

  const container = document.createElement('div');
  container.style.padding = '24px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  container.style.color = '#0f172a';
  container.style.background = '#ffffff';

  const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  let html = `
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h1 style="margin:0; font-size:24px; color:#2563eb; font-weight:800;">Ciudad Viva</h1>
        <p style="margin:3px 0 0; color:#64748b; font-size:13px;">${subtitleText}</p>
      </div>
      <div style="text-align:right; font-size:12px; color:#64748b;">
        <b>Emisión:</b> ${dateStr}<br>
        <b>Actividades exportadas:</b> ${filteredEvents.length}
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9; text-align:left; color:#475569;">
          <th style="padding:8px 10px; border-bottom:2px solid #cbd5e1;">Fecha / Hora</th>
          <th style="padding:8px 10px; border-bottom:2px solid #cbd5e1;">Evento</th>
          <th style="padding:8px 10px; border-bottom:2px solid #cbd5e1;">Categoría</th>
          <th style="padding:8px 10px; border-bottom:2px solid #cbd5e1;">Lugar / Municipio</th>
          <th style="padding:8px 10px; border-bottom:2px solid #cbd5e1;">Entrada</th>
        </tr>
      </thead>
      <tbody>
  `;

  filteredEvents.forEach(e => {
    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding:8px 10px; font-weight:700; color:#1e293b;">${getEventDateLabel(e)}<br><span style="font-weight:normal; font-size:11px; color:#64748b;">${e.time || '20:00'}</span></td>
        <td style="padding:8px 10px;"><b style="font-size:13px; color:#0f172a;">${e.title}</b><br><span style="color:#475569; font-size:11px;">${(e.description || '').slice(0, 90)}${(e.description || '').length > 90 ? '...' : ''}</span></td>
        <td style="padding:8px 10px; font-weight:600; color:#2563eb;">${e.category}</td>
        <td style="padding:8px 10px;">${e.venue}<br><span style="font-weight:600; color:#64748b; font-size:11px;">${e.town}</span></td>
        <td style="padding:8px 10px; font-weight:700; color:#047857;">${e.price}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; color: #94a3b8; font-size: 10px;">
      Ciudad Viva © Plataforma de Agenda Cultural Municipal · Documento generado para ${townFilterVal || 'municipios autorizados'}.
    </div>
  `;

  container.innerHTML = html;

  const pdfName = townFilterVal ? `Agenda_Cultural_${townFilterVal.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf` : `Agenda_Cultural_CiudadViva_${new Date().toISOString().slice(0,10)}.pdf`;

  const opt = {
    margin: 8,
    filename: pdfName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    notifySuccess(`Exportando ${filteredEvents.length} eventos a PDF...`);
    html2pdf().set(opt).from(container).save();
  } else {
    notifyError('Error', 'La librería de exportación a PDF no se ha cargado correctamente.');
  }
}

function updateSummaryStats() {
  const scopedTowns = towns.filter(t => isTownAllowed(t.name));
  const scopedLocations = locations.filter(l => isTownAllowed(l.town || (l.name.match(/\(([^)]+)\)$/) ? l.name.match(/\(([^)]+)\)$/)[1] : '')));
  const scopedEvents = events.filter(e => isTownAllowed(e.town));

  if ($('#summary-towns-count')) $('#summary-towns-count').textContent = scopedTowns.length;
  if ($('#summary-cats-count')) $('#summary-cats-count').textContent = 6;
  if ($('#summary-venues-count')) $('#summary-venues-count').textContent = scopedLocations.length;
  if ($('#summary-events-count')) $('#summary-events-count').textContent = scopedEvents.length;

  const recEventsEl = $('#summary-recent-events');
  if (recEventsEl) {
    if (scopedEvents.length === 0) {
      recEventsEl.innerHTML = `<p class="muted">No hay eventos recientes.</p>`;
    } else {
      recEventsEl.innerHTML = scopedEvents.slice(0, 5).map(e => `
        <div class="admin-list-item-simple">
          <b>${e.title}</b><br>
          <span class="muted" style="font-size:12px;">${e.category} · ${e.venue}</span>
        </div>
      `).join('');
    }
  }

  const recVenuesEl = $('#summary-recent-venues');
  if (recVenuesEl) {
    if (scopedLocations.length === 0) {
      recVenuesEl.innerHTML = `<p class="muted">No hay lugares recientes.</p>`;
    } else {
      recVenuesEl.innerHTML = scopedLocations.slice(0, 5).map(v => `
        <div class="admin-list-item-simple">
          <b>${getLocationDisplayName(v)}</b>
        </div>
      `).join('');
    }
  }
}

if ($('#admin-search-events')) $('#admin-search-events').oninput = renderAdminEvents;
if ($('#admin-search-venues')) $('#admin-search-venues').oninput = renderLocations;

if ($('#btn-new-event')) {
  $('#btn-new-event').onclick = () => {
    resetEventForm();
    $('#event-form-panel').scrollIntoView({ behavior: 'smooth' });
  };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Próximamente';
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const d = new Date(cleanStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function getEventDateLabel(e) {
  if (!e) return 'Próximamente';
  if (e.dateRaw) return formatDateLabel(e.dateRaw);
  if (e.date && e.date.includes('-')) return formatDateLabel(e.date);
  if (e.dateLabel) {
    if (e.dateLabel.includes(',')) return e.dateLabel;
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

  const confirmed = await confirmDialog('¿Eliminar evento?', `¿Seguro que quieres eliminar el evento "${e.title}"?`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "events", id));
    notifySuccess(`Evento "${e.title}" eliminado con éxito.`);
    await loadEvents();
  } catch(err) {
    console.error(err);
    notifyError('Error al eliminar el evento', err.message);
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
    if (!title) return notifyWarning('Escribe un título para el evento.');

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
        notifySuccess('Evento actualizado con éxito.');
      } else {
        eventPayload.createdAt = serverTimestamp();
        await addDoc(eventsRef, eventPayload);
        notifySuccess('Evento publicado en la agenda.');
      }

      resetEventForm();
      loadEvents();
    } catch(err) {
      console.error(err);
      notifyError('Error al guardar el evento', err.message);
    } finally {
      $('#save').disabled = false;
      $('#save').textContent = id ? "Actualizar evento" : "Publicar en la agenda";
    }
  };
}

// ----------------------------------------------------
// SUBIDA DE FOTOS Y COMPRESIÓN EN CANVAS
// ----------------------------------------------------
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
  if (remaining <= 0) return notifyWarning('Máximo 3 imágenes por evento.');

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
    if (thumbsContainer) thumbsContainer.style.display = 'none';
    if (slotsInfo) slotsInfo.textContent = '3 huecos disponibles';
    return;
  }
  if (thumbsContainer) thumbsContainer.style.display = 'grid';
  if (slotsInfo) slotsInfo.textContent = `${3 - uploadedPhotos.length} huecos restantes · Clic para portada`;
  if (thumbsContainer) {
    thumbsContainer.innerHTML = uploadedPhotos.map((item, idx) => `
      <div class="thumb-slot ${item.isPrimary ? 'is-primary' : ''}" onclick="setAsPrimary(${idx})">
        <img src="${item.url}">
        <span class="badge-cover">${item.isPrimary ? '★ Portada' : 'Hacer portada'}</span>
        <button type="button" class="btn-del" onclick="removePhoto(event, ${idx})">✕</button>
      </div>
    `).join('');
  }
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

// ----------------------------------------------------
// GESTIÓN DE USUARIOS Y PERMISOS (RBAC - Exclusivo Superadmin)
// ----------------------------------------------------
async function loadUsers() {
  if (!currentUserProfile || currentUserProfile.role !== 'superadmin') return;
  try {
    const snapshot = await getDocs(usersRef);
    usersList = [];
    snapshot.forEach(docSnap => {
      usersList.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderUsers();
    renderUserTownCheckboxes();
  } catch (e) {
    console.error("Error al cargar usuarios:", e);
  }
}

function renderUsers() {
  const listEl = $('#users-list');
  if (!listEl) return;

  const searchQuery = ($('#admin-search-users') ? $('#admin-search-users').value : '').toLowerCase().trim();
  const filteredUsers = usersList.filter(u => (u.email || '').toLowerCase().includes(searchQuery));

  if (filteredUsers.length === 0) {
    listEl.innerHTML = `<p class="muted">${searchQuery ? 'No hay usuarios que coincidan.' : 'No hay usuarios registrados.'}</p>`;
    return;
  }

  listEl.innerHTML = filteredUsers.map(u => {
    const isSuper = u.role === 'superadmin';
    const townsLabel = isSuper ? 'Todos (*)' : (u.allowedTowns && u.allowedTowns.length ? u.allowedTowns.join(', ') : 'Ninguno');
    const roleBadge = isSuper 
      ? `<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Superadmin</span>` 
      : `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Gestor Municipal</span>`;

    return `
      <div class="admin-list-item">
        <div>
          <b style="font-size:15px;">${u.email || 'Sin email'}</b> ${roleBadge}<br>
          <span class="muted" style="font-size:13px;">Municipios autorizados: <b>${townsLabel}</b></span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-action-edit" onclick="editUserPermissions('${u.id}')">⚙️ Editar Permisos</button>
        </div>
      </div>
    `;
  }).join('');
}

if ($('#admin-search-users')) $('#admin-search-users').oninput = renderUsers;

function renderUserTownCheckboxes(selectedTowns = []) {
  const wrap = $('#user-towns-checkboxes');
  if (!wrap) return;

  if (towns.length === 0) {
    wrap.innerHTML = `<p class="muted" style="margin:0;">No hay municipios registrados en la plataforma.</p>`;
    return;
  }

  wrap.innerHTML = towns.map(t => {
    const isChecked = selectedTowns.includes('*') || selectedTowns.includes(t.name);
    return `
      <label style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:normal; cursor:pointer;">
        <input type="checkbox" class="user-town-cb" value="${t.name}" ${isChecked ? 'checked' : ''}>
        ${t.name}
      </label>
    `;
  }).join('');
}

window.editUserPermissions = (uid) => {
  const u = usersList.find(item => item.id === uid || item.uid === uid);
  if (!u) return;

  $('#user-edit-uid').value = u.id || u.uid;
  $('#user-edit-email').value = u.email || '';
  $('#user-edit-role').value = u.role || 'editor';

  renderUserTownCheckboxes(u.allowedTowns || []);
  toggleTownsGroupVisibility();

  $('#user-form-title').textContent = "Editar Permisos de Usuario";
  if ($('#cancel-user-edit')) $('#cancel-user-edit').style.display = 'inline-block';
};

function toggleTownsGroupVisibility() {
  const roleSelect = $('#user-edit-role');
  const townsGroup = $('#user-towns-group');
  if (roleSelect && townsGroup) {
    townsGroup.style.display = roleSelect.value === 'superadmin' ? 'none' : 'block';
  }
}

if ($('#user-edit-role')) {
  $('#user-edit-role').onchange = toggleTownsGroupVisibility;
}

if ($('#save-user-permissions')) {
  $('#save-user-permissions').onclick = async () => {
    const uid = $('#user-edit-uid').value;
    if (!uid) return notifyWarning('Selecciona un usuario de la lista para editar sus permisos.');

    const role = $('#user-edit-role').value;
    let allowedTowns = [];

    if (role === 'superadmin') {
      allowedTowns = ['*'];
    } else {
      const checkboxes = document.querySelectorAll('.user-town-cb:checked');
      allowedTowns = Array.from(checkboxes).map(cb => cb.value);
      if (allowedTowns.length === 0) {
        return notifyWarning('Debes seleccionar al menos un municipio para este gestor municipal.');
      }
    }

    try {
      $('#save-user-permissions').disabled = true;
      $('#save-user-permissions').textContent = "Guardando...";

      await updateDoc(doc(db, "users", uid), {
        role: role,
        allowedTowns: allowedTowns
      });

      notifySuccess('Permisos de usuario actualizados con éxito.');

      if (currentUserProfile && (currentUserProfile.uid === uid || currentUserProfile.id === uid)) {
        currentUserProfile.role = role;
        currentUserProfile.allowedTowns = allowedTowns;
        updateUserRoleUI();
      }

      await loadUsers();
    } catch (e) {
      console.error("Error al actualizar permisos:", e);
      notifyError('Error al actualizar permisos', e.message);
    } finally {
      $('#save-user-permissions').disabled = false;
      $('#save-user-permissions').textContent = "Guardar Permisos";
    }
  };
}

if ($('#cancel-user-edit')) {
  $('#cancel-user-edit').onclick = () => {
    $('#user-edit-uid').value = '';
    $('#user-edit-email').value = '';
    $('#user-edit-role').value = 'editor';
    renderUserTownCheckboxes([]);
    if ($('#cancel-user-edit')) $('#cancel-user-edit').style.display = 'none';
  };
}

// ----------------------------------------------------
// DETALLE, LIGHTBOX Y COMPARTE DESDE ADMIN
// ----------------------------------------------------
let activeGalleryPhotos = [];
let currentLightboxIdx = 0;

function parseEventDates(e) {
  const dateStr = e.dateRaw || new Date().toISOString().split('T')[0];
  const timeStr = e.time || '20:00';
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] || 2026, month = parts[1] || 9, day = parts[2] || 15;
  const timeParts = (timeStr.includes(':') ? timeStr.split(':') : [20, 0]).map(Number);
  const hours = timeParts[0] || 20, minutes = timeParts[1] || 0;

  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

  const formatICS = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  return { startICS: formatICS(startDate), endICS: formatICS(endDate) };
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
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ciudad Viva//Agenda Cultural//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `SUMMARY:${title}`, `DESCRIPTION:${description}`, `LOCATION:${location}`, `DTSTART:${startICS}`, `DTEND:${endICS}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'
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
      if (result.isConfirmed) window.open(generateGoogleCalendarUrl(e), '_blank');
      else if (result.isDenied) downloadIcsFile(e);
    });
  } else {
    window.open(generateGoogleCalendarUrl(e), '_blank');
  }
}

function getEventShareUrl(e) {
  const url = new URL(window.location.origin + window.location.pathname.replace('admin.html', 'index.html'));
  url.searchParams.set('event', e.id);
  return url.toString();
}

function shareEvent(e) {
  const shareUrl = getEventShareUrl(e);
  const shareText = `¡Mira este plan cultural en Ciudad Viva! "${e.title}" en ${e.venue || e.town}.`;

  if (navigator.share && typeof navigator.share === 'function') {
    navigator.share({ title: e.title, text: shareText, url: shareUrl }).catch(err => {
      if (err.name !== 'AbortError') showCustomShareDialog(e, shareUrl, shareText);
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
          <button id="btn-copy-link-admin" class="btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:14px; font-weight:700; cursor:pointer;">
            📋 Copiar Enlace Directo
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const copyBtn = document.getElementById('btn-copy-link-admin');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              Swal.close();
              notifySuccess('¡Enlace copiado al portapapeles!');
            }).catch(() => {
              prompt('Copia este enlace:', shareUrl);
            });
          };
        }
      }
    });
  }
}

window.openDetail = function(id) {
  let e = events.find(ev => ev.id === id);
  if(!e) return;

  if ($('#dtag')) $('#dtag').textContent = e.category;
  if ($('#dtitle')) $('#dtitle').textContent = e.title;
  if ($('#ddesc')) $('#ddesc').textContent = e.description;
  if ($('#dwhen')) $('#dwhen').textContent = getEventDateLabel(e) + ' · ' + e.time;
  
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

  const btnCal = $('#btn-add-calendar');
  if (btnCal) btnCal.onclick = () => showAddToCalendarDialog(e);

  const btnShare = $('#btn-share-event');
  if (btnShare) btnShare.onclick = () => shareEvent(e);

  const linksEl = $('#modal-links');
  if (linksEl) {
    let linksHtml = `<a href="${mapsUrl}" target="_blank" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:700;">📍 Abrir ubicación en Google Maps ↗</a>`;
    if (e.linkFacebook) linksHtml += `<a href="${e.linkFacebook}" target="_blank">📘 Publicación en Facebook ↗</a>`;
    if (e.linkWeb) linksHtml += `<a href="${e.linkWeb}" target="_blank">🌐 Web Oficial / Venta de Entradas ↗</a>`;
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

window.openLightbox = (index) => {
  if (!activeGalleryPhotos.length) return;
  currentLightboxIdx = index;
  updateLightbox();
  $('#lightbox').classList.add('on');
};

window.closeLightbox = () => $('#lightbox').classList.remove('on');

function updateLightbox() {
  if ($('#lb-img')) $('#lb-img').src = activeGalleryPhotos[currentLightboxIdx];
  if ($('#lb-counter')) $('#lb-counter').textContent = `${currentLightboxIdx + 1} / ${activeGalleryPhotos.length}`;
  const showNav = activeGalleryPhotos.length > 1;
  if ($('.lb-prev')) $('.lb-prev').style.display = showNav ? 'flex' : 'none';
  if ($('.lb-next')) $('.lb-next').style.display = showNav ? 'flex' : 'none';
}

window.prevLightboxPhoto = () => {
  currentLightboxIdx = (currentLightboxIdx - 1 + activeGalleryPhotos.length) % activeGalleryPhotos.length;
  updateLightbox();
};

window.nextLightboxPhoto = () => {
  currentLightboxIdx = (currentLightboxIdx + 1) % activeGalleryPhotos.length;
  updateLightbox();
};

// Carga Inicial de datos para Administración
Promise.all([loadTowns(), loadLocations(), loadEvents()]);
