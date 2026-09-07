import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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
const auth = getAuth(app);

const eventsRef = collection(db, "events");
const locationsRef = collection(db, "locations");
const townsRef = collection(db, "towns");
const usersRef = collection(db, "users");

let selectedCategory = '';
let events = [];
let locations = [];
let towns = [];
let usersList = [];
let currentUserProfile = null;
let uploadedPhotos = [];
let activeGalleryPhotos = [];
let currentLightboxIdx = 0;

// Scroll Infinito
let visibleCount = 6;
let observer = null;

const $ = s => document.querySelector(s);

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
  draw();
  updateSummaryStats();
}

// Formulario de Login tradicional (Email / Password)
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
    const availableTowns = towns.filter(t => isTownAllowed(t.name));
    venueTownSelect.innerHTML = availableTowns.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (currentVal && availableTowns.some(t => t.name === currentVal)) venueTownSelect.value = currentVal;
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

async function seedDatabase(force = false) {
  try {
    const btn = $('#btn-seed-data');
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Generando 30 Eventos y 20 Lugares..."; }

    if (force) {
      const evSnap = await getDocs(eventsRef);
      for (const d of evSnap.docs) { await deleteDoc(doc(db, "events", d.id)); }
      
      const locSnap = await getDocs(locationsRef);
      for (const d of locSnap.docs) { await deleteDoc(doc(db, "locations", d.id)); }
    }

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
      const dateLabel = formatDateLabel(dateRaw);
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
          <span class="pill-time">${getEventDateLabel(e)} · ${e.time || ''}</span>
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
            <span class="muted">${getEventDateLabel(e)}</span>
            <button class="btn-detail" onclick="openDetail('${e.id}')">Ver ficha →</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const sentinelText = $('#sentinel-text');
  if (sentinelText) {
    if (visibleCount >= shown.length) {
      sentinelText.textContent = shown.length > 0 ? "✓ Has llegado al final de la agenda." : "No hay actividades disponibles.";
    } else {
      sentinelText.textContent = `Mostrando ${visibleCount} de ${shown.length} eventos (Desplaza para cargar más...)`;
    }
  }

  setupScrollObserver(shown.length);

  const adminEventsList = $('#admin-events-list');
  if (adminEventsList) {
    const adminSearchQuery = ($('#admin-search-events') ? $('#admin-search-events').value : '').toLowerCase().trim();
    const adminFilteredEvents = events.filter(e => 
      isTownAllowed(e.town) &&
      (e.title.toLowerCase().includes(adminSearchQuery) ||
       e.category.toLowerCase().includes(adminSearchQuery) ||
       (e.venue && e.venue.toLowerCase().includes(adminSearchQuery)))
    );

    if (adminFilteredEvents.length === 0) {
      adminEventsList.innerHTML = `<p class="muted">${adminSearchQuery ? 'No hay eventos que coincidan con la búsqueda.' : 'No hay eventos en tus municipios asignados.'}</p>`;
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
        <div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
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
  $('#dwhen').textContent = getEventDateLabel(e) + ' · ' + e.time;
  
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
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
        <div>
          <b style="font-size:15px; color:#0f172a;">${u.email || 'Sin email'}</b> ${roleBadge}<br>
          <span class="muted" style="font-size:13px;">Municipios autorizados: <b>${townsLabel}</b></span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" style="padding:6px 12px; font-size:13px;" onclick="editUserPermissions('${u.id}')">Editar Permisos</button>
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
    if (!uid) return alert('Selecciona un usuario de la lista para editar sus permisos.');

    const role = $('#user-edit-role').value;
    let allowedTowns = [];

    if (role === 'superadmin') {
      allowedTowns = ['*'];
    } else {
      const checkboxes = document.querySelectorAll('.user-town-cb:checked');
      allowedTowns = Array.from(checkboxes).map(cb => cb.value);
      if (allowedTowns.length === 0) {
        return alert('Debes seleccionar al menos un municipio para este gestor municipal.');
      }
    }

    try {
      $('#save-user-permissions').disabled = true;
      $('#save-user-permissions').textContent = "Guardando...";

      await updateDoc(doc(db, "users", uid), {
        role: role,
        allowedTowns: allowedTowns
      });

      const toast = $('#toast-user');
      if (toast) {
        toast.style.display = 'inline-block';
        setTimeout(() => toast.style.display = 'none', 3000);
      }

      if (currentUserProfile && (currentUserProfile.uid === uid || currentUserProfile.id === uid)) {
        currentUserProfile.role = role;
        currentUserProfile.allowedTowns = allowedTowns;
        updateUserRoleUI();
      }

      await loadUsers();
    } catch (e) {
      console.error("Error al actualizar permisos:", e);
      alert("Error al actualizar permisos: " + e.message);
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

// Carga Inicial
Promise.all([loadTowns(), loadLocations(), loadEvents()]);