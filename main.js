// js/main.js

let newsModal;
let newsModalTitle;
let newsModalDate;
let newsModalBody;

document.addEventListener("DOMContentLoaded", () => {
  initNewsModal();   // preparar el modal de noticias

  cargarBlogs();
  cargarNoticias();
  cargarTalleres();
});

// ===========================
// CARGA DESDE API
// ===========================
async function cargarDesdeAPI(tipo, contenedorId) {
  try {
    const resp = await fetch(`/.netlify/functions/posts?tipo=${tipo}`);
    if (!resp.ok) throw new Error("Error al obtener " + tipo);

    const cont = document.getElementById(contenedorId);
    if (!cont) return;

    cont.innerHTML = "";

    const posts = await resp.json();

    if (!posts.length) {
      cont.innerHTML = "<p>No hay registros aún.</p>";
      return;
    }

    posts.forEach((p) => {
      if (tipo === "noticia" && contenedorId === "lista-noticias") {
        crearTarjetaNoticia(p, cont);
      } else {
        crearTarjetaGenerica(p, cont);
      }
    });
  } catch (err) {
    console.error(err);
    const cont = document.getElementById(contenedorId);
    if (cont) {
      cont.innerHTML = "<p>Error al cargar datos.</p>";
    }
  }
}

// Tarjetas para blogs / talleres (comportamiento viejo)
function crearTarjetaGenerica(p, contenedor) {
  const card = document.createElement("div");
  card.classList.add("card");

  const titulo = document.createElement("h3");
  titulo.textContent = p.titulo;

  const contenido = document.createElement("p");
  contenido.innerHTML = formatearTextoConLinks(p.contenido || "");

  const fecha = document.createElement("small");
  fecha.textContent = formatearFecha(p.creado_en);

  card.appendChild(titulo);
  card.appendChild(contenido);
  card.appendChild(fecha);

  contenedor.appendChild(card);
}

// Tarjetas específicas para NOTICIAS (resumen + botón → modal)
function crearTarjetaNoticia(p, contenedor) {
  const card = document.createElement("div");
  card.classList.add("card");

  const titulo = document.createElement("h3");
  titulo.textContent = p.titulo;

  const fullText = p.contenido || "";

  const contenido = document.createElement("p");
  contenido.classList.add("news-excerpt");
  contenido.textContent = getExcerpt(fullText, 360); // máx 360 caracteres aprox

  const readMoreBtn = document.createElement("button");
  readMoreBtn.type = "button";
  readMoreBtn.className = "news-read-more";
  readMoreBtn.textContent = "Leer noticia completa";

  const fecha = document.createElement("small");
  fecha.textContent = formatearFecha(p.creado_en);

  // guardamos el texto completo en la card para usarlo en el modal
  card.dataset.fullText = fullText;

  // ensamblamos la tarjeta
  card.appendChild(titulo);
  card.appendChild(contenido);
  card.appendChild(readMoreBtn);
  card.appendChild(fecha);

  // al hacer clic, abrimos el modal con esa noticia
  readMoreBtn.addEventListener("click", () => abrirModalNoticiaDesdeCard(card));

  contenedor.appendChild(card);
}

// ===========================
// UTILIDADES
// ===========================

// Convierte texto normal en HTML seguro con links como botoncitos
function formatearTextoConLinks(texto) {
  if (!texto) return "";

  // escapamos HTML básico
  let safe = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // URLs tipo http(s)://...
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // cambiamos cada URL por un botón
  safe = safe.replace(
    urlRegex,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-enlace">📎 Abrir enlace</a>`
  );

  // saltos de línea → <br>
  safe = safe.replace(/\r?\n/g, "<br>");

  return safe;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  try {
    return new Date(fechaIso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// recorta un texto a X caracteres y agrega "…"
function getExcerpt(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "…";
}

// ===========================
// MODAL DE NOTICIAS
// ===========================
function initNewsModal() {
  newsModal = document.getElementById("news-modal");
  if (!newsModal) return;

  newsModalTitle = document.getElementById("news-modal-title");
  newsModalDate = document.getElementById("news-modal-date");
  newsModalBody = document.getElementById("news-modal-body");

  const backdrop = newsModal.querySelector(".news-modal-backdrop");
  const closeBtn = newsModal.querySelector(".news-modal-close");

  const close = () => cerrarNewsModal();

  if (backdrop) backdrop.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && newsModal.classList.contains("is-open")) {
      cerrarNewsModal();
    }
  });
}

function abrirModalNoticiaDesdeCard(card) {
  if (!newsModal) return;

  const titleEl = card.querySelector("h3");
  const dateEl = card.querySelector("small");
  const fullText = card.dataset.fullText || "";

  if (newsModalTitle) {
    newsModalTitle.textContent = titleEl ? titleEl.textContent : "Detalle de la noticia";
  }
  if (newsModalDate) {
    newsModalDate.textContent = dateEl ? dateEl.textContent : "";
  }
  if (newsModalBody) {
    newsModalBody.innerHTML = formatearTextoConLinks(fullText);
  }

  newsModal.classList.add("is-open");
  newsModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function cerrarNewsModal() {
  if (!newsModal) return;
  newsModal.classList.remove("is-open");
  newsModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// ===========================
// WRAPPERS DE CARGA PÚBLICOS
// ===========================
function cargarBlogs() {
  cargarDesdeAPI("blog", "lista-blogs");
}

function cargarNoticias() {
  cargarDesdeAPI("noticia", "lista-noticias");
}

function cargarTalleres() {
  cargarDesdeAPI("taller", "lista-talleres");
}

// MANTENIMIENTO: modal/banner con persistencia en localStorage
(function () {
  // CONFIGURA ESTAS FECHAS/MENSAJE según necesites
  const maintenance = {
    start: new Date('2025-11-27T00:00:00'), // inicio (sin hora = medianoche)
    end:   new Date('2025-11-28T23:59:59'), // fin
    message: 'Mantenimiento Programado para el 27 a 28 de noviembre del 2025. Durante este periodo algunos servicios podrían no estar disponibles.',
    storageKey: 'ceinfua_maintenance_dismissed_until' // clave almacenamiento
  };

  // Decide si mostrar
  function shouldShow() {
    const now = new Date();
    if (now < maintenance.start) return true;   // si querés mostrar también antes del inicio
    if (now > maintenance.end) return false;
    // revisa storage para no mostrar si el usuario ya cerró
    const dismissedUntil = localStorage.getItem(maintenance.storageKey);
    if (!dismissedUntil) return true;
    const until = new Date(dismissedUntil);
    return now > until ? true : false;
  }

  // Helper: muestra modal
  function showModal() {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    // focus trap: poner foco en el primer botón
    const btn = overlay.querySelector('#maintenanceDismiss');
    if (btn) btn.focus();
  }

  // Hide modal
  function hideModal() {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
  }

  // Banner handlers (si usás banner)
  function showBanner() {
    const banner = document.getElementById('maintenance-banner');
    if (!banner) return;
    banner.style.display = 'block';
  }
  function hideBanner() {
    const banner = document.getElementById('maintenance-banner');
    if (!banner) return;
    banner.style.display = 'none';
  }

  // On DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Si no existen los nodos, nada que mostrar
    const overlay = document.getElementById('maintenance-overlay');
    const banner = document.getElementById('maintenance-banner');

    // Decide si mostrar (y que aún no pasó el maintenance.end)
    const now = new Date();
    if (now > maintenance.end) return; // todo pasado, no mostrar

    // Si user marcó "no mostrar hasta X", respeta
    const dismissed = localStorage.getItem(maintenance.storageKey);
    if (dismissed) {
      const until = new Date(dismissed);
      if (now <= until) return; // no mostrar
    }

    // Elige modal si existe overlay, sino banner
    if (overlay) {
      // Inyecta el mensaje dinámicamente (opcional)
      const msg = document.getElementById('maintenance-message');
      if (msg) msg.innerHTML = maintenance.message;

      // Mostrar modal
      showModal();

      // botones
      const dismissBtn = document.getElementById('maintenanceDismiss');
      const remindBtn = document.getElementById('maintenanceRemind');
      const closeX = document.getElementById('maintenanceClose');

      // Dismiss = guardar hasta fin de maintenance
      if (dismissBtn) dismissBtn.addEventListener('click', () => {
        // guardar hasta después del fin del mantenimiento para que no vuelva a aparecer
        localStorage.setItem(maintenance.storageKey, maintenance.end.toISOString());
        hideModal();
      });

      // Remind later = recordar después de 24 horas (ejemplo)
      if (remindBtn) remindBtn.addEventListener('click', () => {
        const remindUntil = new Date();
        remindUntil.setDate(remindUntil.getDate() + 1); // 1 día
        localStorage.setItem(maintenance.storageKey, remindUntil.toISOString());
        hideModal();
      });

      // X (cerrar): solo cerrar ahora y recordar 4 horas (ejemplo)
      if (closeX) closeX.addEventListener('click', () => {
        const until = new Date();
        until.setHours(until.getHours() + 4);
        localStorage.setItem(maintenance.storageKey, until.toISOString());
        hideModal();
      });

      // Cerrar con ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // como si presionara la X
          const until = new Date();
          until.setHours(until.getHours() + 4);
          localStorage.setItem(maintenance.storageKey, until.toISOString());
          hideModal();
        }
      });
    } else if (banner) {
      // Si usás banner
      showBanner();
      const closeBannerBtn = document.getElementById('maintenanceBannerClose');
      if (closeBannerBtn) closeBannerBtn.addEventListener('click', () => {
        // guardamos hasta fin del maintenance (o 24h, según prefieras)
        localStorage.setItem(maintenance.storageKey, maintenance.end.toISOString());
        hideBanner();
      });
    }
  });
})();
4114
