# 🌟 Ciudad Viva — Agenda Cultural y Planes de Ocio

**Ciudad Viva** es la plataforma web progresiva (PWA) de referencia para la gestión y difusión de la agenda cultural, ocio y actividades sociales en la comarca. Conecta a la ciudadanía con la oferta cultural de sus municipios de forma intuitiva, accesible y actualizada en tiempo real.

---

## 🌐 Enlaces de Acceso Público (Provisionales)

- 📲 **Vista Ciudadana (Web & PWA Instalable):** [https://ciudad-viva-1c19f.web.app](https://ciudad-viva-1c19f.web.app)
- ⚙️ **Panel de Administración:** [https://ciudad-viva-1c19f.web.app/admin.html](https://ciudad-viva-1c19f.web.app/admin.html)
- 🔗 **Dominio alternativo Firebase:** [https://ciudad-viva-1c19f.firebaseapp.com](https://ciudad-viva-1c19f.firebaseapp.com)

---

## ✨ Características Principales

### 📲 1. Progressive Web App (PWA Instalable & Offline)
- **Instalación en 1-Clic:** Incluye un botón interactivo **"📲 Instalar App"** en la cabecera que lanza el instalador nativo del navegador (Android/Chrome/Desktop) o un desplegable instructivo para iOS Safari (*Añadir a la pantalla de inicio*).
- **Modo Offline:** Mediante Service Worker (`sw.js`) y `manifest.json`, la aplicación ofrece carga ultra-rápida y soporte básico sin conexión.

### ⭐ 2. Eventos Destacados en Portada
- Marcación de eventos como `⭐ Destacado en Portada` desde el panel de administración.
- Insignia dorada visual sobre los eventos recomendados y ordenación prioritaria automática en la agenda.

### 🏰 3. Fichas Interactivas de Municipio
- Al hacer clic en cualquier localidad (`🏰 Úbeda`, `🏰 Baeza`, etc.), se abre un modal dinámico con el resumen de la oferta cultural del municipio, número de recintos y listado de sus próximos eventos.

### 🏷️ 4. Categorías Dinámicas & Filtros Avanzados
- Chips deslizables por temática (Música, Teatro, Cine, Ferias, Infantil, Exposiciones...).
- Filtros combinados por municipio, rango de fechas (incluyendo fechas de inicio y fin para exposiciones) y buscador predictivo por título, artista o recinto.

### 🎨 5. Identidad Visual y Modo Oscuro
- Logotipo oficial maximizado (Pin de Ubicación con Nota Musical y destellos solares).
- Conmutador de tema `🌙 Modo Oscuro / ☀️ Modo Claro` con persistencia de preferencia.

### 🛠️ 6. Panel de Gestión (Admin)
- Control CRUD completo para gestores culturales (creación, modificación y borrado de eventos, recintos, municipios y categorías).
- Carga de imágenes por URL y fechas extendidas para eventos de múltiples días.

---

## 💻 Arquitectura Tecnológica

- **Frontend:** HTML5 semántico, CSS3 moderno (Custom Properties, Grid & Flexbox) y JS ES Modules.
- **Base de Datos en Tiempo Real:** Cloud Firestore (`events`, `locations`, `towns`, `categories`).
- **Librerías Auxiliares:** SweetAlert2 (Modales interactivos) y html2pdf.js (Exportación de fichas/programas).
- **Despliegue & Hosting:** Firebase Hosting con CDN global y certificado SSL automático.

---

## 🚀 Desarrollo Local y Despliegue

### Requisitos
- Node.js (opcional, para servidor estático local).

### Iniciar en local
```bash
# Servidor local simple
npx http-server -p 8080
```
Acceder a `http://127.0.0.1:8080/`

### Desplegar a producción (Firebase Hosting)
```bash
npx firebase-tools deploy --only hosting
```

---

*Desarrollado para potenciar la vida cultural y el turismo local.*
