// Módulo i18n — Multilingüe (Español / Inglés) para Ciudad Viva

const translations = {
  es: {
    brand_subtitle: "Agenda cultural y planes de ocio en la comarca",
    hero_title: "¿Qué hacer hoy?",
    hero_subtitle: "Descubre eventos, rutas, conciertos y actividades programadas para los próximos días.",
    search_placeholder: "Buscar por título, temática o artista...",
    all_towns: "Todos los municipios",
    all_dates: "🗓️ Todas las fechas",
    date_today: "Hoy",
    date_tomorrow: "Mañana",
    date_weekend: "Este fin de semana",
    date_7days: "Próximos 7 días",
    date_30days: "Próximos 30 días",
    all_categories: "Todas las categorías",
    filter_free: "Solo gratuitos",
    filter_featured: "⭐ Destacados",
    btn_install: "📲 Instalar App",
    theme_dark: "🌙 Modo Oscuro",
    theme_light: "☀️ Modo Claro",
    lang_btn: "🇬🇧 EN",
    btn_detail: "Ver detalle →",
    badge_featured: "⭐ Destacado",
    badge_free: "Gratis",
    modal_when: "Cuándo",
    modal_where: "Dónde",
    modal_about: "Sobre la actividad",
    modal_venue_info: "Información del Espacio / Recinto",
    modal_calendar: "📅 Añadir a mi calendario",
    modal_favorite: "🤍 Guardar",
    modal_favorite_active: "❤️ En favoritos",
    modal_share: "🔗 Compartir",
    maps_link: "📍 Abrir ubicación en Google Maps ↗",
    fb_link: "📘 Publicación en Facebook ↗",
    web_link: "🌐 Web Oficial / Venta de Entradas ↗",
    town_events_title: "Próximas actividades en",
    town_modal_events: "Eventos programados",
    town_modal_venues: "Espacios culturales",
    town_modal_btn: "Filtrar agenda por este municipio",
    no_events: "No se encontraron eventos con los filtros seleccionados."
  },
  en: {
    brand_subtitle: "Cultural agenda & leisure activities in the region",
    hero_title: "What to do today?",
    hero_subtitle: "Discover events, tours, concerts and activities scheduled for the upcoming days.",
    search_placeholder: "Search by title, category or artist...",
    all_towns: "All towns",
    all_dates: "🗓️ All dates",
    date_today: "Today",
    date_tomorrow: "Tomorrow",
    date_weekend: "This weekend",
    date_7days: "Next 7 days",
    date_30days: "Next 30 days",
    all_categories: "All categories",
    filter_free: "Free only",
    filter_featured: "⭐ Featured",
    btn_install: "📲 Install App",
    theme_dark: "🌙 Dark Mode",
    theme_light: "☀️ Light Mode",
    lang_btn: "🇪🇸 ES",
    btn_detail: "View details →",
    badge_featured: "⭐ Featured",
    badge_free: "Free",
    modal_when: "When",
    modal_where: "Where",
    modal_about: "About this activity",
    modal_venue_info: "Venue / Location Info",
    modal_calendar: "📅 Add to my calendar",
    modal_favorite: "🤍 Save",
    modal_favorite_active: "❤️ Saved",
    modal_share: "🔗 Share",
    maps_link: "📍 Open location on Google Maps ↗",
    fb_link: "📘 Facebook Event Post ↗",
    web_link: "🌐 Official Web / Tickets ↗",
    town_events_title: "Upcoming activities in",
    town_modal_events: "Scheduled events",
    town_modal_venues: "Cultural venues",
    town_modal_btn: "Filter agenda for this town",
    no_events: "No events found matching the selected filters."
  }
};

const categoryTranslations = {
  en: {
    "Música": "Music",
    "Teatro": "Theater",
    "Patrimonio": "Heritage & Tours",
    "Exposiciones": "Exhibitions",
    "Infantil": "Kids & Family",
    "Gastronomía": "Gastronomy",
    "Deporte": "Sports",
    "Cine": "Cinema",
    "Fiestas": "Festivals & Fairs",
    "Conferencias": "Talks & Workshops",
    "Danza": "Dance",
    "Arte": "Art & Culture"
  }
};

let currentLang = localStorage.getItem('cv_lang') || 'es';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('cv_lang', lang);
  updateDOMTranslations();
}

export function toggleLang() {
  setLang(currentLang === 'es' ? 'en' : 'es');
}

export function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations['es'][key] || key;
}

export function translateCategory(catName) {
  if (currentLang === 'en' && categoryTranslations.en[catName]) {
    return categoryTranslations.en[catName];
  }
  return catName;
}

export function translatePrice(priceText) {
  if (!priceText) return '';
  if (currentLang === 'en') {
    if (priceText.toLowerCase().includes('gratis') || priceText.toLowerCase().includes('libre')) {
      return 'Free';
    }
  }
  return priceText;
}

export function updateDOMTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang] && translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLang] && translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });

  const btnEs = document.getElementById('lang-btn-es');
  const btnEn = document.getElementById('lang-btn-en');
  if (btnEs && btnEn) {
    if (currentLang === 'es') {
      btnEs.classList.add('active');
      btnEn.classList.remove('active');
    } else {
      btnEs.classList.remove('active');
      btnEn.classList.add('active');
    }
  }
}
