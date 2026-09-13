// Módulo i18n — Multilingüe (Español / Inglés) para Ciudad Viva

const translations = {
  es: {
    brand_subtitle: "Agenda cultural y planes de ocio en la comarca",
    hero_title: "¿Qué hacer hoy?",
    hero_subtitle: "Descubre eventos, rutas, conciertos y actividades programadas para los próximos días.",
    search_placeholder: "Buscar por título, temática o artista...",
    all_towns: "Todos los municipios",
    btn_near_me: "Cerca de mí",
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
    btn_install_short: "Instalar App",
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
    modal_calendar: `<i class="fa-regular fa-calendar-plus"></i> Añadir a mi calendario`,
    modal_favorite: `<i class="fa-regular fa-heart"></i> Guardar`,
    modal_favorite_active: `<i class="fa-solid fa-heart" style="color:#ef4444;"></i> Guardado`,
    modal_share: `<i class="fa-solid fa-share-nodes"></i> Compartir`,
    maps_link: `<i class="fa-solid fa-map-pin"></i> Abrir ubicación en Google Maps ↗`,
    fb_link: `<i class="fa-brands fa-facebook"></i> Publicación en Facebook ↗`,
    web_link: `<i class="fa-solid fa-globe"></i> Web Oficial / Venta de Entradas ↗`,
    town_events_title: "Próximas actividades en",
    town_modal_events: "Eventos programados",
    town_modal_venues: "Espacios culturales",
    town_modal_btn: "Filtrar agenda por este municipio",
    no_events: "No se encontraron eventos con los filtros seleccionados.",
    section_title: "Agenda disponible",
    view_list: "📋 Lista",
    view_map: "🗺️ Mapa",
    btn_export_pdf: "📄 Exportar PDF",
    pdf_title: "Programa Cultural y Agenda de Ocio",
    pdf_generated: "Generado el",
    share_modal_title: "Compartir Evento",
    share_ws: "📲 Compartir por WhatsApp",
    share_tg: "✈️ Compartir por Telegram",
    share_x: "🈁 Compartir en X (Twitter)",
    share_copy: "📋 Copiar Enlace Directo",
    share_copied: "¡Enlace copiado al portapapeles!"
  },
  en: {
    brand_subtitle: "Cultural agenda & leisure activities in the region",
    hero_title: "What to do today?",
    hero_subtitle: "Discover events, tours, concerts and activities scheduled for the upcoming days.",
    search_placeholder: "Search by title, category or artist...",
    all_towns: "All towns",
    btn_near_me: "Near me",
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
    btn_install_short: "Install App",
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
    modal_calendar: `<i class="fa-regular fa-calendar-plus"></i> Add to my calendar`,
    modal_favorite: `<i class="fa-regular fa-heart"></i> Save`,
    modal_favorite_active: `<i class="fa-solid fa-heart" style="color:#ef4444;"></i> Saved`,
    modal_share: `<i class="fa-solid fa-share-nodes"></i> Share`,
    maps_link: `<i class="fa-solid fa-map-pin"></i> Open location on Google Maps ↗`,
    fb_link: `<i class="fa-brands fa-facebook"></i> Facebook Event Post ↗`,
    web_link: `<i class="fa-solid fa-globe"></i> Official Web / Tickets ↗`,
    town_events_title: "Upcoming activities in",
    town_modal_events: "Scheduled events",
    town_modal_venues: "Cultural venues",
    town_modal_btn: "Filter agenda for this town",
    no_events: "No events found matching the selected filters.",
    section_title: "Available Agenda",
    view_list: "📋 List",
    view_map: "🗺️ Map",
    btn_export_pdf: "📄 Export PDF",
    pdf_title: "Cultural Program & Leisure Agenda",
    pdf_generated: "Generated on",
    share_modal_title: "Share Event",
    share_ws: "📲 Share via WhatsApp",
    share_tg: "✈️ Share via Telegram",
    share_x: "🈁 Share on X (Twitter)",
    share_copy: "📋 Copy Direct Link",
    share_copied: "Link copied to clipboard!"
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

export function getCategoryIconHtml(categoryName) {
  if (!categoryName) return '<i class="fa-solid fa-tag"></i>';
  const name = categoryName.toLowerCase().trim();
  if (name.includes('música') || name.includes('musica') || name.includes('concierto')) {
    return '<i class="fa-solid fa-music"></i>';
  }
  if (name.includes('patrimonio') || name.includes('historia') || name.includes('monumento')) {
    return '<i class="fa-solid fa-building-columns"></i>';
  }
  if (name.includes('gastronomía') || name.includes('gastronomia') || name.includes('tapas') || name.includes('comida')) {
    return '<i class="fa-solid fa-utensils"></i>';
  }
  if (name.includes('taller') || name.includes('arte') || name.includes('artesanía') || name.includes('artesania')) {
    return '<i class="fa-solid fa-palette"></i>';
  }
  if (name.includes('cine') || name.includes('película') || name.includes('pelicula') || name.includes('proyección')) {
    return '<i class="fa-solid fa-clapperboard"></i>';
  }
  if (name.includes('deporte') || name.includes('carrera') || name.includes('senderismo') || name.includes('ruta')) {
    return '<i class="fa-solid fa-person-running"></i>';
  }
  if (name.includes('teatro') || name.includes('danza') || name.includes('espectáculo') || name.includes('espectaculo')) {
    return '<i class="fa-solid fa-masks-theater"></i>';
  }
  if (name.includes('infantil') || name.includes('familia') || name.includes('niños')) {
    return '<i class="fa-solid fa-child-reaching"></i>';
  }
  if (name.includes('fiesta') || name.includes('feria') || name.includes('verbena')) {
    return '<i class="fa-solid fa-champagne-glasses"></i>';
  }
  if (name.includes('naturaleza') || name.includes('medio ambiente')) {
    return '<i class="fa-solid fa-tree"></i>';
  }
  return '<i class="fa-solid fa-tag"></i>';
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
